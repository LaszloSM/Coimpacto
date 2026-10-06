"""Genera casos aleatorios (semilla fija) de interés sobre saldo con un oráculo independiente.

El oráculo usa fracciones exactas, no Decimal, para no repetir la implementación que prueba.
Uso: python packages/casos-reglas/scripts/generar_interes_aleatorio.py
"""

import json
import random
from fractions import Fraction
from pathlib import Path

SEMILLA = 20261006
DESTINO = Path(__file__).resolve().parent.parent / "casos" / "interes-aleatorio.json"


def oraculo(saldo: int, tasa: str) -> int:
    exacto = saldo * Fraction(tasa)
    return int(exacto + Fraction(1, 2)) if exacto >= 0 else 0  # piso(x + 1/2): mitad hacia arriba


def main() -> None:
    azar = random.Random(SEMILLA)
    casos = []
    for i in range(300):
        saldo = azar.choice([azar.randint(0, 999), azar.randint(1_000, 5_000_000), 10**azar.randint(0, 9)])
        decimales = azar.randint(1, 4)
        tasa = f"{azar.randint(0, 10**decimales // 10):d}"
        tasa = f"0.{tasa.zfill(decimales)}"
        casos.append({"nombre": f"aleatorio {i}", "saldo": saldo, "tasa": tasa, "esperado": oraculo(saldo, tasa)})
    doc = {
        "regla": "interes-sobre-saldo",
        "descripcion": f"Generado por scripts/generar_interes_aleatorio.py (semilla {SEMILLA}). No editar a mano.",
        "casos": casos,
    }
    DESTINO.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
