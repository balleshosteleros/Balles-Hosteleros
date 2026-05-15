import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMAIL = "qa-test-bh@example.com";
const PASSWORD = "QaTest12345!";
const SHOTS = ".qa-reports/2026-05-15-tipos-ausencia/screenshots";
mkdirSync(SHOTS, { recursive: true });

const log = (...a) => console.log("[qa]", ...a);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

page.on("pageerror", (e) => log("pageerror:", e.message));

const results = { steps: [] };
const step = async (name, fn) => {
  log(">>>", name);
  try {
    await fn();
    results.steps.push({ name, ok: true });
  } catch (e) {
    log("!!! step failed:", name, e.message);
    await page.screenshot({ path: `${SHOTS}/ERR-${name.replace(/\W+/g, "_")}.png`, fullPage: true }).catch(() => {});
    results.steps.push({ name, ok: false, error: e.message });
    throw e;
  }
};

const login = async () => {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#email", { timeout: 15000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForNavigation({ timeout: 30000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2500);
  log("logged in, url:", page.url());
};

try {
  // ───── FASE 1: como director (para ver /rrhh/horarios) ─────
  await step("01-login", login);
  await page.screenshot({ path: `${SHOTS}/01-after-login.png`, fullPage: true });

  await step("02-goto-horarios", async () => {
    await page.goto(BASE + "/rrhh/horarios", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    log("horarios url:", page.url());
    await page.screenshot({ path: `${SHOTS}/02-horarios-landing.png`, fullPage: true });
  });

  await step("03-tab-ausencias", async () => {
    await page.getByText("Tipos de ausencia", { exact: false }).first().click({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/03-tipos-ausencia-tabla.png`, fullPage: true });
    const tablaText = await page.locator("table").first().innerText().catch(() => "");
    results.tablaText = tablaText.slice(0, 600);
    results.tablaTieneLimiteAnual = /Límite anual/i.test(tablaText);
    log("tabla text:", tablaText.slice(0, 300));
  });

  await step("04-modal-crear", async () => {
    await page.getByRole("button", { name: /^Crear$/ }).first().click({ timeout: 10000 });
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/04-modal-crear.png`, fullPage: true });

    const dialogText = await page.locator('[role="dialog"]').first().innerText();
    results.modalText = dialogText;
    results.modalAssertions = {
      noDescripcion: !/^Descripción$/m.test(dialogText) && !/\bDescripción\b/.test(dialogText),
      noCategoria: !/Categoría/i.test(dialogText),
      noRefleja: !/Se refleja en calendario/i.test(dialogText),
      siLimiteAnual: /Límite anual/i.test(dialogText),
    };
    log("modal text:\n", dialogText);
    log("modal assertions:", JSON.stringify(results.modalAssertions));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  // ───── FASE 2: cambiar a empleado y probar bloqueo ─────
  await step("05-demote-to-empleado", async () => {
    // Llamada via API supabase admin desde aquí no es trivial; lo haremos via SQL externo
    log("(demotion happens externally before re-login)");
  });
} catch (e) {
  log("FATAL fase 1:", e.message);
  results.fatal = e.message;
} finally {
  await browser.close();
  console.log("\n=== RESULTS FASE 1 ===");
  console.log(JSON.stringify(results, null, 2));
}
