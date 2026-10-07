"""Verificación de firmas ECDSA P-256 hechas en el celular (D17, EX1).

Contrato con la app (movil/src/seguridad/firma.ts):
- Llave pública: SubjectPublicKeyInfo DER de una llave P-256, en base64url sin relleno.
- Firma: ECDSA con SHA-256 sobre los bytes UTF-8 del JCS del valor (core.canonico), en formato
  IEEE P1363 (r || s, 64 bytes), que es el que produce WebCrypto; en base64url sin relleno.

Los mismos vectores (packages/casos-reglas/casos/firmas-p256.json) los verifican pytest y Jest.
"""

import base64
import binascii

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

from core.canonico import canonico

LARGO_COORDENADA = 32


class LlaveInvalida(ValueError):
    """La llave pública no es una SPKI P-256 válida."""


def desde_b64url(texto: str) -> bytes:
    if not isinstance(texto, str) or not texto or "=" in texto:
        raise ValueError("Se esperaba base64url sin relleno.")
    try:
        return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))
    except (binascii.Error, ValueError) as error:
        raise ValueError("base64url inválido.") from error


def a_b64url(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).rstrip(b"=").decode("ascii")


def cargar_llave_publica(spki_b64url: str) -> ec.EllipticCurvePublicKey:
    """Lee y valida una llave pública P-256. Lanza LlaveInvalida si no lo es."""
    try:
        llave = serialization.load_der_public_key(desde_b64url(spki_b64url))
    except ValueError as error:
        raise LlaveInvalida("La llave pública no se puede leer.") from error
    if not isinstance(llave, ec.EllipticCurvePublicKey) or not isinstance(
        llave.curve, ec.SECP256R1
    ):
        raise LlaveInvalida("La llave pública debe ser ECDSA P-256.")
    return llave


def verificar(spki_b64url: str, valor, firma_b64url: str) -> bool:
    """True si la firma de `valor` con esa llave es válida. Una firma mal formada da False."""
    llave = cargar_llave_publica(spki_b64url)
    try:
        firma = desde_b64url(firma_b64url)
    except ValueError:
        return False
    if len(firma) != 2 * LARGO_COORDENADA:
        return False
    r = int.from_bytes(firma[:LARGO_COORDENADA], "big")
    s = int.from_bytes(firma[LARGO_COORDENADA:], "big")
    try:
        llave.verify(
            encode_dss_signature(r, s),
            canonico(valor).encode("utf-8"),
            ec.ECDSA(hashes.SHA256()),
        )
    except InvalidSignature:
        return False
    return True
