from fractions import Fraction

import pytest
from hypothesis import given
from hypothesis import strategies as st

from core.tests.casos import leer
from libro.reglas import ReglaInvalida, interes_sobre_saldo

MANUALES = leer("interes-sobre-saldo.json")
ALEATORIOS = leer("interes-aleatorio.json")


@pytest.mark.parametrize("caso", MANUALES["casos"] + ALEATORIOS["casos"], ids=lambda c: c["nombre"])
def test_interes_casos_compartidos(caso):
    assert interes_sobre_saldo(caso["saldo"], caso["tasa"]) == caso["esperado"]


@pytest.mark.parametrize("caso", MANUALES["rechazos"], ids=lambda c: c["nombre"])
def test_interes_rechaza_entradas_invalidas(caso):
    with pytest.raises(ReglaInvalida):
        interes_sobre_saldo(caso["saldo"], caso["tasa"])


tasas = st.builds(
    lambda entero, decimales: f"{entero}.{decimales}",
    st.integers(min_value=0, max_value=2),
    st.from_regex(r"[0-9]{1,6}", fullmatch=True),
)


@given(st.integers(min_value=0, max_value=10**12), tasas)
def test_interes_coincide_con_fracciones_exactas(saldo, tasa):
    exacto = saldo * Fraction(tasa)

    assert interes_sobre_saldo(saldo, tasa) == int(exacto + Fraction(1, 2))


@given(st.integers(min_value=0, max_value=10**9), tasas)
def test_interes_nunca_se_aleja_mas_de_medio_peso(saldo, tasa):
    diferencia = interes_sobre_saldo(saldo, tasa) - saldo * Fraction(tasa)

    assert Fraction(-1, 2) < diferencia <= Fraction(1, 2)
