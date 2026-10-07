// Migraciones versionadas de la base local (PRAGMA user_version).
//
// Reglas: una migración publicada nunca se edita, solo se agregan nuevas al final; cada una
// corre en una transacción exclusiva junto con su cambio de versión, así un corte a mitad no
// deja la base a medias. Una base de una versión más nueva de la app no se abre (no se baja
// de versión): se pide actualizar la app.

import type { BaseLocal } from "./base";

export interface Migracion {
  version: number;
  sql: string;
}

export const MIGRACIONES: readonly Migracion[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE meta (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      ) STRICT;

      -- Copia de lo que manda el servidor. Caduca a los 60 días sin sincronizar (D5).
      CREATE TABLE grupo (
        id TEXT PRIMARY KEY,
        datos TEXT NOT NULL,
        descargado_en TEXT NOT NULL
      ) STRICT;

      CREATE TABLE miembros (
        membresia_id TEXT PRIMARY KEY,
        numero INTEGER NOT NULL UNIQUE,
        iniciales TEXT NOT NULL,
        activo INTEGER NOT NULL CHECK (activo IN (0, 1))
      ) STRICT;

      -- Lo escrito en este celular. Nunca caduca y no se borra hasta que el servidor lo
      -- confirma; su contenido no cambia (las correcciones son registros nuevos).
      CREATE TABLE pendientes (
        id TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,
        carga TEXT NOT NULL,
        creado_en TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'pendiente'
          CHECK (estado IN ('pendiente', 'confirmado', 'rechazado', 'en_conflicto', 'por_validar'))
      ) STRICT;

      CREATE TRIGGER pendientes_no_se_borran
      BEFORE DELETE ON pendientes WHEN OLD.estado <> 'confirmado'
      BEGIN SELECT RAISE(ABORT, 'pendiente sin confirmar'); END;

      CREATE TRIGGER pendientes_contenido_fijo
      BEFORE UPDATE OF id, tipo, carga, creado_en ON pendientes
      BEGIN SELECT RAISE(ABORT, 'el contenido de un pendiente no cambia'); END;
    `,
  },
];

export const VERSION_ACTUAL = MIGRACIONES[MIGRACIONES.length - 1].version;

export class BaseMasNueva extends Error {
  constructor(readonly version: number) {
    super("Esta base es de una versión más nueva de la app. Actualice la app.");
  }
}

export async function versionDe(base: BaseLocal): Promise<number> {
  return (await base.primera<{ user_version: number }>("PRAGMA user_version;"))?.user_version ?? 0;
}

/** Lleva la base al esquema actual. Devuelve las versiones aplicadas. */
export async function migrar(base: BaseLocal, migraciones: readonly Migracion[] = MIGRACIONES): Promise<number[]> {
  const ultima = migraciones[migraciones.length - 1]?.version ?? 0;
  const actual = await versionDe(base);
  if (actual > ultima) throw new BaseMasNueva(actual);
  const aplicadas: number[] = [];
  for (const migracion of migraciones) {
    if (migracion.version <= actual) continue;
    await base.transaccion(async (txn) => {
      await txn.ejecutar(migracion.sql);
      await txn.ejecutar(`PRAGMA user_version = ${migracion.version};`);
    });
    aplicadas.push(migracion.version);
  }
  return aplicadas;
}
