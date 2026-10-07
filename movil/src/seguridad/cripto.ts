// Primitivas criptográficas que usa la app, detrás de una interfaz para poder probarlas.
//
// En el celular las da react-native-quick-crypto (criptoNativo.ts, C++ en hilos aparte, EX1);
// en Jest, node:crypto (pruebas/criptoNode.ts). Ninguna operación usa la fuente del sistema
// ni guarda secretos en claro.

export interface ParamsScrypt {
  /** Costo (potencia de 2). Piso: 2^15 (EP1). */
  N: number;
  r: number;
  p: number;
}

export interface Cripto {
  subtle: SubtleCrypto;
  aleatorio(largo: number): Uint8Array;
  scrypt(secreto: Uint8Array, sal: Uint8Array, params: ParamsScrypt, largo: number): Promise<Uint8Array>;
  hkdf(ikm: Uint8Array, sal: Uint8Array, info: string, largo: number): Promise<Uint8Array>;
  /** Reloj en milisegundos para calibrar la derivación del PIN. */
  ahora(): number;
}

export const utf8 = (texto: string) => new TextEncoder().encode(texto);

export function unir(...partes: Uint8Array[]): Uint8Array {
  const salida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
}

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** base64url sin relleno, el formato que espera el servidor (core/firmas.py). */
export function aB64url(bytes: Uint8Array | ArrayBuffer): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let salida = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    salida += ALFABETO[(n >> 18) & 63] + ALFABETO[(n >> 12) & 63];
    if (i + 1 < b.length) salida += ALFABETO[(n >> 6) & 63];
    if (i + 2 < b.length) salida += ALFABETO[n & 63];
  }
  return salida;
}

export function desdeB64url(texto: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(texto) || texto.length % 4 === 1) {
    throw new TypeError("base64url inválido.");
  }
  const salida: number[] = [];
  let acumulado = 0;
  let bits = 0;
  for (const c of texto) {
    acumulado = (acumulado << 6) | ALFABETO.indexOf(c);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      salida.push((acumulado >> bits) & 255);
    }
  }
  return new Uint8Array(salida);
}

/** WebCrypto pide BufferSource con ArrayBuffer propio; esto evita vistas sobre buffers compartidos. */
export const copia = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);
