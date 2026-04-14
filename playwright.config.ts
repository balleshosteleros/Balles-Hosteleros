import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración de Playwright para Balles-Hosteleros.
 *
 * Prerrequisito: la app debe estar corriendo en local:
 *   npm run dev
 *
 * Ejecutar todos los tests:
 *   npx playwright test
 *
 * Ejecutar solo logística:
 *   npx playwright test tests/logistica.spec.ts
 *
 * Ver reporte:
 *   npx playwright show-report
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false, // secuencial para no interferir entre tests de BD
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    // Dev bypass: asume que NEXT_PUBLIC_DEV_BYPASS_AUTH=true en .env.local
    // Si la app requiere login real, ajustar con storageState
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Arrancar el dev server si no está corriendo (opcional)
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: true,
  //   timeout: 60_000,
  // },
});
