"""Vista de solo lectura del socio (TX8, EX4, N2, N17).

    celular ──POST /socio/reto (llave del socio)──► reto de un solo uso (2 min)
    celular ──POST /socio/datos {reto, firma del socio}──► solo los datos de ese socio

La respuesta nunca trae datos de otro socio ni del grupo: lo que ha ahorrado en el ciclo, sus
aportes, lo que le falta pagar y la fecha hasta la que van los datos. Vocabulario de N2:
nunca "saldo" ni "cuenta". Llave revocada o celular retirado: no hay datos.
"""

import datetime
import secrets

from django.db import transaction
from django.utils import timezone

from acap.models import Ciclo, Reunion
from core import firmas
from cuentas.models import LlaveSocio
from libro import servicio as libro
from libro.models import EstadoMovimiento, Movimiento, Prestamo
from sync.bajada import BajadaRechazada
from sync.models import Reto

VIGENCIA_RETO = datetime.timedelta(minutes=2)
E = EstadoMovimiento


def emitir_reto(llave: LlaveSocio, ahora=None) -> str:
    ahora = ahora or timezone.now()
    valor = secrets.token_urlsafe(32)
    Reto.objects.create(
        valor=valor,
        dispositivo=llave.dispositivo,
        llave_socio=llave,
        vence_en=ahora + VIGENCIA_RETO,
    )
    return valor


def mensaje(reto: str) -> dict:
    return {"pedido": "socio", "reto": reto}


@transaction.atomic
def usar_reto(*, llave: LlaveSocio, reto: str, firma: str, ahora=None) -> None:
    ahora = ahora or timezone.now()
    registro = Reto.objects.select_for_update().filter(valor=reto, llave_socio=llave).first()
    if registro is None or registro.usado_en is not None or registro.vence_en <= ahora:
        raise BajadaRechazada("RETO_INVALIDO")
    if not firmas.verificar(llave.llave_publica, mensaje(reto), firma):
        raise BajadaRechazada("FIRMA_INVALIDA")
    registro.usado_en = ahora
    registro.save(update_fields=["usado_en"])
    if llave.revocada_en is not None or not llave.dispositivo.activo:
        raise BajadaRechazada("ACCESO_RETIRADO", estado_http=410)


def _es_ahorro(mov: Movimiento) -> bool:
    return mov.tipo == Movimiento.Tipo.AHORRO or (
        mov.tipo == Movimiento.Tipo.REVERSO
        and (mov.detalle or {}).get("tipo_original") == Movimiento.Tipo.AHORRO
    )


def datos_del_socio(llave: LlaveSocio) -> dict:
    membresia = llave.membresia
    titular = membresia.titular_id
    ciclo = Ciclo.objects.filter(acap_id=membresia.acap_id, estado=Ciclo.Estado.ACTIVO).first()
    respuesta = {
        "formato": 1,
        "numero": membresia.numero_miembro,
        "datos_hasta": None,
        "ahorrado_ciclo": 0,
        "aportes": [],
        "prestamo": None,
    }
    if ciclo is None:
        return respuesta
    ultima = Reunion.objects.filter(ciclo=ciclo).order_by("-fecha").first()
    respuesta["datos_hasta"] = ultima.fecha.isoformat() if ultima else None
    movimientos = (
        Movimiento.objects.con_estado()
        .filter(reunion__ciclo=ciclo, titular_id=titular)
        .exclude(estado__in=[E.RECHAZADO, E.EN_CONFLICTO])
        .select_related("reunion")
        .order_by("-reunion__fecha", "-creado_en")
    )
    for mov in movimientos:
        if not _es_ahorro(mov):
            continue
        respuesta["ahorrado_ciclo"] += mov.monto
        if mov.tipo == Movimiento.Tipo.AHORRO:
            respuesta["aportes"].append(
                {
                    "fecha": mov.reunion.fecha.isoformat(),
                    "acciones": (mov.detalle or {}).get("acciones", 0),
                    "pesos": mov.monto,
                    "estado": "confirmado" if mov.estado == E.CONFIRMADO else "guardado",
                }
            )
    for prestamo in Prestamo.objects.filter(ciclo=ciclo, titular_id=titular):
        saldo = libro.saldo_prestamo(prestamo)
        if saldo > 0:
            respuesta["prestamo"] = {
                "me_falta_pagar": saldo,
                "cuota": prestamo.cuota_mensual,
                "num_cuotas": prestamo.num_cuotas,
            }
    return respuesta
