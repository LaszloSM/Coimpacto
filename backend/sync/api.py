"""Subida de la cola del celular (TX5).

El celular firma el cuerpo completo del lote con su llave de dispositivo (D18), en la cabecera
`X-Credimpacto-Firma`, y se identifica en `X-Credimpacto-Dispositivo`. Reenviar un lote ya
recibido no cambia nada: cada elemento es idempotente por su id, así que repetir la petición es
inofensivo.
"""

import json
import uuid

from ninja import Router, Schema
from ninja.errors import HttpError
from ninja.security import django_auth
from ninja.throttling import AnonRateThrottle

from core import firmas
from core.canonico import ValorNoCanonico
from cuentas.models import Dispositivo
from sync import bajada, respaldo, servicio

router = Router(tags=["sincronizacion"])


class ResultadoElemento(Schema):
    id: str
    estado: str
    codigo: str


class ResultadoLote(Schema):
    resultados: list[ResultadoElemento]


class Rechazo(Schema):
    codigo: str


def _dispositivo(request, cuerpo) -> Dispositivo:
    try:
        dispositivo_id = uuid.UUID(request.headers.get("X-Credimpacto-Dispositivo", ""))
    except ValueError as error:
        raise HttpError(401, "Falta el celular.") from error
    dispositivo = Dispositivo.objects.filter(id=dispositivo_id).first()
    firma = request.headers.get("X-Credimpacto-Firma", "")
    try:
        valida = dispositivo is not None and firmas.verificar(
            dispositivo.llave_publica, cuerpo, firma
        )
    except ValorNoCanonico:
        valida = False
    if not valida:
        raise HttpError(401, "La firma del celular no es válida.")
    return dispositivo


@router.post(
    "/sync/lotes",
    response={200: ResultadoLote, 400: Rechazo},
    auth=None,
    summary="Subir un lote de la cola del celular (formato 1)",
)
def subir_lote(request):
    """Cada elemento vuelve con su estado: confirmado, por_validar, rechazado, en_conflicto o
    en_espera (el celular lo reenvía después). Ver sync/servicio.py."""
    try:
        cuerpo = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise HttpError(400, "El lote no es JSON.") from error
    dispositivo = _dispositivo(request, cuerpo)
    try:
        resultados = servicio.recibir_lote(dispositivo=dispositivo, cuerpo=cuerpo)
    except servicio.LoteInvalido as error:
        return 400, {"codigo": error.codigo}
    return {"resultados": resultados}


class PedidoGrupo(Schema):
    reto: str
    firma: str


class Reto(Schema):
    reto: str


def _celular_por_cabecera(request) -> Dispositivo:
    try:
        dispositivo_id = uuid.UUID(request.headers.get("X-Credimpacto-Dispositivo", ""))
    except ValueError as error:
        raise HttpError(401, "Falta el celular.") from error
    dispositivo = Dispositivo.objects.filter(id=dispositivo_id).first()
    if dispositivo is None:
        raise HttpError(401, "Celular desconocido.")
    return dispositivo


@router.post(
    "/sync/reto",
    response=Reto,
    auth=None,
    throttle=[AnonRateThrottle("30/m")],
    summary="Pedir un número de un solo uso para bajar los datos del grupo",
)
def pedir_reto(request):
    return {"reto": bajada.emitir_reto(_celular_por_cabecera(request))}


@router.post(
    "/sync/grupo",
    response={200: dict, 401: Rechazo, 410: Rechazo},
    auth=None,
    summary="Bajar los datos del grupo para llevar la reunión sin señal",
)
def bajar_grupo(request, pedido: PedidoGrupo):
    """El celular firma {"pedido": "grupo", "reto": …}. Un celular retirado recibe 410 y borra
    sus datos locales después de subir su cola (E3)."""
    dispositivo = _celular_por_cabecera(request)
    try:
        bajada.usar_reto(dispositivo=dispositivo, reto=pedido.reto, firma=pedido.firma)
    except bajada.BajadaRechazada as error:
        return error.estado_http, {"codigo": error.codigo}
    return bajada.foto_del_grupo(dispositivo)


class Respaldo(Schema):
    archivo: str


class ResultadoRespaldo(Schema):
    elementos: int
    resultado: dict[str, int]


@router.post(
    "/respaldos",
    response={200: ResultadoRespaldo, 400: Rechazo, 403: Rechazo},
    auth=django_auth,
    summary="Subir el archivo de respaldo de un celular (lo trae el facilitador)",
)
def subir_respaldo(request, cuerpo: Respaldo):
    """Importa los pendientes del archivo cifrado; subirlo dos veces no duplica nada."""
    if not request.user.has_perm("cuentas.add_codigoenrolamiento"):
        return 403, {"codigo": "SIN_PERMISO"}
    try:
        return respaldo.importar(texto=cuerpo.archivo, usuario=request.user)
    except respaldo.RespaldoInvalido as error:
        return 400, {"codigo": error.codigo}
