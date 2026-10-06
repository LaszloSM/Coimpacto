import { describe, expect, it } from "vitest";
import casos from "@credimpacto/casos-reglas/casos/canonico-jcs.json";
import { canonico, hashCanonico, ValorNoCanonico, type ValorJson } from "./canonico";

describe("canonico (casos compartidos con el backend)", () => {
  it.each(casos.casos)("$nombre", async ({ entrada, esperado, sha256 }) => {
    expect(canonico(entrada as ValorJson)).toBe(esperado);
    expect(await hashCanonico(entrada as ValorJson)).toBe(sha256);
  });

  it.each(casos.rechazos)("rechaza: $nombre", ({ entrada }) => {
    expect(() => canonico(entrada as ValorJson)).toThrow(ValorNoCanonico);
  });

  it("no depende del orden de inserción", () => {
    expect(canonico({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(canonico({ a: [2, { c: 4, d: 3 }], b: 1 }));
  });
});
