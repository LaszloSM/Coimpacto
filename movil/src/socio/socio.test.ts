import type { Elemento } from "../cola/cola";
import { LlaveIncorrecta, prepararBaseCifrada, type BaseLocal } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { almacenEnMemoria } from "../seguridad/almacen";
import { verificar } from "../seguridad/firma";
import { abrirCargo, PinIncorrecto } from "../seguridad/llavero";
import { llaveroDe, perfiles } from "../seguridad/perfiles";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import { secretoDelDispositivo } from "../seguridad/dispositivo";
import { abrirSesion } from "../sesion/abrir";
import { FOTO_PRUEBA, PIN_PRUEBA, sembrarModoPrueba } from "../sesion/modoPrueba";
import {
  abrirSocio,
  actualizarSocio,
  altaSocio,
  EsperaSocio,
  intentarSocio,
  leerDatosSocio,
  mensajeAltaSocio,
  PinSocioFallido,
  vigenciaDatos,
  type DatosSocio,
} from "./socio";

/** Bases en memoria por nombre, cada una con la DEK con que se creó (como SQLCipher). */
function bases() {
  const archivos = new Map<string, { base: BaseLocal; dek: string }>();
  return async (nombre: string, dek: Uint8Array): Promise<BaseLocal> => {
    const hex = Buffer.from(dek).toString("hex");
    let archivo = archivos.get(nombre);
    if (!archivo) {
      const base = baseEnMemoria();
      await prepararBaseCifrada(base, dek);
      archivo = { base: { ...base, cerrar: async () => {} }, dek: hex };
      archivos.set(nombre, archivo);
    }
    if (archivo.dek !== hex) throw new LlaveIncorrecta();
    return archivo.base;
  };
}

async function preparar() {
  const almacen = almacenEnMemoria();
  const abrirBaseSocio = bases();
  const abrirBase = async (dek: Uint8Array) => {
    const b = await abrirBaseSocio("reunion.db", dek);
    await migrar(b);
    return b;
  };
  let reloj = new Date("2026-10-04T16:00:00Z").getTime();
  const ahora = () => new Date(reloj);
  const deps = { cripto: c, almacen, abrirBase, abrirBaseSocio, ahora, nuevoId: () => "x" };
  await sembrarModoPrueba(deps, ahora());
  const caja = (await perfiles(almacen)).find((p) => p.tipo === "portador_caja")!;
  const sesion = await abrirSesion(deps, caja, PIN_PRUEBA.portador_caja);
  const socia = FOTO_PRUEBA.miembros[6]; // #07
  return { deps, sesion, socia, avanzar: (ms: number) => (reloj += ms) };
}

test("alta del socio: el cargo firma el alta y la llave sube por la cola", async () => {
  const { deps, sesion, socia } = await preparar();
  const perfil = await altaSocio(deps, {
    base: sesion.base,
    foto: FOTO_PRUEBA,
    cargo: sesion.firmante,
    dispositivoId: "d1",
    membresiaId: socia.membresia_id,
    pin: "591736",
  });
  expect(perfil).toMatchObject({ numero: 7, membresiaId: socia.membresia_id });
  const [e] = (await sesion.base.todas<{ carga: string }>("SELECT carga FROM pendientes WHERE tipo = 'llave_socio';")).map(
    (f) => JSON.parse(f.carga) as Elemento,
  );
  expect(e.id).toBe(perfil.llaveId);
  const llaveroCaja = (await llaveroDe(deps.almacen, sesion.perfil.cargoId))!;
  const mensaje = mensajeAltaSocio({ llaveId: e.id, membresiaId: socia.membresia_id, dispositivoId: "d1", llavePublica: String(e.datos.llave_publica) });
  expect(await verificar(c, llaveroCaja.llavePublica, mensaje, String(e.datos.firma_alta))).toBe(true);
});

test("N17: el PIN del socio abre solo su almacén, nunca la base de la reunión", async () => {
  const { deps, sesion, socia } = await preparar();
  const perfil = await altaSocio(deps, { base: sesion.base, foto: FOTO_PRUEBA, cargo: sesion.firmante, dispositivoId: "d1", membresiaId: socia.membresia_id, pin: "591736" });
  const suya = await abrirSocio(deps, perfil, "591736");
  expect((await leerDatosSocio(suya.base))?.numero).toBe(7);
  // Con su llavero y su PIN no se obtiene la DEK de la reunión: abrir la reunión con esa llave falla.
  const texto = (await deps.almacen.leer(`socio.${perfil.llaveId}`))!;
  const abierto = await abrirCargo(c, JSON.parse(texto), "591736", await secretoDelDispositivo(c, deps.almacen));
  await expect(deps.abrirBase(abierto.dek)).rejects.toBeInstanceOf(LlaveIncorrecta);
  // Y el PIN del socio no abre el llavero de ningún cargo.
  await expect(abrirCargo(c, (await llaveroDe(deps.almacen, sesion.perfil.cargoId))!, "591736", await secretoDelDispositivo(c, deps.almacen))).rejects.toBeInstanceOf(PinIncorrecto);
});

test("N7: tras 5 errores espera 1 minuto, luego 2, 4… y nunca bloquea del todo", async () => {
  const almacen = almacenEnMemoria();
  let t = 0;
  const ahora = () => new Date(t);
  const falla = () => Promise.reject(new PinIncorrecto());
  const tanda = async () => {
    for (let i = 0; i < 4; i++) await expect(intentarSocio(almacen, "s1", ahora, falla)).rejects.toBeInstanceOf(PinSocioFallido);
    return intentarSocio(almacen, "s1", ahora, falla).catch((e) => e);
  };
  expect(((await tanda()) as EsperaSocio).minutos).toBe(1);
  await expect(intentarSocio(almacen, "s1", ahora, async () => "ok")).rejects.toBeInstanceOf(EsperaSocio);
  t += 61_000;
  expect(((await tanda()) as EsperaSocio).minutos).toBe(2);
  t += 121_000;
  expect(((await tanda()) as EsperaSocio).minutos).toBe(4);
  t += 241_000;
  expect(await intentarSocio(almacen, "s1", ahora, async () => "ok")).toBe("ok"); // acertar reinicia
});

test("N7: la espera llega a 60 minutos como máximo", async () => {
  const almacen = almacenEnMemoria();
  let t = 0;
  for (let tanda = 0; tanda < 10; tanda++) {
    let ultima: unknown;
    for (let i = 0; i < 5; i++) ultima = await intentarSocio(almacen, "s1", () => new Date(t), () => Promise.reject(new PinIncorrecto())).catch((e) => e);
    expect((ultima as EsperaSocio).minutos).toBeLessThanOrEqual(60);
    t += 61 * 60_000;
  }
});

test("N3: aviso a los 30 días y sin cifras a los 60", () => {
  const datos = { actualizado_en: "2026-10-01T00:00:00Z" } as DatosSocio;
  expect(vigenciaDatos(datos, new Date("2026-10-20T00:00:00Z")).aviso).toBe("ninguno");
  expect(vigenciaDatos(datos, new Date("2026-11-05T00:00:00Z")).aviso).toBe("viejos");
  expect(vigenciaDatos(datos, new Date("2026-12-01T00:00:00Z")).aviso).toBe("caducados");
});

test("actualizar con señal: firma el reto con la llave del socio y guarda solo lo suyo", async () => {
  const { deps, sesion, socia } = await preparar();
  const perfil = await altaSocio(deps, { base: sesion.base, foto: FOTO_PRUEBA, cargo: sesion.firmante, dispositivoId: "d1", membresiaId: socia.membresia_id, pin: "591736" });
  const suya = await abrirSocio(deps, perfil, "591736");
  const pedidos: { url: string; cabeceras: Record<string, string>; cuerpo?: string }[] = [];
  const pedir = jest.fn(async (url: string, init: RequestInit) => {
    pedidos.push({ url, cabeceras: init.headers as Record<string, string>, cuerpo: init.body as string | undefined });
    if (url.endsWith("/reto")) return new Response(JSON.stringify({ reto: "r1" }), { status: 200 });
    return new Response(
      JSON.stringify({ formato: 1, numero: 7, datos_hasta: "2026-10-04", ahorrado_ciclo: 30_000, aportes: [{ fecha: "2026-10-04", acciones: 3, pesos: 30_000, estado: "guardado" }], prestamo: null }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  const datos = await actualizarSocio(suya, { cripto: c, servidor: "https://api.example", pedir, ahora: deps.ahora });
  expect(datos.ahorrado_ciclo).toBe(30_000);
  expect(pedidos.every((p) => p.cabeceras["X-Credimpacto-Socio"] === perfil.llaveId)).toBe(true);
  expect((await leerDatosSocio(suya.base))?.aportes).toHaveLength(1);
});
