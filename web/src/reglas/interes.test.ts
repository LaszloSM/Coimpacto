import { describe, expect, it } from "vitest";
import aleatorios from "@credimpacto/casos-reglas/casos/interes-aleatorio.json";
import manuales from "@credimpacto/casos-reglas/casos/interes-sobre-saldo.json";
import { interesSobreSaldo, ReglaInvalida } from "./interes";

describe("interesSobreSaldo (casos compartidos con el backend)", () => {
  it.each([...manuales.casos, ...aleatorios.casos])("$nombre", ({ saldo, tasa, esperado }) => {
    expect(interesSobreSaldo(saldo, tasa)).toBe(esperado);
  });

  it.each(manuales.rechazos)("rechaza: $nombre", ({ saldo, tasa }) => {
    expect(() => interesSobreSaldo(saldo as number, tasa as string)).toThrow(ReglaInvalida);
  });
});
