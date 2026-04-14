# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: agora-sync.spec.ts >> Ágora Sync — 4. Integridad completa de la tubería >> el dashboard de logística carga sin error 500 con el componente Ágora activo
- Location: tests/agora-sync.spec.ts:374:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/logistica", waiting until "load"

```

# Test source

```ts
  275 | 
  276 |     // Si aparece el diálogo de error (esperado sin AGORA_API_URL)
  277 |     const dialog = page.locator("[role='dialog']").first();
  278 |     const dialogVisible = await dialog.isVisible().catch(() => false);
  279 | 
  280 |     if (dialogVisible) {
  281 |       // Verificar las 3 opciones del protocolo de seguridad
  282 |       await expect(page.getByRole("button", { name: /reintentar/i })).toBeVisible();
  283 |       await expect(page.getByRole("button", { name: /backup/i })).toBeVisible();
  284 |       await expect(page.getByRole("button", { name: /ignorar/i })).toBeVisible();
  285 |     }
  286 |   });
  287 | 
  288 |   test("opción 'Ignorar' cierra el diálogo y muestra toast informativo", async ({ page }) => {
  289 |     await irALogistica(page);
  290 |     const btn = page.getByRole("button", { name: /sincronizar/i });
  291 |     await expect(btn).toBeVisible({ timeout: 8_000 });
  292 |     await btn.click();
  293 |     await expect(page.getByText(/sincronizando/i)).not.toBeVisible({ timeout: 15_000 });
  294 | 
  295 |     const dialog = page.locator("[role='dialog']").first();
  296 |     const dialogVisible = await dialog.isVisible().catch(() => false);
  297 | 
  298 |     if (dialogVisible) {
  299 |       const btnIgnorar = page.getByRole("button", { name: /ignorar/i });
  300 |       await btnIgnorar.click();
  301 | 
  302 |       // El diálogo debe cerrarse
  303 |       await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  304 | 
  305 |       // Debe aparecer un toast informativo
  306 |       const toast = page.locator("[data-sonner-toast]").first();
  307 |       await expect(toast).toBeVisible({ timeout: 3_000 });
  308 |     }
  309 |   });
  310 | 
  311 |   test("opción 'Backup' cierra el diálogo y confirma que el log fue guardado", async ({ page }) => {
  312 |     await irALogistica(page);
  313 |     const btn = page.getByRole("button", { name: /sincronizar/i });
  314 |     await expect(btn).toBeVisible({ timeout: 8_000 });
  315 |     await btn.click();
  316 |     await expect(page.getByText(/sincronizando/i)).not.toBeVisible({ timeout: 15_000 });
  317 | 
  318 |     const dialog = page.locator("[role='dialog']").first();
  319 |     const dialogVisible = await dialog.isVisible().catch(() => false);
  320 | 
  321 |     if (dialogVisible) {
  322 |       const btnBackup = page.getByRole("button", { name: /backup/i });
  323 |       await btnBackup.click();
  324 | 
  325 |       // El diálogo debe cerrarse
  326 |       await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  327 | 
  328 |       // Toast de confirmación de backup
  329 |       const toast = page.locator("[data-sonner-toast]").first();
  330 |       await expect(toast).toBeVisible({ timeout: 3_000 });
  331 |     }
  332 |   });
  333 | 
  334 | });
  335 | 
  336 | // ─── SUITE 4: INTEGRIDAD DE LA TUBERÍA ───────────────────────────────────────
  337 | 
  338 | test.describe("Ágora Sync — 4. Integridad completa de la tubería", () => {
  339 | 
  340 |   test("múltiples triggers acumulan registros en agora_sync_log (no sobreescriben)", async ({ page }) => {
  341 |     const supabase = getSupabaseAdmin();
  342 | 
  343 |     // Contar registros actuales
  344 |     const { count: antesCount } = await supabase
  345 |       .from("agora_sync_log")
  346 |       .select("*", { count: "exact", head: true });
  347 | 
  348 |     await irALogistica(page);
  349 | 
  350 |     // Trigger 1
  351 |     const btn = page.getByRole("button", { name: /sincronizar/i });
  352 |     await expect(btn).toBeVisible({ timeout: 8_000 });
  353 |     await btn.click();
  354 |     await expect(page.getByText(/sincronizando/i)).not.toBeVisible({ timeout: 15_000 });
  355 | 
  356 |     // Cerrar diálogo si aparece
  357 |     const dialog = page.locator("[role='dialog']").first();
  358 |     if (await dialog.isVisible().catch(() => false)) {
  359 |       await page.getByRole("button", { name: /ignorar/i }).click();
  360 |       await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  361 |     }
  362 | 
  363 |     // Contar registros después
  364 |     const { count: despuesCount } = await supabase
  365 |       .from("agora_sync_log")
  366 |       .select("*", { count: "exact", head: true });
  367 | 
  368 |     expect(
  369 |       (despuesCount ?? 0),
  370 |       "Cada trigger debe insertar un nuevo registro, no sobrescribir"
  371 |     ).toBeGreaterThan(antesCount ?? 0);
  372 |   });
  373 | 
  374 |   test("el dashboard de logística carga sin error 500 con el componente Ágora activo", async ({ page }) => {
> 375 |     const response = await page.goto("/logistica");
      |                                 ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  376 |     expect(response?.status(), "La página no debe devolver 500").not.toBe(500);
  377 |     await expect(page).not.toHaveTitle(/error/i);
  378 | 
  379 |     // El componente AgoraSyncStatus debe estar presente
  380 |     const syncCard = page.getByText(/sincronización ágora/i);
  381 |     await expect(syncCard).toBeVisible({ timeout: 8_000 });
  382 |   });
  383 | 
  384 | });
  385 | 
```