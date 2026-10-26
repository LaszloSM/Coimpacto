import { expect, test } from "@playwright/test";

test("la portada lleva a la oficina de la Fundación", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Nuestro dinero, bien contado" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar a la oficina" })).toBeVisible();
  await expect(page.getByText("se lleva en la app Credimpacto para Android")).toBeVisible();
});

test("la ruta de la reunión ya no existe en la web", async ({ page }) => {
  const respuesta = await page.goto("/reunion");

  expect(respuesta?.status()).toBe(404);
});

test("las fuentes de DESIGN.md se cargan desde la app", async ({ page }) => {
  const pedidosDeFuentes: string[] = [];
  page.on("request", (pedido) => {
    if (pedido.resourceType() === "font") pedidosDeFuentes.push(new URL(pedido.url()).host);
  });

  await page.goto("/");
  const cargadas = await page.evaluate(async () => {
    await document.fonts.ready;
    // check() da verdadero también si la familia no existe: se pide que esté declarada y cargada.
    return ["Atkinson Hyperlegible Next", "Bricolage Grotesque"].map((familia) =>
      [...document.fonts].some((f) => f.family.replace(/"/g, "") === familia && f.status === "loaded"),
    );
  });

  expect(cargadas).toEqual([true, true]);
  // Ninguna fuente sale de Google ni de otro dominio: en campo no hay red.
  expect(pedidosDeFuentes.every((host) => host.startsWith("localhost"))).toBe(true);
});
