// BaseLocal sobre expo-sqlite con SQLCipher (`useSQLCipher` en app.config.ts).

import * as SQLite from "expo-sqlite";

import { prepararBaseCifrada, type BaseLocal } from "./base";
import { migrar } from "./migraciones";

function envolver(db: SQLite.SQLiteDatabase): BaseLocal {
  const base: BaseLocal = {
    ejecutar: (sql) => db.execAsync(sql),
    correr: async (sql, ...p) => ({ cambios: (await db.runAsync(sql, p)).changes }),
    todas: (sql, ...p) => db.getAllAsync(sql, p),
    primera: (sql, ...p) => db.getFirstAsync(sql, p),
    transaccion: async (cuerpo) => {
      let resultado!: Awaited<ReturnType<typeof cuerpo>>;
      // Solo lo que corre sobre `txn` entra a la transacción exclusiva (docs de expo-sqlite).
      await db.withExclusiveTransactionAsync(async (txn) => {
        resultado = await cuerpo(envolver(txn));
      });
      return resultado;
    },
    cerrar: () => db.closeAsync(),
  };
  return base;
}

/** Abre (o crea) la base cifrada con la DEK y la lleva al esquema actual. */
export async function abrirBase(nombre: string, dek: Uint8Array): Promise<BaseLocal> {
  const base = envolver(await SQLite.openDatabaseAsync(nombre));
  await prepararBaseCifrada(base, dek);
  await migrar(base);
  return base;
}

/** Borra el archivo de la base (registro nuevo o celular retirado, E3). */
export async function borrarBase(nombre = "reunion.db"): Promise<void> {
  try {
    await SQLite.deleteDatabaseAsync(nombre);
  } catch {
    // No existía.
  }
}
