from fractions import Fraction

import pytest
from hypothesis import given
from hypothesis import strategies as st

from core.tests.casos import leer
from libro.reglas import (
    ReglaInvalida,
    calcular_prestamo,
    dividir_abono,
    montos_registro,
    preview_cierre,
    resultado_votacion,
)

PRESTAMO = leer("prestamo.json")
ABONO = leer("abono.json")
CIERRE = leer("cierre-ciclo.json")
REGISTRO = leer("registro-ahorro.json")
VOTACION = leer("votacion.json")


def _ids(caso):
    return caso["nombre"]


# --- casos compartidos con la web ------------------------------------------------------------


@pytest.mark.parametrize("caso", REGISTRO["casos"], ids=_ids)
def test_registro_ahorro(caso):
    assert montos_registro(**caso["entrada"]) == caso["esperado"]


@pytest.mark.parametrize("caso", REGISTRO["rechazos"], ids=_ids)
def test_registro_ahorro_rechazos(caso):
    with pytest.raises(ReglaInvalida):
        montos_registro(**caso["entrada"])


@pytest.mark.parametrize("caso", PRESTAMO["casos"], ids=_ids)
def test_prestamo(caso):
    assert calcular_prestamo(caso["capital"], caso["tasa"], caso["num_cuotas"]) == caso["esperado"]


@pytest.mark.parametrize("caso", PRESTAMO["rechazos"], ids=_ids)
def test_prestamo_rechazos(caso):
    with pytest.raises(ReglaInvalida):
        calcular_prestamo(caso["capital"], caso["tasa"], caso["num_cuotas"])


@pytest.mark.parametrize("caso", ABONO["casos"], ids=_ids)
def test_abono(caso):
    assert dividir_abono(caso["monto"], saldo=caso["saldo"], **caso["prestamo"]) == caso["esperado"]


@pytest.mark.parametrize("caso", ABONO["rechazos"], ids=_ids)
def test_abono_rechazos(caso):
    with pytest.raises(ReglaInvalida):
        dividir_abono(caso["monto"], saldo=caso["saldo"], **caso["prestamo"])


@pytest.mark.parametrize("caso", CIERRE["casos"], ids=_ids)
def test_cierre(caso):
    assert preview_cierre(**caso["entrada"]) == caso["esperado"]


@pytest.mark.parametrize("caso", CIERRE["rechazos"], ids=_ids)
def test_cierre_rechazos(caso):
    with pytest.raises(ReglaInvalida) as error:
        preview_cierre(**caso["entrada"])
    assert error.value.codigo == caso["codigo"]


# --- propiedades -----------------------------------------------------------------------------

tasas = st.builds(
    lambda entero, decimales: f"{entero}.{decimales}",
    st.integers(min_value=0, max_value=20),
    st.from_regex(r"[0-9]{1,4}", fullmatch=True),
)


@given(st.integers(min_value=1, max_value=10**10), tasas, st.integers(min_value=1, max_value=60))
def test_prestamo_interes_a_medio_peso_del_exacto(capital, tasa, cuotas):
    r = calcular_prestamo(capital, tasa, cuotas)
    diferencia = r["interes_mensual"] - capital * Fraction(tasa) / 100

    assert Fraction(-1, 2) < diferencia <= Fraction(1, 2)
    assert r["total_pagar"] == capital + r["interes_mensual"] * cuotas


@given(
    st.integers(min_value=1, max_value=10**9),
    tasas,
    st.integers(min_value=1, max_value=36),
    st.data(),
)
def test_abonos_de_cuotas_completas_suman_el_prestamo(capital, tasa, cuotas, data):
    p = calcular_prestamo(capital, tasa, cuotas)
    total = p["total_pagar"]
    monto = data.draw(st.integers(min_value=1, max_value=total))
    partes = dividir_abono(
        monto,
        saldo=total,
        num_cuotas=cuotas,
        **{k: p[k] for k in ("interes_mensual", "total_pagar")},
    )

    assert partes["capital"] + partes["interes"] == monto
    assert 0 <= partes["interes"] <= monto


miembro = st.fixed_dictionaries(
    {
        "acciones": st.integers(min_value=0, max_value=100),
        "fondo_social": st.integers(min_value=0, max_value=200_000),
        "multas": st.integers(min_value=0, max_value=50_000),
        "deuda": st.integers(min_value=0, max_value=2_000_000),
    }
)


@given(
    st.lists(miembro, min_size=1, max_size=25),
    st.booleans(),
    st.booleans(),
    st.booleans(),
    st.sampled_from([1, 100, 1000, 2000, 5000]),
    st.integers(min_value=0, max_value=5_000_000),
    st.integers(min_value=0, max_value=500_000),
)
def test_cierre_cuadra_y_entrega_en_billetes(miembros, fondo, multas, ventas, multiplo, interes, v):
    for n, m in enumerate(miembros):
        m["numero_miembro"] = n + 1
        m["ahorro"] = m["acciones"] * 10_000
    if sum(m["acciones"] for m in miembros) == 0:
        miembros[0]["acciones"], miembros[0]["ahorro"] = 1, 10_000
    politica = {
        "reparte_fondo_social": fondo,
        "multas_a_repartible": multas,
        "ventas_a_repartible": ventas,
        "multiplo_redondeo": multiplo,
    }

    r = preview_cierre(politica=politica, interes_cobrado=interes, ventas=v, miembros=miembros)
    t = r["totales"]

    entregado = sum(d["a_entregar"] for d in r["detalle"])
    assert entregado + t["residuo_redondeo"] == t["monto_repartible"]
    assert sum(d["participacion_interes"] for d in r["detalle"]) <= t["ganancia"]
    for d in r["detalle"]:
        assert d["a_entregar"] % multiplo == 0
        assert d["a_entregar"] >= 0 and d["deuda_arrastrada"] >= 0


@pytest.mark.parametrize("caso", VOTACION["casos"], ids=_ids)
def test_votacion(caso):
    assert resultado_votacion(**caso["entrada"]) == caso["esperado"]


@pytest.mark.parametrize("caso", VOTACION["rechazos"], ids=_ids)
def test_votacion_rechazos(caso):
    with pytest.raises(ReglaInvalida):
        resultado_votacion(**caso["entrada"])
