"""Reglas puras de dinero del libro de la ACAP.

Sin acceso a base de datos ni a Django: entran enteros y tasas, salen enteros. El celular corre
la misma lógica en TypeScript (web/src/reglas/) para la reunión sin señal y el cierre de ciclo
(D19); los dos ejecutan los casos de packages/casos-reglas, y el servidor es la autoridad.

Reglas (diseño aprobado, "Dinero y redondeo"):
- Todo valor monetario es un entero de pesos colombianos.
- Las tasas son decimales exactos en texto ("0.025"), nunca coma flotante.
- El interés se calcula sobre el saldo de capital y se redondea al peso, mitad hacia arriba.
"""

import re
from decimal import ROUND_HALF_UP, Decimal

_TASA = re.compile(r"\d+(\.\d+)?")


class ReglaInvalida(ValueError):
    """Entrada fuera de las reglas de dinero (monto no entero, tasa mal escrita, negativos)."""


def pesos(valor) -> int:
    """Valida que `valor` sea un monto en pesos: entero no booleano y no negativo."""
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise ReglaInvalida(f"El dinero se maneja en pesos enteros: {valor!r}")
    if valor < 0:
        raise ReglaInvalida(f"Monto negativo: {valor}")
    return valor


def tasa(valor) -> Decimal:
    """Convierte una tasa escrita como texto decimal ("0.025") en Decimal exacto."""
    if not isinstance(valor, str) or not _TASA.fullmatch(valor):
        raise ReglaInvalida(f'La tasa va como texto decimal con punto, p. ej. "0.025": {valor!r}')
    return Decimal(valor)


def redondear_al_peso(valor: Decimal) -> int:
    """Redondea al peso con mitad hacia arriba (ROUND_HALF_UP)."""
    return int(valor.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def interes_sobre_saldo(saldo: int, tasa_cuota: str) -> int:
    """Interés de una cuota: saldo de capital × tasa, al peso, mitad hacia arriba."""
    return redondear_al_peso(pesos(saldo) * tasa(tasa_cuota))
