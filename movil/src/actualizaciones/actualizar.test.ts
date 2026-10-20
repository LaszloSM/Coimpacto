import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { buscarActualizacion, type Actualizador } from "./actualizar";

async function base() {
  const b = baseEnMemoria();
  await prepararBaseCifrada(b, new Uint8Array(32));
  await migrar(b);
  return b;
}

function actualizador(hayNueva = true): Actualizador & { bajadas: number } {
  const a = {
    habilitado: true,
    bajadas: 0,
    hayNueva: async () => hayNueva,
    bajar: async () => {
      a.bajadas += 1;
    },
    aplicar: async () => {},
  };
  return a;
}

const wifi = { conDatosMoviles: async () => false, preguntarDatosMoviles: async () => true };

test("sin nada pendiente ni reunión abierta, baja la versión nueva", async () => {
  const a = actualizador();
  expect(await buscarActualizacion(await base(), { actualizador: a, ...wifi })).toBe("lista");
  expect(a.bajadas).toBe(1);
});

test("D9: con algo por subir no se actualiza; primero se envía", async () => {
  const b = await base();
  await b.correr("INSERT INTO pendientes (id, tipo, carga, creado_en) VALUES ('p', 'ahorro', '{}', 'x');");
  const a = actualizador();
  expect(await buscarActualizacion(b, { actualizador: a, ...wifi })).toBe("espera-pendientes");
  expect(a.bajadas).toBe(0);
});

test("D9: con una reunión abierta no se actualiza", async () => {
  const b = await base();
  await b.correr("INSERT INTO reunion_local (id, ciclo_id, numero, fecha, abierta_por) VALUES ('r', 'c', 1, '2026-10-04', 'l');");
  expect(await buscarActualizacion(b, { actualizador: actualizador(), ...wifi })).toBe("espera-reunion");
});

test("N16: con datos móviles pregunta; si dice que no, no baja nada", async () => {
  const a = actualizador();
  const r = await buscarActualizacion(await base(), {
    actualizador: a,
    conDatosMoviles: async () => true,
    preguntarDatosMoviles: async () => false,
  });
  expect(r).toBe("sin-permiso-datos");
  expect(a.bajadas).toBe(0);
});

test("sin servidor de actualizaciones configurado no hace nada", async () => {
  expect(await buscarActualizacion(await base(), { actualizador: { ...actualizador(), habilitado: false }, ...wifi })).toBe(
    "deshabilitado",
  );
});
