import type { Elemento } from "../cola/cola";
import type { PropuestaFoto } from "../cola/grupo";
import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { verificar } from "../seguridad/firma";
import { uuid } from "../seguridad/llavero";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import { FOTO_PRUEBA } from "../sesion/modoPrueba";
import type { FirmanteCargo } from "./prestamos";
import { aceptar, noAceptar, porResponder } from "./propuestas";
import { textoEnVozAlta } from "./PasoCambios";

const AHORA = new Date("2026-10-04T15:00:00Z");
const PROPUESTA: PropuestaFoto = {
  id: "11111111-2222-4333-8444-555555555555",
  accion: "anular",
  motivo: "Se anotó dos veces",
  movimiento: { id: "m1", tipo: "fondo_social", monto: 2_000, titular_id: FOTO_PRUEBA.miembros[6].titular_id, reunion: 3, fecha: "2026-09-27" },
};
const FOTO = { ...FOTO_PRUEBA, propuestas: [PROPUESTA] };

async function firmante(tipo: string, numero: number): Promise<FirmanteCargo & { publica: string }> {
  const par = (await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  return {
    llaveId: uuid(c),
    privada: par.privateKey,
    perfil: { cargoId: `k-${tipo}`, tipo, numero },
    publica: Buffer.from(await c.subtle.exportKey("spki", par.publicKey)).toString("base64url"),
  };
}

async function preparar() {
  const base = baseEnMemoria();
  await prepararBaseCifrada(base, new Uint8Array(32));
  await migrar(base);
  return base;
}

const cola = async (base: Awaited<ReturnType<typeof preparar>>) =>
  (await base.todas<{ carga: string }>("SELECT carga FROM pendientes ORDER BY rowid;")).map((f) => JSON.parse(f.carga) as Elemento);

test("aceptar: dos firmas de cargos distintos sobre la respuesta; queda respondida", async () => {
  const base = await preparar();
  const presidente = await firmante("presidente", 1);
  const contador = await firmante("contador_1", 3);
  expect(await porResponder(base, FOTO)).toHaveLength(1);
  await expect(aceptar(base, c, { propuesta: PROPUESTA, firmantes: [presidente], foto: FOTO, ahora: AHORA })).rejects.toThrow();
  await aceptar(base, c, { propuesta: PROPUESTA, firmantes: [presidente, contador], foto: FOTO, ahora: AHORA });
  const [e] = await cola(base);
  expect(e).toMatchObject({ tipo: "respuesta_propuesta", datos: { propuesta: PROPUESTA.id, respuesta: "acepta" } });
  expect(e.firmas).toHaveLength(2);
  expect(await verificar(c, contador.publica, { formato: 1, id: e.id, tipo: e.tipo, datos: e.datos }, e.firmas[1].firma)).toBe(true);
  expect(await porResponder(base, FOTO)).toEqual([]);
});

test("no aceptar: quien opera firma con el motivo y la nota", async () => {
  const base = await preparar();
  const cajera = await firmante("portador_caja", 2);
  await noAceptar(base, c, { propuesta: PROPUESTA, motivo: "si_se_recibio", nota: "  Lo pagó en efectivo ", firmante: cajera, ahora: AHORA });
  const [e] = await cola(base);
  expect(e.datos).toEqual({ propuesta: PROPUESTA.id, respuesta: "no_acepta", motivo: "si_se_recibio", nota: "Lo pagó en efectivo" });
  // Responder dos veces da el mismo id: el servidor no lo duplica.
  await expect(
    noAceptar(base, c, { propuesta: PROPUESTA, motivo: "otro", nota: "", firmante: cajera, ahora: AHORA }),
  ).rejects.toThrow();
});

test("el texto para leer en voz alta dice qué, de quién y por qué", () => {
  expect(textoEnVozAlta(FOTO, PROPUESTA)).toBe(
    "Fondo social de $ 2.000 de #07, reunión 3 del 27 de septiembre. La Fundación propone quitarlo del cuaderno porque: Se anotó dos veces",
  );
});
