import { canonico, type ValorJson } from "@credimpacto/reglas";

import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { almacenEnMemoria } from "../seguridad/almacen";
import { firmarComoDispositivo, llaveDelDispositivo } from "../seguridad/dispositivo";
import { verificar } from "../seguridad/firma";
import { uuid } from "../seguridad/llavero";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import {
  CelularRechazado,
  encolar,
  enviarPorHttp,
  loFirmado,
  prepararElemento,
  RecapturaDistinta,
  SinSenal,
  sincronizar,
  type Elemento,
  type EnviarLote,
  type Firmante,
  type ResultadoElemento,
} from "./cola";
import { idNatural, uuidV5 } from "./ids";

const AHORA = new Date("2026-10-04T15:00:00Z");

async function base() {
  const b = baseEnMemoria();
  await prepararBaseCifrada(b, new Uint8Array(32));
  await migrar(b);
  return b;
}

async function cajera(): Promise<Firmante & { publica: string }> {
  const par = (await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const spki = Buffer.from(await c.subtle.exportKey("spki", par.publicKey)).toString("base64url");
  return { llaveId: uuid(c), privada: par.privateKey, publica: spki };
}

async function aporte(firmante: Firmante, acciones = 3, id = uuid(c)): Promise<Elemento> {
  return prepararElemento(c, { id, tipo: "ahorro", datos: { reunion: "r1", titular: "t7", acciones } }, [firmante]);
}

/** Servidor de mentira: idempotente por id y con reglas configurables por elemento. */
function servidor(regla: (e: Elemento) => ResultadoElemento["estado"] = () => "confirmado") {
  const recibidos = new Map<string, ResultadoElemento>();
  const lotes: Elemento[][] = [];
  const enviar: EnviarLote = async ({ elementos }) => {
    lotes.push(elementos);
    return elementos.map((e) => {
      const previo = recibidos.get(e.id);
      if (previo) return previo;
      const r = { id: e.id, estado: regla(e), codigo: "" };
      if (r.estado !== "en_espera") recibidos.set(e.id, r);
      return r;
    });
  };
  return { enviar, recibidos, lotes };
}

const estados = async (b: Awaited<ReturnType<typeof base>>) =>
  b.todas<{ id: string; estado: string }>("SELECT id, estado FROM pendientes ORDER BY rowid;");

describe("ids deterministas", () => {
  test("vector de la RFC 4122 (UUID v5 de www.example.com en el espacio DNS)", async () => {
    expect(await uuidV5(c, "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
  });

  test("la misma clave natural da el mismo id; otra clave, otro id", async () => {
    const a = await idNatural(c, "ahorro", "reunion-1", "titular-7");
    expect(await idNatural(c, "ahorro", "reunion-1", "titular-7")).toBe(a);
    expect(await idNatural(c, "ahorro", "reunion-1", "titular-8")).not.toBe(a);
    expect(a[14]).toBe("5");
  });
});

describe("elementos firmados", () => {
  test("la firma cubre formato, id, tipo y datos", async () => {
    const f = await cajera();
    const e = await aporte(f);
    expect(await verificar(c, f.publica, loFirmado(e), e.firmas[0].firma)).toBe(true);
    expect(await verificar(c, f.publica, loFirmado({ ...e, datos: { ...e.datos, acciones: 4 } }), e.firmas[0].firma)).toBe(false);
  });
});

describe("encolar", () => {
  test("un doble toque no duplica", async () => {
    const b = await base();
    const e = await aporte(await cajera());
    await encolar(b, e, AHORA);
    await encolar(b, e, AHORA);
    expect(await estados(b)).toHaveLength(1);
  });

  test("el mismo id con otro contenido no se guarda", async () => {
    const b = await base();
    const f = await cajera();
    const e = await aporte(f, 3);
    await encolar(b, e, AHORA);
    await expect(encolar(b, await aporte(f, 4, e.id), AHORA)).rejects.toBeInstanceOf(RecapturaDistinta);
  });
});

describe("sincronizar", () => {
  test("envía en lotes de 50, en orden, y marca cada resultado", async () => {
    const b = await base();
    const f = await cajera();
    const ids: string[] = [];
    for (let i = 0; i < 120; i++) {
      const e = await aporte(f);
      ids.push(e.id);
      await encolar(b, e, AHORA);
    }
    const s = servidor();
    const resumen = await sincronizar(b, s.enviar, () => uuid(c));
    expect(s.lotes.map((l) => l.length)).toEqual([50, 50, 20]);
    expect(s.lotes.flat().map((e) => e.id)).toEqual(ids);
    expect(resumen).toMatchObject({ enviados: 120, fin: "listo" });
    expect((await estados(b)).every((r) => r.estado === "confirmado")).toBe(true);
  });

  test("un corte de señal deja el resto pendiente y se reanuda sin duplicar", async () => {
    const b = await base();
    const f = await cajera();
    for (let i = 0; i < 120; i++) await encolar(b, await aporte(f), AHORA);
    const s = servidor();
    let llamadas = 0;
    const conCorte: EnviarLote = async (cuerpo) => {
      if (++llamadas === 2) throw new SinSenal();
      return s.enviar(cuerpo);
    };
    expect((await sincronizar(b, conCorte, () => uuid(c))).fin).toBe("sin_senal");
    expect((await estados(b)).filter((r) => r.estado === "pendiente")).toHaveLength(70);

    expect((await sincronizar(b, s.enviar, () => uuid(c))).fin).toBe("listo");
    expect(s.recibidos.size).toBe(120);
    expect((await estados(b)).every((r) => r.estado === "confirmado")).toBe(true);
  });

  test("la app se cierra después de enviar y antes de guardar: reenviar no duplica", async () => {
    const b = await base();
    const f = await cajera();
    for (let i = 0; i < 3; i++) await encolar(b, await aporte(f), AHORA);
    const s = servidor();
    const muere: EnviarLote = async (cuerpo) => {
      await s.enviar(cuerpo);
      throw new SinSenal(); // la respuesta nunca llegó
    };
    await sincronizar(b, muere, () => uuid(c));
    await sincronizar(b, s.enviar, () => uuid(c));
    expect(s.recibidos.size).toBe(3);
    expect((await estados(b)).every((r) => r.estado === "confirmado")).toBe(true);
  });

  test("lo que queda en espera no tapa lo que viene detrás y se reenvía después", async () => {
    const b = await base();
    const f = await cajera();
    const primero = await aporte(f);
    await encolar(b, primero, AHORA);
    for (let i = 0; i < 60; i++) await encolar(b, await aporte(f), AHORA);
    let faltaReunion = true;
    const s = servidor((e) => (e.id === primero.id && faltaReunion ? "en_espera" : "confirmado"));
    const resumen = await sincronizar(b, s.enviar, () => uuid(c));
    expect(resumen.porEstado).toMatchObject({ en_espera: 1, confirmado: 60 });
    expect((await estados(b))[0]).toEqual({ id: primero.id, estado: "pendiente" });

    faltaReunion = false;
    await sincronizar(b, s.enviar, () => uuid(c));
    expect((await estados(b))[0]).toEqual({ id: primero.id, estado: "confirmado" });
  });

  test("rechazados y en conflicto quedan guardados y no se reenvían", async () => {
    const b = await base();
    const f = await cajera();
    const malo = await aporte(f, 9);
    await encolar(b, malo, AHORA);
    const s = servidor((e) => (e.datos.acciones === 9 ? "rechazado" : "confirmado"));
    await sincronizar(b, s.enviar, () => uuid(c));
    await sincronizar(b, s.enviar, () => uuid(c));
    expect(s.lotes).toHaveLength(1);
    expect(await estados(b)).toEqual([{ id: malo.id, estado: "rechazado" }]);
    await expect(b.correr("DELETE FROM pendientes;")).rejects.toThrow(/pendiente sin confirmar/);
  });

  test("sin nada pendiente no llama al servidor", async () => {
    const s = servidor();
    expect((await sincronizar(await base(), s.enviar, () => uuid(c))).enviados).toBe(0);
    expect(s.lotes).toHaveLength(0);
  });
});

describe("cliente HTTP", () => {
  test("firma el cuerpo con la llave del celular", async () => {
    const almacen = almacenEnMemoria();
    const publica = await llaveDelDispositivo(c, almacen);
    const pedir = jest.fn(async () => new Response(JSON.stringify({ resultados: [] }), { status: 200 }));
    const enviar = enviarPorHttp({
      servidor: "https://api.example",
      dispositivoId: "d1",
      firmarCuerpo: (v) => firmarComoDispositivo(c, almacen, v),
      pedir: pedir as unknown as typeof fetch,
    });
    const cuerpo = { formato: 1, lote: "l1", elementos: [] };
    await enviar(cuerpo);
    const [url, opciones] = pedir.mock.calls[0] as unknown as [string, RequestInit];
    const cabeceras = opciones.headers as Record<string, string>;
    expect(url).toBe("https://api.example/api/sync/lotes");
    expect(opciones.body).toBe(canonico(cuerpo as unknown as ValorJson));
    expect(cabeceras["X-Credimpacto-Dispositivo"]).toBe("d1");
    expect(await verificar(c, publica, cuerpo as unknown as ValorJson, cabeceras["X-Credimpacto-Firma"])).toBe(true);
  });

  test.each([
    [() => Promise.reject(new TypeError("Network request failed")), SinSenal],
    [async () => new Response("", { status: 503 }), SinSenal],
    [async () => new Response("", { status: 401 }), CelularRechazado],
  ])("errores de red y del servidor", async (respuesta, error) => {
    const enviar = enviarPorHttp({
      servidor: "https://api.example",
      dispositivoId: "d1",
      firmarCuerpo: async () => "firma",
      pedir: jest.fn(respuesta) as unknown as typeof fetch,
    });
    await expect(enviar({ formato: 1, lote: "l", elementos: [] })).rejects.toBeInstanceOf(error);
  });
});
