import type { ValorJson } from "@credimpacto/reglas";

import { prepararBaseCifrada } from "../datos/base";
import { diasSinSincronizar } from "../datos/caducidad";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { almacenEnMemoria } from "../seguridad/almacen";
import { firmarComoDispositivo, llaveDelDispositivo } from "../seguridad/dispositivo";
import { verificar } from "../seguridad/firma";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import { SinSenal, type EnviarLote } from "./cola";
import { bajarPorHttp, CelularRetirado, guardarFoto, leerParte, sincronizarTodo, type FotoGrupo } from "./grupo";

const FOTO: FotoGrupo = {
  formato: 1,
  generado_en: "2026-10-07T12:00:00Z",
  acap: { id: "a1", nombre: "ACAP Las Brisas" },
  ciclo: {
    id: "c1",
    numero: 1,
    fecha_inicio: "2026-01-10",
    duracion_meses: 12,
    valor_accion: 10_000,
    max_acciones_reunion: 5,
    valor_fondo_social: 2_000,
    valor_multa: 2_000,
    tasa_interes: "2.000",
  },
  miembros: [
    { membresia_id: "m1", titular_id: "t1", numero: 1, activo: true, ahorro_ciclo: 0 },
    { membresia_id: "m7", titular_id: "t7", numero: 7, activo: true, ahorro_ciclo: 30_000 },
  ],
  cargos: [{ id: "k1", tipo: "presidente", membresia_id: "m1", llaves: ["l1"] }],
  reuniones: [],
  prestamos: [],
  caja: 0,
};

async function base() {
  const b = baseEnMemoria();
  await prepararBaseCifrada(b, new Uint8Array(32));
  await migrar(b);
  return b;
}

const sinNadaQueSubir: EnviarLote = async () => [];
const ahora = () => new Date("2026-10-07T12:00:00Z");

test("guarda la foto y reemplaza la anterior sin tocar los pendientes", async () => {
  const b = await base();
  await b.correr(
    "INSERT INTO pendientes (id, tipo, carga, creado_en) VALUES ('p1', 'ahorro', '{}', '2026-10-04T15:00:00Z');",
  );
  await guardarFoto(b, FOTO);
  await guardarFoto(b, { ...FOTO, miembros: [FOTO.miembros[1]] });
  expect(await b.todas("SELECT numero, titular_id, ahorro_ciclo FROM miembros;")).toEqual([
    { numero: 7, titular_id: "t7", ahorro_ciclo: 30_000 },
  ]);
  expect(await leerParte(b, "ciclo")).toEqual(FOTO.ciclo);
  expect(await b.todas("SELECT id FROM pendientes;")).toEqual([{ id: "p1" }]);
});

test("sincronizar todo: sube, baja y anota la fecha", async () => {
  const b = await base();
  const r = await sincronizarTodo(b, { enviar: sinNadaQueSubir, bajar: async () => FOTO, nuevoId: () => "x", ahora });
  expect(r.fin).toBe("listo");
  expect(await diasSinSincronizar(b, ahora())).toBe(0);
});

test("sin señal al bajar: no anota la sincronización", async () => {
  const b = await base();
  const bajar = async (): Promise<FotoGrupo> => {
    throw new SinSenal();
  };
  expect((await sincronizarTodo(b, { enviar: sinNadaQueSubir, bajar, nuevoId: () => "x", ahora })).fin).toBe(
    "sin_senal",
  );
  expect(await diasSinSincronizar(b, ahora())).toBeNull();
});

test("celular retirado: primero sube su cola y no baja nada", async () => {
  const b = await base();
  const llamadas: string[] = [];
  const enviar: EnviarLote = async () => {
    llamadas.push("subir");
    return [];
  };
  const bajar = async (): Promise<FotoGrupo> => {
    llamadas.push("bajar");
    throw new CelularRetirado();
  };
  await b.correr(
    "INSERT INTO pendientes (id, tipo, carga, creado_en) VALUES ('p1', 'ahorro', '{\"id\":\"p1\"}', '2026-10-04T15:00:00Z');",
  );
  expect((await sincronizarTodo(b, { enviar, bajar, nuevoId: () => "x", ahora })).fin).toBe("retirado");
  expect(llamadas).toEqual(["subir", "bajar"]);
});

describe("cliente HTTP de la bajada", () => {
  test("pide un reto, lo firma con la llave del celular y baja la foto", async () => {
    const almacen = almacenEnMemoria();
    const publica = await llaveDelDispositivo(c, almacen);
    const pedidos: { url: string; cuerpo: unknown; cabeceras: Record<string, string> }[] = [];
    const pedir = jest.fn(async (url: string, opciones: RequestInit) => {
      pedidos.push({
        url,
        cuerpo: opciones.body ? JSON.parse(opciones.body as string) : undefined,
        cabeceras: opciones.headers as Record<string, string>,
      });
      const cuerpo = url.endsWith("/reto") ? { reto: "r-123" } : FOTO;
      return new Response(JSON.stringify(cuerpo), { status: 200 });
    });
    const bajar = bajarPorHttp({
      servidor: "https://api.example",
      dispositivoId: "d1",
      firmarComoDispositivo: (v) => firmarComoDispositivo(c, almacen, v),
      pedir: pedir as unknown as typeof fetch,
    });
    expect(await bajar()).toEqual(FOTO);
    expect(pedidos.map((p) => p.url)).toEqual(["https://api.example/api/sync/reto", "https://api.example/api/sync/grupo"]);
    expect(pedidos.every((p) => p.cabeceras["X-Credimpacto-Dispositivo"] === "d1")).toBe(true);
    const { reto, firma } = pedidos[1].cuerpo as { reto: string; firma: string };
    expect(reto).toBe("r-123");
    expect(await verificar(c, publica, { pedido: "grupo", reto } as ValorJson, firma)).toBe(true);
  });

  test("410 → celular retirado", async () => {
    const bajar = bajarPorHttp({
      servidor: "https://api.example",
      dispositivoId: "d1",
      firmarComoDispositivo: async () => "f",
      pedir: jest.fn(async (url: string) =>
        url.endsWith("/reto")
          ? new Response(JSON.stringify({ reto: "r" }), { status: 200 })
          : new Response(JSON.stringify({ codigo: "DISPOSITIVO_RETIRADO" }), { status: 410 }),
      ) as unknown as typeof fetch,
    });
    await expect(bajar()).rejects.toBeInstanceOf(CelularRetirado);
  });
});
