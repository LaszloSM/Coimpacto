"""Protocolo de expo-updates v1 (TX9): manifiesto firmado, archivos por resumen y publicación
desde CI. https://docs.expo.dev/technical-specs/expo-updates-1/

    GET  /api/actualizaciones/manifiesto   (expo-platform, expo-runtime-version)
         → multipart/mixed con el manifiesto y expo-signature, o 204 si no hay nada nuevo
    GET  /api/actualizaciones/archivos/<resumen>   → el archivo, inmutable
    POST /api/actualizaciones/publicar     (solo CI, con su token)
"""

import base64
import hashlib
import hmac
import json
import os
import uuid

from django.http import HttpResponse
from ninja import File, Form, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile

from actualizaciones.models import Archivo, Paquete

router = Router(tags=["actualizaciones"])

CABECERAS = {
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
    "cache-control": "private, max-age=0",
}


def _resumen(datos: bytes) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(datos).digest()).rstrip(b"=").decode()


@router.get("/actualizaciones/manifiesto", auth=None, summary="Manifiesto de expo-updates v1")
def manifiesto(request):
    plataforma = request.headers.get("expo-platform", "")
    version = request.headers.get("expo-runtime-version", "")
    if plataforma != "android" or not version:
        raise HttpError(400, "Falta expo-platform=android o expo-runtime-version.")
    paquete = (
        Paquete.objects.filter(plataforma=plataforma, version_nativa=version, activo=True)
        .order_by("-creado_en")
        .first()
    )
    if paquete is None:
        respuesta = HttpResponse(status=204)
    else:
        limite = f"credimpacto-{uuid.uuid4().hex}"
        cuerpo = (
            f"--{limite}\r\n"
            'content-disposition: form-data; name="manifest"\r\n'
            "content-type: application/json; charset=utf-8\r\n"
            + (f'expo-signature: sig="{paquete.firma}", keyid="main"\r\n' if paquete.firma else "")
            + f"\r\n{paquete.manifiesto}\r\n--{limite}--\r\n"
        )
        respuesta = HttpResponse(
            cuerpo.encode(), content_type=f"multipart/mixed; boundary={limite}"
        )
    for clave, valor in CABECERAS.items():
        respuesta[clave] = valor
    return respuesta


@router.get(
    "/actualizaciones/archivos/{resumen}", auth=None, summary="Archivo de una actualización"
)
def archivo(request, resumen: str):
    registro = Archivo.objects.filter(resumen=resumen).first()
    if registro is None:
        raise HttpError(404, "No existe.")
    respuesta = HttpResponse(bytes(registro.contenido), content_type=registro.tipo)
    respuesta["cache-control"] = "public, max-age=31536000, immutable"
    return respuesta


@router.post("/actualizaciones/publicar", auth=None, summary="Publicar una actualización (solo CI)")
def publicar(
    request,
    manifiesto: Form[str],
    firma: Form[str],
    archivos: File[list[UploadedFile]],
):
    """CI sube el manifiesto ya firmado y los archivos; el servidor comprueba los resúmenes."""
    token = os.environ.get("CREDIMPACTO_ACTUALIZACIONES_TOKEN", "")
    enviado = request.headers.get("authorization", "").removeprefix("Bearer ")
    if not token or not hmac.compare_digest(token, enviado):
        raise HttpError(401, "Token de publicación inválido.")
    try:
        datos = json.loads(manifiesto)
        esperados = {
            a["hash"]: a["contentType"] for a in [datos["launchAsset"], *datos.get("assets", [])]
        }
        version = datos["runtimeVersion"]
    except (ValueError, KeyError, TypeError) as error:
        raise HttpError(400, "Manifiesto inválido.") from error
    recibidos = {}
    for subido in archivos:
        contenido = subido.read()
        recibidos[_resumen(contenido)] = contenido
    faltan = (
        set(esperados)
        - set(recibidos)
        - set(Archivo.objects.filter(resumen__in=esperados).values_list("resumen", flat=True))
    )
    if faltan:
        raise HttpError(400, f"Faltan {len(faltan)} archivos o su resumen no coincide.")
    for resumen, contenido in recibidos.items():
        if resumen in esperados:
            Archivo.objects.get_or_create(
                resumen=resumen, defaults={"tipo": esperados[resumen], "contenido": contenido}
            )
    paquete = Paquete.objects.create(
        id=uuid.UUID(datos["id"]), version_nativa=version, manifiesto=manifiesto, firma=firma
    )
    return {"id": str(paquete.id)}
