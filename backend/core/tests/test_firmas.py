import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from core import firmas
from core.tests.casos import leer
from cuentas.tests.llaves import LlaveDePrueba

VECTOR = leer("firmas-p256.json")


@pytest.mark.parametrize("caso", VECTOR["casos"], ids=lambda c: c["nombre"])
def test_vector_compartido_con_la_app(caso):
    """Firmas hechas con WebCrypto, que es lo que usa la app (quick-crypto)."""
    assert firmas.verificar(VECTOR["llave_publica"], caso["valor"], caso["firma"]) is caso["valida"]


def test_firma_hecha_en_python_con_el_mismo_contrato():
    llave = LlaveDePrueba()
    valor = {"tipo": "aporte", "pesos": 10_000}
    assert firmas.verificar(llave.publica, valor, llave.firmar(valor))
    assert not firmas.verificar(llave.publica, {**valor, "pesos": 10_001}, llave.firmar(valor))


def test_firma_der_no_se_acepta():
    """El contrato es P1363 (64 bytes); una firma DER de 70 bytes se rechaza en vez de adivinar."""
    llave = LlaveDePrueba()
    valor = {"a": 1}
    assert not firmas.verificar(llave.publica, valor, firmas.a_b64url(llave.firmar_der(valor)))


@pytest.mark.parametrize("texto", ["", "no-es-base64!", "AAAA", "AAAA=="])
def test_llave_publica_ilegible(texto):
    with pytest.raises((firmas.LlaveInvalida, ValueError)):
        firmas.cargar_llave_publica(texto)


def test_llave_de_otra_curva_se_rechaza():
    otra = ec.generate_private_key(ec.SECP384R1()).public_key()
    with pytest.raises(firmas.LlaveInvalida):
        firmas.cargar_llave_publica(LlaveDePrueba.spki(otra))
