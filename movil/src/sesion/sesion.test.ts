import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { almacenEnMemoria } from "../seguridad/almacen";
import { CargoEnPausa, PinFallido } from "../seguridad/intentos";
import { perfiles } from "../seguridad/perfiles";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import { abrirSesion, leerFoto } from "./abrir";
import { FOTO_PRUEBA, PIN_PRUEBA, sembrarModoPrueba } from "./modoPrueba";

/** Una sola base en memoria: la DEK debe ser la misma con la que se sembró. */
function abridor() {
  const base = baseEnMemoria();
  let dekSembrada: string | null = null;
  return async (dek: Uint8Array) => {
    const hex = Buffer.from(dek).toString("hex");
    if (dekSembrada === null) dekSembrada = hex;
    if (hex !== dekSembrada) throw new Error("LlaveIncorrecta");
    await prepararBaseCifrada(base, dek);
    await migrar(base);
    return { ...base, cerrar: async () => {} };
  };
}

test("modo prueba: siembra dos cargos y el grupo; cada PIN abre la misma base", async () => {
  const almacen = almacenEnMemoria();
  const abrirBase = abridor();
  await sembrarModoPrueba({ cripto: c, almacen, abrirBase }, new Date("2026-10-01T12:00:00Z"));
  await sembrarModoPrueba({ cripto: c, almacen, abrirBase }, new Date("2026-10-01T12:00:00Z"));
  const lista = await perfiles(almacen);
  expect(lista.map((p) => p.tipo)).toEqual(["presidente", "portador_caja"]);

  const sesion = await abrirSesion({ cripto: c, almacen, abrirBase }, lista[1], PIN_PRUEBA.portador_caja);
  const foto = await leerFoto(sesion.base);
  expect(foto?.miembros).toHaveLength(20);
  expect(foto?.ciclo).toEqual(FOTO_PRUEBA.ciclo);
  expect(sesion.firmante.privada.extractable).toBe(false);

  const otra = await abrirSesion({ cripto: c, almacen, abrirBase }, lista[0], PIN_PRUEBA.presidente);
  expect((await leerFoto(otra.base))?.acap.nombre).toBe("ACAP de prueba");
});

test("PIN equivocado cuenta intentos y al quinto queda en pausa", async () => {
  const almacen = almacenEnMemoria();
  const abrirBase = abridor();
  await sembrarModoPrueba({ cripto: c, almacen, abrirBase }, new Date());
  const [presidente] = await perfiles(almacen);
  await expect(abrirSesion({ cripto: c, almacen, abrirBase }, presidente, "111112")).rejects.toEqual(
    new PinFallido(4),
  );
  for (let i = 0; i < 4; i++) {
    await abrirSesion({ cripto: c, almacen, abrirBase }, presidente, "111112").catch(() => {});
  }
  await expect(abrirSesion({ cripto: c, almacen, abrirBase }, presidente, PIN_PRUEBA.presidente)).rejects.toBeInstanceOf(
    CargoEnPausa,
  );
});
