// Contrato de subida estable (N5, TD3): la app genera una cola de muestra con todos los tipos de
// elemento del formato 1 y se guarda en packages/casos-reglas/cola/formato-1.json. El servidor
// la vuelve a recibir en cada CI (backend/sync/tests/test_contrato.py) y debe aceptarla sin
// pérdidas. Un formato publicado nunca se cambia: para regenerar esta muestra se crea una nueva
// (formato-2.json) y esta se conserva. Regenerar: REGENERAR_COLA=1 npx jest contrato.

import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Elemento } from "./cola";
import { encolar, prepararElemento, FORMATO } from "./cola";
import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { cerrarReunion, esperadoEnCaja, guardarConteo, guardarMotivo } from "../reunion/cierre";
import { firmarPrestamos, guardarSolicitud, registrarAbono, type FirmanteCargo } from "../reunion/prestamos";
import { abrirReunion, registrarAportes } from "../reunion/reunion";
import { firmar } from "../seguridad/firma";
import { uuid } from "../seguridad/llavero";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import { FOTO_PRUEBA } from "../sesion/modoPrueba";
import { mensajeAltaSocio } from "../socio/socio";

const RUTA = join(__dirname, "../../../packages/casos-reglas/cola/formato-1.json");
const AHORA = new Date("2026-10-04T15:00:00Z");

async function firmante(tipo: string, numero: number): Promise<FirmanteCargo & { publica: string; cargoId: string }> {
  const par = (await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const cargoId = FOTO_PRUEBA.cargos.find((x) => x.tipo === tipo)!.id;
  return {
    llaveId: uuid(c),
    privada: par.privateKey,
    perfil: { cargoId, tipo, numero },
    cargoId,
    publica: Buffer.from(await c.subtle.exportKey("spki", par.publicKey)).toString("base64url"),
  };
}

async function generarCola() {
  const base = baseEnMemoria();
  await prepararBaseCifrada(base, new Uint8Array(32));
  await migrar(base);
  const presidente = await firmante("presidente", 1);
  const cajera = await firmante("portador_caja", 2);
  const ciclo = FOTO_PRUEBA.ciclo!;
  const m = (n: number) => FOTO_PRUEBA.miembros[n - 1];
  const foto = { ...FOTO_PRUEBA, caja: 150_000 };

  const reunion = await abrirReunion(base, c, { ciclo, numero: 1, fecha: "2026-10-04", escritor: cajera, id: uuid(c), ahora: AHORA });
  const aporte = (n: number, acciones: number, multas = {}) =>
    registrarAportes(base, c, { reunion, ciclo, miembro: m(n), aportes: { acciones, fondoSocial: true, multas }, firmante: cajera, ahora: AHORA });
  await aporte(3, 2);
  await aporte(4, 1, { tarde: 1 });
  await aporte(4, 3, { tarde: 1 }); // corrección: contramovimientos y versión nueva
  await guardarSolicitud(base, c, {
    reunion,
    titularId: m(9).titular_id,
    capital: 100_000,
    numCuotas: 4,
    votacion: { aFavor: 15, enContra: 0, abstenciones: 0, presentes: 15 },
    activos: 20,
    ciclo,
    prestamosVigentes: [],
  });
  await firmarPrestamos(base, c, { reunion, firmantes: [presidente, cajera], foto, ahora: AHORA });
  const elementos = (await base.todas<{ carga: string }>("SELECT carga FROM pendientes ORDER BY rowid;")).map((f) => JSON.parse(f.carga) as Elemento);
  const prestamo = elementos.find((e) => e.tipo === "prestamo")!;
  await registrarAbono(base, c, {
    reunion,
    prestamo: { id: prestamo.id, titular_id: m(9).titular_id, capital: 100_000, num_cuotas: 4, cuota_mensual: 27_000, total_pagar: 108_000, saldo: 108_000 },
    monto: 27_000,
    firmante: cajera,
    ahora: AHORA,
  });
  // Arqueo que no cuadra: faltante con motivo, firmado con el cierre.
  const esperado = await esperadoEnCaja(base, reunion, foto);
  await guardarConteo(base, reunion.id, { 1_000: Math.max(0, esperado / 1_000 - 2) }, esperado);
  await guardarMotivo(base, reunion.id, "Se pagó el refrigerio");
  await cerrarReunion(base, c, { reunion, firmantes: [presidente, cajera], foto, ahora: AHORA });
  // Acceso de un socio, firmado por la cajera.
  const socio = (await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
  const publicaSocio = Buffer.from(await c.subtle.exportKey("spki", socio.publicKey)).toString("base64url");
  const llaveSocio = uuid(c);
  const dispositivoId = "7f0c1d2e-3a4b-4c5d-8e6f-000000000001";
  const firmaAlta = await firmar(c, cajera.privada, mensajeAltaSocio({ llaveId: llaveSocio, membresiaId: m(7).membresia_id, dispositivoId, llavePublica: publicaSocio }));
  await encolar(
    base,
    await prepararElemento(c, { id: llaveSocio, tipo: "llave_socio", datos: { membresia: m(7).membresia_id, llave_publica: publicaSocio, firma_alta: firmaAlta } }, [cajera]),
    AHORA,
  );

  const cola = (await base.todas<{ carga: string }>("SELECT carga FROM pendientes ORDER BY rowid;")).map((f) => JSON.parse(f.carga) as Elemento);
  return {
    formato: FORMATO,
    descripcion: "Cola de muestra del formato 1, armada por la app. El servidor debe aceptarla sin pérdidas en cada versión (N5).",
    grupo: {
      acap: FOTO_PRUEBA.acap,
      ciclo,
      miembros: FOTO_PRUEBA.miembros.map(({ membresia_id, titular_id, numero }) => ({ membresia_id, titular_id, numero })),
      cargos: [presidente, cajera].map((f) => ({ id: f.cargoId, tipo: f.perfil.tipo, numero: f.perfil.numero, llave_id: f.llaveId, llave_publica: f.publica })),
    },
    dispositivo: { id: dispositivoId },
    cola,
    tipos: [...new Set(cola.map((e) => e.tipo))].sort(),
  };
}

test("la cola de muestra del formato 1 está al día con todos los tipos", async () => {
  if (process.env.REGENERAR_COLA) {
    if (existsSync(RUTA) && !process.env.SOBRESCRIBIR_FORMATO_PUBLICADO) {
      throw new Error("formato-1.json ya existe y un formato publicado no se cambia: cree formato-2.json.");
    }
    writeFileSync(RUTA, JSON.stringify(await generarCola(), null, 2) + "\n");
  }
  const muestra = JSON.parse(readFileSync(RUTA, "utf8")) as { tipos: string[]; cola: Elemento[] };
  expect(muestra.tipos).toEqual(["abono", "ahorro", "cierre", "correccion", "llave_socio", "movimiento", "multa", "prestamo", "reunion"]);
  expect(muestra.cola.every((e) => e.firmas.length >= 1)).toBe(true);
});
