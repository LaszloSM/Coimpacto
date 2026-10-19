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

test("subir una copia de seguridad: muestra cuántos registros entraron", async ({ page }) => {
  await page.route("**/api/sesion/csrf", (r) => r.fulfill({ json: { csrf: "x" }, headers: { "set-cookie": "csrftoken=x; Path=/" } }));
  await page.route("**/api/respaldos", (r) => r.fulfill({ json: { elementos: 3, resultado: { confirmado: 2, rechazado: 1 } } }));
  await page.goto("/fundacion/respaldos");
  await page.getByLabel("Archivo de la copia").setInputFiles({ name: "copia.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await page.getByRole("button", { name: "Subir la copia" }).click();
  await expect(page.getByText("Copia subida. Registros: 3.")).toBeVisible();
  await expect(page.getByText("Aceptados: 2")).toBeVisible();
  await expect(page.getByText("Rechazados: 1")).toBeVisible();
});

test("copia alterada: lo explica en palabras sencillas", async ({ page }) => {
  await page.route("**/api/sesion/csrf", (r) => r.fulfill({ json: { csrf: "x" }, headers: { "set-cookie": "csrftoken=x; Path=/" } }));
  await page.route("**/api/respaldos", (r) => r.fulfill({ status: 400, json: { codigo: "ARCHIVO_ALTERADO" } }));
  await page.goto("/fundacion/respaldos");
  await page.getByLabel("Archivo de la copia").setInputFiles({ name: "copia.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await page.getByRole("button", { name: "Subir la copia" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "El archivo está dañado" })).toBeVisible();
});

test("bandeja de pendientes: por gravedad, con el código para el equipo", async ({ page }) => {
  await page.route("**/api/oficina/pendientes", (r) =>
    r.fulfill({
      json: [
        { acap_id: "a1", acap: "ACAP Las Brisas", tipo: "rechazado", codigo: "MAXIMO_ACCIONES", cuantos: 2, desde: "2026-10-19T10:00:00Z" },
        { acap_id: "a2", acap: "ACAP Sin Señal", tipo: "sin_datos", codigo: "", cuantos: 21, desde: "2026-09-28T10:00:00Z" },
      ],
    }),
  );
  await page.goto("/fundacion");
  await expect(page.getByText("No se aceptó · 2 registros")).toBeVisible();
  await expect(page.getByText("MAXIMO_ACCIONES")).toBeVisible();
  await expect(page.getByText("Sin datos hace 21 días")).toBeVisible();
});

test("indicadores: cifras por ACAP con la fecha de sus datos y el total", async ({ page }) => {
  await page.route("**/api/oficina/consolidado", (r) =>
    r.fulfill({
      json: {
        generado_en: "2026-10-19T12:00:00Z",
        acaps: [
          { id: "a1", nombre: "ACAP Las Brisas", socios: 20, reuniones: 4, ahorro: 380000, prestamos_con_saldo: 2, saldo_prestamos: 216000, por_revisar: 1, datos_al: "2026-10-18T12:00:00Z", datos_viejos: false },
          { id: "a2", nombre: "ACAP Sin Señal", socios: 12, reuniones: 1, ahorro: 50000, prestamos_con_saldo: 0, saldo_prestamos: 0, por_revisar: 0, datos_al: null, datos_viejos: true },
        ],
        totales: { ahorro: 430000, prestamos_con_saldo: 2, saldo_prestamos: 216000, socios: 32, acaps_con_datos_viejos: 1 },
      },
    }),
  );
  await page.goto("/fundacion/indicadores");
  await expect(page.getByRole("rowheader", { name: /ACAP Las Brisas/ })).toBeVisible();
  await expect(page.getByText("$ 430.000")).toBeVisible();
  await expect(page.getByText("1 ACAP con datos de hace más de 14 días")).toBeVisible();
  await expect(page.getByText("Sin datos", { exact: true })).toBeVisible();
});

test("comprobante por enlace: cifras confirmadas del miembro, sin nombre", async ({ page }) => {
  await page.route("**/api/comprobantes/**", (r) =>
    r.fulfill({
      json: {
        acap: "ACAP Las Brisas",
        reunion: 4,
        fecha: "2026-10-04",
        numero_miembro: 7,
        acciones: 3,
        ahorro: 30000,
        fondo_social: 2000,
        multas: 2000,
        abonos: 25000,
        ahorro_ciclo: 120000,
        saldo_prestamos: 75000,
        vence_en: "2026-12-03",
        datos_al: "2026-10-05T10:00:00Z",
      },
    }),
  );
  await page.goto("/comprobante/abc:def");
  await expect(page.getByRole("heading", { name: "Miembro #07" })).toBeVisible();
  await expect(page.getByText("Ahorro (3 acciones)")).toBeVisible();
  await expect(page.getByText("$ 120.000")).toBeVisible();
  await expect(page.getByText("Confirmado por el libro de la ACAP")).toBeVisible();
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
});

test("comprobante vencido: lo dice y a quién pedir otro", async ({ page }) => {
  await page.route("**/api/comprobantes/**", (r) => r.fulfill({ status: 410, json: { codigo: "VENCIDO" } }));
  await page.goto("/comprobante/abc:def");
  await expect(page.getByRole("alert").filter({ hasText: "venció" })).toHaveText("Este comprobante venció. Pida uno nuevo a su junta.");
});
