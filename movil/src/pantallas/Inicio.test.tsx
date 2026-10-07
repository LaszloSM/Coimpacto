import { render, screen } from "@testing-library/react-native";

import { Inicio } from "./Inicio";

test("un celular sin registrar pide el código al facilitador", async () => {
  await render(<Inicio />);
  expect(screen.getByRole("header", { name: "Credimpacto" })).toBeOnTheScreen();
  expect(screen.getByText(/Pida el código al facilitador/)).toBeOnTheScreen();
});
