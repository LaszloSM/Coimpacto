// PIN de 6 dígitos de cada cargo y su derivación lenta (D5, EP1).
//
// La derivación usa scrypt con r=8, p=1 y un costo N calibrado al registrar el celular para
// tardar ~1 s, nunca por debajo del piso N=2^15. Los parámetros se guardan junto a lo que
// envuelven, así un cambio de calibración no deja datos sin abrir.

import { utf8, type Cripto, type ParamsScrypt } from "./cripto";

export const PARAMS_PISO: ParamsScrypt = { N: 2 ** 15, r: 8, p: 1 };
/** Techo de memoria: 128 · N · r = 128 MiB con N=2^17; más no cabe en un celular de gama baja. */
export const N_MAXIMO = 2 ** 17;
export const LARGO_LLAVE = 32;

export type PinRechazado = "largo" | "repetido" | "secuencia";

/** Valida un PIN nuevo. Devuelve el motivo del rechazo o null si sirve. */
export function revisarPinNuevo(pin: string): PinRechazado | null {
  if (!/^\d{6}$/.test(pin)) return "largo";
  if (/^(\d)\1{5}$/.test(pin)) return "repetido";
  const digitos = [...pin].map(Number);
  const pasos = digitos.slice(1).map((d, i) => d - digitos[i]);
  if (pasos.every((p) => p === 1) || pasos.every((p) => p === -1)) return "secuencia";
  return null;
}

export function derivarDesdePin(
  cripto: Cripto,
  pin: string,
  sal: Uint8Array,
  params: ParamsScrypt,
): Promise<Uint8Array> {
  if (params.N < PARAMS_PISO.N || params.r < PARAMS_PISO.r || params.p < PARAMS_PISO.p) {
    throw new RangeError("Parámetros de derivación por debajo del piso.");
  }
  return cripto.scrypt(utf8(pin), sal, params, LARGO_LLAVE);
}

/**
 * Elige N para que la derivación tarde cerca de `objetivoMs` en este celular (EP1: 0,8–1,2 s).
 * Mide el piso y duplica N mientras el tiempo estimado no pase del objetivo.
 */
export async function calibrar(cripto: Cripto, objetivoMs = 1000): Promise<ParamsScrypt> {
  const sal = cripto.aleatorio(16);
  const inicio = cripto.ahora();
  await cripto.scrypt(utf8("000000"), sal, PARAMS_PISO, LARGO_LLAVE);
  const tiempoPiso = Math.max(cripto.ahora() - inicio, 1);
  let N = PARAMS_PISO.N;
  while (N < N_MAXIMO && tiempoPiso * ((N * 2) / PARAMS_PISO.N) <= objetivoMs * 1.2) N *= 2;
  return { ...PARAMS_PISO, N };
}
