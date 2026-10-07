// UUID deterministas (v5, RFC 4122) por clave natural (D1 de alcance): el mismo aporte de la
// misma persona en la misma reunión siempre tiene el mismo id, así un doble toque o una
// recaptura nunca se duplican; si el contenido cambia, el servidor lo marca en conflicto.

import { copia, unir, utf8, type Cripto } from "../seguridad/cripto";

/** Espacio de nombres de Credimpacto (UUID v4 fijo; no cambiar nunca). */
export const ESPACIO_CREDIMPACTO = "3d5c8f1e-7a42-4b6e-9c0d-2f8a6e1b4c97";

function bytesDe(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new TypeError(`UUID inválido: ${uuid}`);
  return Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16));
}

function texto(b: Uint8Array): string {
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function uuidV5(cripto: Cripto, espacio: string, nombre: string): Promise<string> {
  const resumen = new Uint8Array(
    await cripto.subtle.digest("SHA-1", copia(unir(bytesDe(espacio), utf8(nombre)))),
  ).slice(0, 16);
  resumen[6] = (resumen[6] & 0x0f) | 0x50;
  resumen[8] = (resumen[8] & 0x3f) | 0x80;
  return texto(resumen);
}

/** Id de un elemento por su clave natural, p. ej. ("ahorro", reunión, titular). */
export function idNatural(cripto: Cripto, tipo: string, ...partes: string[]): Promise<string> {
  return uuidV5(cripto, ESPACIO_CREDIMPACTO, [tipo, ...partes].join("/"));
}
