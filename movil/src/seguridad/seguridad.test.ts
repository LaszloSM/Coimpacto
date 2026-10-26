import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ValorJson } from "@credimpacto/reglas";

import { almacenEnMemoria } from "./almacen";
import { aB64url, desdeB64url } from "./cripto";
import { llaveDelDispositivo, llavesPerdidas, secretoDelDispositivo } from "./dispositivo";
import { canjearCodigo, EnrolamientoFallido, leerQr } from "./enrolamiento";
import { firmar, mensajeAlta, verificar } from "./firma";
import { CargoEnPausa, ControlIntentos, PinFallido } from "./intentos";
import { abrirCargo, altaCargo, crearDek, PinIncorrecto } from "./llavero";
import { calibrar, derivarDesdePin, N_MAXIMO, PARAMS_PISO, revisarPinNuevo } from "./pin";
import { criptoNode as c } from "./pruebas/criptoNode";

const vector = JSON.parse(
  readFileSync(join(__dirname, "../../../packages/casos-reglas/casos/firmas-p256.json"), "utf8"),
) as { llave_publica: string; casos: { nombre: string; valor: ValorJson; firma: string; valida: boolean }[] };

describe("base64url", () => {
  test.each([0, 1, 2, 3, 31, 32, 33, 64])("ida y vuelta con %i bytes", (largo) => {
    const bytes = c.aleatorio(largo);
    const texto = aB64url(bytes);
    expect(texto).toBe(Buffer.from(bytes).toString("base64url"));
    expect(desdeB64url(texto)).toEqual(bytes);
  });

  test("rechaza relleno y caracteres ajenos", () => {
    expect(() => desdeB64url("AAAA==")).toThrow();
    expect(() => desdeB64url("A+/A")).toThrow();
  });
});

describe("PIN", () => {
  test.each([
    ["482916", null],
    ["12345", "largo"],
    ["12a456", "largo"],
    ["000000", "repetido"],
    ["123456", "secuencia"],
    ["654321", "secuencia"],
  ])("%s → %s", (pin, motivo) => {
    expect(revisarPinNuevo(pin)).toBe(motivo);
  });

  test("no deriva por debajo del piso de EP1", () => {
    expect(() => derivarDesdePin(c, "482916", c.aleatorio(16), { N: 2 ** 14, r: 8, p: 1 })).toThrow(
      RangeError,
    );
  });

  test("la calibración nunca baja del piso ni pasa del techo", async () => {
    const lento = { ...c, ahora: (() => { let t = 0; return () => (t += 5000); })() };
    expect(await calibrar(lento)).toEqual(PARAMS_PISO);
    const rapido = { ...c, ahora: (() => { let t = 0; return () => (t += 1); })() };
    expect((await calibrar(rapido)).N).toBe(N_MAXIMO);
  });

  test("la calibración apunta a ~1 s", async () => {
    // 200 ms con el piso → N = 2^17 tardaría 800 ms; 2^18 pasaría del techo de memoria.
    const reloj = { ...c, ahora: (() => { let t = 0; return () => (t += 100); })() };
    expect((await calibrar(reloj, 1000)).N).toBe(2 ** 17);
  });
});

describe("llavero del cargo", () => {
  const secreto = c.aleatorio(32);
  const dek = crearDek(c);
  let entrada: Awaited<ReturnType<typeof altaCargo>>;

  beforeAll(async () => {
    entrada = await altaCargo(c, { cargoId: "cargo-presidente", pin: "482916", secreto, dek, params: PARAMS_PISO });
  });

  test("el PIN correcto abre la DEK y la llave para firmar", async () => {
    const abierto = await abrirCargo(c, entrada, "482916", secreto);
    expect(abierto.dek).toEqual(dek);
    const firma = await firmar(c, abierto.privada, { tipo: "aporte", pesos: 50_000 });
    expect(await verificar(c, entrada.llavePublica, { tipo: "aporte", pesos: 50_000 }, firma)).toBe(true);
  });

  test("la llave abierta no se puede exportar", async () => {
    const { privada } = await abrirCargo(c, entrada, "482916", secreto);
    expect(privada.extractable).toBe(false);
    await expect(c.subtle.exportKey("pkcs8", privada)).rejects.toThrow();
  });

  test("PIN equivocado", async () => {
    await expect(abrirCargo(c, entrada, "482917", secreto)).rejects.toBeInstanceOf(PinIncorrecto);
  });

  test("el PIN correcto en otro celular (otro secreto) no abre nada", async () => {
    await expect(abrirCargo(c, entrada, "482916", c.aleatorio(32))).rejects.toBeInstanceOf(PinIncorrecto);
  });

  test("dos cargos abren la misma DEK con PIN distintos", async () => {
    const otra = await altaCargo(c, { cargoId: "cargo-caja", pin: "730185", secreto, dek, params: PARAMS_PISO });
    expect((await abrirCargo(c, otra, "730185", secreto)).dek).toEqual(dek);
    expect(otra.llavePublica).not.toBe(entrada.llavePublica);
  });

  test("la envoltura de un cargo no sirve pegada en otro (AAD)", async () => {
    const copiada = { ...entrada, cargoId: "cargo-registrador" };
    await expect(abrirCargo(c, copiada, "482916", secreto)).rejects.toBeInstanceOf(PinIncorrecto);
  });

  test("nada del llavero contiene la DEK ni el PIN en claro", () => {
    const texto = JSON.stringify(entrada);
    expect(texto).not.toContain(aB64url(dek));
    expect(texto).not.toContain("482916");
  });
});

describe("firmas compartidas con el servidor", () => {
  test.each(vector.casos)("$nombre", async ({ valor, firma, valida }) => {
    expect(await verificar(c, vector.llave_publica, valor, firma)).toBe(valida);
  });

  test("la firma es P1363 de 64 bytes", async () => {
    const { privateKey } = (await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
      "sign",
    ])) as CryptoKeyPair;
    expect(desdeB64url(await firmar(c, privateKey, { a: 1 }))).toHaveLength(64);
  });

  test("el mensaje de alta tiene la forma que verifica el servidor", () => {
    expect(
      mensajeAlta({ llaveId: "l", cargoId: "c", dispositivoId: "d", llavePublica: "p" }),
    ).toEqual({ tipo: "alta_llave_cargo", v: 1, llave: "l", cargo: "c", dispositivo: "d", llave_publica: "p" });
  });
});

describe("5 intentos de PIN", () => {
  const falla = () => Promise.reject(new PinIncorrecto());

  test("al quinto fallo el cargo queda en pausa, aun con el PIN correcto", async () => {
    const control = new ControlIntentos(almacenEnMemoria());
    for (const restantes of [4, 3, 2, 1, 0]) {
      await expect(control.intentar("caja", falla)).rejects.toEqual(new PinFallido(restantes));
    }
    expect(await control.enPausa("caja")).toBe(true);
    await expect(control.intentar("caja", async () => "ok")).rejects.toBeInstanceOf(CargoEnPausa);
  });

  test("acertar devuelve los intentos", async () => {
    const control = new ControlIntentos(almacenEnMemoria());
    await expect(control.intentar("caja", falla)).rejects.toBeInstanceOf(PinFallido);
    expect(await control.intentar("caja", async () => "ok")).toBe("ok");
    expect(await control.restantes("caja")).toBe(5);
  });

  test("cerrar la app a mitad de la derivación no devuelve el intento", async () => {
    const almacen = almacenEnMemoria();
    const antes = new ControlIntentos(almacen);
    // La derivación empieza y nunca termina: la app muere aquí.
    await new Promise<void>((empezo) => {
      void antes.intentar("caja", () => {
        empezo();
        return new Promise(() => {});
      });
    });
    expect(await new ControlIntentos(almacen).restantes("caja")).toBe(4);
  });

  test("la pausa sobrevive al reinicio y cada cargo cuenta aparte", async () => {
    const almacen = almacenEnMemoria();
    const control = new ControlIntentos(almacen);
    for (let i = 0; i < 5; i++) await control.intentar("caja", falla).catch(() => {});
    expect(await new ControlIntentos(almacen).enPausa("caja")).toBe(true);
    expect(await new ControlIntentos(almacen).enPausa("presidente")).toBe(false);
  });

  test("un error que no es del PIN no gasta intentos", async () => {
    const control = new ControlIntentos(almacenEnMemoria());
    await expect(control.intentar("caja", () => Promise.reject(new Error("disco lleno")))).rejects.toThrow(
      "disco lleno",
    );
    expect(await control.restantes("caja")).toBe(5);
  });
});

describe("identidad del celular", () => {
  test("el secreto y la llave se crean una vez y se conservan", async () => {
    const almacen = almacenEnMemoria();
    const secreto = await secretoDelDispositivo(c, almacen);
    expect(secreto).toHaveLength(32);
    expect(await secretoDelDispositivo(c, almacen)).toEqual(secreto);
    const llave = await llaveDelDispositivo(c, almacen);
    expect(await llaveDelDispositivo(c, almacen)).toBe(llave);
  });
});

describe("enrolamiento por QR", () => {
  const codigo = "a".repeat(43);

  test("lee el código del QR del back-office", () => {
    expect(leerQr(`credimpacto:enrolar:${codigo}\n`)).toBe(codigo);
  });

  test.each(["https://otro-servidor.example/enrolar", `otro:enrolar:${codigo}`, "credimpacto:enrolar:corto"])(
    "rechaza un QR ajeno: %s",
    (texto) => {
      expect(() => leerQr(texto)).toThrow(new EnrolamientoFallido("qr_ajeno"));
    },
  );

  const responder = (status: number, cuerpo: unknown) =>
    jest.fn(async () => new Response(JSON.stringify(cuerpo), { status })) as unknown as typeof fetch;

  test("canjea contra el servidor fijo de la app", async () => {
    const pedir = responder(200, { dispositivo_id: "d", acap_id: "a", acap_nombre: "ACAP Las Brisas" });
    await expect(canjearCodigo("https://api.example", codigo, "llave", pedir)).resolves.toEqual({
      dispositivoId: "d",
      acapId: "a",
      acapNombre: "ACAP Las Brisas",
    });
    expect(pedir).toHaveBeenCalledWith("https://api.example/api/enrolamiento/canjear", expect.anything());
  });

  test("código vencido → texto de la tabla de estados", async () => {
    const pedir = responder(400, { motivo: "codigo_vencido", mensaje: "El registro venció." });
    await expect(canjearCodigo("https://api.example", codigo, "llave", pedir)).rejects.toThrow(
      "El registro venció. Escriba otra vez el usuario y la clave de la ACAP.",
    );
  });

  test("sin señal", async () => {
    const pedir = jest.fn(() => Promise.reject(new TypeError("Network request failed")));
    await expect(canjearCodigo("https://api.example", codigo, "llave", pedir)).rejects.toThrow(
      "Necesita señal solo para este paso.",
    );
  });
});

describe("llaves perdidas (tabla de estados)", () => {
  test("con perfiles y sin secreto del Keystore se avisa antes de pedir PIN", async () => {
    const almacen = almacenEnMemoria();
    expect(await llavesPerdidas(almacen, false)).toBe(false);
    expect(await llavesPerdidas(almacen, true)).toBe(true);
    await secretoDelDispositivo(c, almacen);
    expect(await llavesPerdidas(almacen, true)).toBe(false);
  });
});
