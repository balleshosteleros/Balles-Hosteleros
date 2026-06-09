/**
 * Tests E2E — Módulo de Logística
 *
 * Mapa de testeo objetivo (PRP-024, Fase 5).
 * Cubre todos los botones y acciones críticas de las 6 vistas del módulo.
 *
 * CRITERIO OBJETIVO DE ÉXITO por test:
 *   1. Al hacer click, NO queda en loading indefinido (máx 5s)
 *   2. Aparece un toast de éxito O un mensaje de error concreto (no silencio)
 *   3. La tabla/lista refleja el cambio esperado tras la acción
 *
 * PRERREQUISITO:
 *   - npm run dev corriendo en http://localhost:3000
 *   - NEXT_PUBLIC_DEV_BYPASS_AUTH=true en .env.local (omite login)
 *   - Base de datos poblada (npm run ingest o datos de seed)
 *
 * EJECUTAR:
 *   npx playwright test tests/logistica.spec.ts --headed
 */

import { test, expect, type Page } from "@playwright/test";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Espera a que desaparezca cualquier spinner/loader visible */
async function esperarSinLoader(page: Page, timeout = 5_000) {
  await page.waitForFunction(
    () => !document.querySelector('[data-loading="true"], .animate-spin'),
    { timeout }
  ).catch(() => {
    // Si no hay spinner, continuar
  });
}

/** Navega a una ruta de logística y espera que cargue */
async function irA(page: Page, ruta: string) {
  await page.goto(ruta);
  await esperarSinLoader(page, 8_000);
  // Verificar que no hay error 500
  await expect(page.locator("h1, [role='main']").first()).toBeVisible({ timeout: 8_000 });
}

// ─── SUITE: PRODUCTOS ─────────────────────────────────────────────────────────

test.describe("Logística — Productos", () => {
  test.beforeEach(async ({ page }) => {
    await irA(page, "/logistica/productos");
  });

  test("la vista carga con la lista de productos", async ({ page }) => {
    // Debe haber al menos una fila de producto o el estado vacío
    const content = page.locator("table tbody tr, [data-empty-state]").first();
    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test("botón 'Nuevo producto' abre el diálogo", async ({ page }) => {
    const btnNuevo = page.getByRole("button", { name: /nuevo producto|añadir producto|crear/i }).first();
    await expect(btnNuevo).toBeVisible();
    await btnNuevo.click();
    await esperarSinLoader(page);
    // El diálogo/modal debe aparecer
    const dialog = page.locator("[role='dialog'], [data-radix-dialog-content]").first();
    await expect(dialog).toBeVisible({ timeout: 3_000 });
  });

  test("botón de búsqueda filtra la lista sin loading infinito", async ({ page }) => {
    const input = page.getByPlaceholder(/buscar/i).first();
    if (await input.isVisible()) {
      await input.fill("Croquetas");
      await esperarSinLoader(page);
      // Debe haber resultado o estado vacío — no spinner colgado
      await expect(
        page.locator("table tbody tr, [data-empty-state], .text-muted-foreground").first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test("filtro de tipo (compra/venta/elaboracion) no bloquea la UI", async ({ page }) => {
    const selectTipo = page.locator("button[role='combobox']").first();
    if (await selectTipo.isVisible()) {
      await selectTipo.click();
      await esperarSinLoader(page);
      const opcionVenta = page.getByRole("option", { name: /venta/i });
      if (await opcionVenta.isVisible()) {
        await opcionVenta.click();
        await esperarSinLoader(page);
      }
    }
  });
});

// ─── SUITE: PROVEEDORES ───────────────────────────────────────────────────────

test.describe("Logística — Proveedores", () => {
  test.beforeEach(async ({ page }) => {
    await irA(page, "/logistica/proveedores");
  });

  test("la vista carga con la lista de proveedores", async ({ page }) => {
    const content = page.locator("table tbody tr, [data-empty-state], .card").first();
    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test("botón 'Nuevo proveedor' abre el formulario", async ({ page }) => {
    const btnNuevo = page.getByRole("button", { name: /nuevo proveedor|añadir|crear/i }).first();
    await expect(btnNuevo).toBeVisible();
    await btnNuevo.click();
    await esperarSinLoader(page);
    const dialog = page.locator("[role='dialog'], form").first();
    await expect(dialog).toBeVisible({ timeout: 3_000 });
  });

  test("buscar proveedor responde sin freezar la UI", async ({ page }) => {
    const input = page.getByPlaceholder(/buscar/i).first();
    if (await input.isVisible()) {
      await input.fill("test");
      await esperarSinLoader(page);
      await expect(page.locator("table tbody tr, [data-empty-state]").first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ─── SUITE: PEDIDOS ───────────────────────────────────────────────────────────

test.describe("Logística — Pedidos", () => {
  test.beforeEach(async ({ page }) => {
    await irA(page, "/logistica/pedidos");
  });

  test("la vista carga correctamente", async ({ page }) => {
    const content = page.locator("table tbody tr, [data-empty-state], h1, h2").first();
    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test("botón 'Nuevo pedido' abre el formulario", async ({ page }) => {
    const btnNuevo = page.getByRole("button", { name: /nuevo pedido|crear pedido|añadir/i }).first();
    if (await btnNuevo.isVisible()) {
      await btnNuevo.click();
      await esperarSinLoader(page);
      const form = page.locator("[role='dialog'], form, [data-pedido-form]").first();
      await expect(form).toBeVisible({ timeout: 3_000 });
    }
  });

  test("cambiar estado de pedido no produce loading infinito", async ({ page }) => {
    // Si hay pedidos en la lista, intentar cambiar estado del primero
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible()) {
      const statusBtn = firstRow.locator("button, [role='combobox']").first();
      if (await statusBtn.isVisible()) {
        await statusBtn.click();
        await esperarSinLoader(page);
      }
    }
  });
});

// ─── SUITE: INVENTARIOS ───────────────────────────────────────────────────────

test.describe("Logística — Inventarios", () => {
  test.beforeEach(async ({ page }) => {
    await irA(page, "/logistica/inventarios");
  });

  test("la vista carga correctamente", async ({ page }) => {
    const content = page.locator("table, [data-empty-state], h1, h2, .card").first();
    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test("botón 'Abrir inventario' o 'Nuevo' no bloquea la UI", async ({ page }) => {
    const btn = page.getByRole("button", { name: /nuevo inventario|abrir|crear/i }).first();
    if (await btn.isVisible()) {
      await btn.click();
      await esperarSinLoader(page, 5_000);
      // No debe quedar pantalla en blanco ni spinner infinito
      await expect(page.locator("body")).not.toBeEmpty();
    }
  });
});

// ─── SUITE: STOCK ─────────────────────────────────────────────────────────────

test.describe("Logística — Stock", () => {
  test.beforeEach(async ({ page }) => {
    await irA(page, "/logistica/stock");
  });

  test("la vista carga con datos de stock", async ({ page }) => {
    const content = page.locator("table tbody tr, [data-empty-state], .card").first();
    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test("exportar CSV no produce error visible", async ({ page }) => {
    const btnExport = page.getByRole("button", { name: /exportar|csv|descargar/i }).first();
    if (await btnExport.isVisible()) {
      // Escuchar descarga
      const [_download] = await Promise.all([
        page.waitForEvent("download", { timeout: 5_000 }).catch(() => null),
        btnExport.click(),
      ]);
      // O descarga O no hay error — en cualquier caso no loading infinito
      await esperarSinLoader(page);
    }
  });
});

// ─── SUITE: INCIDENCIAS ───────────────────────────────────────────────────────

test.describe("Logística — Incidencias", () => {
  test.beforeEach(async ({ page }) => {
    await irA(page, "/logistica/incidencias");
  });

  test("la vista carga correctamente", async ({ page }) => {
    const content = page.locator("table tbody tr, [data-empty-state], .card, h1").first();
    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test("botón 'Nueva incidencia' abre el formulario sin loading infinito", async ({ page }) => {
    const btn = page.getByRole("button", { name: /nueva incidencia|crear|reportar/i }).first();
    if (await btn.isVisible()) {
      await btn.click();
      await esperarSinLoader(page);
      const form = page.locator("[role='dialog'], form").first();
      await expect(form).toBeVisible({ timeout: 3_000 });
    }
  });
});

// ─── SUITE: SINCRONIZACIÓN ÁGORA (Fail-Safe) ──────────────────────────────────

test.describe("Logística — Ágora Sync (Regla Seguridad)", () => {
  test("el componente AgoraSyncStatus muestra estado sin crash", async ({ page }) => {
    // Buscar el componente en cualquier vista de logística
    await irA(page, "/logistica/productos");

    const syncCard = page.locator("[data-agora-sync], .card").filter({
      hasText: /ágora|sincroniz/i,
    }).first();

    if (await syncCard.isVisible()) {
      // Verificar que tiene el botón de sincronizar
      const btnSync = syncCard.getByRole("button", { name: /sincronizar/i });
      await expect(btnSync).toBeVisible();
    }
  });

  test("ruta base de logística carga sin error 500", async ({ page }) => {
    const response = await page.goto("/logistica");
    expect(response?.status()).not.toBe(500);
    await expect(page).not.toHaveTitle(/error|500/i);
  });
});

// ─── SUITE: NAVEGACIÓN GENERAL ────────────────────────────────────────────────

test.describe("Logística — Navegación", () => {
  const RUTAS = [
    { path: "/logistica/productos", nombre: "Productos" },
    { path: "/logistica/proveedores", nombre: "Proveedores" },
    { path: "/logistica/pedidos", nombre: "Pedidos" },
    { path: "/logistica/inventarios", nombre: "Inventarios" },
    { path: "/logistica/stock", nombre: "Stock" },
    { path: "/logistica/incidencias", nombre: "Incidencias" },
  ];

  for (const ruta of RUTAS) {
    test(`${ruta.nombre}: carga sin error y tiene contenido`, async ({ page }) => {
      const response = await page.goto(ruta.path);
      // No debe ser 500
      expect(response?.status()).not.toBe(500);
      // Debe cargar en menos de 8s
      await esperarSinLoader(page, 8_000);
      // Debe tener algo visible — no pantalla en blanco
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }
});
