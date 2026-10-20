import { describe, expect, test } from "vitest";

import { enLetras } from "./letras";

describe("monto en letras (es-CO)", () => {
  test.each([
    [0, "cero pesos"],
    [1, "un peso"],
    [2, "dos pesos"],
    [16, "dieciséis pesos"],
    [21, "veintiún pesos"],
    [22, "veintidós pesos"],
    [31, "treinta y un pesos"],
    [100, "cien pesos"],
    [101, "ciento un pesos"],
    [500, "quinientos pesos"],
    [1_000, "mil pesos"],
    [1_500, "mil quinientos pesos"],
    [2_000, "dos mil pesos"],
    [10_000, "diez mil pesos"],
    [21_000, "veintiún mil pesos"],
    [31_000, "treinta y un mil pesos"],
    [50_000, "cincuenta mil pesos"],
    [100_000, "cien mil pesos"],
    [101_000, "ciento un mil pesos"],
    [250_000, "doscientos cincuenta mil pesos"],
    [999_999, "novecientos noventa y nueve mil novecientos noventa y nueve pesos"],
    [1_000_000, "un millón de pesos"],
    [1_001_000, "un millón mil pesos"],
    [1_250_000, "un millón doscientos cincuenta mil pesos"],
    [2_000_000, "dos millones de pesos"],
    [21_000_000, "veintiún millones de pesos"],
    [31_000_000, "treinta y un millones de pesos"],
    [100_000_000, "cien millones de pesos"],
    [1_000_000_000, "mil millones de pesos"],
    [1_000_000_000_000, "un billón de pesos"],
    [-2_000, "menos dos mil pesos"],
  ])("%i → %s", (pesos, texto) => {
    expect(enLetras(pesos)).toBe(texto);
  });

  test("solo pesos enteros", () => {
    expect(() => enLetras(1.5)).toThrow(TypeError);
  });
});
