"""Llaves P-256 de prueba que firman con el mismo contrato que la app (core.firmas)."""

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

from core.canonico import canonico
from core.firmas import a_b64url


class LlaveDePrueba:
    def __init__(self):
        self.privada = ec.generate_private_key(ec.SECP256R1())
        self.publica = self.spki(self.privada.public_key())

    @staticmethod
    def spki(llave) -> str:
        return a_b64url(
            llave.public_bytes(
                serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
            )
        )

    def firmar_der(self, valor) -> bytes:
        return self.privada.sign(canonico(valor).encode("utf-8"), ec.ECDSA(hashes.SHA256()))

    def firmar(self, valor) -> str:
        r, s = decode_dss_signature(self.firmar_der(valor))
        return a_b64url(r.to_bytes(32, "big") + s.to_bytes(32, "big"))
