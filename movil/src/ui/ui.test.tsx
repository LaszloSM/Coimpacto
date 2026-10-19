import { fireEvent, render, screen } from "@testing-library/react-native";

import { BotonPrincipal, Contador, Dinero, Franja, mostrarSegmentos } from "./componentes";
import { TecladoPin } from "./TecladoPin";

describe("componentes de la reunión", () => {
  test("el botón principal dice lo que falta en vez de quedar mudo", async () => {
    const alTocar = jest.fn();
    await render(<BotonPrincipal texto="Abrir la reunión" falta="Falta la lista del grupo" alTocar={alTocar} />);
    await fireEvent.press(screen.getByRole("button"));
    expect(alTocar).not.toHaveBeenCalled();
    expect(screen.getByText("Falta la lista del grupo")).toBeOnTheScreen();
  });

  test("la cifra lleva su valor en letras", async () => {
    await render(<Dinero pesos={24_000} etiqueta="Total de hoy" grande />);
    expect(screen.getByText("$ 24.000")).toBeOnTheScreen();
    expect(screen.getByText("veinticuatro mil pesos")).toBeOnTheScreen();
  });

  test("el contador respeta el tope", async () => {
    const alCambiar = jest.fn();
    await render(<Contador etiqueta="Acciones" valor={5} maximo={5} alCambiar={alCambiar} testID="acciones" />);
    await fireEvent.press(screen.getByTestId("acciones-mas"));
    expect(alCambiar).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("acciones-menos"));
    expect(alCambiar).toHaveBeenCalledWith(4);
  });

  test("la franja dice lo que está guardado y en qué paso va", async () => {
    await render(<Franja porSubir={3} paso={4} />);
    expect(screen.getByText("Guardado en este celular · 3 por subir")).toBeOnTheScreen();
    expect(screen.getByText("Paso 4 de 9")).toBeOnTheScreen();
  });
});

describe("teclado de PIN", () => {
  test("entrega el PIN al sexto número y no lo muestra", async () => {
    const alCompletar = jest.fn();
    await render(<TecladoPin paraQuien="Portador de Caja" alCompletar={alCompletar} />);
    for (const d of "4829") await fireEvent.press(screen.getByTestId(`tecla-${d}`));
    await fireEvent.press(screen.getByTestId("tecla-borrar"));
    for (const d of "916") await fireEvent.press(screen.getByTestId(`tecla-${d}`));
    expect(alCompletar).toHaveBeenCalledWith("482916");
    expect(screen.queryByText(/4829/)).toBeNull();
  });

  test("mientras verifica no acepta teclas", async () => {
    const alCompletar = jest.fn();
    await render(<TecladoPin paraQuien="Presidente" verificando alCompletar={alCompletar} />);
    expect(screen.getByText("Verificando…")).toBeOnTheScreen();
    for (const d of "482916") await fireEvent.press(screen.getByTestId(`tecla-${d}`));
    expect(alCompletar).not.toHaveBeenCalled();
  });
});

describe("escala de letra (N10)", () => {
  test.each([
    [411, 1, true],
    [411, 1.3, true],
    [411, 2, false], // letra al 200 %: solo el texto "Paso 4 de 9"
    [320, 1, false], // celular de 320 dp
  ])("ancho %i dp y letra %f× → segmentos %s", async (ancho, escala, esperado) => {
    expect(mostrarSegmentos(ancho, escala)).toBe(esperado);
  });

  test("TalkBack lee la franja completa", async () => {
    await render(<Franja porSubir={2} paso={4} />);
    expect(screen.getByLabelText("Guardado en este celular · 2 por subir. Paso 4 de 9.")).toBeOnTheScreen();
  });
});
