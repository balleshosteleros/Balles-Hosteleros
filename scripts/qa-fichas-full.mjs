import { chromium } from "playwright";
import * as fs from "node:fs";

const OUT = ".qa-reports/2026-04-24-fichas-config-debug";
fs.mkdirSync(`${OUT}/screenshots`, { recursive: true });

const consoleEvents = [];
const networkErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (msg) => consoleEvents.push({ type: msg.type(), text: msg.text() }));
page.on("pageerror", (err) => consoleEvents.push({ type: "pageerror", text: err.message }));
page.on("response", async (resp) => {
  const status = resp.status();
  if (status >= 400) networkErrors.push({ status, url: resp.url() });
});

console.log("→ load page");
await page.goto("http://localhost:3000/cocina/fichas-tecnicas", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/screenshots/A-landing.png`, fullPage: false });

// Listar TODOS los botones visibles con su texto
const buttons = await page.locator("button:visible").all();
console.log(`\n=== Botones visibles en landing (${buttons.length}) ===`);
for (let i = 0; i < buttons.length; i++) {
  const txt = (await buttons[i].textContent())?.trim() || "(sin texto)";
  const disabled = await buttons[i].isDisabled();
  if (txt.length > 0 && txt.length < 60) console.log(`  [${i}] "${txt}" disabled=${disabled}`);
}

console.log("\n→ TEST 1: Click 'Nueva ficha' (botón principal arriba)");
const nuevaFicha = page.locator("button", { hasText: /Nueva ficha/i }).first();
const cnt1 = await nuevaFicha.count();
console.log(`   count: ${cnt1}`);
if (cnt1 > 0) {
  const isDis = await nuevaFicha.isDisabled();
  console.log(`   disabled: ${isDis}`);
  await nuevaFicha.click({ timeout: 5000 }).catch((e) => console.log(`   ERROR click: ${e.message}`));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/screenshots/B-after-nueva-ficha.png`, fullPage: false });
  // ¿Se abrió un modal?
  const dialog = page.locator('[role="dialog"]:visible');
  const dialogCount = await dialog.count();
  console.log(`   modal abierto: ${dialogCount > 0 ? "SÍ" : "NO"}`);
  if (dialogCount > 0) {
    // Cierra
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
}

console.log("\n→ TEST 2: Tab Configuración → cada sub-tab → Añadir");
const configTab = page.locator('[role="tab"]', { hasText: /Configuraci/i }).first();
await configTab.click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/screenshots/C-config-loaded.png`, fullPage: false });

const subtabs = ["Categor", "Alérgenos", "Partidas", "Menaje", "Recomendaciones"];
for (const st of subtabs) {
  console.log(`\n   ── Sub-tab: ${st}`);
  const tab = page.locator('[role="tab"]', { hasText: new RegExp(st, "i") }).first();
  await tab.click();
  await page.waitForTimeout(500);

  // Input visible
  const inp = page.locator('input[placeholder*="Nuevo"]:visible').first();
  const inpExists = await inp.count();
  console.log(`     input visible: ${inpExists > 0 ? "SÍ" : "NO"}`);
  if (!inpExists) continue;

  // Estado del botón "Añadir" SIN escribir nada
  const addBtnEmpty = page.locator('button:visible', { hasText: /^A.adir/i }).first();
  const disEmpty = await addBtnEmpty.isDisabled();
  console.log(`     botón "Añadir" sin texto disabled?: ${disEmpty}`);

  // Escribir y comprobar de nuevo
  await inp.fill(`QA_${st}_${Date.now()}`);
  await page.waitForTimeout(200);
  const disFilled = await addBtnEmpty.isDisabled();
  console.log(`     botón "Añadir" con texto disabled?: ${disFilled}`);

  // Click
  await addBtnEmpty.click({ timeout: 5000 }).catch((e) => console.log(`     ERROR click: ${e.message}`));
  await page.waitForTimeout(1500);
  // Cuántos items aparecen ahora
  const items = await page.locator(".max-h-\\[320px\\] > div, .max-h-\\[200px\\] > div").count();
  console.log(`     items visibles tras añadir: ${items}`);
}

await page.screenshot({ path: `${OUT}/screenshots/D-final.png`, fullPage: true });
await browser.close();

console.log("\n=== CONSOLE ERRORS / WARNINGS ===");
const interesting = consoleEvents.filter((e) => ["error", "warning", "pageerror"].includes(e.type));
if (interesting.length === 0) console.log("(ninguno)");
else interesting.forEach((e) => console.log(`[${e.type}] ${e.text.slice(0, 300)}`));

console.log("\n=== NETWORK ERRORS (>=400) ===");
if (networkErrors.length === 0) console.log("(ninguno)");
else networkErrors.forEach((n) => console.log(`${n.status} ${n.url}`));
