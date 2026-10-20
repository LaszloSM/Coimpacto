"""Comprobante por enlace (alcance 3): lectura pública con el token firmado, sin sesión."""

from ninja import Router, Schema
from ninja.throttling import AnonRateThrottle

from libro import comprobantes

router = Router(tags=["comprobantes"])


class Comprobante(Schema):
    acap: str
    reunion: int
    fecha: str
    numero_miembro: int
    acciones: int
    ahorro: int
    fondo_social: int
    multas: int
    abonos: int
    ahorro_ciclo: int
    saldo_prestamos: int
    vence_en: str
    datos_al: str


class NoValido(Schema):
    codigo: str


@router.get(
    "/comprobantes/{token}",
    response={200: Comprobante, 404: NoValido, 410: NoValido},
    auth=None,
    throttle=[AnonRateThrottle("60/m")],
    summary="Comprobante confirmado de un miembro en una reunión",
)
def ver_comprobante(request, token: str):
    try:
        return 200, comprobantes.leer(token)
    except comprobantes.ComprobanteNoValido as e:
        return e.estado_http, {"codigo": e.codigo}
