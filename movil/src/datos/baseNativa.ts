// BaseLocal sobre expo-sqlite con SQLCipher (`useSQLCipher` en app.config.ts).

import * as SQLite from "expo-sqlite";

import { prepararBaseCifrada, type BaseLocal } from "./base";
import { migrar } from "./migraciones";

function envolver(db: SQLite.SQLiteDatabase): BaseLocal {
  // Las transacciones van en ESTA conexión, la que tiene el PRAGMA key. withExclusiveTransactionAsync
  // de expo-sqlite abre otra conexión sin llave y SQLCipher la rechaza ("file is not a database").
  // Una cola en JS hace que nunca corran dos transacciones a la vez.
  let cola: Promise<unknown> = Promise.resolve();
  const base: BaseLocal = {
    ejecutar: (sql) => db.execAsync(sql),
    correr: async (sql, ...p) => ({ cambios: (await db.runAsync(sql, p)).changes }),
    todas: (sql, ...p) => db.getAllAsync(sql, p),
    primera: (sql, ...p) => db.getFirstAsync(sql, p),
    transaccion: (cuerpo) => {
      const correrTransaccion = async () => {
        await db.execAsync("BEGIN IMMEDIATE;");
        try {
          const resultado = await cuerpo(base);
          await db.execAsync("COMMIT;");
          return resultado;
        } catch (error) {
          await db.execAsync("ROLLBACK;");
          throw error;
        }
      };
      const turno = cola.then(correrTransaccion, correrTransaccion);
      cola = turno.catch(() => undefined);
      return turno;
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

/** Almacén propio de un socio (N17): su archivo, su llave; sin las migraciones de la reunión. */
export async function abrirBaseSocio(nombre: string, dek: Uint8Array): Promise<BaseLocal> {
  const base = envolver(await SQLite.openDatabaseAsync(nombre));
  await prepararBaseCifrada(base, dek);
  return base;
}
