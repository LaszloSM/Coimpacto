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

test("paso 5 sin préstamos vigentes dice qué hacer", async () => {
  await montarEnPaso(5);
  expect(await screen.findByText("Nadie tiene préstamo vigente.")).toBeOnTheScreen();
  expect(screen.getByText("Seguir a préstamos")).toBeOnTheScreen();
});

test("préstamo: votación con quórum, plan de cuotas y firmas agrupadas de dos cargos", async () => {
  const base = await montarEnPaso(6);
  expect(await screen.findByText("Hoy nadie pidió préstamo.")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("agregar-solicitud"));
  await fireEvent.press(await screen.findByTestId("pide-9"));

  await fireEvent.press(screen.getByTestId("capital-1"));
  await fireEvent.press(screen.getByTestId("capital-0"));
  await fireEvent.press(screen.getByTestId("capital-0"));
  await fireEvent.press(screen.getByTestId("capital-000"));
  expect(screen.getByText("cien mil pesos")).toBeOnTheScreen();
  expect(screen.getByText("veintisiete mil pesos")).toBeOnTheScreen(); // cuota con 2 % fijo en 4 cuotas

  for (let i = 0; i < 12; i++) await fireEvent.press(screen.getByTestId("voto-favor-mas"));
  expect(screen.getByTestId("resultado-voto")).toHaveTextContent("Aprobado por la asamblea.");
  await fireEvent.press(screen.getByTestId("guardar-solicitud"));

  expect(await screen.findByText("Aprobada · falta firmar")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("firmar-aprobaciones"));
  expect(await screen.findByText("Faltan 2 firmas.")).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId("firma-presidente"));
  await teclear("tecla", PIN_PRUEBA.presidente);
  expect(await screen.findByText("Falta 1 firma de 2.")).toBeOnTheScreen();
  expect(screen.getByText("Firmó")).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId("firma-portador_caja"));
  await teclear("tecla", PIN_PRUEBA.portador_caja);
  expect(await screen.findByText("Firmada · entregar el efectivo")).toBeOnTheScreen();

  const prestamos = (await base.todas<{ carga: string }>("SELECT carga FROM pendientes WHERE tipo = 'prestamo';")).map(
    (f) => JSON.parse(f.carga) as Elemento,
  );
  expect(prestamos).toHaveLength(1);
  expect(prestamos[0].firmas).toHaveLength(2);
  expect(prestamos[0].datos).toMatchObject({ capital: 100_000, num_cuotas: 4 });
  await waitFor(() => expect(screen.getByTestId("seguir-arqueo")).toBeOnTheScreen());
});

test("un PIN equivocado muestra los intentos que quedan", async () => {
  await montarEnPaso(6);
  await fireEvent.press(await screen.findByTestId("agregar-solicitud"));
  await fireEvent.press(await screen.findByTestId("pide-9"));
  await teclear("capital", "50");
  await fireEvent.press(screen.getByTestId("capital-000"));
  for (let i = 0; i < 12; i++) await fireEvent.press(screen.getByTestId("voto-favor-mas"));
  await fireEvent.press(screen.getByTestId("guardar-solicitud"));
  await fireEvent.press(await screen.findByTestId("firmar-aprobaciones"));
  await fireEvent.press(await screen.findByTestId("firma-presidente"));
  await teclear("tecla", "111112");
  expect(await screen.findByText("PIN no coincide · quedan 4 intentos")).toBeOnTheScreen();
});
