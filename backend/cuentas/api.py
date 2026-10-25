"""Registro de celulares (D18): con el usuario y la clave de la ACAP o con un código QR.

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

from acap.models import Acap, Cargo
from cuentas import servicio
from cuentas.models import Dispositivo

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


class PedidoEntrada(Schema):
    usuario: str
    clave: str
    llave_publica: str


class CelularConCodigo(DispositivoRegistrado):
    codigo: str


@router.post(
    "/enrolamiento/entrar",
    response={200: CelularConCodigo, 400: Rechazo},
    auth=None,
    throttle=[AnonRateThrottle("5/m")],
    summary="Registrar este celular con el usuario y la clave de la ACAP",
)
def entrar(request, pedido: PedidoEntrada):
    """Devuelve el código de un solo uso con el que el celular da de alta al primer Presidente."""
    try:
        texto, _ = servicio.entrar_con_clave(usuario=pedido.usuario, clave=pedido.clave)
        dispositivo = servicio.canjear_codigo(codigo=texto, llave_publica=pedido.llave_publica)
    except servicio.EnrolamientoRechazado as rechazo:
        return 400, {"motivo": rechazo.motivo, "mensaje": str(rechazo)}
    return {
        "codigo": texto,
        "dispositivo_id": dispositivo.id,
        "acap_id": dispositivo.acap_id,
        "acap_nombre": dispositivo.acap.nombre,
    }


class PedidoPresidente(Schema):
    codigo: str
    dispositivo_id: uuid.UUID
    llave_id: uuid.UUID
    cargo_id: uuid.UUID
    llave_publica: str
    firma: str


class LlaveRegistrada(Schema):
    llave_id: uuid.UUID


@router.post(
    "/enrolamiento/presidente",
    response={200: LlaveRegistrada, 400: Rechazo},
    auth=None,
    throttle=[AnonRateThrottle("10/m")],
    summary="Registrar la llave del primer Presidente en el celular recién registrado",
)
def alta_presidente(request, pedido: PedidoPresidente):
    """Con el mismo código del QR, firmado por el celular que lo canjeó, en sus 15 minutos."""
    dispositivo = get_object_or_404(Dispositivo, id=pedido.dispositivo_id)
    cargo = get_object_or_404(Cargo, id=pedido.cargo_id)
    try:
        llave = servicio.alta_primer_presidente(
            dispositivo=dispositivo,
            codigo=pedido.codigo,
            llave_id=pedido.llave_id,
            cargo=cargo,
            llave_publica=pedido.llave_publica,
            firma=pedido.firma,
        )
    except servicio.EnrolamientoRechazado as rechazo:
        return 400, {"motivo": rechazo.motivo, "mensaje": str(rechazo)}
    return {"llave_id": llave.id}
