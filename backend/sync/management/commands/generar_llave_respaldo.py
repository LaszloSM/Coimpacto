"""Genera el par de llaves del respaldo (TX7). La privada va al secreto del servidor
(CREDIMPACTO_RESPALDO_LLAVE) y la pública a la app (EXPO_PUBLIC_LLAVE_RESPALDO). Ninguna se
guarda en el repositorio; la custodia de la privada sigue el runbook de llaves (TX10)."""

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.core.management.base import BaseCommand

from core.firmas import a_b64url


class Command(BaseCommand):
    help = "Genera la llave del respaldo por archivo: imprime la pública y la privada (PEM)."

    def handle(self, *args, **opciones):
        privada = ec.generate_private_key(ec.SECP256R1())
        pem = privada.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ).decode()
        publica = a_b64url(
            privada.public_key().public_bytes(
                serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
            )
        )
        self.stdout.write(f"EXPO_PUBLIC_LLAVE_RESPALDO={publica}\n")
        self.stdout.write("CREDIMPACTO_RESPALDO_LLAVE (secreto del servidor, no la comparta):\n")
        self.stdout.write(pem)
