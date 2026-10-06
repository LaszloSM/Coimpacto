// Todos los textos de la interfaz viven en archivos de idioma (D19). El MVP sale en español;
// otras lenguas se agregan como archivos hermanos de es.json, con las mismas claves.
import es from "./es.json";

type Diccionario = typeof es;

type Claves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Claves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type ClaveTexto = Claves<Diccionario>;

const diccionarios = { es } satisfies Record<string, Diccionario>;
export type Idioma = keyof typeof diccionarios;

export function t(clave: ClaveTexto, idioma: Idioma = "es"): string {
  let nodo: unknown = diccionarios[idioma];
  for (const parte of clave.split(".")) {
    nodo = (nodo as Record<string, unknown>)[parte];
  }
  if (typeof nodo !== "string") throw new Error(`Texto faltante: ${clave} (${idioma})`);
  return nodo;
}
