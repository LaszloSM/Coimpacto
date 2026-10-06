import { defineConfig, devices } from "@playwright/test";

const PUERTO = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: "retain-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    // Local: PLAYWRIGHT_CANAL=msedge usa el Edge instalado sin descargar navegadores. CI usa Chromium.
    ...(process.env.PLAYWRIGHT_CANAL ? { channel: process.env.PLAYWRIGHT_CANAL } : {}),
  },
  projects: [
    // Celular Android de gama media-baja: es el dispositivo de la reunión.
    { name: "celular", use: { ...devices["Pixel 5"] } },
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run start -- --port ${PUERTO}`,
    port: PUERTO,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
