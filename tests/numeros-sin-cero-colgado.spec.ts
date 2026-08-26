/**
 * Tests E2E — NORMA: ninguna casilla de números deja un cero colgado.
 *
 * Al borrar un campo numérico para escribir, la casilla debe quedarse VACÍA.
 * Antes el estado caía a 0, el input repintaba "0" y lo tecleado quedaba
 * detrás ("015"). Se arregló con `NumberInput` (src/shared/components).
 *
 * PRERREQUISITO (si no, la app redirige a /login y los tests se saltan):
 *   - App corriendo en http://localhost:3000
 *   - Sesión iniciada: NEXT_PUBLIC_DEV_BYPASS_AUTH=true en .env.local, o bien
 *     un storageState con sesión real en playwright.config.ts
 *
 * EJECUTAR:
 *   npx playwright test tests/numeros-sin-cero-colgado.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";

async function abrirPuestos(page: Page) {
  await page.goto("/rrhh/puestos");
  await page.waitForLoadState("networkidle");
  test.skip(
    page.url().includes("/login") || page.url().includes("auth=1"),
    "Requiere sesión iniciada: activa NEXT_PUBLIC_DEV_BYPASS_AUTH o usa storageState.",
  );
}

test.describe("Casillas de números · sin cero colgado", () => {
  test("al borrar el salario la casilla queda vacía, no en «0»", async ({ page }) => {
    await abrirPuestos(page);

    // Editar el primer puesto desde la tarjeta de la lista.
    await page.getByRole("button", { name: /Editar/i }).first().click();
    const dialogo = page.getByRole("dialog");
    const salario = dialogo.locator("#ps-bruto");
    await expect(salario).toBeVisible();

    // Vaciar el campo: debe quedarse vacío de verdad.
    await salario.click();
    await salario.fill("");
    await expect(salario).toHaveValue("");

    // Y al teclear no debe colarse un 0 delante.
    await salario.type("1500");
    await expect(salario).toHaveValue("1500");
  });

  test("los días libres no arrastran el cero al escribir", async ({ page }) => {
    await abrirPuestos(page);
    await page.getByRole("button", { name: /Editar/i }).first().click();
    const dialogo = page.getByRole("dialog");

    const dias = dialogo.locator("#ps-dias");
    await dias.click();
    await dias.fill("");
    await expect(dias).toHaveValue("");
    await dias.type("2");
    await expect(dias).toHaveValue("2");
  });

  test("la jornada solo ofrece Completa y Partida", async ({ page }) => {
    await abrirPuestos(page);
    await page.getByRole("button", { name: /Editar/i }).first().click();
    const dialogo = page.getByRole("dialog");

    const jornada = dialogo.locator("#ps-jornada");
    await expect(jornada).toBeVisible();
    const opciones = await jornada.locator("option").allTextContents();
    expect(opciones.map((o) => o.trim())).toEqual(["Completa", "Partida"]);
  });

  test("la ficha del puesto ya no lleva botón de editar dentro", async ({ page }) => {
    await abrirPuestos(page);

    // Entrar en la ficha (clic en la tarjeta, no en sus botones).
    await page.locator('[role="button"]').filter({ hasText: /bruto\/mes/i }).first().click();
    await page.waitForLoadState("networkidle");

    // El botón «Editar condiciones» se retiró: solo se edita desde la lista.
    await expect(page.getByRole("button", { name: /Editar condiciones/i })).toHaveCount(0);
  });
});
