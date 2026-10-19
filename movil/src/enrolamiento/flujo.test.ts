import type { Elemento } from "../cola/cola";
import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { almacenEnMemoria } from "../seguridad/almacen";
import { verificar } from "../seguridad/firma";
import { PinFallido } from "../seguridad/intentos";
import { perfiles } from "../seguridad/perfiles";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import { abrirSesion } from "../sesion/abrir";
import { FOTO_PRUEBA } from "../sesion/modoPrueba";
import { altaOtroCargo, altaPrimerPresidente, dispositivoRegistrado, presidenteDe, registrarCelular, revisarPinDoble } from "./flujo";

const CODIGO = "c".repeat(43);

/** Servidor de mentira que guarda lo que recibe. */
function servidorFalso(opciones: { presidente?: number } = {}) {
  const pedidos: { url: string; cuerpo: Record<string, string> }[] = [];
  const pedir = jest.fn(async (url: string, init: RequestInit) => {
    const cuerpo = init.body ? JSON.parse(init.body as string) : {};
    pedidos.push({ url, cuerpo });
    const r = (status: number, json: unknown) => new Response(JSON.stringify(json), { status });
    if (url.endsWith("/canjear")) return r(200, { dispositivo_id: "d1", acap_id: FOTO_PRUEBA.acap.id, acap_nombre: "ACAP de prueba" });
    if (url.endsWith("/reto")) return r(200, { reto: "r1" });
    if (url.endsWith("/grupo")) return r(200, FOTO_PRUEBA);
    if (url.endsWith("/presidente")) return r(opciones.presidente ?? 200, opciones.presidente ? { motivo: "codigo_invalido" } : { llave_id: cuerpo.llave_id });
    return r(404, {});
  });
  return { pedir: pedir as unknown as typeof fetch, pedidos };
}

function dependencias(pedir: typeof fetch) {
  const almacen = almacenEnMemoria();
  const base = baseEnMemoria();
  const abrirBase = async (dek: Uint8Array) => {
    await prepararBaseCifrada(base, dek);
    await migrar(base);
    return { ...base, cerrar: async () => {} };
  };
  return { cripto: c, almacen, servidor: "https://api.example", abrirBase, borrarBase: async () => {}, pedir, ahora: () => new Date("2026-10-19T12:00:00Z") };
}

test("PIN nuevo: filtro de PIN obvios y confirmación (D26)", () => {
  expect(revisarPinDoble("123456", "123456")).toMatch(/fácil de adivinar/);
  expect(revisarPinDoble("482916", "482961")).toMatch(/no coinciden/);
  expect(revisarPinDoble("482916", "482916")).toBeNull();
});

test("registro con el QR, bajada del grupo y primer Presidente autorizado por el facilitador", async () => {
  const { pedir, pedidos } = servidorFalso();
  const deps = dependencias(pedir);
  const enCurso = await registrarCelular(deps, `credimpacto:enrolar:${CODIGO}`);
  expect(await dispositivoRegistrado(deps.almacen)).toBe("d1");
  expect(enCurso.foto.miembros).toHaveLength(20);
  expect(presidenteDe(enCurso.foto)).toEqual({ cargoId: FOTO_PRUEBA.cargos[0].id, numero: 1 });

  const perfil = await altaPrimerPresidente(deps, enCurso, "482916");
  expect(perfil).toMatchObject({ tipo: "presidente", numero: 1 });
  const alta = pedidos.find((p) => p.url.endsWith("/presidente"))!.cuerpo;
  expect(alta).toMatchObject({ codigo: CODIGO, dispositivo_id: "d1", cargo_id: FOTO_PRUEBA.cargos[0].id });
  const publicaCelular = pedidos.find((p) => p.url.endsWith("/canjear"))!.cuerpo.llave_publica;
  const mensaje = { pedido: "primer_presidente", codigo: CODIGO, llave: alta.llave_id, cargo: alta.cargo_id, llave_publica: alta.llave_publica };
  expect(await verificar(c, publicaCelular, mensaje, alta.firma)).toBe(true);

  // Con el PIN del Presidente se abre la misma base, con el grupo bajado.
  const sesion = await abrirSesion(deps, perfil, "482916");
  expect(await sesion.base.primera("SELECT count(*) AS n FROM miembros;")).toEqual({ n: 20 });
});

test("si el servidor no acepta al Presidente, no queda ningún perfil", async () => {
  const { pedir } = servidorFalso({ presidente: 400 });
  const deps = dependencias(pedir);
  const enCurso = await registrarCelular(deps, `credimpacto:enrolar:${CODIGO}`);
  await expect(altaPrimerPresidente(deps, enCurso, "482916")).rejects.toThrow("Este código ya no sirve");
  expect(await perfiles(deps.almacen)).toEqual([]);
});

test("sin señal, el Presidente da de alta a la Portadora de Caja; la llave sube por la cola", async () => {
  const { pedir } = servidorFalso();
  const deps = dependencias(pedir);
  const enCurso = await registrarCelular(deps, `credimpacto:enrolar:${CODIGO}`);
  const presidente = await altaPrimerPresidente(deps, enCurso, "482916");
  const sesion = await abrirSesion(deps, presidente, "482916");
  const cajaId = FOTO_PRUEBA.cargos[1].id;

  await expect(
    altaOtroCargo(deps, { base: sesion.base, foto: FOTO_PRUEBA, presidente, pinPresidente: "111112", cargoId: cajaId, pinNuevo: "730185", dispositivoId: "d1" }),
  ).rejects.toBeInstanceOf(PinFallido);

  const caja = await altaOtroCargo(deps, {
    base: sesion.base,
    foto: FOTO_PRUEBA,
    presidente,
    pinPresidente: "482916",
    cargoId: cajaId,
    pinNuevo: "730185",
    dispositivoId: "d1",
  });
  expect(caja).toMatchObject({ tipo: "portador_caja", numero: 2 });
  const [elemento] = (await sesion.base.todas<{ carga: string }>("SELECT carga FROM pendientes WHERE tipo = 'llave_cargo';")).map(
    (f) => JSON.parse(f.carga) as Elemento,
  );
  expect(elemento.datos).toMatchObject({ cargo: cajaId });
  expect((await perfiles(deps.almacen)).map((p) => p.tipo)).toEqual(["presidente", "portador_caja"]);
  // La Portadora abre la misma base con su propio PIN.
  const suya = await abrirSesion(deps, caja, "730185");
  expect(await suya.base.primera("SELECT count(*) AS n FROM pendientes;")).toEqual({ n: 1 });
});
