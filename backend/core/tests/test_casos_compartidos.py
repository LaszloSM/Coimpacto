"""Ejecuta en Python los mismos casos que Vitest ejecuta en TypeScript."""

import pytest
from hypothesis import given
from hypothesis import strategies as st

from core.dinero import formatear_pesos
from core.tests.casos import leer


def _casos(archivo):
    return [
        pytest.param(c["entrada"], c["esperado"], id=c["nombre"]) for c in leer(archivo)["casos"]
    ]


@pytest.mark.parametrize(("entrada", "esperado"), _casos("formato-pesos.json"))
def test_formato_pesos_casos_compartidos(entrada, esperado):
    assert formatear_pesos(entrada) == esperado


@given(st.integers(min_value=-(10**12), max_value=10**12))
def test_formato_pesos_conserva_los_digitos(pesos):
    texto = formatear_pesos(pesos)
    digitos = "".join(ch for ch in texto if ch.isdigit())

    assert int(digitos) == abs(pesos)
    assert texto.startswith("\u2212 ") == (pesos < 0)


@pytest.mark.parametrize("valor", [1.5, "1000", True, None])
def test_formato_pesos_rechaza_lo_que_no_es_entero(valor):
    with pytest.raises(TypeError):
        formatear_pesos(valor)
