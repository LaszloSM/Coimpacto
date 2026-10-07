"""Lectura de los casos compartidos de packages/casos-reglas (los mismos que corre Vitest)."""

import json
from pathlib import Path

CASOS_DIR = Path(__file__).resolve().parents[3] / "packages" / "casos-reglas" / "casos"


def leer(archivo: str) -> dict:
    return json.loads((CASOS_DIR / archivo).read_text(encoding="utf-8"))
