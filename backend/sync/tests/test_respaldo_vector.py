"""El servidor abre el respaldo que arma la app (vector generado con WebCrypto en Jest)."""

from cryptography.hazmat.primitives import serialization

from core.canonico import canonico
from core.tests.casos import leer
from sync import respaldo

VECTOR = leer("respaldo-v1.json")


def test_abre_el_respaldo_armado_por_la_app():
    privada = serialization.load_pem_private_key(
        VECTOR["llave_privada_servidor_solo_prueba"].encode(), password=None
    )
    contenido = respaldo.abrir(VECTOR["archivo"], privada)
    assert canonico(contenido) == VECTOR["contenido_jcs"]
    assert contenido["dispositivo"] == "d1"
    assert len(contenido["elementos"]) == 1
