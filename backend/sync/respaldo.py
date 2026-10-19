"""Respaldo por archivo del celular (TX7, EA1, D2/D22 de diseño).

El celular arma un archivo con sus pendientes, firmado con su llave de dispositivo y cifrado
para la llave pública del servidor (que trae la app): solo el servidor lo abre. El facilitador
lo sube desde la oficina y se importa igual que la cola (sync.servicio): idempotente por UUID,
así subirlo dos veces no duplica nada.

    archivo = {"tipo": "credimpacto-respaldo", "formato": 1,
               "llave_efimera": SPKI P-256 b64url, "iv": b64url, "datos": b64url}
    datos   = AES-256-GCM(clave, JCS(contenido), aad="credimpacto/respaldo/v1")
    clave   = HKDF-SHA256(ECDH(efímera, servidor), sal=SPKI efímera, info="credimpacto/respaldo/v1")
    contenido = {"formato", "dispositivo", "generado_en", "elementos", "firma"}
    firma   = llave del celular sobre JCS del contenido sin "firma" (core.firmas)
"""

import json
import os
import uuid

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from core import firmas
from cuentas.models import Dispositivo
from libro.models import Auditoria
from sync.servicio import MAX_ELEMENTOS, recibir_lote

CONTEXTO = b"credimpacto/respaldo/v1"


class RespaldoInvalido(Exception):
    def __init__(self, codigo: str):
        super().__init__(codigo)
        self.codigo = codigo


def llave_privada_del_servidor() -> ec.EllipticCurvePrivateKey:
    """Llave privada del servidor desde el secreto CREDIMPACTO_RESPALDO_LLAVE (PEM PKCS8)."""
    pem = os.environ.get("CREDIMPACTO_RESPALDO_LLAVE", "")
    if not pem:
        raise RespaldoInvalido("SERVIDOR_SIN_LLAVE")
    llave = serialization.load_pem_private_key(pem.replace("\\n", "\n").encode(), password=None)
    if not isinstance(llave, ec.EllipticCurvePrivateKey):
        raise RespaldoInvalido("SERVIDOR_SIN_LLAVE")
    return llave


def _clave(privada: ec.EllipticCurvePrivateKey, spki_efimera: bytes) -> bytes:
    efimera = serialization.load_der_public_key(spki_efimera)
    if not isinstance(efimera, ec.EllipticCurvePublicKey) or not isinstance(
        efimera.curve, ec.SECP256R1
    ):
        raise RespaldoInvalido("ARCHIVO_INVALIDO")
    compartido = privada.exchange(ec.ECDH(), efimera)
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=spki_efimera, info=CONTEXTO).derive(
        compartido
    )


def abrir(texto: str, privada: ec.EllipticCurvePrivateKey) -> dict:
    """Descifra el archivo. Lanza RespaldoInvalido si no es de Credimpacto o fue alterado."""
    try:
        archivo = json.loads(texto)
        if archivo.get("tipo") != "credimpacto-respaldo" or archivo.get("formato") != 1:
            raise RespaldoInvalido("ARCHIVO_INVALIDO")
        spki = firmas.desde_b64url(archivo["llave_efimera"])
        claro = AESGCM(_clave(privada, spki)).decrypt(
            firmas.desde_b64url(archivo["iv"]), firmas.desde_b64url(archivo["datos"]), CONTEXTO
        )
        return json.loads(claro)
    except RespaldoInvalido:
        raise
    except (InvalidTag, ValueError, KeyError, TypeError, AttributeError) as error:
        raise RespaldoInvalido("ARCHIVO_ALTERADO") from error


def importar(*, texto: str, usuario, privada: ec.EllipticCurvePrivateKey | None = None) -> dict:
    """Importa los pendientes del archivo. Devuelve cuántos quedaron en cada estado."""
    contenido = abrir(texto, privada or llave_privada_del_servidor())
    try:
        dispositivo = Dispositivo.objects.get(id=uuid.UUID(str(contenido.get("dispositivo"))))
    except (ValueError, Dispositivo.DoesNotExist) as error:
        raise RespaldoInvalido("CELULAR_DESCONOCIDO") from error
    firma = contenido.pop("firma", "")
    if not firmas.verificar(dispositivo.llave_publica, contenido, firma):
        raise RespaldoInvalido("FIRMA_INVALIDA")
    elementos = contenido.get("elementos")
    if not isinstance(elementos, list):
        raise RespaldoInvalido("ARCHIVO_INVALIDO")

    conteo: dict[str, int] = {}
    for i in range(0, len(elementos), MAX_ELEMENTOS):
        lote = {
            "formato": 1,
            "lote": str(uuid.uuid4()),
            "elementos": elementos[i : i + MAX_ELEMENTOS],
        }
        for r in recibir_lote(dispositivo=dispositivo, cuerpo=lote) if lote["elementos"] else []:
            conteo[r["estado"]] = conteo.get(r["estado"], 0) + 1
    Auditoria.objects.create(
        tabla="sync_respaldo",
        pk_registro=str(dispositivo.id),
        accion="importar",
        actor=usuario,
        dispositivo=str(dispositivo.id),
        despues={
            "elementos": len(elementos),
            "resultado": conteo,
            "generado_en": contenido.get("generado_en"),
        },
    )
    return {"elementos": len(elementos), "resultado": conteo}
