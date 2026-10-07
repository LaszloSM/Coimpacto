"""Genera los casos compartidos de las reglas de dinero (docs/reglas/reglas-de-dinero.md).

El oráculo de este script es independiente de backend/libro/reglas.py: usa fracciones exactas y
fórmulas escritas aparte. Los casos manuales además se comparan con valores calculados a mano.
Los aleatorios usan semilla fija para que el archivo sea reproducible (CI lo regenera y compara).

Uso: python packages/casos-reglas/scripts/generar_casos.py
"""

import json
import random
from fractions import Fraction as F
from pathlib import Path

CASOS = Path(__file__).resolve().parent.parent / "casos"
SEMILLA = 20261006
GENERADO = f"Generado por scripts/generar_casos.py (semilla {SEMILLA}). No editar a mano."


def redondear(x: F) -> int:
    """Al peso, mitad hacia arriba (x >= 0)."""
    return int(x + F(1, 2))


def piso(x: F) -> int:
    return x.numerator // x.denominator


# --- oráculo ------------------------------------------------------------------------------


def o_prestamo(capital, tasa, cuotas):
    interes = redondear(capital * F(tasa) / 100)
    total = capital + interes * cuotas
    return {
        "interes_mensual": interes,
        "total_pagar": total,
        "cuota_mensual": redondear(F(total, cuotas)),
    }


def o_abono(monto, interes_mensual, num_cuotas, total_pagar):
    interes = redondear(F(monto * interes_mensual * num_cuotas, total_pagar))
    return {"capital": monto - interes, "interes": interes}


def o_cierre(e):
    pol, ms = e["politica"], e["miembros"]
    mult = max(pol["multiplo_redondeo"], 1)
    acc = sum(m["acciones"] for m in ms)
    ahorro = sum(m["ahorro"] for m in ms)
    fondo = sum(m["fondo_social"] for m in ms)
    multas = sum(m["multas"] for m in ms)
    interes, ventas = e["interes_cobrado"], e["ventas"]
    ganancia = (
        interes
        + (multas if pol["multas_a_repartible"] else 0)
        + (ventas if pol["ventas_a_repartible"] else 0)
    )
    repartible = ahorro + ganancia + (fondo if pol["reparte_fondo_social"] else 0)
    detalle = []
    for m in sorted(ms, key=lambda m: m["numero_miembro"]):
        part = piso(F(ganancia * m["acciones"], acc))
        bruto = m["ahorro"] + part + (m["fondo_social"] if pol["reparte_fondo_social"] else 0)
        detalle.append(
            {
                "numero_miembro": m["numero_miembro"],
                "acciones": m["acciones"],
                "ahorro": m["ahorro"],
                "aporte_fondo_social": m["fondo_social"],
                "multas_pagadas": m["multas"],
                "participacion_interes": part,
                "deuda_pendiente": m["deuda"],
                "a_entregar": max(piso(F(bruto - m["deuda"], mult)) * mult, 0),
                "deuda_arrastrada": max(m["deuda"] - bruto, 0),
            }
        )
    return {
        "totales": {
            "acciones": acc,
            "ahorro": ahorro,
            "fondo_social": fondo,
            "multas": multas,
            "ventas": ventas,
            "interes_prestamos": interes,
            "caja_total": ahorro + fondo + multas + interes + ventas,
            "ganancia": ganancia,
            "monto_repartible": repartible,
            "residuo_redondeo": repartible - sum(d["a_entregar"] for d in detalle),
            "multiplo_redondeo": mult,
        },
        "detalle": detalle,
    }


# --- casos manuales (valores esperados verificados a mano) --------------------------------

PRESTAMOS = [
    ("ejemplo del documento: 1.000.000 al 2 % en 3", 1_000_000, "2", 3, (20_000, 1_060_000, 353_333)),
    ("tasa con decimal", 500_000, "2.5", 6, (12_500, 575_000, 95_833)),
    ("9.999,99 de interés sube a 10.000", 333_333, "3", 4, (10_000, 373_333, 93_333)),
    ("tasa cero", 150_000, "0", 2, (0, 150_000, 75_000)),
    ("una sola cuota", 100_001, "1.5", 1, (1_500, 101_501, 101_501)),
    ("medio peso de interés sube a 1", 50, "1", 3, (1, 53, 18)),
    ("cuota 18,5 sube a 19", 70, "1", 4, (1, 74, 19)),
]

# Préstamo de 1.000.000 al 2 % en 3 cuotas: interés mensual 20.000, total 1.060.000.
PRESTAMO_EJEMPLO = {"interes_mensual": 20_000, "num_cuotas": 3, "total_pagar": 1_060_000}
ABONOS = [
    ("una cuota", 353_333, (333_333, 20_000)),
    ("pago total", 1_060_000, (1_000_000, 60_000)),
    ("medio préstamo", 530_000, (500_000, 30_000)),
    ("un peso va todo a capital", 1, (1, 0)),
]

POLITICA_ACTUAL = {
    "reparte_fondo_social": False,
    "multas_a_repartible": True,
    "ventas_a_repartible": False,
    "multiplo_redondeo": 1000,
}
CIERRE_BASE = {
    "politica": POLITICA_ACTUAL,
    "interes_cobrado": 37_500,
    "ventas": 10_000,
    "miembros": [
        {"numero_miembro": 1, "acciones": 20, "ahorro": 200_000, "fondo_social": 20_000,
         "multas": 4_000, "deuda": 0},
        {"numero_miembro": 2, "acciones": 15, "ahorro": 150_000, "fondo_social": 20_000,
         "multas": 0, "deuda": 120_000},
        {"numero_miembro": 3, "acciones": 5, "ahorro": 50_000, "fondo_social": 20_000,
         "multas": 2_000, "deuda": 300_000},
    ],
}
CIERRE_TODO = {
    **CIERRE_BASE,
    "politica": {
        "reparte_fondo_social": True,
        "multas_a_repartible": True,
        "ventas_a_repartible": True,
        "multiplo_redondeo": 1,
    },
}


def verificar_a_mano():
    for _, cap, tasa, n, esperado in PRESTAMOS:
        assert tuple(o_prestamo(cap, tasa, n).values()) == esperado, (cap, tasa, n)
    for _, monto, (cap, inte) in ABONOS:
        assert o_abono(monto, **PRESTAMO_EJEMPLO) == {"capital": cap, "interes": inte}, monto
    r = o_cierre(CIERRE_BASE)
    assert [d["participacion_interes"] for d in r["detalle"]] == [21_750, 16_312, 5_437]
    assert [d["a_entregar"] for d in r["detalle"]] == [221_000, 46_000, 0]
    assert r["detalle"][2]["deuda_arrastrada"] == 244_563
    t = r["totales"]
    assert (t["caja_total"], t["monto_repartible"], t["residuo_redondeo"]) == (513_500, 443_500, 176_500)


def escribir(nombre, doc):
    texto = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
    (CASOS / nombre).write_text(texto, encoding="utf-8", newline="\n")


def casos_prestamo(azar):
    casos = [
        {"nombre": n, "capital": c, "tasa": t, "num_cuotas": k, "esperado": o_prestamo(c, t, k)}
        for n, c, t, k, _ in PRESTAMOS
    ]
    for i in range(200):
        c = azar.choice([azar.randint(1, 999), azar.randint(1_000, 5_000_000)])
        if azar.random() < 0.5:
            t = f"{azar.randint(0, 10)}.{azar.randint(0, 99):02d}"
        else:
            t = str(azar.randint(0, 10))
        k = azar.randint(1, 24)
        casos.append(
            {"nombre": f"aleatorio {i}", "capital": c, "tasa": t, "num_cuotas": k,
             "esperado": o_prestamo(c, t, k)}
        )
    return {
        "regla": "prestamo",
        "descripcion": f"Interés fijo sobre el capital (tasa en % mensual). {GENERADO}",
        "casos": casos,
        "rechazos": [
            {"nombre": "capital cero", "capital": 0, "tasa": "2", "num_cuotas": 3},
            {"nombre": "sin cuotas", "capital": 1000, "tasa": "2", "num_cuotas": 0},
            {"nombre": "tasa negativa", "capital": 1000, "tasa": "-1", "num_cuotas": 3},
            {"nombre": "tasa con coma", "capital": 1000, "tasa": "2,5", "num_cuotas": 3},
            {"nombre": "tasa como número", "capital": 1000, "tasa": 2, "num_cuotas": 3},
            {"nombre": "capital con decimales", "capital": 1000.5, "tasa": "2", "num_cuotas": 3},
        ],
    }


def casos_abono(azar):
    casos = [
        {"nombre": n, "monto": m, "saldo": 1_060_000, "prestamo": PRESTAMO_EJEMPLO,
         "esperado": o_abono(m, **PRESTAMO_EJEMPLO)}
        for n, m, _ in ABONOS
    ]
    for i in range(200):
        cuotas = azar.randint(1, 12)
        tasa = f"{azar.randint(0, 5)}.{azar.randint(0, 9)}"
        p = o_prestamo(azar.randint(1_000, 5_000_000), tasa, cuotas)
        prestamo = {"interes_mensual": p["interes_mensual"], "num_cuotas": cuotas,
                    "total_pagar": p["total_pagar"]}
        monto = azar.randint(1, p["total_pagar"])
        casos.append(
            {"nombre": f"aleatorio {i}", "monto": monto, "saldo": p["total_pagar"],
             "prestamo": prestamo, "esperado": o_abono(monto, **prestamo)}
        )
    return {
        "regla": "abono",
        "descripcion": f"División del abono en capital e interés. {GENERADO}",
        "casos": casos,
        "rechazos": [
            {"nombre": "abono mayor que el saldo", "monto": 101, "saldo": 100,
             "prestamo": PRESTAMO_EJEMPLO},
            {"nombre": "abono cero", "monto": 0, "saldo": 100, "prestamo": PRESTAMO_EJEMPLO},
        ],
    }


def casos_cierre(azar):
    casos = [
        {"nombre": "política actual: fondo no, multas sí, ventas no, billetes de 1.000",
         "entrada": CIERRE_BASE, "esperado": o_cierre(CIERRE_BASE)},
        {"nombre": "todo repartible y sin redondeo", "entrada": CIERRE_TODO,
         "esperado": o_cierre(CIERRE_TODO)},
    ]
    for i in range(25):
        miembros = []
        for n in range(azar.randint(1, 20)):
            acciones = azar.randint(0, 60)
            miembros.append(
                {
                    "numero_miembro": n + 1,
                    "acciones": acciones,
                    "ahorro": acciones * 10_000,
                    "fondo_social": azar.choice([0, 2_000, 5_000]) * azar.randint(1, 10),
                    "multas": azar.randint(0, 5) * 1_000,
                    "deuda": azar.choice([0, 0, 0, azar.randint(1, 800_000)]),
                }
            )
        if sum(m["acciones"] for m in miembros) == 0:
            miembros[0]["acciones"], miembros[0]["ahorro"] = 1, 10_000
        e = {
            "politica": {
                "reparte_fondo_social": azar.random() < 0.5,
                "multas_a_repartible": azar.random() < 0.8,
                "ventas_a_repartible": azar.random() < 0.3,
                "multiplo_redondeo": azar.choice([1, 100, 1000, 2000]),
            },
            "interes_cobrado": azar.randint(0, 2_000_000),
            "ventas": azar.randint(0, 300_000),
            "miembros": miembros,
        }
        casos.append({"nombre": f"aleatorio {i}", "entrada": e, "esperado": o_cierre(e)})
    sin_acciones = {
        **CIERRE_BASE,
        "miembros": [{**m, "acciones": 0, "ahorro": 0} for m in CIERRE_BASE["miembros"]],
    }
    return {
        "regla": "cierre-ciclo",
        "descripcion": f"Preview del reparto del cierre de ciclo. {GENERADO}",
        "casos": casos,
        "rechazos": [
            {"nombre": "ciclo sin acciones", "entrada": sin_acciones, "codigo": "SIN_MOVIMIENTOS"}
        ],
    }


def casos_registro():
    def entrada(acciones, multas, valor_accion=10_000, valor_multa=2_000, maximo=5):
        return {"acciones": acciones, "cantidad_multas": multas, "valor_accion": valor_accion,
                "valor_multa": valor_multa, "max_acciones": maximo}

    return {
        "regla": "registro-ahorro",
        "descripcion": "Montos del registro de ahorro desde los precios congelados de la reunión.",
        "casos": [
            {"nombre": "aporte típico", "entrada": entrada(3, 1),
             "esperado": {"ahorro": 30_000, "multas": 2_000}},
            {"nombre": "no asistió: sin acciones", "entrada": entrada(0, 0),
             "esperado": {"ahorro": 0, "multas": 0}},
            {"nombre": "justo en el máximo", "entrada": entrada(5, 2, 5_000, 1_000),
             "esperado": {"ahorro": 25_000, "multas": 2_000}},
        ],
        "rechazos": [
            {"nombre": "más acciones que el máximo", "entrada": entrada(6, 0)},
            {"nombre": "acciones negativas", "entrada": entrada(-1, 0)},
            {"nombre": "multas negativas", "entrada": entrada(1, -1)},
        ],
    }


def main():
    verificar_a_mano()
    azar = random.Random(SEMILLA)
    escribir("prestamo.json", casos_prestamo(azar))
    escribir("abono.json", casos_abono(azar))
    escribir("cierre-ciclo.json", casos_cierre(azar))
    escribir("registro-ahorro.json", casos_registro())


if __name__ == "__main__":
    main()
