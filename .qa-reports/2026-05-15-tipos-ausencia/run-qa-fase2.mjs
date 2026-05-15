import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMAIL = "qa-test-bh@example.com";
const PASSWORD = "QaTest12345!";
const SHOTS = ".qa-reports/2026-05-15-tipos-ausencia/screenshots";
mkdirSync(SHOTS, { recursive: true });

const log = (...a) => console.log("[qa2]", ...a);

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
    await page.screenshot({ path: `${SHOTS}/ERR2-${name.replace(/\W+/g, "_")}.png`, fullPage: true }).catch(() => {});
    results.steps.push({ name, ok: false, error: e.message });
    throw e;
  }
};

try {
  await step("F2-01-login", async () => {
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
  });

  await step("F2-02-goto-mi-panel", async () => {
    await page.goto(BASE + "/mi-panel", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    log("mi-panel url:", page.url());
    await page.screenshot({ path: `${SHOTS}/F2-02-mi-panel.png`, fullPage: true });
  });

  await step("F2-03-nueva-solicitud", async () => {
    const btn = page.getByRole("button", { name: /Nueva solicitud|Solicitar/i }).first();
    await btn.click({ timeout: 10000 });
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/F2-03-paso1-tipo.png`, fullPage: true });

    await page.locator('[role="dialog"]').getByText("Ausencia", { exact: false }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/F2-04-paso2-subtipo.png`, fullPage: true });

    await page.locator('[role="dialog"]').getByText("Baja médica", { exact: false }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/F2-05-paso3-detalle.png`, fullPage: true });
  });

  await step("F2-06-rellenar-3-dias", async () => {
    await page.fill("#fechaInicio", "2026-06-01");
    await page.fill("#fechaFin", "2026-06-03");
    await page.fill("#motivo", "QA: probar bloqueo limite anual");
    await page.screenshot({ path: `${SHOTS}/F2-06-formulario-relleno.png`, fullPage: true });
  });

  await step("F2-07-enviar-y-capturar-toast", async () => {
    await page.getByRole("button", { name: /Enviar solicitud/i }).click();
    const toast = page.locator('[data-sonner-toast], li[data-sonner-toast]').first();
    await toast.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1000);
    const toastText = await toast.innerText();
    log("TOAST:", toastText);
    results.toastText = toastText;
    await page.screenshot({ path: `${SHOTS}/F2-07-toast-error.png`, fullPage: true });

    results.toastAssertions = {
      mencionaLimiteAnual: /[Ll]ímite anual/i.test(toastText),
      mencionaNoSePuedeRegistrar: /No se puede registrar/i.test(toastText),
      mencionaDiasUsados: /usado/i.test(toastText),
      noMencionaDirector: !/director/i.test(toastText),
    };
    log("toast assertions:", JSON.stringify(results.toastAssertions));
  });
} catch (e) {
  log("FATAL fase 2:", e.message);
  results.fatal = e.message;
} finally {
  await browser.close();
  console.log("\n=== RESULTS FASE 2 ===");
  console.log(JSON.stringify(results, null, 2));
}
