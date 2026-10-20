import { expect, test } from "@playwright/test";

// La oficina habla con Django por /api; aquí se simula la API para probar solo la web.

test("clave incorrecta: lo dice sin culpar a nadie", async ({ page }) => {
  await page.route("**/api/sesion/csrf", (r) => r.fulfill({ json: { csrf: "x" }, headers: { "set-cookie": "csrftoken=x; Path=/" } }));
  await page.route("**/api/sesion/entrar", (r) => r.fulfill({ status: 401, json: { mensaje: "Usuario o clave incorrectos." } }));
  await page.goto("/fundacion/entrar");
  await page.getByLabel("Usuario").fill("ana");
  await page.getByLabel("Clave").fill("equivocada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Usuario o clave incorrectos." })).toBeVisible();
});

test("registrar un celular: elegir la ACAP y mostrar el QR que vence a los 15 minutos", async ({ page }) => {
  await page.route("**/api/sesion/csrf", (r) => r.fulfill({ json: { csrf: "x" }, headers: { "set-cookie": "csrftoken=x; Path=/" } }));
  await page.route("**/api/acaps", (r) => r.fulfill({ json: [{ id: "a1", nombre: "ACAP Las Brisas" }] }));
  let cuerpo: unknown = null;
  await page.route("**/api/enrolamiento/codigos", async (r) => {
    cuerpo = r.request().postDataJSON();
    const vence = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await r.fulfill({ json: { codigo: "abc123", qr: "credimpacto:enrolar:abc123", vence_en: vence } });
  });

  await page.goto("/fundacion/celulares");
  await page.getByLabel("ACAP").selectOption("a1");
  await page.getByRole("button", { name: "Generar el código" }).click();

  await expect(page.getByRole("img", { name: "Registrar un celular" }).locator("svg")).toBeVisible();
  await expect(page.getByText(/^1[45]:\d\d$/)).toBeVisible();
  await expect(page.getByText("abc123")).toBeVisible();
  expect(cuerpo).toEqual({ acap_id: "a1" });
});

test("sin sesión, la página de celulares lleva a entrar", async ({ page }) => {
  await page.route("**/api/acaps", (r) => r.fulfill({ status: 401, json: { detail: "Unauthorized" } }));
  await page.goto("/fundacion/celulares");
  await expect(page).toHaveURL(/\/fundacion\/entrar$/);
});
