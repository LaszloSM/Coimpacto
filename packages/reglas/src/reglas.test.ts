import { describe, expect, it } from "vitest";
import abono from "@credimpacto/casos-reglas/casos/abono.json";
import cierre from "@credimpacto/casos-reglas/casos/cierre-ciclo.json";
import prestamo from "@credimpacto/casos-reglas/casos/prestamo.json";
import registro from "@credimpacto/casos-reglas/casos/registro-ahorro.json";
import { pisoCociente, ReglaInvalida } from "./aritmetica";
import { previewCierre, type EntradaCierre } from "./cierre";
import { calcularPrestamo, dividirAbono } from "./prestamo";
import { montosRegistro } from "./registro";

// Mismos casos que backend/libro/tests/test_reglas.py: si difieren, el celular y el servidor
// calcularían distinto.

describe("registro de ahorro", () => {
  it.each(registro.casos)("$nombre", ({ entrada, esperado }) => {
    expect(montosRegistro(entrada)).toEqual(esperado);
  });
  it.each(registro.rechazos)("rechaza: $nombre", ({ entrada }) => {
    expect(() => montosRegistro(entrada)).toThrow(ReglaInvalida);
  });
});

describe("préstamo", () => {
  it.each(prestamo.casos)("$nombre", ({ capital, tasa, num_cuotas, esperado }) => {
    expect(calcularPrestamo(capital, tasa, num_cuotas)).toEqual(esperado);
  });
  it.each(prestamo.rechazos)("rechaza: $nombre", ({ capital, tasa, num_cuotas }) => {
    expect(() => calcularPrestamo(capital, tasa as string, num_cuotas)).toThrow(ReglaInvalida);
  });
});

describe("abono", () => {
  it.each(abono.casos)("$nombre", ({ monto, saldo, prestamo: p, esperado }) => {
    expect(dividirAbono(monto, { saldo, ...p })).toEqual(esperado);
  });
  it.each(abono.rechazos)("rechaza: $nombre", ({ monto, saldo, prestamo: p }) => {
    expect(() => dividirAbono(monto, { saldo, ...p })).toThrow(ReglaInvalida);
  });
});

describe("cierre de ciclo", () => {
  it.each(cierre.casos)("$nombre", ({ entrada, esperado }) => {
    expect(previewCierre(entrada as EntradaCierre)).toEqual(esperado);
  });
  it.each(cierre.rechazos)("rechaza: $nombre", ({ entrada, codigo }) => {
    expect(() => previewCierre(entrada as EntradaCierre)).toThrow(expect.objectContaining({ codigo }));
  });
});

describe("pisoCociente", () => {
  it.each([
    [7n, 2n, 3n],
    [-7n, 2n, -4n],
    [-6n, 2n, -3n],
    [0n, 5n, 0n],
  ])("piso(%s / %s) = %s", (a, b, esperado) => {
    expect(pisoCociente(a, b)).toBe(esperado);
  });
});
