// Aritmética exacta de dinero: enteros de pesos y tasas en texto decimal, sin coma flotante.
// Espejo de las utilidades de backend/libro/reglas.py.

/** `codigo` es estable (lo usa la interfaz para traducir el error), igual que en Python. */
export class ReglaInvalida extends RangeError {
  readonly codigo: string;

  constructor(codigo: string, detalle = "") {
    super(detalle ? `${codigo}: ${detalle}` : codigo);
    this.codigo = codigo;
  }
}

export function pesos(valor: unknown, { positivo = false } = {}): number {
  if (typeof valor !== "number" || !Number.isSafeInteger(valor)) {
    throw new ReglaInvalida("MONTO_NO_ENTERO", String(valor));
  }
  if (valor < 0 || (positivo && valor === 0)) {
    throw new ReglaInvalida("MONTO_INVALIDO", String(valor));
  }
  return valor;
}

const TASA = /^\d+(\.\d+)?$/;

/** Tasa en porcentaje mensual ("2.5") como fracción exacta numerador / escala. */
export function tasaPorcentaje(valor: unknown): { numerador: bigint; escala: bigint } {
  if (typeof valor !== "string" || !TASA.test(valor)) {
    throw new ReglaInvalida("TASA_INVALIDA", String(valor));
  }
  const [entero, decimales = ""] = valor.split(".");
  return { numerador: BigInt(entero + decimales), escala: 10n ** BigInt(decimales.length) };
}

/** a / b al peso, mitad hacia arriba (a >= 0, b > 0). */
export function redondearCociente(a: bigint, b: bigint): bigint {
  return (2n * a + b) / (2n * b);
}

/** Piso de a / b para cualquier signo de a (la división de BigInt trunca hacia cero). */
export function pisoCociente(a: bigint, b: bigint): bigint {
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}
