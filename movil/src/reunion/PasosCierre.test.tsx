import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { Elemento } from "../cola/cola";
import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { almacenEnMemoria } from "../seguridad/almacen";
import { uuid } from "../seguridad/llavero";
import { perfiles } from "../seguridad/perfiles";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import { abrirSesion } from "../sesion/abrir";
import { ProveedorSesion } from "../sesion/contexto";
import { PIN_PRUEBA, sembrarModoPrueba } from "../sesion/modoPrueba";
import { Asistente } from "./Asistente";
import { abrirReunion, guardarPosicion } from "./reunion";

const METRICAS = { frame: { x: 0, y: 0, width: 360, height: 760 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function montarEnPaso(paso: number) {
  const base = baseEnMemoria();
  const abrirBase = async (dek: Uint8Array) => {
    await prepararBaseCifrada(base, dek);
    await migrar(base);
    return { ...base, cerrar: async () => {} };
  };
  const almacen = almacenEnMemoria();
  const entorno = { cripto: c, almacen, abrirBase, ahora: () => new Date("2026-10-04T15:00:00Z"), nuevoId: () => uuid(c) };
  await sembrarModoPrueba(entorno, entorno.ahora());
  const cajera = (await perfiles(almacen)).find((p) => p.tipo === "portador_caja")!;
  const sesion = await abrirSesion(entorno, cajera, PIN_PRUEBA.portador_caja);
  const ciclo = (await sesion.base.primera<{ datos: string }>("SELECT datos FROM grupo WHERE id = 'ciclo';"))!;
  const reunion = await abrirReunion(sesion.base, c, {
    ciclo: JSON.parse(ciclo.datos),
    numero: 1,
    fecha: "2026-10-04",
    escritor: sesion.firmante,
    id: uuid(c),
    ahora: entorno.ahora(),
  });
  await guardarPosicion(sesion.base, reunion.id, paso);
  await render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ProveedorSesion entorno={entorno} sesionInicial={sesion}>
        <Asistente />
      </ProveedorSesion>
    </SafeAreaProvider>,
  );
  return sesion.base;
}

const teclear = async (prefijo: string, texto: string) => {
  for (const d of texto) await fireEvent.press(screen.getByTestId(`${prefijo}-${d}`));
};

test("arqueo a ciegas que cuadra, cierre firmado con sello y resumen hasta terminar", async () => {
  const base = await montarEnPaso(7);
  expect(await screen.findByText("Cuenten los billetes")).toBeOnTheScreen();
  expect(screen.queryByText(/Debería haber/)).toBeNull(); // a ciegas
  await fireEvent.press(screen.getByTestId("cuenta-100000-mas"));
  await fireEvent.press(screen.getByTestId("cuenta-50000-mas"));
  await fireEvent.press(screen.getByTestId("contar-monedas"));
  expect(await screen.findByText("Ahora las monedas")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("termine-de-contar"));
  expect(await screen.findByText("Cuadra al peso.")).toBeOnTheScreen(); // abrió con 150.000 y hoy no hubo movimientos
  await fireEvent.press(screen.getByTestId("seguir-cierre"));

  expect(await screen.findByText("Hoy no hubo correcciones.")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("firmar-cierre"));
  await fireEvent.press(await screen.findByTestId("firma-presidente"));
  await teclear("tecla", PIN_PRUEBA.presidente);
  await fireEvent.press(await screen.findByTestId("firma-portador_caja"));
  await teclear("tecla", PIN_PRUEBA.portador_caja);
  expect(await screen.findByText("Reunión cerrada · Guardado en este celular")).toBeOnTheScreen();
  expect(screen.getByLabelText("Reunión cerrada. Bien contado.")).toBeOnTheScreen();

  const cierre = JSON.parse((await base.primera<{ carga: string }>("SELECT carga FROM pendientes WHERE tipo = 'cierre';"))!.carga) as Elemento;
  expect(cierre.datos).toMatchObject({ caja_contada: 150_000, movimientos: [] });

  await fireEvent.press(screen.getByTestId("ver-resumen"));
  expect(await screen.findByText("#01")).toBeOnTheScreen();
  expect(screen.getByText("Pendiente de confirmar por la Fundación.")).toBeOnTheScreen();
  for (let i = 0; i < 19; i++) await fireEvent.press(await screen.findByTestId("resumen-siguiente"));
  await fireEvent.press(await screen.findByTestId("terminar-reunion"));
  await waitFor(async () => expect(await base.primera("SELECT 1 FROM reunion_local WHERE estado = 'abierta';")).toBeNull());
});

test("si falta plata, no sigue sin motivo", async () => {
  await montarEnPaso(7);
  await fireEvent.press(await screen.findByTestId("cuenta-100000-mas"));
  await fireEvent.press(screen.getByTestId("contar-monedas"));
  await fireEvent.press(await screen.findByTestId("termine-de-contar"));
  expect(await screen.findByText("Faltan $ 50.000. Anoten el motivo.")).toBeOnTheScreen();
  expect(screen.getByText("Falta el motivo")).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByTestId("arqueo-motivo"), "Se pagó el refrigerio");
  expect(await screen.findByText("Seguir al cierre")).toBeOnTheScreen();
});
