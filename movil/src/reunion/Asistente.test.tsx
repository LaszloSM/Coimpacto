import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { Elemento } from "../cola/cola";
import { guardarFoto } from "../cola/grupo";
import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { almacenEnMemoria } from "../seguridad/almacen";
import { uuid } from "../seguridad/llavero";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import type { Sesion } from "../sesion/abrir";
import { ProveedorSesion } from "../sesion/contexto";
import { FOTO_PRUEBA } from "../sesion/modoPrueba";
import { Asistente } from "./Asistente";

const METRICAS = { frame: { x: 0, y: 0, width: 360, height: 760 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function montar(foto = FOTO_PRUEBA) {
  const base = baseEnMemoria();
  await prepararBaseCifrada(base, new Uint8Array(32));
  await migrar(base);
  if (foto) await guardarFoto(base, foto);
  const par = (await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"])) as CryptoKeyPair;
  const sesion: Sesion = {
    base,
    cripto: c,
    perfil: { cargoId: "k2", tipo: "portador_caja", numero: 2 },
    firmante: { llaveId: uuid(c), privada: par.privateKey },
  };
  const entorno = {
    cripto: c,
    almacen: almacenEnMemoria(),
    abrirBase: async () => base,
    ahora: () => new Date("2026-10-04T15:00:00Z"),
    nuevoId: () => uuid(c),
  };
  await render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ProveedorSesion entorno={entorno} sesionInicial={sesion}>
        <Asistente />
      </ProveedorSesion>
    </SafeAreaProvider>,
  );
  return base;
}

const cola = async (base: Awaited<ReturnType<typeof montar>>) =>
  (await base.todas<{ carga: string }>("SELECT carga FROM pendientes ORDER BY rowid;")).map(
    (f) => JSON.parse(f.carga) as Elemento,
  );

test("abre la reunión, salta el paso 2 y pasa por asistencia a los aportes", async () => {
  const base = await montar();
  await fireEvent.press(await screen.findByTestId("abrir-reunion"));
  expect(await screen.findByText("Asistencia")).toBeOnTheScreen();
  expect(screen.getByText("Paso 3 de 9")).toBeOnTheScreen();
  expect(screen.getByText("Guardado en este celular · 1 por subir")).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId("asistencia-2"));
  await waitFor(() => expect(screen.getByText(/Hoy están 19 de 20/)).toBeOnTheScreen());
  await fireEvent.press(screen.getByTestId("seguir-aportes"));

  expect(await screen.findByText("#01")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("acciones-mas"));
  await fireEvent.press(screen.getByTestId("acciones-mas"));
  expect(screen.getByText("veintidós mil pesos")).toBeOnTheScreen(); // 2 acciones + fondo social
  await fireEvent.press(screen.getByTestId("guardar-siguiente"));

  // La #02 no vino: sin acciones ni fondo y con la multa de inasistencia marcada (D11).
  expect(await screen.findByText("#02")).toBeOnTheScreen();
  expect(screen.getByTestId("multa-no_asistio-valor")).toHaveTextContent("1");
  expect(screen.getByText("dos mil pesos")).toBeOnTheScreen();

  const tipos = (await cola(base)).map((e) => e.tipo);
  expect(tipos).toEqual(["reunion", "ahorro", "movimiento"]);
  expect(await base.primera("SELECT paso, miembro FROM reunion_local;")).toEqual({ paso: 4, miembro: 1 });
});

test("al reabrir sigue en el mismo miembro (D14)", async () => {
  const base = await montar();
  await fireEvent.press(await screen.findByTestId("abrir-reunion"));
  await fireEvent.press(await screen.findByTestId("seguir-aportes"));
  await fireEvent.press(await screen.findByTestId("guardar-siguiente"));
  await screen.findByText("#02");
  screen.unmount();

  const par = (await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"])) as CryptoKeyPair;
  await render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ProveedorSesion
        entorno={{ cripto: c, almacen: almacenEnMemoria(), abrirBase: async () => base, ahora: () => new Date(), nuevoId: () => uuid(c) }}
        sesionInicial={{ base, cripto: c, perfil: { cargoId: "k2", tipo: "portador_caja", numero: 2 }, firmante: { llaveId: "l", privada: par.privateKey } }}
      >
        <Asistente />
      </ProveedorSesion>
    </SafeAreaProvider>,
  );
  expect(await screen.findByText("#02")).toBeOnTheScreen();
  expect(screen.getByText("Paso 4 de 9")).toBeOnTheScreen();
});

test("sin lista del grupo pide conectarse una vez", async () => {
  await montar(null as never);
  expect(await screen.findByText("Este celular aún no tiene la lista del grupo. Conéctelo a señal una vez.")).toBeOnTheScreen();
});

test("igual que la reunión pasada rellena acciones y fondo, y se ve antes de guardar (D11)", async () => {
  const primera = FOTO_PRUEBA.miembros[0].titular_id;
  const base = await montar({
    ...FOTO_PRUEBA,
    ultima_reunion: { numero: 1, aportes: { [primera]: { acciones: 3, fondo_social: true } } },
  });
  await fireEvent.press(await screen.findByTestId("abrir-reunion"));
  await fireEvent.press(await screen.findByTestId("seguir-aportes"));
  expect(await screen.findByText("#01")).toBeOnTheScreen();
  expect(screen.getByText("3 acciones y fondo social")).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId("igual-pasada"));
  expect(screen.getByTestId("acciones-valor")).toHaveTextContent("3");
  expect(screen.getByText("treinta y dos mil pesos")).toBeOnTheScreen();
  expect(screen.queryByTestId("igual-pasada")).toBeNull(); // ya está igual
  expect((await cola(base)).map((e) => e.tipo)).toEqual(["reunion"]); // nada se guarda sin tocar "Guardar"

  await fireEvent.press(screen.getByTestId("guardar-siguiente"));
  expect(await screen.findByText("#02")).toBeOnTheScreen();
  expect(screen.queryByTestId("igual-pasada")).toBeNull(); // la #02 no dio nada la vez pasada
});

test("número + nombre corto de quien autorizó sus datos; los demás solo el número (D3)", async () => {
  const [uno, ...resto] = FOTO_PRUEBA.miembros;
  await montar({ ...FOTO_PRUEBA, miembros: [{ ...uno, nombre_corto: "Yuliana I." }, ...resto] });
  await fireEvent.press(await screen.findByTestId("abrir-reunion"));
  expect(await screen.findByText("#01 Yuliana I.")).toBeOnTheScreen();
  expect(screen.getByText("#02")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("seguir-aportes"));
  expect(await screen.findByTestId("aporte-nombre")).toHaveTextContent("Yuliana I.");
});

test("con una propuesta del facilitador, el paso 2 la muestra y no aceptarla pide motivo (D7, ET3)", async () => {
  const base = await montar({
    ...FOTO_PRUEBA,
    propuestas: [
      {
        id: "11111111-2222-4333-8444-555555555555",
        accion: "anular",
        motivo: "Se anotó dos veces",
        movimiento: { id: "m1", tipo: "fondo_social", monto: 2_000, titular_id: FOTO_PRUEBA.miembros[6].titular_id, reunion: 3, fecha: "2026-09-27" },
      },
    ],
  });
  await fireEvent.press(await screen.findByTestId("abrir-reunion"));
  expect(await screen.findByText("1 cambio por revisar")).toBeOnTheScreen();
  expect(screen.getByText("Paso 2 de 9")).toBeOnTheScreen();
  expect(screen.getByTestId("cambio-propuesta")).toHaveTextContent("Quitarlo del cuaderno");

  await fireEvent.press(screen.getByTestId("no-aceptar-cambio"));
  expect(screen.getByText("Elija un motivo")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("motivo-si_se_recibio"));
  await fireEvent.press(screen.getByTestId("guardar-no-aceptar"));

  expect(await screen.findByText("Asistencia")).toBeOnTheScreen();
  const respuesta = (await cola(base)).find((e) => e.tipo === "respuesta_propuesta");
  expect(respuesta?.datos).toMatchObject({ respuesta: "no_acepta", motivo: "si_se_recibio" });
});
