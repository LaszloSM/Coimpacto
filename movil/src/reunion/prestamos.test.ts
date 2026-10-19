import type { Elemento } from "../cola/cola";
import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { verificar } from "../seguridad/firma";
import { uuid } from "../seguridad/llavero";
import type { Perfil } from "../seguridad/perfiles";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import { FOTO_PRUEBA } from "../sesion/modoPrueba";
import {
  firmarPrestamos,
  guardarSolicitud,
  partesAbono,
  planDeCuotas,
  puedeFirmar,
  registrarAbono,
  resultadoVotacion,
  solicitudes,
  type FirmanteCargo,
  type PrestamoFoto,
} from "./prestamos";
import { abrirReunion } from "./reunion";

const CICLO = FOTO_PRUEBA.ciclo!;
const AHORA = new Date("2026-10-04T15:00:00Z");
const titular = (n: number) => FOTO_PRUEBA.miembros[n - 1].titular_id;
const PRESTAMO: PrestamoFoto = {
  id: "p1",
  titular_id: titular(7),
  capital: 100_000,
  num_cuotas: 4,
  cuota_mensual: 27_000,
  total_pagar: 108_000,
  saldo: 108_000,
};

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
  const cajera = await firmante("portador_caja", 2);
  const reunion = await abrirReunion(base, c, { ciclo: CICLO, numero: 1, fecha: "2026-10-04", escritor: cajera, id: uuid(c), ahora: AHORA });
  return { base, cajera, reunion };
}

const cola = async (base: Awaited<ReturnType<typeof preparar>>["base"]) =>
  (await base.todas<{ carga: string }>("SELECT carga FROM pendientes ORDER BY rowid;")).map((f) => JSON.parse(f.carga) as Elemento).slice(1);

describe("abonos", () => {
  test("capital e interés con las reglas compartidas; no más que el saldo", () => {
    expect(partesAbono(PRESTAMO, 27_000)).toEqual({ capital: 25_000, interes: 2_000 });
    expect(() => partesAbono({ ...PRESTAMO, saldo: 10_000 }, 27_000)).toThrow(/ABONO_EXCEDE_SALDO/);
  });

  test("encola el abono; corregirlo deja contramovimiento y versión nueva", async () => {
    const { base, cajera, reunion } = await preparar();
    await registrarAbono(base, c, { reunion, prestamo: PRESTAMO, monto: 27_000, firmante: cajera, ahora: AHORA });
    await registrarAbono(base, c, { reunion, prestamo: PRESTAMO, monto: 27_000, firmante: cajera, ahora: AHORA });
    await registrarAbono(base, c, { reunion, prestamo: PRESTAMO, monto: 20_000, firmante: cajera, ahora: AHORA });
    const e = await cola(base);
    expect(e.map((x) => x.tipo)).toEqual(["abono", "correccion", "abono"]);
    expect(e[1].datos.original).toBe(e[0].id);
    expect(e[2].datos).toEqual({ reunion: reunion.id, prestamo: "p1", monto: 20_000 });
  });
});

describe("votación (D21)", () => {
  test.each([
    [{ aFavor: 8, enContra: 2, abstenciones: 1, presentes: 11 }, 20, true],
    [{ aFavor: 8, enContra: 2, abstenciones: 0, presentes: 10 }, 20, false], // 10 de 20 no es quórum
    [{ aFavor: 5, enContra: 5, abstenciones: 1, presentes: 11 }, 20, false], // empate
    [{ aFavor: 9, enContra: 2, abstenciones: 1, presentes: 11 }, 20, false], // más votos que presentes
  ])("%o con %i activos → aprobada %s", (v, activos, aprobada) => {
    expect(resultadoVotacion(v, activos).aprobada).toBe(aprobada);
  });

  test("plan de cuotas con interés fijo del ciclo", () => {
    expect(planDeCuotas(CICLO, 100_000, 4)).toEqual({ interes_mensual: 2_000, total_pagar: 108_000, cuota_mensual: 27_000 });
  });

  test("quien tiene préstamo vigente no puede pedir otro", async () => {
    const { base, reunion } = await preparar();
    await expect(
      guardarSolicitud(base, c, {
        reunion,
        titularId: titular(7),
        capital: 50_000,
        numCuotas: 2,
        votacion: { aFavor: 11, enContra: 0, abstenciones: 0, presentes: 11 },
        activos: 20,
        ciclo: CICLO,
        prestamosVigentes: [PRESTAMO],
      }),
    ).rejects.toThrow(/PRESTAMO_VIGENTE/);
  });
});

describe("firmas agrupadas (D10)", () => {
  const voto = { aFavor: 11, enContra: 0, abstenciones: 0, presentes: 11 };

  async function conSolicitudes() {
    const ctx = await preparar();
    for (const [n, capital] of [[9, 100_000], [12, 60_000]] as const) {
      await guardarSolicitud(ctx.base, c, {
        reunion: ctx.reunion,
        titularId: titular(n),
        capital,
        numCuotas: 4,
        votacion: voto,
        activos: 20,
        ciclo: CICLO,
        prestamosVigentes: [],
      });
    }
    await guardarSolicitud(ctx.base, c, {
      reunion: ctx.reunion,
      titularId: titular(15),
      capital: 30_000,
      numCuotas: 2,
      votacion: { aFavor: 3, enContra: 8, abstenciones: 0, presentes: 11 },
      activos: 20,
      ciclo: CICLO,
      prestamosVigentes: [],
    });
    return ctx;
  }

  test("cada firmante firma todas las aprobadas de una vez; la no aprobada no se firma", async () => {
    const { base, reunion, cajera } = await conSolicitudes();
    const presidente = await firmante("presidente", 1);
    const n = await firmarPrestamos(base, c, { reunion, firmantes: [presidente, cajera], foto: FOTO_PRUEBA, ahora: AHORA });
    expect(n).toBe(2);
    const e = await cola(base);
    expect(e.map((x) => x.tipo)).toEqual(["prestamo", "prestamo"]);
    expect(e[0].firmas.map((f) => f.llave)).toEqual([presidente.llaveId, cajera.llaveId]);
    expect(e[0].datos).toMatchObject({ capital: 100_000, num_cuotas: 4, votacion: { a_favor: 11, presentes: 11 } });
    const firmado = { formato: 1, id: e[1].id, tipo: e[1].tipo, datos: e[1].datos };
    expect(await verificar(c, presidente.publica, firmado, e[1].firmas[0].firma)).toBe(true);
    expect(await verificar(c, cajera.publica, firmado, e[1].firmas[1].firma)).toBe(true);
    expect((await solicitudes(base, reunion.id)).map((s) => s.estado)).toEqual(["firmada", "firmada", "no_aprobada"]);
    expect(await firmarPrestamos(base, c, { reunion, firmantes: [presidente, cajera], foto: FOTO_PRUEBA, ahora: AHORA })).toBe(0);
  });

  test("una sola firma no basta y no deja nada a medias", async () => {
    const { base, reunion, cajera } = await conSolicitudes();
    await expect(firmarPrestamos(base, c, { reunion, firmantes: [cajera], foto: FOTO_PRUEBA, ahora: AHORA })).rejects.toThrow(
      /FIRMAS_INSUFICIENTES/,
    );
    expect(await cola(base)).toEqual([]);
  });

  test("reglas de quién puede firmar: cargo distinto, persona distinta, nunca el beneficiario", () => {
    const caja: Perfil = { cargoId: "k2", tipo: "portador_caja", numero: 2 };
    expect(puedeFirmar({ cargoId: "k1", tipo: "presidente", numero: 1 }, [caja], [titular(9)], FOTO_PRUEBA)).toBeNull();
    expect(puedeFirmar({ cargoId: "kx", tipo: "portador_caja", numero: 3 }, [caja], [], FOTO_PRUEBA)).toBe("mismo_cargo");
    expect(puedeFirmar({ cargoId: "k3", tipo: "contador_1", numero: 2 }, [caja], [], FOTO_PRUEBA)).toBe("misma_persona");
    expect(puedeFirmar({ cargoId: "k1", tipo: "presidente", numero: 9 }, [caja], [titular(9)], FOTO_PRUEBA)).toBe("beneficiario");
  });
});

test("la votación usa el reglamento de la ACAP que baja con la foto (ET2)", () => {
  const v = { presentes: 13, aFavor: 13, enContra: 0, abstenciones: 0 };
  expect(resultadoVotacion(v, 20).aprobada).toBe(true);
  expect(resultadoVotacion(v, 20, { quorum_porcentaje: 66 })).toEqual({ quorum: false, votosCuadran: true, aprobada: false });
  expect(resultadoVotacion({ ...v, aFavor: 6, enContra: 2, abstenciones: 5 }, 20, { mayoria: "absoluta" }).aprobada).toBe(false);
});
