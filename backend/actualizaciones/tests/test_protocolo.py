import base64
import hashlib
import json
import uuid

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from actualizaciones.models import Paquete

pytestmark = pytest.mark.django_db
TOKEN = "token-de-prueba-largo"
CABECERAS = {
    "expo-platform": "android",
    "expo-runtime-version": "0.1.0",
    "expo-protocol-version": "1",
}


def resumen(datos: bytes) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(datos).digest()).rstrip(b"=").decode()


def manifiesto(bundle: bytes, imagen: bytes) -> str:
    return json.dumps(
        {
            "id": str(uuid.uuid4()),
            "createdAt": "2026-10-19T12:00:00.000Z",
            "runtimeVersion": "0.1.0",
            "launchAsset": {
                "hash": resumen(bundle),
                "key": "bundle",
                "contentType": "application/javascript",
                "url": "x",
            },
            "assets": [
                {
                    "hash": resumen(imagen),
                    "key": "img",
                    "contentType": "image/png",
                    "fileExtension": ".png",
                    "url": "y",
                }
            ],
            "metadata": {},
            "extra": {},
        }
    )


def publicar(cliente, texto, archivos, token=TOKEN):
    return cliente.post(
        "/api/actualizaciones/publicar",
        {"manifiesto": texto, "firma": "c2lnbmF0dXJh", "archivos": archivos},
        secure=True,
        headers={"authorization": f"Bearer {token}"},
    )


@pytest.fixture(autouse=True)
def token(monkeypatch):
    monkeypatch.setenv("CREDIMPACTO_ACTUALIZACIONES_TOKEN", TOKEN)


def test_sin_actualizaciones_responde_204_con_las_cabeceras_del_protocolo():
    r = Client().get("/api/actualizaciones/manifiesto", secure=True, headers=CABECERAS)
    assert r.status_code == 204
    assert r["expo-protocol-version"] == "1"
    assert r["expo-sfv-version"] == "0"


def test_publicar_y_entregar_el_manifiesto_firmado_y_sus_archivos():
    bundle, imagen = b"console.log(1)", b"\x89PNG..."
    texto = manifiesto(bundle, imagen)
    cliente = Client()
    r = publicar(
        cliente,
        texto,
        [SimpleUploadedFile("bundle.js", bundle), SimpleUploadedFile("img.png", imagen)],
    )
    assert r.status_code == 200, r.content
    r = cliente.get("/api/actualizaciones/manifiesto", secure=True, headers=CABECERAS)
    assert r.status_code == 200
    assert r["content-type"].startswith("multipart/mixed; boundary=")
    cuerpo = r.content.decode()
    assert 'name="manifest"' in cuerpo
    assert 'expo-signature: sig="c2lnbmF0dXJh", keyid="main"' in cuerpo
    assert texto in cuerpo  # el texto exacto que firmó CI
    archivo = cliente.get(f"/api/actualizaciones/archivos/{resumen(bundle)}", secure=True)
    assert archivo.content == bundle
    assert archivo["cache-control"].endswith("immutable")


def test_archivo_que_no_coincide_con_su_resumen():
    texto = manifiesto(b"bundle", b"img")
    r = publicar(
        Client(),
        texto,
        [SimpleUploadedFile("bundle.js", b"otro"), SimpleUploadedFile("img.png", b"img")],
    )
    assert r.status_code == 400
    assert not Paquete.objects.exists()


def test_publicar_sin_token():
    r = publicar(Client(), manifiesto(b"a", b"b"), [SimpleUploadedFile("a", b"a")], token="otro")
    assert r.status_code == 401


def test_un_paquete_retirado_ya_no_se_entrega():
    bundle, imagen = b"b", b"i"
    publicar(
        Client(),
        manifiesto(bundle, imagen),
        [SimpleUploadedFile("b", bundle), SimpleUploadedFile("i", imagen)],
    )
    Paquete.objects.update(activo=False)
    assert (
        Client().get("/api/actualizaciones/manifiesto", secure=True, headers=CABECERAS).status_code
        == 204
    )


def test_otra_plataforma():
    r = Client().get(
        "/api/actualizaciones/manifiesto",
        secure=True,
        headers={**CABECERAS, "expo-platform": "ios"},
    )
    assert r.status_code == 400
