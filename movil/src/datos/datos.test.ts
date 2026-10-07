import { LlaveIncorrecta, pragmaLlave, prepararBaseCifrada, SinCifrado } from "./base";
import { aplicarCaducidad, diasSinSincronizar, registrarSincronizacion } from "./caducidad";
import { BaseMasNueva, migrar, MIGRACIONES, VERSION_ACTUAL, versionDe } from "./migraciones";
import { baseEnMemoria } from "./pruebas/baseNode";

const DEK = new Uint8Array(32).map((_, i) => i);

async function baseLista() {
  const base = baseEnMemoria();
  await prepararBaseCifrada(base, DEK);
  await migrar(base);
  return base;
}

const pendiente = (id: string, estado = "pendiente") => [
  "INSERT INTO pendientes (id, tipo, carga, creado_en, estado) VALUES (?, 'aporte', '{\"pesos\":50000}', '2026-10-04T15:00:00Z', ?);",
  id,
  estado,
] as const;

describe("cifrado", () => {
  test("la llave entra cruda, en hexadecimal, sin derivación", () => {
    expect(pragmaLlave(DEK)).toBe(`PRAGMA key = "x'${"000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"}'";`);
    expect(() => pragmaLlave(new Uint8Array(16))).toThrow(RangeError);
  });

  test("sin SQLCipher la base no se abre", async () => {
    await expect(prepararBaseCifrada(baseEnMemoria({ cifrado: false }), DEK)).rejects.toBeInstanceOf(SinCifrado);
  });

  test("una llave que no abre la base se informa como tal", async () => {
    const base = baseEnMemoria();
    const original = base.primera.bind(base);
    base.primera = async (sql, ...p) => {
      if (/sqlite_master/.test(sql)) throw new Error("file is not a database");
      return original(sql, ...p);
    };
    await expect(prepararBaseCifrada(base, DEK)).rejects.toBeInstanceOf(LlaveIncorrecta);
  });
});

describe("migraciones", () => {
  test("una base nueva queda en la versión actual con sus tablas", async () => {
    const base = await baseLista();
    expect(await versionDe(base)).toBe(VERSION_ACTUAL);
    const tablas = await base.todas<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;");
    expect(tablas.map((t) => t.name)).toEqual(["asistencia", "grupo", "meta", "miembros", "pendientes", "registro_miembro", "reunion_local"]);
  });

  test("migrar dos veces no hace nada la segunda", async () => {
    const base = await baseLista();
    expect(await migrar(base)).toEqual([]);
  });

  test("una migración que falla no deja la base a medias", async () => {
    const base = await baseLista();
    const rota = [...MIGRACIONES, { version: VERSION_ACTUAL + 1, sql: "CREATE TABLE nueva (a); SELECT * FROM no_existe;" }];
    await expect(migrar(base, rota)).rejects.toThrow();
    expect(await versionDe(base)).toBe(VERSION_ACTUAL);
    expect(await base.primera("SELECT name FROM sqlite_master WHERE name = 'nueva';")).toBeNull();
  });

  test("una migración nueva conserva los pendientes", async () => {
    const base = await baseLista();
    await base.correr(...pendiente("p1"));
    await base.correr(...pendiente("p2", "rechazado"));
    const siguiente = [
      ...MIGRACIONES,
      { version: VERSION_ACTUAL + 1, sql: "ALTER TABLE pendientes ADD COLUMN lote TEXT;" },
    ];
    expect(await migrar(base, siguiente)).toEqual([VERSION_ACTUAL + 1]);
    const filas = await base.todas<{ id: string; estado: string; carga: string }>(
      "SELECT id, estado, carga FROM pendientes ORDER BY id;",
    );
    expect(filas).toEqual([
      { id: "p1", estado: "pendiente", carga: '{"pesos":50000}' },
      { id: "p2", estado: "rechazado", carga: '{"pesos":50000}' },
    ]);
    await expect(base.correr("DELETE FROM pendientes;")).rejects.toThrow(/pendiente sin confirmar/);
  });

  test("no abre una base de una versión más nueva de la app", async () => {
    const base = await baseLista();
    await base.ejecutar(`PRAGMA user_version = ${VERSION_ACTUAL + 1};`);
    await expect(migrar(base)).rejects.toBeInstanceOf(BaseMasNueva);
  });

  test("las versiones son consecutivas desde 1", () => {
    expect(MIGRACIONES.map((m) => m.version)).toEqual(MIGRACIONES.map((_, i) => i + 1));
  });
});

describe("pendientes", () => {
  test("un pendiente sin confirmar no se puede borrar", async () => {
    const base = await baseLista();
    await base.correr(...pendiente("p1"));
    await expect(base.correr("DELETE FROM pendientes WHERE id = 'p1';")).rejects.toThrow(/pendiente sin confirmar/);
    await expect(base.correr("DELETE FROM pendientes;")).rejects.toThrow(/pendiente sin confirmar/);
  });

  test.each(["rechazado", "en_conflicto", "por_validar"])("un pendiente %s tampoco se borra", async (estado) => {
    const base = await baseLista();
    await base.correr(...pendiente("p1", estado));
    await expect(base.correr("DELETE FROM pendientes;")).rejects.toThrow(/pendiente sin confirmar/);
  });

  test("lo confirmado por el servidor sí se puede limpiar", async () => {
    const base = await baseLista();
    await base.correr(...pendiente("p1"));
    await base.correr("UPDATE pendientes SET estado = 'confirmado' WHERE id = 'p1';");
    expect((await base.correr("DELETE FROM pendientes WHERE id = 'p1';")).cambios).toBe(1);
  });

  test("el contenido de un pendiente no cambia", async () => {
    const base = await baseLista();
    await base.correr(...pendiente("p1"));
    await expect(base.correr("UPDATE pendientes SET carga = '{\"pesos\":5}' WHERE id = 'p1';")).rejects.toThrow(
      /no cambia/,
    );
  });

  test("estado desconocido se rechaza", async () => {
    const base = await baseLista();
    await expect(base.correr(...pendiente("p1", "borrado"))).rejects.toThrow();
  });
});

describe("caducidad de 60 días", () => {
  const dia = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 24 * 60 * 60 * 1000);

  async function conDatos() {
    const base = await baseLista();
    await base.correr("INSERT INTO grupo (id, datos, descargado_en) VALUES ('acap', '{}', ?);", dia(0).toISOString());
    await base.correr("INSERT INTO miembros (membresia_id, numero, iniciales, activo) VALUES ('m7', 7, 'M. C.', 1);");
    await base.correr(...pendiente("p1"));
    await registrarSincronizacion(base, dia(0));
    return base;
  }

  test("antes de 60 días no borra nada", async () => {
    const base = await conDatos();
    expect(await aplicarCaducidad(base, dia(59))).toBe(false);
    expect(await base.todas("SELECT * FROM miembros;")).toHaveLength(1);
  });

  test("a los 60 días borra la copia del servidor y deja los pendientes", async () => {
    const base = await conDatos();
    expect(await diasSinSincronizar(base, dia(60))).toBe(60);
    expect(await aplicarCaducidad(base, dia(60))).toBe(true);
    expect(await base.todas("SELECT * FROM miembros;")).toHaveLength(0);
    expect(await base.todas("SELECT * FROM grupo;")).toHaveLength(0);
    expect(await base.todas("SELECT * FROM pendientes;")).toHaveLength(1);
  });

  test("sincronizar reinicia la cuenta", async () => {
    const base = await conDatos();
    await registrarSincronizacion(base, dia(50));
    expect(await aplicarCaducidad(base, dia(100))).toBe(false);
    expect(await diasSinSincronizar(base, dia(100))).toBe(50);
  });

  test("un celular que nunca sincronizó no caduca nada", async () => {
    const base = await baseLista();
    expect(await diasSinSincronizar(base, dia(500))).toBeNull();
    expect(await aplicarCaducidad(base, dia(500))).toBe(false);
  });
});
