import datetime
import json
import os
import uuid

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from core.canonico import canonico
from core.firmas import a_b64url
from cuentas.tests.llaves import LlaveDePrueba
from libro.models import Movimiento
from sync import respaldo
from sync.models import Recibido

pytestmark = pytest.mark.django_db
CONTEXTO = b"credimpacto/respaldo/v1"


def armar(publica_servidor, contenido: dict) -> str:
    """Lo mismo que hace la app (movil/src/respaldo): ECIES P-256 + HKDF + AES-GCM."""
    efimera = ec.generate_private_key(ec.SECP256R1())
    spki = efimera.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    clave = HKDF(algorithm=hashes.SHA256(), length=32, salt=spki, info=CONTEXTO).derive(
        efimera.exchange(ec.ECDH(), publica_servidor)
    )
    iv = os.urandom(12)
    datos = AESGCM(clave).encrypt(iv, canonico(contenido).encode(), CONTEXTO)
    return json.dumps(
        {
            "tipo": "credimpacto-respaldo",
            "formato": 1,
            "llave_efimera": a_b64url(spki),
            "iv": a_b64url(iv),
            "datos": a_b64url(datos),
        }
    )


@pytest.fixture
def servidor():
    return ec.generate_private_key(ec.SECP256R1())


def contenido(junta, elementos, *, llave=None):
    sin_firma = {
        "formato": 1,
        "dispositivo": str(junta.dispositivo.id),
        "generado_en": "2026-10-04T16:00:00Z",
        "elementos": elementos,
    }
    return {**sin_firma, "firma": (llave or junta.llave_dispositivo).firmar(sin_firma)}


def reunion_con_aporte(junta):
    reunion_id = str(uuid.uuid4())
    return [
        junta.elemento(
            "reunion",
            {"ciclo": str(junta.ciclo.id), "numero": 1, "fecha": "2026-10-04"},
            id=reunion_id,
        ),
        junta.elemento(
            "ahorro", {"reunion": reunion_id, "titular": str(junta.socia.id), "acciones": 2}
        ),
    ]


def test_importa_los_pendientes_del_celular(junta, servidor, facilitadora):
    archivo = armar(servidor.public_key(), contenido(junta, reunion_con_aporte(junta)))
    resultado = respaldo.importar(texto=archivo, usuario=facilitadora, privada=servidor)
    assert resultado == {"elementos": 2, "resultado": {"confirmado": 2}}
    assert Movimiento.objects.count() == 1


def test_subirlo_dos_veces_no_duplica(junta, servidor, facilitadora):
    archivo = armar(servidor.public_key(), contenido(junta, reunion_con_aporte(junta)))
    respaldo.importar(texto=archivo, usuario=facilitadora, privada=servidor)
    respaldo.importar(texto=archivo, usuario=facilitadora, privada=servidor)
    assert Movimiento.objects.count() == 1
    assert Recibido.objects.count() == 2


def test_archivo_alterado(junta, servidor, facilitadora):
    archivo = json.loads(armar(servidor.public_key(), contenido(junta, reunion_con_aporte(junta))))
    datos = bytearray(archivo["datos"].encode())
    datos[10] = ord("A") if datos[10] != ord("A") else ord("B")
    archivo["datos"] = datos.decode()
    with pytest.raises(respaldo.RespaldoInvalido) as error:
        respaldo.importar(texto=json.dumps(archivo), usuario=facilitadora, privada=servidor)
    assert error.value.codigo == "ARCHIVO_ALTERADO"


def test_cifrado_para_otro_servidor(junta, servidor, facilitadora):
    otro = ec.generate_private_key(ec.SECP256R1())
    archivo = armar(otro.public_key(), contenido(junta, reunion_con_aporte(junta)))
    with pytest.raises(respaldo.RespaldoInvalido) as error:
        respaldo.importar(texto=archivo, usuario=facilitadora, privada=servidor)
    assert error.value.codigo == "ARCHIVO_ALTERADO"


def test_firma_de_otro_celular(junta, servidor, facilitadora):
    archivo = armar(
        servidor.public_key(), contenido(junta, reunion_con_aporte(junta), llave=LlaveDePrueba())
    )
    with pytest.raises(respaldo.RespaldoInvalido) as error:
        respaldo.importar(texto=archivo, usuario=facilitadora, privada=servidor)
    assert error.value.codigo == "FIRMA_INVALIDA"
    assert not Recibido.objects.exists()


def test_no_es_un_respaldo(servidor, facilitadora):
    with pytest.raises(respaldo.RespaldoInvalido) as error:
        respaldo.importar(texto='{"hola": 1}', usuario=facilitadora, privada=servidor)
    assert error.value.codigo == "ARCHIVO_INVALIDO"


def test_por_la_api_con_la_llave_del_secreto(junta, servidor, facilitadora, monkeypatch):
    from django.test import Client

    pem = servidor.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    monkeypatch.setenv("CREDIMPACTO_RESPALDO_LLAVE", pem)
    cliente = Client()
    cliente.force_login(facilitadora)
    archivo = armar(servidor.public_key(), contenido(junta, reunion_con_aporte(junta)))
    r = cliente.post(
        "/api/respaldos", {"archivo": archivo}, content_type="application/json", secure=True
    )
    assert r.status_code == 200, r.content
    assert r.json()["resultado"] == {"confirmado": 2}


@pytest.fixture
def facilitadora(db):
    from django.contrib.auth.models import Group

    from cuentas.models import Usuario

    u = Usuario.objects.create_user(
        username=f"f-{datetime.datetime.now().timestamp()}", password="x" * 16
    )
    u.groups.add(Group.objects.get(name="Facilitador"))
    return Usuario.objects.get(pk=u.pk)
