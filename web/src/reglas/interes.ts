// Interés de una cuota: saldo de capital × tasa, redondeado al peso con mitad hacia arriba.
// Espejo de backend/libro/reglas.py. Sin coma flotante: la tasa entra como texto decimal y la
// cuenta se hace con BigInt sobre la tasa escalada a entero.

export class ReglaInvalida extends RangeError {}

const TASA = /^\d+(\.\d+)?$/;

export function validarPesos(valor: unknown): number {
  if (typeof valor !== "number" || !Number.isSafeInteger(valor)) {
    throw new ReglaInvalida(`El dinero se maneja en pesos enteros: ${String(valor)}`);
  }
  if (valor < 0) throw new ReglaInvalida(`Monto negativo: ${valor}`);
  return valor;
}

/** Tasa "0.025" -> { numerador: 25n, escala: 1000n } */
export function validarTasa(valor: unknown): { numerador: bigint; escala: bigint } {
  if (typeof valor !== "string" || !TASA.test(valor)) {
    throw new ReglaInvalida(`La tasa va como texto decimal con punto, p. ej. "0.025": ${String(valor)}`);
  }
  const [entero, decimales = ""] = valor.split(".");
  return { numerador: BigInt(entero + decimales), escala: 10n ** BigInt(decimales.length) };
}

export function interesSobreSaldo(saldo: number, tasa: string): number {
  const capital = BigInt(validarPesos(saldo));
  const { numerador, escala } = validarTasa(tasa);
  // piso((capital × numerador) / escala + 1/2) = piso((2 × capital × numerador + escala) / (2 × escala))
  const resultado = (2n * capital * numerador + escala) / (2n * escala);
  return Number(resultado);
}
