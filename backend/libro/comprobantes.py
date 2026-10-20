"""Comprobante confirmado por miembro (alcance 3; pregunta abierta 2b, valor por defecto).

    reunión cerrada en el servidor ──► foto del grupo: un enlace firmado por miembro
    siguiente reunión ──► el celular de la junta muestra el QR del enlace a cada miembro
    el miembro abre /comprobante/<token> ──► cifras confirmadas de esa reunión

El enlace no lleva datos: es el id del comprobante firmado con la llave del servidor. Vence a los
VIGENCIA días de la reunión y la Fundación lo puede revocar. Muestra número de miembro, nunca
nombre ni cédula (Ley 1581).
"""

import datetime

from django.core import signing
from django.db.models import Max, Q, Sum
from django.utils import timezone

from acap.models import Ciclo, Membresia, Reunion
from libro import servicio as libro
from libro.models import Comprobante, EstadoMovimiento, Movimiento, Prestamo

VIGENCIA = datetime.timedelta(days=60)
SAL = "credimpacto.comprobante"
E = EstadoMovimiento
T = Movimiento.Tipo


class ComprobanteNoValido(Exception):
    def __init__(self, codigo: str, estado_http: int):
        super().__init__(codigo)
        self.codigo = codigo
        self.estado_http = estado_http


def token(comprobante: Comprobante) -> str:
    return signing.dumps(str(comprobante.id), salt=SAL)


def vence_en(reunion: Reunion) -> datetime.date:
    return reunion.fecha + VIGENCIA


def _suma(movimientos, tipo: str) -> int:
    """Total de un tipo con sus correcciones, sin lo rechazado ni en conflicto."""
    ids = (
        movimientos.con_estado()
        .exclude(estado__in=[E.RECHAZADO, E.EN_CONFLICTO])
        .filter(Q(tipo=tipo) | Q(tipo=T.REVERSO, corrige__tipo=tipo))
        .values("id")
    )
    return Movimiento.objects.filter(id__in=ids).aggregate(t=Sum("monto"))["t"] or 0


def emitir(ciclo: Ciclo | None) -> dict | None:
    """Enlaces de la última reunión cerrada del ciclo, para la foto del grupo (uno por miembro)."""
    if ciclo is None:
        return None
    reunion = (
        Reunion.objects.filter(ciclo=ciclo, estado=Reunion.Estado.CERRADA)
        .order_by("-numero")
        .first()
    )
    if reunion is None:
        return None
    titulares = set(
        Movimiento.objects.filter(reunion=reunion, titular__isnull=False).values_list(
            "titular_id", flat=True
        )
    )
    enlaces = {}
    for m in Membresia.objects.filter(acap=ciclo.acap, titular_id__in=titulares):
        comprobante, _ = Comprobante.objects.get_or_create(reunion=reunion, membresia=m)
        if comprobante.revocado_en is None:
            enlaces[str(m.titular_id)] = token(comprobante)
    return {
        "reunion": reunion.numero,
        "fecha": reunion.fecha.isoformat(),
        "vence_en": vence_en(reunion).isoformat(),
        "enlaces": enlaces,
    }


def leer(valor: str, ahora=None) -> dict:
    """Cifras confirmadas del comprobante; ComprobanteNoValido si no existe, venció o se revocó."""
    ahora = ahora or timezone.now()
    try:
        comprobante_id = signing.loads(valor, salt=SAL)
    except signing.BadSignature as error:
        raise ComprobanteNoValido("NO_EXISTE", 404) from error
    comprobante = (
        Comprobante.objects.select_related("reunion__ciclo__acap", "membresia")
        .filter(id=comprobante_id)
        .first()
    )
    if comprobante is None:
        raise ComprobanteNoValido("NO_EXISTE", 404)
    if comprobante.revocado_en is not None:
        raise ComprobanteNoValido("REVOCADO", 410)
    reunion = comprobante.reunion
    if timezone.localdate(ahora) > vence_en(reunion):
        raise ComprobanteNoValido("VENCIDO", 410)

    titular_id = comprobante.membresia.titular_id
    hoy = Movimiento.objects.filter(reunion=reunion, titular_id=titular_id)
    ahorro = _suma(hoy, T.AHORRO)
    del_ciclo = Movimiento.objects.filter(
        reunion__ciclo=reunion.ciclo, reunion__numero__lte=reunion.numero, titular_id=titular_id
    )
    saldo = sum(
        libro.saldo_prestamo(p)
        for p in Prestamo.objects.filter(ciclo=reunion.ciclo, titular_id=titular_id)
    )
    datos_al = Movimiento.objects.filter(reunion__ciclo=reunion.ciclo).aggregate(
        u=Max("creado_en")
    )["u"]
    return {
        "acap": reunion.ciclo.acap.nombre,
        "reunion": reunion.numero,
        "fecha": reunion.fecha.isoformat(),
        "numero_miembro": comprobante.membresia.numero_miembro,
        "acciones": ahorro // reunion.valor_accion,
        "ahorro": ahorro,
        "fondo_social": _suma(hoy, T.FONDO_SOCIAL),
        "multas": _suma(hoy, T.MULTA),
        "abonos": _suma(hoy, T.ABONO),
        "ahorro_ciclo": _suma(del_ciclo, T.AHORRO),
        "saldo_prestamos": saldo,
        "vence_en": vence_en(reunion).isoformat(),
        "datos_al": (datos_al or ahora).isoformat(),
    }
