import type { Elemento } from "../cola/cola";
import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { uuid } from "../seguridad/llavero";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import { FOTO_PRUEBA } from "../sesion/modoPrueba";
import {
  arqueoGuardado,
  cerrarReunion,
  correccionesDeHoy,
  efectoEnCaja,
  elementosDeLaReunion,
  esperadoEnCaja,
  guardarConteo,
  guardarMotivo,
  movimientosDelCierre,
  resumenMiembro,
  terminarReunion,
  totalConteo,
} from "./cierre";
import { firmarPrestamos, guardarSolicitud, registrarAbono, type FirmanteCargo } from "./prestamos";
import { abrirReunion, registrarAportes, reunionAbierta } from "./reunion";

const CICLO = FOTO_PRUEBA.ciclo!;
const AHORA = new Date("2026-10-04T15:00:00Z");
const m = (n: number) => FOTO_PRUEBA.miembros[n - 1];

async function firmante(tipo: string, numero: number): Promise<FirmanteCargo> {
  const par = (await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"])) as CryptoKeyPair;
  return { llaveId: uuid(c), privada: par.privateKey, perfil: { cargoId: `k-${tipo}`, tipo, numero } };
}

/** Reunión con: 2 acciones + fondo de #01, 1 acción + fondo de #02 (corregida a 3), un préstamo
 * de 100.000 para #09 y un abono de 27.000 a un préstamo viejo de #07. */
async function reunionConMovimientos() {
  const base = baseEnMemoria();
  await prepararBaseCifrada(base, new Uint8Array(32));
  await migrar(base);
  const cajera = await firmante("portador_caja", 2);
  const presidente = await firmante("presidente", 1);
  const foto = {
    ...FOTO_PRUEBA,
    prestamos: [{ id: "p7", titular_id: m(7).titular_id, capital: 100_000, num_cuotas: 4, cuota_mensual: 27_000, total_pagar: 108_000, saldo: 81_000 }],
  };
  const reunion = await abrirReunion(base, c, { ciclo: CICLO, numero: 1, fecha: "2026-10-04", escritor: cajera, id: uuid(c), ahora: AHORA });
  const aporte = (n: number, acciones: number) =>
    registrarAportes(base, c, { reunion, ciclo: CICLO, miembro: m(n), aportes: { acciones, fondoSocial: true, multas: {} }, firmante: cajera, ahora: AHORA });
  await aporte(1, 2);
  await aporte(2, 1);
  await aporte(2, 3);
  await registrarAbono(base, c, { reunion, prestamo: foto.prestamos[0], monto: 27_000, firmante: cajera, ahora: AHORA });
  await guardarSolicitud(base, c, {
    reunion,
    titularId: m(9).titular_id,
    capital: 100_000,
    numCuotas: 4,
    votacion: { aFavor: 11, enContra: 0, abstenciones: 0, presentes: 11 },
    activos: 20,
    ciclo: CICLO,
    prestamosVigentes: foto.prestamos,
  });
  await firmarPrestamos(base, c, { reunion, firmantes: [presidente, cajera], foto, ahora: AHORA });
  return { base, reunion, foto, cajera, presidente };
}

test("conteo por denominación", () => {
  expect(totalConteo({ 50_000: 2, 10_000: 3, 500: 4 })).toBe(132_000);
});

test("lo esperado: caja de apertura + entradas − desembolsos, con las correcciones", async () => {
  const { base, reunion, foto } = await reunionConMovimientos();
  // 150.000 + (20.000 + 2.000) + (30.000 + 2.000) + 27.000 − 100.000
  expect(await esperadoEnCaja(base, reunion, foto)).toBe(131_000);
});

test("una corrección anula el efecto de lo que corrige", () => {
  const e = (id: string, tipo: Elemento["tipo"], datos: Elemento["datos"]): Elemento => ({ id, tipo, datos, firmas: [] });
  expect(
    efectoEnCaja([e("a", "ahorro", { acciones: 2, reunion: "r" }), e("b", "correccion", { original: "a" })], CICLO),
  ).toBe(0);
});

test("la lista del cierre: movimientos y el desembolso del préstamo, sin la reunión", async () => {
  const { base, reunion } = await reunionConMovimientos();
  const elementos = await elementosDeLaReunion(base, reunion.id);
  const lista = movimientosDelCierre(elementos);
  expect(lista).not.toContain(reunion.id);
  const prestamo = elementos.find((x) => x.tipo === "prestamo")!;
  expect(lista).toContain(prestamo.datos.id_desembolso);
  expect(lista).not.toContain(prestamo.id);
  expect((await correccionesDeHoy(base, reunion.id)).length).toBe(2); // ahorro y fondo de #02
});

test("si la caja cuadra, el cierre va solo; queda cerrado y no se vuelve a firmar", async () => {
  const { base, reunion, foto, cajera, presidente } = await reunionConMovimientos();
  await guardarConteo(base, reunion.id, { 100_000: 1, 20_000: 1, 10_000: 1, 1_000: 1 }, await esperadoEnCaja(base, reunion, foto));
  await cerrarReunion(base, c, { reunion, firmantes: [presidente, cajera], foto, ahora: AHORA });
  await cerrarReunion(base, c, { reunion, firmantes: [presidente, cajera], foto, ahora: AHORA });
  const cierres = await base.todas<{ carga: string }>("SELECT carga FROM pendientes WHERE tipo = 'cierre';");
  expect(cierres).toHaveLength(1);
  const cierre = JSON.parse(cierres[0].carga) as Elemento;
  expect(cierre.datos.caja_contada).toBe(131_000);
  expect(cierre.firmas).toHaveLength(2);
  expect((await arqueoGuardado(base, reunion.id))?.cerradaEn).toBe(AHORA.toISOString());
  await guardarConteo(base, reunion.id, {}, 0); // ya cerrado: no cambia
  expect((await arqueoGuardado(base, reunion.id))?.contado).toBe(131_000);
});

test("si falta plata: sin motivo no cierra; con motivo, faltante firmado y en la lista", async () => {
  const { base, reunion, foto, cajera, presidente } = await reunionConMovimientos();
  await guardarConteo(base, reunion.id, { 100_000: 1, 20_000: 1, 5_000: 1 }, 131_000);
  await expect(cerrarReunion(base, c, { reunion, firmantes: [presidente, cajera], foto, ahora: AHORA })).rejects.toThrow(/FALTA_MOTIVO/);
  await guardarMotivo(base, reunion.id, "Se pagó el refrigerio");
  await cerrarReunion(base, c, { reunion, firmantes: [presidente, cajera], foto, ahora: AHORA });
  const elementos = (await base.todas<{ carga: string }>("SELECT carga FROM pendientes ORDER BY rowid;")).map((f) => JSON.parse(f.carga) as Elemento);
  const faltante = elementos.find((e) => e.datos.tipo === "faltante")!;
  expect(faltante.datos).toMatchObject({ monto: 6_000, detalle: { motivo: "Se pagó el refrigerio" } });
  expect(faltante.firmas).toHaveLength(2);
  const cierre = elementos.find((e) => e.tipo === "cierre")!;
  expect(cierre.datos.movimientos).toContain(faltante.id);
});

test("el cierre necesita dos cargos distintos", async () => {
  const { base, reunion, foto, cajera } = await reunionConMovimientos();
  await guardarConteo(base, reunion.id, { 100_000: 1, 20_000: 1, 10_000: 1, 1_000: 1 }, 131_000);
  await expect(cerrarReunion(base, c, { reunion, firmantes: [cajera], foto, ahora: AHORA })).rejects.toThrow(/FIRMAS_INSUFICIENTES/);
});

test("resumen por miembro: ahorro de hoy, del ciclo y lo que debe", async () => {
  const { base, reunion, foto } = await reunionConMovimientos();
  expect(await resumenMiembro(base, reunion, foto, m(2))).toEqual({ ahorroHoy: 30_000, ahorroCiclo: 30_000, debePrestamo: null });
  expect(await resumenMiembro(base, reunion, foto, m(7))).toMatchObject({ debePrestamo: 54_000 });
  expect(await resumenMiembro(base, reunion, foto, m(9))).toMatchObject({ debePrestamo: 108_000 });
});

test("terminar deja la reunión cerrada en este celular", async () => {
  const { base, reunion } = await reunionConMovimientos();
  await terminarReunion(base, reunion.id);
  expect(await reunionAbierta(base)).toBeNull();
});
