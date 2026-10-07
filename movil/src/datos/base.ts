// Base local de la reunión: SQLite con SQLCipher, todo el archivo cifrado con la DEK (EX2).
//
// La DEK sale del llavero del cargo (seguridad/llavero.ts) y entra como llave cruda
// (`PRAGMA key = "x'…'"`), sin una segunda derivación: la derivación lenta ya la hizo el PIN.
// Si SQLCipher no está enlazado, la base NO se abre: nunca se guardan datos en claro.

export type Valor = string | number | null;

export interface Resultado {
  cambios: number;
}

/** Lo mínimo que la app usa de SQLite; la implementan expo-sqlite (celular) y node:sqlite (Jest). */
export interface BaseLocal {
  ejecutar(sql: string): Promise<void>;
  correr(sql: string, ...parametros: Valor[]): Promise<Resultado>;
  todas<T>(sql: string, ...parametros: Valor[]): Promise<T[]>;
  primera<T>(sql: string, ...parametros: Valor[]): Promise<T | null>;
  /** Transacción exclusiva: o se aplica todo o nada. */
  transaccion<T>(cuerpo: (base: BaseLocal) => Promise<T>): Promise<T>;
  cerrar(): Promise<void>;
}

export class SinCifrado extends Error {
  constructor() {
    super("SQLCipher no está disponible: la base no se abre sin cifrado.");
  }
}

export class LlaveIncorrecta extends Error {
  constructor() {
    super("La llave no abre esta base.");
  }
}

export function pragmaLlave(dek: Uint8Array): string {
  if (dek.length !== 32) throw new RangeError("La DEK debe tener 32 bytes.");
  const hex = Array.from(dek, (b) => b.toString(16).padStart(2, "0")).join("");
  return `PRAGMA key = "x'${hex}'";`;
}

/** Aplica la llave y comprueba que la base esté cifrada y que la llave la abra. */
export async function prepararBaseCifrada(base: BaseLocal, dek: Uint8Array): Promise<void> {
  await base.ejecutar(pragmaLlave(dek));
  const cifrado = await base.primera<{ cipher_version: string }>("PRAGMA cipher_version;");
  if (!cifrado?.cipher_version) {
    await base.cerrar();
    throw new SinCifrado();
  }
  try {
    await base.primera("SELECT count(*) AS n FROM sqlite_master;");
  } catch {
    await base.cerrar();
    throw new LlaveIncorrecta();
  }
  await base.ejecutar("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
}
