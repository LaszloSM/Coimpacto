import { expect, test, type Page } from "@playwright/test";

// Módulos del panel con la API simulada. DATOS SINTÉTICOS de prueba (nombres del mockup y
// cifras inventadas), solo para ver cada módulo lleno y probar sus formularios.

const MESES = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

const AHORRO = {
  resumen: { ahorro_ciclo: 48_300_000, fondo_social_ciclo: 6_100_000, multas_ciclo: 420_000, ahorro_historico: 182_000_000, por_miembro: 196_000, participacion: 82.4 },
  comunidades: [
    { id: "a1", nombre: "Kayetamana", zona: "Norte", ciclo: 3, reuniones: 8, miembros: 22, ahorro: 9_800_000, fondo_social: 1_100_000, multas: 60_000, por_miembro: 445_000, meta: 12_000_000, ultima_reunion: "2026-10-18", participacion: 91 },
    { id: "a2", nombre: "Shiliwai", zona: "Norte", ciclo: 2, reuniones: 1, miembros: 14, ahorro: 330_000, fondo_social: 55_000, multas: 0, por_miembro: 23_571, meta: null, ultima_reunion: "2026-08-30", participacion: 57.1 },
    { id: "a3", nombre: "Cerro Azul", zona: "Sur", ciclo: 1, reuniones: 6, miembros: 18, ahorro: 6_400_000, fondo_social: 900_000, multas: 120_000, por_miembro: 355_000, meta: 8_000_000, ultima_reunion: "2026-10-11", participacion: 77 },
  ],
  zonas: [
    { zona: "Norte", ahorro: 10_130_000, comunidades: 2, miembros: 36 },
    { zona: "Sur", ahorro: 6_400_000, comunidades: 1, miembros: 18 },
  ],
  mensual: MESES.map((mes, i) => ({ mes, ahorro: 2_000_000 + i * 350_000, fondo_social: 400_000 + i * 20_000, multas: i % 3 ? 30_000 : 0 })),
};

const prestamo = (id: string, acap: string, dias: number, saldo: number) => ({
  id,
  acap_id: "a1",
  acap,
  zona: "Norte",
  miembro: 7,
  fecha: "2026-07-12",
  capital: 500_000,
  tasa: 3,
  cuotas: 5,
  cuota: 115_000,
  total: 575_000,
  abonado: 575_000 - saldo,
  saldo,
  debidas: 3,
  atraso: dias ? 115_000 : 0,
  dias_atraso: dias,
  estado: dias ? "mora" : "al_dia",
});

const CREDITO = {
  resumen: { prestamos: 34, vigentes: 21, desembolsado: 15_600_000, intereses_pactados: 1_900_000, capital_promedio: 458_000, plazo_promedio: 4.6, tasa_promedio: 3 },
  comunidades: [{ id: "a1", nombre: "Kayetamana", prestamos: 12, capital: 6_000_000, intereses: 720_000, vigentes: 8 }],
  rangos: [
    { rango: "Hasta $200 mil", prestamos: 6 },
    { rango: "$200 mil a $500 mil", prestamos: 18 },
    { rango: "$500 mil a $1 M", prestamos: 8 },
    { rango: "Más de $1 M", prestamos: 2 },
  ],
  mensual: MESES.map((mes, i) => ({ mes, desembolsado: 800_000 + i * 90_000, abonado: 600_000 + i * 80_000, prestamos: 2 })),
  recientes: [prestamo("p1", "Kayetamana", 0, 345_000), prestamo("p2", "Cerro Azul", 42, 460_000)],
};

const CARTERA = {
  resumen: { activa: 8_900_000, vencida: 920_000, mora: 10.3, prestamos: 21, en_mora: 3, atraso_total: 345_000 },
  tramos: [
    { tramo: "al_dia", texto: "Al día", prestamos: 18, saldo: 7_980_000 },
    { tramo: "1_30", texto: "1 a 30 días", prestamos: 1, saldo: 300_000 },
    { tramo: "31_60", texto: "31 a 60 días", prestamos: 1, saldo: 460_000 },
    { tramo: "61_90", texto: "61 a 90 días", prestamos: 1, saldo: 160_000 },
    { tramo: "mas_90", texto: "Más de 90 días", prestamos: 0, saldo: 0 },
  ],
  comunidades: [{ id: "a3", nombre: "Cerro Azul", zona: "Sur", saldo: 2_100_000, vencida: 460_000, prestamos: 5, en_mora: 1, mora: 21.9 }],
  prestamos: [prestamo("p2", "Cerro Azul", 42, 460_000), prestamo("p1", "Kayetamana", 0, 345_000)],
};

const ANALISIS = {
  generado_en: "2026-10-25T15:00:00Z",
  lecturas: [
    { tono: "alerta", titulo: "Mora en Cerro Azul", acap_id: "a3", texto: "21,9 % de su cartera está en mora (1 de 5 préstamos)." },
    { tono: "alerta", titulo: "Participación en Shiliwai", acap_id: "a2", texto: "Solo 57 % de los miembros ahorró en la última reunión." },
    { tono: "bien", titulo: "Ritmo del ahorro", texto: "En 2026-10 se ahorraron $5.850.000 (+6,4 % frente a 2026-09)." },
  ],
  indicadores: { participacion: 82.4, por_miembro: 196_000, mora: 10.3, comunidades_sin_reunion: 1 },
};

const COMUNIDADES = [
  { id: "a1", nombre: "Kayetamana", zona: "Norte", departamento: "La Guajira", municipio: "Uribia", ciclo: { numero: 3, valor_accion: 10_000, reuniones: 8 }, miembros: 22, cargos: 5, acceso_app: true, celulares: 1 },
  { id: "a2", nombre: "Shiliwai", zona: "Norte", departamento: "La Guajira", municipio: "Riohacha", ciclo: { numero: 2, valor_accion: 30_000, reuniones: 1 }, miembros: 14, cargos: 5, acceso_app: false, celulares: 0 },
];

const FICHA = {
  id: "a2",
  reuniones: [
    { id: "r1", fecha: "2025-08-30", ciclo: 1, numero: 1, ahorro: 240_000, fondo_social: 30_000, multas: 3_000, ahorraron: 6 },
    { id: "r2", fecha: "2025-12-06", ciclo: 1, numero: 3, ahorro: 930_000, fondo_social: 70_000, multas: 6_000, ahorraron: 12 },
    { id: "r3", fecha: "2026-08-30", ciclo: 2, numero: 1, ahorro: 330_000, fondo_social: 55_000, multas: 0, ahorraron: 8 },
  ],
  nombre: "Shiliwai",
  zona: "Norte",
  departamento: "La Guajira",
  municipio: "Riohacha",
  ciclos: [
    { id: "c2", numero: 2, estado: "activo", fecha_inicio: "2026-07-17", duracion_meses: 12, valor_accion: 30_000, max_acciones_reunion: 5, valor_fondo_social: 5_000, valor_multa: 3_000, tasa_interes: 5, meta_ahorro: null, reuniones: 1 },
    { id: "c1", numero: 1, estado: "cerrado", fecha_inicio: "2025-07-17", duracion_meses: 12, valor_accion: 30_000, max_acciones_reunion: 5, valor_fondo_social: 5_000, valor_multa: 3_000, tasa_interes: 5, meta_ahorro: null, reuniones: 5 },
  ],
  ciclo_activo: "c2",
  cargos: [{ id: "k1", tipo: "presidente", texto: "Presidente", membresia_id: "m1", numero: 1, nombre: null }],
  tipos_cargo: [
    { tipo: "presidente", texto: "Presidente" },
    { tipo: "portador_caja", texto: "Portador de Caja" },
    { tipo: "registrador", texto: "Registrador" },
    { tipo: "contador_1", texto: "Contador 1" },
    { tipo: "contador_2", texto: "Contador 2" },
  ],
  miembros: [
    { id: "m1", numero: 1, activo: true, nombre_corto: null, consentimiento: "falta" },
    { id: "m2", numero: 2, activo: true, nombre_corto: "Persona D.", consentimiento: "vigente" },
  ],
  usuarios_app: [],
  celulares: [],
};

async function preparar(page: Page) {
  await page.route("**/api/sesion/csrf", (r) => r.fulfill({ json: { csrf: "x" }, headers: { "set-cookie": "csrftoken=x; Path=/" } }));
  await page.route("**/api/sesion", (r) => r.fulfill({ json: { usuario: "andrea.mayorga", puede_enrolar: true } }));
  await page.route("**/api/oficina/pendientes", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/oficina/ahorro", (r) => r.fulfill({ json: AHORRO }));
  await page.route("**/api/oficina/credito", (r) => r.fulfill({ json: CREDITO }));
  await page.route("**/api/oficina/cartera", (r) => r.fulfill({ json: CARTERA }));
  await page.route("**/api/oficina/analisis", (r) => r.fulfill({ json: ANALISIS }));
  await page.route("**/api/oficina/comunidades", (r) => r.fulfill({ json: COMUNIDADES }));
  await page.route("**/api/oficina/comunidades/a2", (r) => r.fulfill({ json: FICHA }));
}

async function capturar(page: Page, nombre: string, info: { project: { name: string } }) {
  if (process.env.CAPTURAR && info.project.name === "escritorio") {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `../.impeccable/review/modulo-${nombre}.png`, fullPage: true });
  }
}

test("ahorro: cifras, gráficos y tabla ordenable por comunidad", async ({ page }, info) => {
  await preparar(page);
  await page.goto("/fundacion/ahorro");
  await expect(page.getByRole("heading", { name: "Ahorro", level: 1 })).toBeVisible();
  await expect(page.getByText("$ 48,3 M")).toBeVisible();
  await expect(page.getByRole("cell", { name: /Kayetamana/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Descargar Excel/ })).toHaveAttribute("href", "/api/oficina/reportes/consolidado.xlsx");
  await capturar(page, "ahorro", info);
});

test("crédito y cartera: desembolsos, tramos de atraso y préstamos para seguimiento", async ({ page }, info) => {
  await preparar(page);
  await page.goto("/fundacion/credito");
  await expect(page.getByText("$ 15,6 M")).toBeVisible();
  await capturar(page, "credito", info);
  await page.goto("/fundacion/cartera");
  await expect(page.getByText("31 a 60 días")).toBeVisible();
  await expect(page.getByText("En mora").first()).toBeVisible();
  await capturar(page, "cartera", info);
});

test("análisis: lecturas con su comunidad", async ({ page }, info) => {
  await preparar(page);
  await page.goto("/fundacion/analisis");
  await expect(page.getByRole("heading", { name: "Mora en Cerro Azul" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver comunidad" }).first()).toHaveAttribute("href", "/fundacion/comunidades/a3");
  await capturar(page, "analisis", info);
});

test("comunidades: crear una ACAP lleva a su ficha", async ({ page }, info) => {
  await preparar(page);
  let cuerpo: unknown = null;
  await page.route("**/api/oficina/comunidades", async (r) => {
    if (r.request().method() === "POST") {
      cuerpo = r.request().postDataJSON();
      await r.fulfill({ json: { id: "a2" } });
    } else await r.fulfill({ json: COMUNIDADES });
  });
  await page.goto("/fundacion/comunidades");
  await expect(page.getByRole("cell", { name: /Shiliwai/ })).toBeVisible();
  await capturar(page, "comunidades", info);
  await page.getByRole("button", { name: "Nueva comunidad" }).click();
  await page.getByLabel("Nombre de la ACAP").fill("Shiliwai");
  await page.getByLabel("Zona").fill("Norte");
  await page.getByRole("button", { name: "Crear y seguir" }).click();
  await expect(page).toHaveURL(/\/fundacion\/comunidades\/a2$/);
  expect(cuerpo).toMatchObject({ nombre: "Shiliwai", zona: "Norte" });
});

test("ficha: asignar un cargo y crear el usuario de la app", async ({ page }, info) => {
  await preparar(page);
  const pedidos: { url: string; cuerpo: unknown }[] = [];
  await page.route(/\/api\/oficina\/(ciclos\/c2\/cargos|comunidades\/a2\/usuario-app)$/, async (r) => {
    pedidos.push({ url: r.request().url(), cuerpo: r.request().postDataJSON() });
    await r.fulfill({ json: { ok: true, usuario: "shiliwai" } });
  });
  await page.goto("/fundacion/comunidades/a2");
  await expect(page.getByRole("heading", { name: "Shiliwai", level: 1 })).toBeVisible();
  await expect(page.getByText("12 de 2 ahorraron")).toBeVisible();
  await capturar(page, "ficha-datos", info);
  await page.getByRole("tab", { name: "Junta" }).click();
  await page.getByLabel("Portador de Caja").selectOption("m2");
  await expect(page.getByText(/Junta actualizada/)).toBeVisible();
  await capturar(page, "ficha-junta", info);
  await page.getByRole("tab", { name: "Acceso a la app" }).click();
  await page.getByLabel("Clave").fill("una-clave-larga-1");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText(/Usuario creado/)).toBeVisible();
  expect(pedidos.map((p) => p.cuerpo)).toEqual([
    { tipo: "portador_caja", membresia_id: "m2" },
    { usuario: "shiliwai", clave: "una-clave-larga-1" },
  ]);
});

test("proyectos: registrar uno nuevo desde el panel lateral", async ({ page }, info) => {
  await preparar(page);
  const lista: unknown[] = [];
  await page.route("**/api/oficina/proyectos", async (r) => {
    if (r.request().method() === "POST") {
      const p = r.request().postDataJSON();
      lista.push({ ...p, id: "p1", acap: "Kayetamana", linea_texto: "Agrícola", estado_texto: "En ejecución" });
      await r.fulfill({ json: lista[0] });
    } else
      await r.fulfill({
        json: {
          proyectos: lista,
          estados: [{ valor: "idea", texto: "Idea" }, { valor: "ejecucion", texto: "En ejecución" }],
          lineas: [{ valor: "otra", texto: "Otra" }, { valor: "agricola", texto: "Agrícola" }],
        },
      });
  });
  await page.goto("/fundacion/proyectos");
  await expect(page.getByText(/Todavía no hay proyectos/)).toBeVisible();
  await page.getByRole("button", { name: "Nuevo proyecto" }).click();
  await page.getByLabel("Nombre del proyecto").fill("Huerta comunitaria");
  await page.getByLabel("Línea").selectOption("agricola");
  await page.getByLabel("Estado").selectOption("ejecucion");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { name: "Huerta comunitaria" })).toBeVisible();
  await capturar(page, "proyectos", info);
});
