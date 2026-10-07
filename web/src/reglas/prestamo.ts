// Préstamo interno con interés fijo sobre el capital inicial (decisión D1 de T3) y división de
// abonos. Espejo de backend/libro/reglas.py; especificación en docs/reglas/reglas-de-dinero.md.
import { pesos, ReglaInvalida, redondearCociente, tasaPorcentaje } from "./aritmetica";

export interface Prestamo {
  interes_mensual: number;
  total_pagar: number;
  cuota_mensual: number;
}

export function calcularPrestamo(capital: number, tasa: string, numCuotas: number): Prestamo {
  pesos(capital, { positivo: true });
  pesos(numCuotas, { positivo: true });
  const { numerador, escala } = tasaPorcentaje(tasa);
  const interes = redondearCociente(BigInt(capital) * numerador, escala * 100n);
  const total = BigInt(capital) + interes * BigInt(numCuotas);
  return {
    interes_mensual: Number(interes),
    total_pagar: Number(total),
    cuota_mensual: Number(redondearCociente(total, BigInt(numCuotas))),
  };
}

export interface DatosAbono {
  saldo: number;
  interes_mensual: number;
  num_cuotas: number;
  total_pagar: number;
}

/** Parte el abono en capital e interés, en proporción fija al interés total del préstamo. */
export function dividirAbono(monto: number, p: DatosAbono): { capital: number; interes: number } {
  pesos(monto, { positivo: true });
  if (monto > pesos(p.saldo)) {
    throw new ReglaInvalida("ABONO_EXCEDE_SALDO", `saldo ${p.saldo}, abono ${monto}`);
  }
  const interesTotal = BigInt(p.interes_mensual) * BigInt(p.num_cuotas);
  const total = BigInt(pesos(p.total_pagar, { positivo: true }));
  const interes = Number(redondearCociente(BigInt(monto) * interesTotal, total));
  return { capital: monto - interes, interes };
}
