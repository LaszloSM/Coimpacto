import { expect, test, type Page } from "@playwright/test";

// Panel de gerencia con la API simulada. DATOS SINTÉTICOS de prueba: nombres de comunidades del
// mockup y cifras inventadas solo para ver el panel lleno; nunca se muestran en producción.

const comunidad = (nombre: string, zona: string, estado: string, ahorro: number, mora: number, cumplimiento: number | null, dias: number | null) => ({
  id: nombre.toLowerCase(),
  nombre,
  zona,
  municipio: "",
  estado,
  ahorro,
  meta: Math.round(ahorro * 1.3),
  cartera: Math.round(ahorro * 0.4),
  mora,
  cumplimiento,
  reuniones: 6,
  dias_sin_datos: dias,
});

const TABLERO = {
  generado_en: "2026-10-25T15:00:00Z",
  datos_al: "2026-10-25T14:32:00Z",
  resumen: {
    ahorro: 97_480_000,
    ahorro_variacion: 6.4,
    cartera: 21_830_000,
    comunidades_activas: 17,
    comunidades: 18,
    miembros: 246,
    miembros_variacion: 2.1,
  },
  indicadores: { cumplimiento: 91.6, mora: 8.4, cartera_vencida: 1_834_000, capacitaciones: null, proyectos: null },
  pulso: [
    comunidad("Kayetamana", "Norte", "al_dia", 8_120_000, 0, 98, 1),
    comunidad("Izshimana", "Norte", "al_dia", 7_340_000, 0, 96, 2),
    comunidad("Masamana", "Centro", "atencion", 6_910_000, 3.2, 88, 3),
    comunidad("Yoduijoné", "Sur", "mora", 5_270_000, 14.8, 71, 4),
    comunidad("Jojoncito", "Sur", "al_dia", 4_880_000, 0, 94, 1),
    comunidad("Pulitchuyou", "Oriente", "al_dia", 4_610_000, 0, 97, 2),
    comunidad("Los Mandares", "Centro", "atencion", 3_990_000, 0, 92, 18),
    comunidad("Marisol", "Occidente", "sin_datos", 3_420_000, 0, null, 41),
    comunidad("Wayuu Kaí", "Norte", "al_dia", 2_960_000, 0, 95, 5),
    comunidad("Arroyo Arena", "Norte", "al_dia", 2_740_000, 0, 97, 3),
    comunidad("Cerro Azul", "Centro", "al_dia", 2_610_000, 0, 93, 6),
    comunidad("La Esperanza", "Centro", "al_dia", 2_480_000, 0, 91, 4),
    comunidad("Santa Rosa", "Sur", "atencion", 2_330_000, 4.1, 86, 7),
    comunidad("El Paraíso", "Sur", "al_dia", 2_190_000, 0, 92, 2),
    comunidad("Nueva Vida", "Oriente", "al_dia", 2_050_000, 0, 96, 1),
    comunidad("Palma Real", "Oriente", "al_dia", 1_920_000, 0, 94, 5),
    comunidad("Río Claro", "Occidente", "al_dia", 1_780_000, 0, 90, 8),
    comunidad("Brisas del Mar", "Sur", "al_dia", 1_640_000, 0, 89, 9),
  ],
  hallazgos: [
    { tono: "alerta", acap_id: "yoduijoné", texto: "Yoduijoné tiene 14,8 % de su cartera en mora. Conviene una visita de seguimiento." },
    { tono: "bien", acap_id: "kayetamana", texto: "Kayetamana lleva 6 reuniones con 98 % de cumplimiento en sus pagos." },
    { tono: "neutro", acap_id: "marisol", texto: "Sin datos recientes de Marisol. Revise si su celular sincronizó." },
  ],
  series: {
    mensual: [
      { mes: "2026-05", ahorro: 61_200_000, credito: 12_400_000 },
      { mes: "2026-06", ahorro: 68_900_000, credito: 14_100_000 },
      { mes: "2026-07", ahorro: 75_300_000, credito: 16_800_000 },
      { mes: "2026-08", ahorro: 83_100_000, credito: 18_200_000 },
      { mes: "2026-09", ahorro: 91_600_000, credito: 20_500_000 },
      { mes: "2026-10", ahorro: 97_480_000, credito: 21_830_000 },
    ],
    zonas: [
      { zona: "Centro", comunidades: 4, cumplimiento: 90, mora: 3.1 },
      { zona: "Norte", comunidades: 5, cumplimiento: 96, mora: 1.2 },
      { zona: "Occidente", comunidades: 2, cumplimiento: 89, mora: 5.6 },
      { zona: "Oriente", comunidades: 3, cumplimiento: 95, mora: 2.4 },
      { zona: "Sur", comunidades: 4, cumplimiento: 82, mora: 9.8 },
    ],
    top: [
      { nombre: "Kayetamana", ahorro: 8_120_000, meta: 9_000_000 },
      { nombre: "Izshimana", ahorro: 7_340_000, meta: 8_000_000 },
      { nombre: "Masamana", ahorro: 6_910_000, meta: 7_500_000 },
      { nombre: "Yoduijoné", ahorro: 5_270_000, meta: 7_000_000 },
      { nombre: "Jojoncito", ahorro: 4_880_000, meta: 5_000_000 },
    ],
    nuevos: [
      { mes: "2026-05", miembros: 9, creditos: 6 },
      { mes: "2026-06", miembros: 12, creditos: 8 },
      { mes: "2026-07", miembros: 7, creditos: 11 },
      { mes: "2026-08", miembros: 14, creditos: 9 },
      { mes: "2026-09", miembros: 10, creditos: 13 },
      { mes: "2026-10", miembros: 8, creditos: 7 },
    ],
  },
};

async function simular(page: Page, tablero: unknown = TABLERO) {
  await page.route("**/api/sesion", (r) => r.fulfill({ json: { usuario: "andrea.mayorga", puede_enrolar: true } }));
  await page.route("**/api/oficina/pendientes", (r) => r.fulfill({ json: [{}, {}, {}] }));
  await page.route("**/api/oficina/tablero", (r) => r.fulfill({ json: tablero }));
}

test("panel: cifras, pulso con filtro por estado y hallazgos", async ({ page }, info) => {
  await simular(page);
  await page.goto("/fundacion");
  await expect(page.getByRole("heading", { name: "Panel de gerencia" })).toBeVisible();
  await expect(page.getByText("$ 97,5 M")).toBeVisible();
  await expect(page.getByText("17 de 18")).toBeVisible();
  await expect(page.getByRole("link", { name: /Yoduijoné.*En mora/ })).toBeVisible();
  if (process.env.CAPTURAR) {
    const celular = info.project.name === "celular";
    await page.setViewportSize(celular ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `../.impeccable/review/${celular ? "mobile" : "desktop"}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: /En mora/ }).click();
  await expect(page.getByRole("link", { name: /Kayetamana/ }).first()).toBeHidden();
  if (process.env.CAPTURAR && info.project.name === "escritorio") {
    // El momento de movimiento: filtro activo y un cuadro a mitad del reacomodo.
    await page.screenshot({ path: "../.impeccable/review/desktop-filtro.png", fullPage: true });
    await page.getByRole("button", { name: /En mora/ }).click();
    await page.getByRole("button", { name: /Atención/ }).click();
    await page.waitForTimeout(90);
    await page.screenshot({ path: "../.impeccable/review/desktop-filtro-medio.png" });
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Atención/ }).click();
  }
  await expect(page.getByText("Conviene una visita de seguimiento.", { exact: false })).toBeVisible();
});

test("panel sin comunidades: dice cómo empezar", async ({ page }) => {
  await simular(page, { ...TABLERO, resumen: { ...TABLERO.resumen, comunidades: 0 }, pulso: [] });
  await page.goto("/fundacion");
  await expect(page.getByRole("heading", { name: "Todavía no hay comunidades" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Crear la primera ACAP" })).toBeVisible();
});

test("panel: error con reintento", async ({ page }) => {
  await page.route("**/api/sesion", (r) => r.fulfill({ json: { usuario: "a", puede_enrolar: true } }));
  await page.route("**/api/oficina/pendientes", (r) => r.fulfill({ json: [] }));
  let llamadas = 0;
  await page.route("**/api/oficina/tablero", (r) => (++llamadas === 1 ? r.fulfill({ status: 500, json: {} }) : r.fulfill({ json: TABLERO })));
  await page.goto("/fundacion");
  await page.getByRole("button", { name: "Intentar de nuevo" }).click();
  await expect(page.getByRole("heading", { name: "Panel de gerencia" })).toBeVisible();
  await expect(page.getByText("$ 97,5 M")).toBeVisible();
});

// Densidad real: 27 comunidades (las que hoy tiene la Fundación). Solo captura, para revisar el
// pulso a escala de producción.
test("panel con 27 comunidades", async ({ page }, info) => {
  test.skip(!process.env.CAPTURAR || info.project.name !== "escritorio", "solo captura");
  const extra = Array.from({ length: 9 }, (_, i) =>
    comunidad(`Comunidad ${["Alfa", "Beta", "Gamma", "Delta", "Épsilon", "Zeta", "Eta", "Theta", "Iota"][i]}`, "Centro", i < 2 ? "atencion" : "al_dia", 1_500_000 - i * 40_000, i < 2 ? 2.5 : 0, 92, 4),
  );
  await simular(page, { ...TABLERO, resumen: { ...TABLERO.resumen, comunidades: 27, comunidades_activas: 26 }, pulso: [...TABLERO.pulso, ...extra] });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/fundacion");
  await expect(page.getByRole("heading", { name: "Panel de gerencia" })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "../.impeccable/review/desktop-27.png", fullPage: true });
});
