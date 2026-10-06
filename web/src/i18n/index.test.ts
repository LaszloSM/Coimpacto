import { describe, expect, it } from "vitest";
import { t } from "./index";

describe("t", () => {
  it("devuelve el texto en español", () => {
    expect(t("inicio.titulo")).toBe("Nuestro dinero, bien contado");
  });
});
