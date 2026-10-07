"""Reglas puras de dinero del libro de la ACAP.

Sin base de datos ni Django: entran enteros y tasas, salen enteros. La app Android corre la misma
lógica en TypeScript (packages/reglas/) para la reunión sin señal y el cierre de ciclo (D19);
los dos ejecutan los casos de packages/casos-reglas, y el servidor es la autoridad.

Especificación: docs/reglas/reglas-de-dinero.md (portada de las RPC fn_* de Supabase).
- Todo monto es un entero de pesos colombianos.
- Las tasas son texto decimal exacto en porcentaje mensual ("2.5" = 2,5 %), nunca coma flotante.
- redondear = al peso, mitad hacia arriba; los repartos usan piso.
"""

import re
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

_TASA = re.compile(r"\d+(\.\d+)?")


class ReglaInvalida(ValueError):
    """Entrada fuera de las reglas de dinero. `codigo` es estable para que la web lo traduzca."""

    def __init__(self, codigo: str, detalle: str = ""):
        super().__init__(f"{codigo}: {detalle}" if detalle else codigo)
        self.codigo = codigo


def pesos(valor, *, positivo: bool = False) -> int:
    """Valida un monto en pesos: entero no booleano, no negativo (o > 0 si `positivo`)."""
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise ReglaInvalida("MONTO_NO_ENTERO", repr(valor))
    if valor < 0 or (positivo and valor == 0):
        raise ReglaInvalida("MONTO_INVALIDO", repr(valor))
    return valor


def tasa_porcentaje(valor) -> Decimal:
    """Tasa mensual en porcentaje escrita como texto decimal con punto ("2", "2.5")."""
    if not isinstance(valor, str) or not _TASA.fullmatch(valor):
        raise ReglaInvalida("TASA_INVALIDA", repr(valor))
    return Decimal(valor)


def redondear(valor: Decimal) -> int:
    """Al peso, mitad hacia arriba (igual que round(numeric) de PostgreSQL para positivos)."""
    return int(valor.quantize(Decimal(1), rounding=ROUND_HALF_UP))


# --- Registro de ahorro ----------------------------------------------------------------------


def montos_registro(
    *, acciones: int, cantidad_multas: int, valor_accion: int, valor_multa: int, max_acciones: int
) -> dict:
    """Ahorro y multas de una persona en la reunión, desde los precios congelados al abrirla."""
    pesos(acciones)
    pesos(cantidad_multas)
    if acciones > max_acciones:
        raise ReglaInvalida("MAXIMO_ACCIONES", f"{acciones} > {max_acciones}")
    return {
        "ahorro": acciones * pesos(valor_accion),
        "multas": cantidad_multas * pesos(valor_multa),
    }


# --- Préstamo y abono --------------------------------------------------------------------------


def calcular_prestamo(capital: int, tasa: str, num_cuotas: int) -> dict:
    """Interés fijo sobre el capital inicial (decisión D1 de T3)."""
    pesos(capital, positivo=True)
    pesos(num_cuotas, positivo=True)
    interes = redondear(capital * tasa_porcentaje(tasa) / 100)
    total = capital + interes * num_cuotas
    return {
        "interes_mensual": interes,
        "total_pagar": total,
        "cuota_mensual": redondear(Decimal(total) / num_cuotas),
    }


def dividir_abono(
    monto: int, *, saldo: int, interes_mensual: int, num_cuotas: int, total_pagar: int
) -> dict:
    """Parte el abono en capital e interés, en proporción fija al interés total del préstamo."""
    pesos(monto, positivo=True)
    if monto > pesos(saldo):
        raise ReglaInvalida("ABONO_EXCEDE_SALDO", f"saldo {saldo}, abono {monto}")
    interes_total = interes_mensual * num_cuotas
    interes = redondear(Decimal(monto * interes_total) / pesos(total_pagar, positivo=True))
    return {"capital": monto - interes, "interes": interes}


# --- Cierre de ciclo ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PoliticaCierre:
    reparte_fondo_social: bool
    multas_a_repartible: bool
    ventas_a_repartible: bool
    multiplo_redondeo: int


def _piso(numerador: int, denominador: int) -> int:
    return numerador // denominador


def preview_cierre(
    *, politica: dict, interes_cobrado: int, ventas: int, miembros: list[dict]
) -> dict:
    """Reparto del cierre de ciclo. `miembros`: quienes tienen registros de ahorro en el ciclo.

    Cada miembro trae numero_miembro, acciones, ahorro, fondo_social, multas y deuda (saldo de sus
    préstamos vigentes).
    """
    pol = PoliticaCierre(**politica)
    multiplo = max(pol.multiplo_redondeo, 1)
    acciones = sum(pesos(m["acciones"]) for m in miembros)
    ahorro = sum(pesos(m["ahorro"]) for m in miembros)
    fondo = sum(pesos(m["fondo_social"]) for m in miembros)
    multas = sum(pesos(m["multas"]) for m in miembros)
    pesos(interes_cobrado)
    pesos(ventas)
    if acciones == 0:
        raise ReglaInvalida("SIN_MOVIMIENTOS", "el ciclo no tiene ahorro registrado")

    ganancia = (
        interes_cobrado
        + (multas if pol.multas_a_repartible else 0)
        + (ventas if pol.ventas_a_repartible else 0)
    )
    repartible = ahorro + ganancia + (fondo if pol.reparte_fondo_social else 0)

    detalle = []
    for m in sorted(miembros, key=lambda m: m["numero_miembro"]):
        participacion = _piso(ganancia * m["acciones"], acciones)
        bruto = m["ahorro"] + participacion + (m["fondo_social"] if pol.reparte_fondo_social else 0)
        deuda = pesos(m["deuda"])
        detalle.append(
            {
                "numero_miembro": m["numero_miembro"],
                "acciones": m["acciones"],
                "ahorro": m["ahorro"],
                "aporte_fondo_social": m["fondo_social"],
                "multas_pagadas": m["multas"],
                "participacion_interes": participacion,
                "deuda_pendiente": deuda,
                # hacia abajo al múltiplo: siempre entregable en billetes
                "a_entregar": max(_piso(bruto - deuda, multiplo) * multiplo, 0),
                "deuda_arrastrada": max(deuda - bruto, 0),
            }
        )

    return {
        "totales": {
            "acciones": acciones,
            "ahorro": ahorro,
            "fondo_social": fondo,
            "multas": multas,
            "ventas": ventas,
            "interes_prestamos": interes_cobrado,
            "caja_total": ahorro + fondo + multas + interes_cobrado + ventas,
            "ganancia": ganancia,
            "monto_repartible": repartible,
            "residuo_redondeo": repartible - sum(d["a_entregar"] for d in detalle),
            "multiplo_redondeo": multiplo,
        },
        "detalle": detalle,
    }
