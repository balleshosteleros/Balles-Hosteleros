# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: agora-sync.spec.ts >> Ágora Sync — 2. Registro en agora_sync_log >> el registro tiene empresa_id correcto (no null)
- Location: tests/agora-sync.spec.ts:213:7

# Error details

```
TimeoutError: page.goto: Timeout 20000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/logistica", waiting until "domcontentloaded"

```

# Test source

```ts
  1   | /**
  2   |  * tests/agora-sync.spec.ts
  3   |  * ─────────────────────────────────────────────────────────────────────────────
  4   |  * Suite de pruebas E2E para la tubería completa de Ágora POS:
  5   |  *
  6   |  *   1. Trigger de sincronización  → botón en AgoraSyncStatus
  7   |  *   2. Registro en agora_sync_log → verificado directo contra Supabase
  8   |  *   3. Reflejo en la UI           → el componente muestra el nuevo estado
  9   |  *
  10  |  * PRERREQUISITOS:
  11  |  *   - npm run dev corriendo en http://localhost:3000
  12  |  *   - NEXT_PUBLIC_DEV_BYPASS_AUTH=true en .env.local
  13  |  *   - Migración 016_agora_sync_log aplicada en Supabase
  14  |  *   - SUPABASE_SERVICE_ROLE_KEY disponible en .env.local (para leer BD en tests)
  15  |  *
  16  |  * EJECUTAR:
  17  |  *   npx playwright install   ← solo la primera vez
  18  |  *   npx playwright test tests/agora-sync.spec.ts --headed
  19  |  *
  20  |  * NOTA SOBRE AGORA_API_URL:
  21  |  *   En tests, la variable NO estará configurada → el sync devuelve status="error"
  22  |  *   con mensaje "AGORA_API_URL no está configurada". Esto es el comportamiento
  23  |  *   CORRECTO y esperado: verificamos que la tubería completa funciona incluso
  24  |  *   en el escenario de fallo (que es el más crítico).
  25  |  */
  26  | 
  27  | import { test, expect, type Page } from "@playwright/test";
  28  | import { createClient } from "@supabase/supabase-js";
  29  | import * as fs from "fs";
  30  | import * as path from "path";
  31  | 
  32  | // ─── CLIENTE SUPABASE PARA VERIFICACIÓN EN TESTS ─────────────────────────────
  33  | 
  34  | function loadEnvLocal(): Record<string, string> {
  35  |   const envPath = path.resolve(process.cwd(), ".env.local");
  36  |   if (!fs.existsSync(envPath)) return {};
  37  |   const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  38  |   const env: Record<string, string> = {};
  39  |   for (const line of lines) {
  40  |     const match = line.match(/^([^#=]+)=(.*)$/);
  41  |     if (match) env[match[1].trim()] = match[2].trim();
  42  |   }
  43  |   return env;
  44  | }
  45  | 
  46  | function getSupabaseAdmin() {
  47  |   const env = loadEnvLocal();
  48  |   const url = env.NEXT_PUBLIC_SUPABASE_URL;
  49  |   const key = env.SUPABASE_SERVICE_ROLE_KEY;
  50  |   if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  51  |   return createClient(url, key);
  52  | }
  53  | 
  54  | // ─── HELPERS ──────────────────────────────────────────────────────────────────
  55  | 
  56  | async function irALogistica(page: Page) {
> 57  |   await page.goto("/logistica", { waitUntil: "domcontentloaded", timeout: 20_000 });
      |              ^ TimeoutError: page.goto: Timeout 20000ms exceeded.
  58  |   // Si hay redirect de auth, esperar a que se estabilice
  59  |   await page.waitForURL(/logistica/, { timeout: 15_000 }).catch(() => {});
  60  |   // Esperar a que haya contenido visible
  61  |   await page.waitForSelector("body", { timeout: 10_000 });
  62  |   // Dar tiempo a los server components para hidratarse
  63  |   await page.waitForTimeout(2_000);
  64  | }
  65  | 
  66  | async function obtenerUltimoSyncLog(empresaId?: string) {
  67  |   const supabase = getSupabaseAdmin();
  68  |   let query = supabase
  69  |     .from("agora_sync_log")
  70  |     .select("*")
  71  |     .order("sync_at", { ascending: false })
  72  |     .limit(1);
  73  |   if (empresaId) query = query.eq("empresa_id", empresaId);
  74  |   const { data, error } = await query.maybeSingle();
  75  |   if (error) throw new Error(`Error leyendo agora_sync_log: ${error.message}`);
  76  |   return data;
  77  | }
  78  | 
  79  | async function obtenerEmpresaId(): Promise<string | null> {
  80  |   const supabase = getSupabaseAdmin();
  81  |   const { data } = await supabase
  82  |     .from("empresas")
  83  |     .select("id")
  84  |     .order("created_at", { ascending: true })
  85  |     .limit(1)
  86  |     .maybeSingle();
  87  |   return data?.id ?? null;
  88  | }
  89  | 
  90  | // ─── SUITE 1: TRIGGER DE SINCRONIZACIÓN ──────────────────────────────────────
  91  | 
  92  | test.describe("Ágora Sync — 1. Trigger de sincronización", () => {
  93  | 
  94  |   test("el botón 'Sincronizar' está visible en el dashboard de logística", async ({ page }) => {
  95  |     await irALogistica(page);
  96  | 
  97  |     const btn = page.getByRole("button", { name: /sincronizar/i });
  98  |     await expect(btn).toBeVisible({ timeout: 8_000 });
  99  |     await expect(btn).toBeEnabled();
  100 |   });
  101 | 
  102 |   test("al pulsar el botón entra en estado loading (no se queda colgado)", async ({ page }) => {
  103 |     await irALogistica(page);
  104 | 
  105 |     const btn = page.getByRole("button", { name: /sincronizar/i });
  106 |     await expect(btn).toBeVisible({ timeout: 8_000 });
  107 | 
  108 |     await btn.click();
  109 | 
  110 |     // Debe aparecer estado de carga inmediatamente
  111 |     const loadingText = page.getByText(/sincronizando/i);
  112 |     await expect(loadingText).toBeVisible({ timeout: 3_000 });
  113 | 
  114 |     // Y debe salir del estado de carga en menos de 15s (timeout de red + proceso)
  115 |     await expect(loadingText).not.toBeVisible({ timeout: 15_000 });
  116 |   });
  117 | 
  118 |   test("tras el trigger, aparece una respuesta concreta (no silencio)", async ({ page }) => {
  119 |     await irALogistica(page);
  120 | 
  121 |     const btn = page.getByRole("button", { name: /sincronizar/i });
  122 |     await expect(btn).toBeVisible({ timeout: 8_000 });
  123 |     await btn.click();
  124 | 
  125 |     // Esperar a que termine el loading
  126 |     await expect(page.getByText(/sincronizando/i)).not.toBeVisible({ timeout: 15_000 });
  127 | 
  128 |     // Debe aparecer O un toast de éxito O el diálogo de error de seguridad
  129 |     // Nunca silencio absoluto
  130 |     const toastOk    = page.locator("[data-sonner-toast]").first();
  131 |     const dialogError = page.locator("[role='dialog']").first();
  132 | 
  133 |     const alguno = await Promise.race([
  134 |       toastOk.waitFor({ state: "visible", timeout: 5_000 }).then(() => "toast"),
  135 |       dialogError.waitFor({ state: "visible", timeout: 5_000 }).then(() => "dialog"),
  136 |     ]).catch(() => "ninguno");
  137 | 
  138 |     expect(alguno, "El trigger debe producir feedback visible (toast o diálogo)").not.toBe("ninguno");
  139 |   });
  140 | 
  141 | });
  142 | 
  143 | // ─── SUITE 2: REGISTRO EN agora_sync_log ─────────────────────────────────────
  144 | 
  145 | test.describe("Ágora Sync — 2. Registro en agora_sync_log", () => {
  146 | 
  147 |   test("el trigger crea un registro en agora_sync_log", async ({ page }) => {
  148 |     // Timestamp antes del trigger para filtrar solo los nuevos
  149 |     const antesISO = new Date().toISOString();
  150 | 
  151 |     await irALogistica(page);
  152 |     const btn = page.getByRole("button", { name: /sincronizar/i });
  153 |     await expect(btn).toBeVisible({ timeout: 8_000 });
  154 |     await btn.click();
  155 | 
  156 |     // Esperar a que finalice
  157 |     await expect(page.getByText(/sincronizando/i)).not.toBeVisible({ timeout: 15_000 });
```