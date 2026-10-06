import json

import pytest
from hypothesis import given
from hypothesis import strategies as st

from core.canonico import ENTERO_SEGURO_MAX, ValorNoCanonico, canonico, hash_canonico
from core.tests.casos import leer

CASOS = leer("canonico-jcs.json")


@pytest.mark.parametrize("caso", CASOS["casos"], ids=lambda c: c["nombre"])
def test_casos_compartidos(caso):
    assert canonico(caso["entrada"]) == caso["esperado"]
    assert hash_canonico(caso["entrada"]) == caso["sha256"]


@pytest.mark.parametrize("caso", CASOS["rechazos"], ids=lambda c: c["nombre"])
def test_rechaza_lo_que_no_es_canonico(caso):
    with pytest.raises(ValorNoCanonico):
        canonico(caso["entrada"])


valores_json = st.recursive(
    st.none()
    | st.booleans()
    | st.integers(min_value=-ENTERO_SEGURO_MAX, max_value=ENTERO_SEGURO_MAX)
    | st.text(),
    lambda hijos: st.lists(hijos, max_size=4) | st.dictionaries(st.text(), hijos, max_size=4),
    max_leaves=20,
)


@given(valores_json)
def test_es_json_valido_que_conserva_el_valor(valor):
    assert json.loads(canonico(valor)) == valor


@given(st.dictionaries(st.text(), st.integers(min_value=0, max_value=10**9), max_size=6))
def test_no_depende_del_orden_de_insercion(valor):
    al_reves = dict(reversed(list(valor.items())))

    assert canonico(al_reves) == canonico(valor)
