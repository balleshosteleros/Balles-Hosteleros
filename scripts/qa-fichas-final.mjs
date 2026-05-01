import { chromium } from "playwright";
import * as fs from "node:fs";
const OUT = ".qa-reports/2026-04-24-fichas-config-debug";
fs.mkdirSync(`${OUT}/screenshots`, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto("http://localhost:3000/cocina/fichas-tecnicas", { waitUntil: "networkidle", timeout: 30000 });
await page.locator('[role="tab"]', { hasText: /Configuraci/i }).first().click();
await page.waitForTimeout(800);
await page.locator('[role="tab"]', { hasText: /^Categor/i }).first().click();
await page.waitForTimeout(500);

await page.screenshot({ path: `${OUT}/screenshots/FIX-1-empty.png` });
const inp = page.locator('input[placeholder*="Añadir"]:visible, input[placeholder*="añadir"]:visible, input[placeholder*="Escribe"]:visible').first();
const inpCount = await inp.count();
console.log("input visible (nuevo placeholder):", inpCount);

const addBtn = page.locator('button:visible', { hasText: /^A.adir/i }).first();
const disEmpty = await addBtn.isDisabled();
console.log("Botón Añadir SIN escribir → disabled?", disEmpty);

// Click sin escribir: debería salir toast
await addBtn.click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/screenshots/FIX-2-toast-empty.png` });

await inp.fill("PRUEBA_FINAL");
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/screenshots/FIX-3-filled.png` });
await addBtn.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/screenshots/FIX-4-after.png` });

await browser.close();
console.log("OK");
