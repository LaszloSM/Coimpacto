import { expect, test } from "@playwright/test";

// La oficina habla con Django por /api; aquí se simula la API para probar solo la web.

test("clave incorrecta: lo dice sin culpar a nadie", async ({ page }) => {
  await page.route("**/api/sesion/csrf", (r) => r.fulfill({ json: { csrf: "x" }, headers: { "set-cookie": "csrftoken=x; Path=/" } }));
  await page.route("**/api/sesion/entrar", (r) => r.fulfill({ status: 401, json: { mensaje: "Usuario o clave incorrectos." } }));
  await page.goto("/fundacion/entrar");
  await page.getByLabel("Usuario").fill("ana");
  await page.getByLabel("Clave", { exact: true }).fill("equivocada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Usuario o clave incorrectos." })).toBeVisible();
});

test("acceso a la app: sin QR, lleva a crear el usuario de la ACAP", async ({ page }) => {
  await page.goto("/fundacion/celulares");
  await expect(page.getByRole("heading", { name: "Acceso a la app", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Crear usuario" })).toHaveAttribute("href", "/admin/cuentas/usuario/add/");
  await expect(page.getByText(/código QR/i)).toHaveCount(0);
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
  await page.goto("/fundacion/pendientes");
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

test("personas: agregar con la foto de la autorización y registrar la revocación", async ({ page }) => {
  await page.route("**/api/sesion/csrf", (r) => r.fulfill({ json: { csrf: "x" }, headers: { "set-cookie": "csrftoken=x; Path=/" } }));
  await page.route("**/api/oficina/comunidades", (r) => r.fulfill({ json: [{ id: "a1", nombre: "ACAP Las Brisas", miembros: 1 }] }));
  const base = { activo: true, consentimiento_id: null, desde: null, fecha_ingreso: "2026-01-10", documento: null, telefono: null, genero: null, fecha_nacimiento: null, etnia: null, cabeza_hogar: null };
  type Fila = Record<string, unknown>;
  let lista: Fila[] = [{ ...base, id: "m5", numero: 5, nombre_corto: null, nombres: null, apellidos: null, consentimiento: "falta" }];
  let alta: string | null = null;
  await page.route("**/api/oficina/acaps/a1/miembros", async (r) => {
    if (r.request().method() === "POST") {
      alta = r.request().headers()["content-type"] ?? "";
      lista = [...lista, { ...base, id: "m6", numero: 6, nombre_corto: "Yuliana I.", nombres: "Yuliana Andrea", apellidos: "Ibarra", consentimiento: "vigente", genero: "femenino" }];
      return r.fulfill({ status: 201, json: lista[1] });
    }
    return r.fulfill({ json: lista });
  });
  await page.route("**/api/oficina/miembros/m6/revocar", (r) => {
    lista = [lista[0], { ...lista[1], nombre_corto: null, nombres: null, apellidos: null, consentimiento: "revocado" }];
    return r.fulfill({ json: { ok: true } });
  });

  await page.goto("/fundacion/miembros");
  await page.getByRole("tab", { name: /Todas/ }).click();
  await expect(page.getByText("Datos ocultos hasta registrar su autorización")).toBeVisible();

  await page.getByRole("button", { name: "Agregar persona" }).first().click();
  const ficha = page.getByRole("dialog", { name: "Agregar persona" });
  await ficha.getByLabel("Nombres").fill("Yuliana Andrea");
  await ficha.getByLabel("Apellidos").fill("Ibarra");
  await ficha.getByRole("radio", { name: "Mujer" }).click();
  await ficha.locator('input[type="file"]').setInputFiles({ name: "formato.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });
  await ficha.getByRole("button", { name: "Agregar persona" }).click();
  await expect(page.getByText("Yuliana Andrea Ibarra")).toBeVisible();
  expect(alta).toContain("multipart/form-data");

  await page.getByText("Yuliana Andrea Ibarra").click();
  await page.getByRole("button", { name: "Registrar que revocó la autorización" }).click();
  await page.getByLabel("Cómo lo pidió").fill("De palabra ante la facilitadora");
  await page.getByRole("button", { name: "Guardar la revocación" }).click();
  await expect(page.getByText("Yuliana Andrea Ibarra")).toHaveCount(0);
  await expect(page.getByText("Revocó", { exact: true })).toBeVisible();
});

test("por aclarar: proponer a la junta quitar un registro, con motivo en palabras sencillas", async ({ page }) => {
  await page.route("**/api/sesion/csrf", (r) => r.fulfill({ json: { csrf: "x" }, headers: { "set-cookie": "csrftoken=x; Path=/" } }));
  await page.route("**/api/acaps", (r) => r.fulfill({ json: [{ id: "a1", nombre: "ACAP Las Brisas" }] }));
  let propuesta: unknown = null;
  const registro = {
    movimiento_id: "m1",
    tipo: "fondo_social",
    monto: 2000,
    numero_miembro: 7,
    reunion: 3,
    fecha: "2026-09-27",
    estado: "en_conflicto",
    codigo: "FUERA_DEL_CIERRE",
    propuesta: null as null | Record<string, string>,
  };
  await page.route("**/api/oficina/acaps/a1/por-aclarar", (r) => r.fulfill({ json: [registro] }));
  await page.route("**/api/oficina/propuestas", (r) => {
    propuesta = r.request().postDataJSON();
    registro.propuesta = { id: "p1", accion: "anular", motivo: "Se anotó dos veces", estado: "pendiente", respuesta_motivo: "", respuesta_nota: "" };
    return r.fulfill({ status: 201, json: { id: "p1" } });
  });

  await page.goto("/fundacion/por-aclarar");
  // Con una sola ACAP queda elegida; el selector la muestra.
  await expect(page.getByLabel("ACAP")).toHaveText(/ACAP Las Brisas/);
  await expect(page.getByText("Fondo social · $ 2.000 · #07")).toBeVisible();
  await page.getByRole("button", { name: "Proponer a la junta" }).click();
  await page.getByRole("radio", { name: "Quitarlo del cuaderno" }).click();
  await page.getByLabel("Motivo").fill("Se anotó dos veces");
  await page.getByRole("button", { name: "Enviar a la junta" }).click();
  await expect(page.getByText("Espera a la junta")).toBeVisible();
  await expect(page.getByText("Propuesta: Quitarlo del cuaderno")).toBeVisible();
  expect(propuesta).toEqual({ movimiento_id: "m1", accion: "anular", motivo: "Se anotó dos veces" });
});
