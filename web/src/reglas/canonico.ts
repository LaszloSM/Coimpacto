// Serialización canónica JSON (RFC 8785, JCS) para hashes y firmas.
// Debe producir los mismos bytes que backend/core/canonico.py: los dos ejecutan
// packages/casos-reglas/casos/canonico-jcs.json. Solo se aceptan enteros seguros (el dinero
// es entero); cualquier número no entero se rechaza.

export type ValorJson = null | boolean | number | string | ValorJson[] | { [clave: string]: ValorJson };

export class ValorNoCanonico extends TypeError {}

// RFC 8785 §3.2.3: orden por unidades de código UTF-16. La comparación de strings de JS ya
// compara unidades UTF-16, así que no se usa localeCompare.
const porUtf16 = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function serializar(valor: unknown): string {
  if (valor === null) return "null";
  if (valor === true) return "true";
  if (valor === false) return "false";
  if (typeof valor === "number") {
    if (!Number.isSafeInteger(valor)) {
      throw new ValorNoCanonico(`Solo enteros seguros: ${valor}`);
    }
    return Object.is(valor, -0) ? "0" : String(valor);
  }
  if (typeof valor === "string") {
    if (!valor.isWellFormed()) throw new ValorNoCanonico("Texto con sustitutos sueltos.");
    return JSON.stringify(valor);
  }
  if (Array.isArray(valor)) return `[${valor.map(serializar).join(",")}]`;
  if (typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    const claves = Object.keys(objeto).sort(porUtf16);
    return `{${claves.map((k) => `${serializar(k)}:${serializar(objeto[k])}`).join(",")}}`;
  }
  throw new ValorNoCanonico(`Tipo no serializable de forma canónica: ${typeof valor}`);
}

export function canonico(valor: ValorJson): string {
  return serializar(valor);
}

/** SHA-256 en hexadecimal del texto JCS en UTF-8 (WebCrypto: navegador y Node). */
export async function hashCanonico(valor: ValorJson): Promise<string> {
  const bytes = new TextEncoder().encode(canonico(valor));
  const resumen = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, "0")).join("");
}
