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

from core import firmas
from core.canonico import ValorNoCanonico
from cuentas.models import Dispositivo
from sync import servicio

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
