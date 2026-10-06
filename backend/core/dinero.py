"""Dinero en pesos colombianos enteros.

Regla del proyecto: el dinero siempre es un entero de pesos (nunca float). El formato
es-CO usa punto como separador de miles y un espacio no separable después del signo.
Los mismos casos se prueban en Python y en TypeScript (packages/casos-reglas).
"""

ESPACIO_NO_SEPARABLE = "\u00a0"


def formatear_pesos(pesos: int) -> str:
    """Formatea pesos enteros como "$ 1.250.000" (es-CO). Los negativos llevan "−"."""
    if isinstance(pesos, bool) or not isinstance(pesos, int):
        raise TypeError("El dinero se maneja en pesos enteros (int).")
    signo = "\u2212 " if pesos < 0 else ""
    miles = f"{abs(pesos):,}".replace(",", ".")
    return f"{signo}${ESPACIO_NO_SEPARABLE}{miles}"
