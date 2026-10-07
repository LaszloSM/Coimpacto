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
  {
    // Cola de envío (TX5): el código del servidor (motivo del rechazo o de la espera). El
    // orden de envío es el de inserción (rowid).
    version: 2,
    sql: `ALTER TABLE pendientes ADD COLUMN codigo TEXT NOT NULL DEFAULT '';`,
  },
  {
    // Bajada del grupo (TX6.0): id seudónimo del titular y ahorro del ciclo confirmado por
    // el servidor, para la tarjeta de cada miembro en la reunión.
    version: 3,
    sql: `
      ALTER TABLE miembros ADD COLUMN titular_id TEXT NOT NULL DEFAULT '';
      ALTER TABLE miembros ADD COLUMN ahorro_ciclo INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    // Reunión en curso (TX6a): un solo escritor, posición del asistente para retomar en el
    // punto exacto (D14), asistencia y lo registrado por miembro (para corregir, D9).
    version: 4,
    sql: `
      CREATE TABLE reunion_local (
        id TEXT PRIMARY KEY,
        ciclo_id TEXT NOT NULL,
        numero INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        abierta_por TEXT NOT NULL,
        paso INTEGER NOT NULL DEFAULT 1 CHECK (paso BETWEEN 1 AND 9),
        miembro INTEGER NOT NULL DEFAULT 0,
        estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada'))
      ) STRICT;
      CREATE UNIQUE INDEX una_reunion_abierta ON reunion_local (estado) WHERE estado = 'abierta';

      CREATE TABLE asistencia (
        reunion_id TEXT NOT NULL REFERENCES reunion_local (id),
        membresia_id TEXT NOT NULL,
        presente INTEGER NOT NULL CHECK (presente IN (0, 1)),
        PRIMARY KEY (reunion_id, membresia_id)
      ) STRICT;

      CREATE TABLE registro_miembro (
        reunion_id TEXT NOT NULL REFERENCES reunion_local (id),
        titular_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        acciones INTEGER NOT NULL,
        fondo_social INTEGER NOT NULL CHECK (fondo_social IN (0, 1)),
        multas TEXT NOT NULL,
        elementos TEXT NOT NULL,
        PRIMARY KEY (reunion_id, titular_id)
      ) STRICT;
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
