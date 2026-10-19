import { describe, expect, test } from "vitest";

import { cuentaRegresiva } from "./api";

describe("cuenta regresiva del código", () => {
  const vence = "2026-10-19T12:15:00Z";
  test.each([
    ["2026-10-19T12:00:00Z", "15:00"],
    ["2026-10-19T12:14:01Z", "0:59"],
    ["2026-10-19T12:20:00Z", "0:00"],
  ])("a las %s quedan %s", (ahora, texto) => {
    expect(cuentaRegresiva(vence, Date.parse(ahora))).toBe(texto);
  });
});
