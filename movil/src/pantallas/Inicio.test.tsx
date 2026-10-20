import { fireEvent, render, screen } from "@testing-library/react-native";

import { Inicio } from "./Inicio";

const PERFILES = [
  { cargoId: "k1", tipo: "presidente", numero: 1 },
  { cargoId: "k2", tipo: "portador_caja", numero: 2 },
];

test("un celular sin registrar pide el código al facilitador", async () => {
  const alRegistrar = jest.fn();
  await render(<Inicio alRegistrar={alRegistrar} />);
  expect(screen.getByRole("header", { name: "Credimpacto" })).toBeOnTheScreen();
  expect(screen.getByText(/Pida el código al facilitador/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("registrar-celular"));
  expect(alRegistrar).toHaveBeenCalled();
});

test("con reunión abierta, el botón naranja es seguirla (N1); sin nombres completos", async () => {
  await render(<Inicio perfiles={PERFILES} elegido="k2" reunionAbierta="2026-10-04" />);
  expect(screen.getByText("Seguir la reunión del 2026-10-04")).toBeOnTheScreen();
  expect(screen.getByText("Enviar a la Fundación")).toBeOnTheScreen();
  expect(screen.getByText("#02")).toBeOnTheScreen();
});

test("sin elegir quién lleva la reunión, el botón dice qué falta", async () => {
  await render(<Inicio perfiles={PERFILES} />);
  expect(screen.getByText("Elija quién lleva la reunión")).toBeOnTheScreen();
});

test("si no pudo preparar el celular lo dice, nunca en blanco", async () => {
  await render(<Inicio error="SinCifrado: SQLCipher no está disponible" />);
  expect(screen.getByTestId("inicio-error")).toHaveTextContent(/No se pudo preparar este celular/);
});
