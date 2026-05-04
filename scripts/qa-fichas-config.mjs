import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUT = ".qa-reports/2026-04-24-fichas-config-debug";
fs.mkdirSync(`${OUT}/screenshots`, { recursive: true });

const consoleEvents = [];
const networkEvents = [];
const failedRequests = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("console", (msg) => {
  consoleEvents.push({ type: msg.type(), text: msg.text() });
});
page.on("pageerror", (err) => {
  consoleEvents.push({ type: "pageerror", text: err.message + "\n" + err.stack });
});
page.on("requestfailed", (req) => {
  failedRequests.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText });
});
page.on("response", async (resp) => {
  const status = resp.status();
  const url = resp.url();
  if (url.includes("/cocina/") || url.includes("/api/") || resp.request().method() === "POST") {
    let body = "";
    try { body = (await resp.text()).slice(0, 500); } catch {}
    networkEvents.push({ method: resp.request().method(), status, url, body });
  }
});

console.log("→ navigating");
await page.goto("http://localhost:3000/cocina/fichas-tecnicas", { waitUntil: "networkidle", timeout: 30000 });
await page.screenshot({ path: `${OUT}/screenshots/01-load.png`, fullPage: true });

console.log("→ click tab Configuración");
// Buscar el TabsTrigger por texto.
const configTrigger = page.locator('[role="tab"]', { hasText: /Configuraci/i }).first();
const exists = await configTrigger.count();
console.log("   tab Configuración count:", exists);
if (exists > 0) {
  await configTrigger.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/screenshots/02-config-tab.png`, fullPage: true });
}

console.log("→ click sub-tab Categorías");
const catTrigger = page.locator('[role="tab"]', { hasText: /^Categor/i }).first();
const catExists = await catTrigger.count();
console.log("   sub-tab Categorías count:", catExists);
if (catExists > 0) {
  await catTrigger.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/screenshots/03-cat-subtab.png`, fullPage: true });
}

console.log("→ buscar input visible");
const inputs = await page.locator('input[placeholder*="Nuevo"]').all();
console.log("   inputs con 'Nuevo':", inputs.length);
let input = null;
for (const i of inputs) {
  if (await i.isVisible()) { input = i; break; }
}
if (!input) {
  console.log("   NO HAY INPUT VISIBLE");
  await page.screenshot({ path: `${OUT}/screenshots/04-no-input.png`, fullPage: true });
} else {
  await input.fill("TEST_PLAYWRIGHT");
  await page.screenshot({ path: `${OUT}/screenshots/04-after-fill.png`, fullPage: true });

  console.log("→ click Añadir");
  const addBtn = page.locator('button', { hasText: /A.adir/i }).first();
  const btnDisabled = await addBtn.isDisabled().catch(() => null);
  console.log("   botón Añadir disabled?:", btnDisabled);
  await addBtn.click({ timeout: 5000 }).catch((e) => console.log("   click error:", e.message));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/screenshots/05-after-click.png`, fullPage: true });
}

await browser.close();

fs.writeFileSync(`${OUT}/console.json`, JSON.stringify(consoleEvents, null, 2));
fs.writeFileSync(`${OUT}/network.json`, JSON.stringify(networkEvents, null, 2));
fs.writeFileSync(`${OUT}/failed.json`, JSON.stringify(failedRequests, null, 2));

console.log("\n=== CONSOLE EVENTS (errores y warnings) ===");
for (const e of consoleEvents) {
  if (["error", "warning", "pageerror"].includes(e.type)) {
    console.log(`[${e.type}] ${e.text.slice(0, 400)}`);
  }
}
console.log("\n=== FAILED REQUESTS ===");
for (const r of failedRequests) console.log(JSON.stringify(r));

console.log("\n=== POSTs / API responses ===");
for (const n of networkEvents) {
  if (n.method === "POST" || n.status >= 400) {
    console.log(`[${n.method} ${n.status}] ${n.url}`);
    if (n.body) console.log(`  body: ${n.body.slice(0, 200)}`);
  }
}
