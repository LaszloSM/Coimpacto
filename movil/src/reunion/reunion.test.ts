import { type Elemento, type Firmante } from "../cola/cola";
import type { FotoGrupo } from "../cola/grupo";
import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { verificar } from "../seguridad/firma";
import { uuid } from "../seguridad/llavero";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import {
  abrirReunion,
  anotadosDeLaReunion,
  aportesDeLaPasada,
  aportesRegistrados,
  asistencia,
  guardarPosicion,
  marcarAsistencia,
  montos,
  porSubir,
  registrarAportes,
  reunionAbierta,
  ReunionYaAbierta,
  siguienteNumero,
  type Ciclo,
} from "./reunion";

const CICLO: Ciclo = {
  id: "c1",
  numero: 1,
  fecha_inicio: "2026-01-10",
  duracion_meses: 12,
  valor_accion: 10_000,
  max_acciones_reunion: 5,
  valor_fondo_social: 2_000,
  valor_multa: 2_000,
  tasa_interes: "2.000",
};
const SOCIA = { membresia_id: "m7", titular_id: "t7", numero: 7, activo: true, ahorro_ciclo: 0 };
const AHORA = new Date("2026-10-04T15:00:00Z");

async function preparar() {
  const base = baseEnMemoria();
  await prepararBaseCifrada(base, new Uint8Array(32));
  await migrar(base);
  const par = (await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const publica = Buffer.from(await c.subtle.exportKey("spki", par.publicKey)).toString("base64url");
  const escritor: Firmante = { llaveId: uuid(c), privada: par.privateKey };
  const reunion = await abrirReunion(base, c, { ciclo: CICLO, numero: 1, fecha: "2026-10-04", escritor, id: uuid(c), ahora: AHORA });
  return { base, escritor, publica, reunion };
}

const cola = async (base: Awaited<ReturnType<typeof preparar>>["base"]) =>
  (await base.todas<{ carga: string }>("SELECT carga FROM pendientes ORDER BY rowid;")).map(
    (f) => JSON.parse(f.carga) as Elemento,
  );

describe("abrir la reunión", () => {
  test("encola la reunión firmada por el escritor y queda en el paso 1", async () => {
    const { base, reunion, publica } = await preparar();
    expect(reunion).toMatchObject({ numero: 1, paso: 1, miembro: 0, estado: "abierta" });
    const [elemento] = await cola(base);
    expect(elemento).toMatchObject({ tipo: "reunion", datos: { ciclo: "c1", numero: 1, fecha: "2026-10-04" } });
    expect(
      await verificar(c, publica, { formato: 1, id: elemento.id, tipo: elemento.tipo, datos: elemento.datos }, elemento.firmas[0].firma),
    ).toBe(true);
  });

  test("un solo escritor: no se abre otra reunión mientras haya una abierta", async () => {
    const { base, escritor } = await preparar();
    await expect(
      abrirReunion(base, c, { ciclo: CICLO, numero: 2, fecha: "2026-10-11", escritor, id: uuid(c), ahora: AHORA }),
    ).rejects.toBeInstanceOf(ReunionYaAbierta);
  });

  test("el número sigue al mayor entre lo del servidor y lo abierto aquí", async () => {
    const { base } = await preparar();
    const foto = { reuniones: [{ id: "r", numero: 3, fecha: "2026-09-01", estado: "cerrada" }] } as Pick<FotoGrupo, "reuniones">;
    expect(await siguienteNumero(base, foto, "c1")).toBe(4);
    expect(await siguienteNumero(base, { reuniones: [] }, "c1")).toBe(2);
  });
});

describe("retomar en el punto exacto (D14)", () => {
  test("guarda paso y miembro", async () => {
    const { base, reunion } = await preparar();
    await guardarPosicion(base, reunion.id, 4, 11);
    expect(await reunionAbierta(base)).toMatchObject({ paso: 4, miembro: 11 });
    await expect(guardarPosicion(base, reunion.id, 10)).rejects.toThrow(RangeError);
  });
});

describe("asistencia", () => {
  test("se marca y se cambia", async () => {
    const { base, reunion } = await preparar();
    await marcarAsistencia(base, reunion.id, "m7", true);
    await marcarAsistencia(base, reunion.id, "m7", false);
    expect((await asistencia(base, reunion.id)).get("m7")).toBe(false);
  });
});

describe("aportes por miembro", () => {
  test("montos con los precios del ciclo", () => {
    expect(montos(CICLO, { acciones: 2, fondoSocial: true, multas: { tarde: 1 } })).toEqual({
      ahorro: 20_000,
      fondoSocial: 2_000,
      multas: 2_000,
      total: 24_000,
    });
    expect(() => montos(CICLO, { acciones: 6, fondoSocial: false, multas: {} })).toThrow(/MAXIMO_ACCIONES/);
  });

  test("encola ahorro, fondo social y multa firmados", async () => {
    const { base, reunion, escritor } = await preparar();
    await registrarAportes(base, c, {
      reunion,
      ciclo: CICLO,
      miembro: SOCIA,
      aportes: { acciones: 2, fondoSocial: true, multas: { tarde: 1 } },
      firmante: escritor,
      ahora: AHORA,
    });
    const elementos = (await cola(base)).slice(1);
    expect(elementos.map((e) => e.tipo)).toEqual(["ahorro", "movimiento", "multa"]);
    expect(elementos[0].datos).toEqual({ reunion: reunion.id, titular: "t7", acciones: 2 });
    expect(elementos[1].datos).toMatchObject({ tipo: "fondo_social", monto: 2_000 });
    expect(elementos[2].datos).toMatchObject({ cantidad: 1, motivo: "Llegó tarde" });
    expect(await aportesRegistrados(base, reunion.id, "t7")).toEqual({
      acciones: 2,
      fondoSocial: true,
      multas: { tarde: 1 },
    });
    expect(await porSubir(base)).toBe(4);
  });

  test("guardar lo mismo dos veces no encola nada nuevo (doble toque)", async () => {
    const { base, reunion, escritor } = await preparar();
    const datos = { reunion, ciclo: CICLO, miembro: SOCIA, aportes: { acciones: 1, fondoSocial: true, multas: {} }, firmante: escritor, ahora: AHORA };
    await registrarAportes(base, c, datos);
    await registrarAportes(base, c, datos);
    expect(await porSubir(base)).toBe(3);
  });

  test("corregir: contramovimiento de cada registro anterior y la versión nueva (D9)", async () => {
    const { base, reunion, escritor } = await preparar();
    const base_ = { reunion, ciclo: CICLO, miembro: SOCIA, firmante: escritor, ahora: AHORA };
    await registrarAportes(base, c, { ...base_, aportes: { acciones: 3, fondoSocial: true, multas: {} } });
    const antes = (await cola(base)).slice(1);
    await registrarAportes(base, c, { ...base_, aportes: { acciones: 2, fondoSocial: true, multas: {} } });
    const despues = (await cola(base)).slice(1 + antes.length);
    expect(despues.map((e) => e.tipo)).toEqual(["correccion", "correccion", "ahorro", "movimiento"]);
    expect(despues.slice(0, 2).map((e) => e.datos.original)).toEqual(antes.map((e) => e.id));
    expect(despues[2].datos.acciones).toBe(2);
    expect(new Set(despues.map((e) => e.id)).size).toBe(4);
    expect(despues.some((e) => antes.some((a) => a.id === e.id))).toBe(false);
  });

  test("la planilla sabe quién ya tiene su aporte anotado y cuánto dio", async () => {
    const { base, reunion, escritor } = await preparar();
    expect((await anotadosDeLaReunion(base, reunion.id, CICLO)).size).toBe(0);
    await registrarAportes(base, c, { reunion, ciclo: CICLO, miembro: SOCIA, aportes: { acciones: 2, fondoSocial: true, multas: { tarde: 1 } }, firmante: escritor, ahora: AHORA });
    expect(await anotadosDeLaReunion(base, reunion.id, CICLO)).toEqual(new Map([["t7", 24_000]]));
  });

  test("por encima del tope del ciclo no se firma nada", async () => {
    const { base, reunion, escritor } = await preparar();
    await expect(
      registrarAportes(base, c, { reunion, ciclo: CICLO, miembro: SOCIA, aportes: { acciones: 9, fondoSocial: true, multas: {} }, firmante: escritor, ahora: AHORA }),
    ).rejects.toThrow(/MAXIMO_ACCIONES/);
    expect(await porSubir(base)).toBe(1);
  });
});

describe("igual que la reunión pasada (D11)", () => {
  const sin = { ciclo: CICLO, ultima_reunion: null };

  test("sin reunión pasada no hay nada que copiar", async () => {
    const { base, reunion } = await preparar();
    expect(await aportesDeLaPasada(base, sin, reunion.id, "t7")).toBeNull();
  });

  test("usa lo que la Fundación conoce de la última reunión, sin multas y con el tope del ciclo", async () => {
    const { base, reunion } = await preparar();
    const foto = {
      ciclo: CICLO,
      ultima_reunion: { numero: 3, aportes: { t7: { acciones: 9, fondo_social: true } } },
    };
    expect(await aportesDeLaPasada(base, foto, reunion.id, "t7")).toEqual({ acciones: 5, fondoSocial: true, multas: {} });
    expect(await aportesDeLaPasada(base, foto, reunion.id, "t8")).toBeNull();
  });

  test("la reunión que llevó este celular gana si es más reciente que la del servidor", async () => {
    const { base, escritor, reunion } = await preparar();
    await registrarAportes(base, c, {
      reunion,
      ciclo: CICLO,
      miembro: SOCIA,
      aportes: { acciones: 2, fondoSocial: false, multas: { tarde: 1 } },
      firmante: escritor,
      ahora: AHORA,
    });
    await base.correr("UPDATE reunion_local SET estado = 'cerrada' WHERE id = ?;", reunion.id);
    const hoy = await abrirReunion(base, c, { ciclo: CICLO, numero: 2, fecha: "2026-10-11", escritor, id: uuid(c), ahora: AHORA });
    const vieja = { ciclo: CICLO, ultima_reunion: { numero: 0, aportes: { t7: { acciones: 4, fondo_social: true } } } };
    expect(await aportesDeLaPasada(base, vieja, hoy.id, "t7")).toEqual({ acciones: 2, fondoSocial: false, multas: {} });
    // Lo de hoy no cuenta como "la pasada".
    expect(await aportesDeLaPasada(base, sin, reunion.id, "t7")).toBeNull();
  });
});
