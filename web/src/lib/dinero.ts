// Dinero en pesos colombianos enteros. Debe dar exactamente lo mismo que backend/core/dinero.py:
// los dos ejecutan los casos de packages/casos-reglas/casos/formato-pesos.json.

const ESPACIO_NO_SEPARABLE = "\u00a0";
const MENOS = "\u2212 ";

export function formatearPesos(pesos: number): string {
  if (!Number.isSafeInteger(pesos)) {
    throw new TypeError("El dinero se maneja en pesos enteros.");
  }
  const miles = Math.abs(pesos)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${pesos < 0 ? MENOS : ""}$${ESPACIO_NO_SEPARABLE}${miles}`;
}
