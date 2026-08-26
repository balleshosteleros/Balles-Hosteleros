/**
 * Tests E2E — NORMA: un puesto no se crea con datos incompletos.
 *
 * Un puesto a medias daba de alta empleados con datos incompletos: al contratar,
 * las condiciones del puesto se copian al empleado y de ahí viajan al contrato y
 * a la gestoría.
 *
 * PRERREQUISITO (si no, la app redirige a /login y los tests se saltan):
 *   - npm run dev corriendo en http://localhost:3000
 *   - Sesión iniciada: NEXT_PUBLIC_DEV_BYPASS_AUTH=true en .env.local, o bien
 *     un storageState con sesión real en playwright.config.ts
 *
 * EJECUTAR:
 *   npx playwright test tests/puestos-datos-completos.spec.ts
 */

import { test, expect } from "@playwright/test";

test.describe("Puestos · datos obligatorios", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/rrhh/puestos");
    await page.waitForLoadState("networkidle");
    // Sin sesión no se puede probar la pantalla: se avisa en vez de dar un
    // falso verde (un login vacío también "cumple" cualquier aserción).
    test.skip(
      page.url().includes("/login"),
      "Requiere sesión iniciada: activa NEXT_PUBLIC_DEV_BYPASS_AUTH o usa storageState.",
    );
  });

  test("no deja crear un puesto vacío y señala lo que falta", async ({ page }) => {
    // Abrir el formulario de puesto nuevo desde la barra de herramientas.
    await page.getByRole("button", { name: /^Nuevo/i }).first().click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("Nuevo puesto")).toBeVisible();

    // Guardar sin rellenar nada.
    await dialogo.getByRole("button", { name: /Crear puesto/i }).click();

    // Debe avisar y NO cerrar el diálogo.
    await expect(
      page.getByText(/Faltan datos del puesto/i).first(),
    ).toBeVisible();
    await expect(dialogo).toBeVisible();
  });

  test("con nombre y departamento solos tampoco se crea", async ({ page }) => {
    await page.getByRole("button", { name: /^Nuevo/i }).first().click();
    const dialogo = page.getByRole("dialog");

    await dialogo.locator("#ps-nombre").fill("PUESTO DE PRUEBA E2E");
    // Primer departamento real del desplegable.
    const depto = dialogo.locator("#ps-depto");
    const opciones = await depto.locator("option").all();
    if (opciones.length > 1) {
      const valor = await opciones[1].getAttribute("value");
      if (valor) await depto.selectOption(valor);
    }

    await dialogo.getByRole("button", { name: /Crear puesto/i }).click();

    // Sigue faltando el resto: salario, horas, convenio, validador…
    await expect(
      page.getByText(/Faltan datos del puesto/i).first(),
    ).toBeVisible();
    await expect(dialogo).toBeVisible();
  });

  test("los puestos existentes ya no aparecen a 0 €", async ({ page }) => {
    // La ficha de cada puesto pinta el salario bruto. Ninguno debe estar a cero:
    // un puesto a 0 € es un puesto sin dato, no un puesto gratis.
    await expect(page.locator("body")).not.toContainText("0 € bruto/mes");
  });
});
