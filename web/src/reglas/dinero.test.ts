import { describe, expect, it } from "vitest";
import casos from "@credimpacto/casos-reglas/casos/formato-pesos.json";
import { formatearPesos } from "./dinero";

describe("formatearPesos (casos compartidos con el backend)", () => {
  it.each(casos.casos)("$nombre", ({ entrada, esperado }) => {
    expect(formatearPesos(entrada)).toBe(esperado);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])("rechaza %s", (valor) => {
    expect(() => formatearPesos(valor)).toThrow(TypeError);
  });
});
