// BaseLocal sobre node:sqlite (Node 24) para Jest. Sin SQLCipher: las pruebas de cifrado
// simulan `cipher_version` y la llave; el cifrado real lo prueba el build de Android.

import { DatabaseSync } from "node:sqlite";

import type { BaseLocal, Valor } from "../base";

export function baseEnMemoria(opciones: { cifrado?: boolean } = {}): BaseLocal & { db: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  const cifrado = opciones.cifrado ?? true;
  const base: BaseLocal & { db: DatabaseSync } = {
    db,
    ejecutar: async (sql) => {
      if (/^\s*PRAGMA key\b/i.test(sql)) return; // la llave solo la entiende SQLCipher
      db.exec(sql);
    },
    correr: async (sql, ...p: Valor[]) => ({ cambios: Number(db.prepare(sql).run(...p).changes) }),
    todas: async <T,>(sql: string, ...p: Valor[]) => db.prepare(sql).all(...p) as T[],
    primera: async <T,>(sql: string, ...p: Valor[]) => {
      if (/^\s*PRAGMA cipher_version/i.test(sql)) {
        return (cifrado ? { cipher_version: "4.6.1 community" } : null) as T | null;
      }
      return (db.prepare(sql).get(...p) as T | undefined) ?? null;
    },
    transaccion: async (cuerpo) => {
      db.exec("BEGIN EXCLUSIVE;");
      try {
        const resultado = await cuerpo(base);
        db.exec("COMMIT;");
        return resultado;
      } catch (error) {
        db.exec("ROLLBACK;");
        throw error;
      }
    },
    cerrar: async () => db.close(),
  };
  return base;
}
