// Reparto del cierre de ciclo, calculado en el celular para la reunión final sin señal (D19).
// Espejo de preview_cierre en backend/libro/reglas.py: el servidor lo recalcula al sincronizar.
import { pesos, pisoCociente, ReglaInvalida } from "./aritmetica";

export interface PoliticaCierre {
  reparte_fondo_social: boolean;
  multas_a_repartible: boolean;
  ventas_a_repartible: boolean;
  multiplo_redondeo: number;
}

export interface MiembroCierre {
  numero_miembro: number;
  acciones: number;
  ahorro: number;
  fondo_social: number;
  multas: number;
  deuda: number;
}

export interface EntradaCierre {
  politica: PoliticaCierre;
  interes_cobrado: number;
  ventas: number;
  miembros: MiembroCierre[];
}

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function previewCierre({ politica: pol, interes_cobrado, ventas, miembros }: EntradaCierre) {
  const multiplo = Math.max(pol.multiplo_redondeo, 1);
  const acciones = suma(miembros.map((m) => pesos(m.acciones)));
  const ahorro = suma(miembros.map((m) => pesos(m.ahorro)));
  const fondo = suma(miembros.map((m) => pesos(m.fondo_social)));
  const multas = suma(miembros.map((m) => pesos(m.multas)));
  pesos(interes_cobrado);
  pesos(ventas);
  if (acciones === 0) throw new ReglaInvalida("SIN_MOVIMIENTOS", "el ciclo no tiene ahorro registrado");

  const ganancia =
    interes_cobrado + (pol.multas_a_repartible ? multas : 0) + (pol.ventas_a_repartible ? ventas : 0);
  const repartible = ahorro + ganancia + (pol.reparte_fondo_social ? fondo : 0);

  const detalle = [...miembros]
    .sort((a, b) => a.numero_miembro - b.numero_miembro)
    .map((m) => {
      const participacion = Number(pisoCociente(BigInt(ganancia) * BigInt(m.acciones), BigInt(acciones)));
      const bruto = m.ahorro + participacion + (pol.reparte_fondo_social ? m.fondo_social : 0);
      const deuda = pesos(m.deuda);
      // Hacia abajo al múltiplo: siempre entregable en billetes.
      const billetes = Number(pisoCociente(BigInt(bruto - deuda), BigInt(multiplo)));
      return {
        numero_miembro: m.numero_miembro,
        acciones: m.acciones,
        ahorro: m.ahorro,
        aporte_fondo_social: m.fondo_social,
        multas_pagadas: m.multas,
        participacion_interes: participacion,
        deuda_pendiente: deuda,
        a_entregar: Math.max(billetes * multiplo, 0),
        deuda_arrastrada: Math.max(deuda - bruto, 0),
      };
    });

  return {
    totales: {
      acciones,
      ahorro,
      fondo_social: fondo,
      multas,
      ventas,
      interes_prestamos: interes_cobrado,
      caja_total: ahorro + fondo + multas + interes_cobrado + ventas,
      ganancia,
      monto_repartible: repartible,
      residuo_redondeo: repartible - suma(detalle.map((d) => d.a_entregar)),
      multiplo_redondeo: multiplo,
    },
    detalle,
  };
}
