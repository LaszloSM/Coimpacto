"""Enrolamiento de celulares por código QR (D18).

El QR lleva solo el código: la app tiene fija la dirección del servidor, así que un QR falso no
puede mandar el celular a otro servidor.
"""

import datetime
import uuid

from django.shortcuts import get_object_or_404
from ninja import Router, Schema
from ninja.errors import HttpError
from ninja.security import django_auth
from ninja.throttling import AnonRateThrottle

from acap.models import Acap
from cuentas import servicio

router = Router(tags=["enrolamiento"])

# Texto del QR; la app lo lee en movil/src/seguridad/enrolamiento.ts.
PREFIJO_QR = "credimpacto:enrolar:"


class PedidoCodigo(Schema):
    acap_id: uuid.UUID


class CodigoEmitido(Schema):
    codigo: str
    qr: str
    vence_en: datetime.datetime


class PedidoCanje(Schema):
    codigo: str
    llave_publica: str


class DispositivoRegistrado(Schema):
    dispositivo_id: uuid.UUID
    acap_id: uuid.UUID
    acap_nombre: str


class Rechazo(Schema):
    motivo: str
    mensaje: str


@router.post(
    "/enrolamiento/codigos",
    response=CodigoEmitido,
    auth=django_auth,
    summary="Emitir un código QR de un solo uso para registrar un celular",
)
def emitir_codigo(request, pedido: PedidoCodigo):
    """Solo para facilitadores con permiso. El código vence a los 15 minutos."""
    if not request.user.has_perm("cuentas.add_codigoenrolamiento"):
        raise HttpError(403, "Este usuario no puede registrar celulares.")
    acap = get_object_or_404(Acap, id=pedido.acap_id)
    texto, codigo = servicio.emitir_codigo(acap=acap, usuario=request.user)
    return {"codigo": texto, "qr": f"{PREFIJO_QR}{texto}", "vence_en": codigo.vence_en}


@router.post(
    "/enrolamiento/canjear",
    response={200: DispositivoRegistrado, 400: Rechazo},
    auth=None,
    throttle=[AnonRateThrottle("10/m")],
    summary="Registrar este celular con el código del facilitador",
)
def canjear_codigo(request, pedido: PedidoCanje):
    """El celular envía el código leído y su llave pública de dispositivo."""
    try:
        dispositivo = servicio.canjear_codigo(
            codigo=pedido.codigo, llave_publica=pedido.llave_publica
        )
    except servicio.EnrolamientoRechazado as rechazo:
        return 400, {"motivo": rechazo.motivo, "mensaje": str(rechazo)}
    return {
        "dispositivo_id": dispositivo.id,
        "acap_id": dispositivo.acap_id,
        "acap_nombre": dispositivo.acap.nombre,
    }
