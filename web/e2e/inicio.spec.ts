import { expect, test } from "@playwright/test";

test("la portada muestra las dos superficies", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Nuestro dinero, bien contado" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir la reunión" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar a la oficina" })).toBeVisible();
});

test("la reunión sigue en pantalla cuando se pierde la señal", async ({ page, context }) => {
  await page.goto("/reunion");
  await expect(page.getByRole("heading", { name: "Reunión de la ACAP" })).toBeVisible();

  // El modo offline completo (service worker, cola y sincronización) llega en S5/DT2;
  // esta prueba fija la base: la superficie es de cliente y no depende de la red ya cargada.
  await context.setOffline(true);
  await expect(page.getByRole("heading", { name: "Reunión de la ACAP" })).toBeVisible();
  await context.setOffline(false);
});
