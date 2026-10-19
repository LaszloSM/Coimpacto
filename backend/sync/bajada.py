"""Bajada de los datos del grupo al celular de la reunión (TX6.0).

    celular ──POST /sync/reto──► número de un solo uso (2 min)
    celular ──POST /sync/grupo {reto, firma del celular}──► foto del grupo

Solo lo necesario para llevar la reunión (Habeas Data, Ley 1581): números de miembro e ids
seudónimos, el nombre corto de quien autorizó sus datos (D3), configuración del ciclo, cargos,
reuniones, ahorro acumulado y préstamos vigentes. Sin nombres completos, cédulas ni teléfonos.
Un celular retirado no recibe datos (E3).
"""

import datetime
import secrets

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from acap.models import Cargo, Ciclo, Membresia, Reunion
from core import firmas
from cuentas import miembros
from cuentas.models import Dispositivo
from libro import comprobantes
from libro import servicio as libro
from libro.models import EstadoMovimiento, Movimiento, Prestamo
from sync import propuestas
from sync.models import Reto

VIGENCIA_RETO = datetime.timedelta(minutes=2)
E = EstadoMovimiento


class BajadaRechazada(Exception):
    def __init__(self, codigo: str, estado_http: int = 401):
        super().__init__(codigo)
        self.codigo = codigo
        self.estado_http = estado_http


def emitir_reto(dispositivo: Dispositivo, ahora=None) -> str:
    ahora = ahora or timezone.now()
    valor = secrets.token_urlsafe(32)
    Reto.objects.create(valor=valor, dispositivo=dispositivo, vence_en=ahora + VIGENCIA_RETO)
    return valor


def mensaje_bajada(reto: str) -> dict:
    """Lo que firma el celular para pedir el grupo (JCS, core.firmas)."""
    return {"pedido": "grupo", "reto": reto}


@transaction.atomic
def usar_reto(*, dispositivo: Dispositivo, reto: str, firma: str, ahora=None) -> None:
    ahora = ahora or timezone.now()
    registro = (
        Reto.objects.select_for_update()
        .filter(valor=reto, dispositivo=dispositivo, llave_socio__isnull=True)
        .first()
    )
    if registro is None or registro.usado_en is not None or registro.vence_en <= ahora:
        raise BajadaRechazada("RETO_INVALIDO")
    if not firmas.verificar(dispositivo.llave_publica, mensaje_bajada(reto), firma):
        raise BajadaRechazada("FIRMA_INVALIDA")
    registro.usado_en = ahora
    registro.save(update_fields=["usado_en"])
    if not dispositivo.activo:
        raise BajadaRechazada("DISPOSITIVO_RETIRADO", estado_http=410)


def _vigentes():
    return Movimiento.objects.con_estado().exclude(estado__in=[E.RECHAZADO, E.EN_CONFLICTO])


def _ahorro_por_titular(ciclo: Ciclo) -> dict[str, int]:
    """Ahorro del ciclo por titular, con sus correcciones, sin lo rechazado ni en conflicto."""
    vigentes = (
        _vigentes()
        .filter(reunion__ciclo=ciclo)
        .filter(
            Q(tipo=Movimiento.Tipo.AHORRO)
            | Q(tipo=Movimiento.Tipo.REVERSO, corrige__tipo=Movimiento.Tipo.AHORRO)
        )
        .values("id")
    )
    filas = (
        Movimiento.objects.filter(id__in=vigentes)
        .values("titular_id")
        .annotate(total=Sum("monto"))
        .order_by()
    )
    return {str(f["titular_id"]): f["total"] for f in filas}


def _aportes_de_la_reunion(reunion: Reunion, valor_accion: int) -> dict[str, dict]:
    """Acciones y fondo social de cada titular en una reunión, con sus correcciones (D11)."""
    vigentes = (
        _vigentes()
        .filter(reunion=reunion)
        .filter(
            Q(tipo__in=[Movimiento.Tipo.AHORRO, Movimiento.Tipo.FONDO_SOCIAL])
            | Q(
                tipo=Movimiento.Tipo.REVERSO,
                corrige__tipo__in=[Movimiento.Tipo.AHORRO, Movimiento.Tipo.FONDO_SOCIAL],
            )
        )
        .values("id")
    )
    aportes: dict[str, dict] = {}
    for m in Movimiento.objects.filter(id__in=vigentes, titular__isnull=False).select_related(
        "corrige"
    ):
        tipo = m.corrige.tipo if m.tipo == Movimiento.Tipo.REVERSO else m.tipo
        fila = aportes.setdefault(str(m.titular_id), {"ahorro": 0, "fondo": 0})
        fila["ahorro" if tipo == Movimiento.Tipo.AHORRO else "fondo"] += m.monto
    return {
        titular: {"acciones": f["ahorro"] // valor_accion, "fondo_social": f["fondo"] > 0}
        for titular, f in aportes.items()
        if f["ahorro"] > 0 or f["fondo"] > 0
    }


def foto_del_grupo(dispositivo: Dispositivo) -> dict:
    acap = dispositivo.acap
    ciclo = Ciclo.objects.filter(acap=acap, estado=Ciclo.Estado.ACTIVO).first()
    foto = {
        "formato": 1,
        "generado_en": timezone.now().isoformat(),
        "acap": {
            "id": str(acap.id),
            "nombre": acap.nombre,
            # Reglamento de la votación de préstamos (ET2): el celular lo aplica sin señal.
            "quorum_porcentaje": acap.quorum_porcentaje,
            "mayoria": acap.mayoria,
        },
        "ciclo": None,
        "miembros": [],
        "cargos": [],
        "reuniones": [],
        "prestamos": [],
        "caja": 0,
        "ultima_reunion": None,
        "comprobantes": None,
        "propuestas": [],
    }
    if ciclo is None:
        return foto
    foto["ciclo"] = {
        "id": str(ciclo.id),
        "numero": ciclo.numero,
        "fecha_inicio": ciclo.fecha_inicio.isoformat(),
        "duracion_meses": ciclo.duracion_meses,
        "valor_accion": ciclo.valor_accion,
        "max_acciones_reunion": ciclo.max_acciones_reunion,
        "valor_fondo_social": ciclo.valor_fondo_social,
        "valor_multa": ciclo.valor_multa,
        "tasa_interes": format(ciclo.tasa_interes, "f"),
    }
    ahorro = _ahorro_por_titular(ciclo)
    membresias = list(Membresia.objects.filter(acap=acap).order_by("numero_miembro"))
    # Nombre corto (D3) solo de quien tiene consentimiento vigente; los demás, solo el número.
    nombres = miembros.nombres_cortos([m.titular_id for m in membresias])
    foto["miembros"] = [
        {
            "membresia_id": str(m.id),
            "titular_id": str(m.titular_id),
            "numero": m.numero_miembro,
            "activo": m.activa,
            "ahorro_ciclo": ahorro.get(str(m.titular_id), 0),
            "nombre_corto": nombres.get(str(m.titular_id)),
        }
        for m in membresias
    ]
    foto["cargos"] = [
        {
            "id": str(c.id),
            "tipo": c.tipo,
            "membresia_id": str(c.membresia_id),
            # Solo las llaves de este celular: las de otros celulares no le sirven.
            "llaves": [
                str(llave.id)
                for llave in c.llaves.all()
                if llave.dispositivo_id == dispositivo.id and llave.revocada_en is None
            ],
        }
        for c in Cargo.objects.filter(ciclo=ciclo, vigente=True).prefetch_related("llaves")
    ]
    reuniones = list(Reunion.objects.filter(ciclo=ciclo).order_by("numero"))
    foto["reuniones"] = [
        {"id": str(r.id), "numero": r.numero, "fecha": r.fecha.isoformat(), "estado": r.estado}
        for r in reuniones
    ]
    # Caja con que abre la próxima reunión: lo contado en el arqueo de la última cerrada (D12).
    cerradas = [r for r in reuniones if r.caja_contada is not None]
    foto["caja"] = cerradas[-1].caja_contada if cerradas else 0
    # Comprobantes de la última reunión cerrada, para mostrarlos en la siguiente (pregunta 2b).
    foto["comprobantes"] = comprobantes.emitir(ciclo)
    # Propuestas del facilitador para el paso 2 de la siguiente reunión (ET3, D7).
    foto["propuestas"] = propuestas.para_la_foto(acap)
    # "Igual que la reunión pasada" (D11): lo que dio cada miembro en la última del ciclo.
    foto["ultima_reunion"] = (
        {
            "numero": reuniones[-1].numero,
            "aportes": _aportes_de_la_reunion(reuniones[-1], ciclo.valor_accion),
        }
        if reuniones
        else None
    )
    for p in Prestamo.objects.filter(ciclo=ciclo).order_by("id"):
        saldo = libro.saldo_prestamo(p)
        if saldo > 0:
            foto["prestamos"].append(
                {
                    "id": str(p.id),
                    "titular_id": str(p.titular_id),
                    "capital": p.capital,
                    "num_cuotas": p.num_cuotas,
                    "cuota_mensual": p.cuota_mensual,
                    "total_pagar": p.total_pagar,
                    "saldo": saldo,
                }
            )
    return foto
