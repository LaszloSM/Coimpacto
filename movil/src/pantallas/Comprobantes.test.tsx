import { fireEvent, render, screen } from "@testing-library/react-native";

import { FOTO_PRUEBA } from "../sesion/modoPrueba";
import { Comprobantes, enlaceComprobante } from "./Comprobantes";

const [uno, dos] = FOTO_PRUEBA.miembros;
const FOTO = {
  ...FOTO_PRUEBA,
  comprobantes: {
    reunion: 4,
    fecha: "2026-10-04",
    vence_en: "2026-12-03",
    enlaces: { [uno.titular_id]: "tok-1", [dos.titular_id]: "tok-2" },
  },
};

test("sin comprobantes lo dice y deja volver", async () => {
  const alSalir = jest.fn();
  await render(<Comprobantes foto={FOTO_PRUEBA} servidor="https://s" alSalir={alSalir} />);
  expect(screen.getByTestId("comprobantes-vacio")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("comprobantes-volver"));
  expect(alSalir).toHaveBeenCalled();
});

test("lista por número; el QR de cada miembro y el siguiente sin volver a la lista", async () => {
  await render(<Comprobantes foto={FOTO} servidor="https://s" alSalir={() => {}} />);
  expect(screen.getByText("Comprobantes de la reunión 4")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId(`comprobante-${uno.numero}`));
  expect(screen.getByTestId("comprobante-numero")).toHaveTextContent(`#0${uno.numero}`);
  expect(screen.getByLabelText(`Comprobante de #0${uno.numero}`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("comprobante-siguiente"));
  expect(screen.getByTestId("comprobante-numero")).toHaveTextContent(`#0${dos.numero}`);
  expect(screen.queryByTestId("comprobante-siguiente")).toBeNull();
  await fireEvent.press(screen.getByTestId("comprobante-lista"));
  expect(screen.getByText("Comprobantes de la reunión 4")).toBeOnTheScreen();
});

test("el enlace va a la web del mismo servidor", () => {
  expect(enlaceComprobante("https://credimpacto.org", "a:b")).toBe("https://credimpacto.org/comprobante/a:b");
});
