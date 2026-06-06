import { test, expect } from "@playwright/test";
import fs from "fs";

const HABANA = "00000000-0000-0000-0000-000000000001";
const LOCAL = { latitude: 40.4168, longitude: -3.7038 }; // = coords temporales del local
const LEJOS = { latitude: 40.45, longitude: -3.7038 };    // ~3.7 km fuera del radio (100 m)
const session = JSON.parse(fs.readFileSync("/tmp/_session.json", "utf8"));

test.use({ geolocation: LOCAL, permissions: ["geolocation"] });

test("fichaje presencial/teletrabajo con colores", async ({ page, context }) => {
  await context.addCookies([
    ...session.cookies.map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, url: "http://localhost:3000",
    })),
    { name: "bh_empresa_activa", value: HABANA, url: "http://localhost:3000" },
  ]);
  // Salta el overlay de onboarding (guard basado en localStorage).
  await context.addInitScript((uid) => {
    try { localStorage.setItem(`balles:onboarding-completado-${uid}`, "true"); } catch { /* noop */ }
  }, session.userId);

  page.on("console", (m) => { if (m.text().includes("fichaje-debug")) console.log("PAGE>", m.text()); });
  await page.goto("/mi-panel/fichajes");
  console.log("URL tras navegar:", page.url());
  console.log("COOKIES:", (await context.cookies()).map((c) => c.name).join(","));
  await expect(page.getByText("Historial")).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1000); // deja cargar getMiConfigFichaje (permiteTeletrabajo)
  await page.screenshot({ path: "/tmp/fichaje-0-inicial.png", fullPage: true });

  // ---- 1) TELETRABAJO ----
  await page.getByRole("button", { name: "Fichar entrada" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("¿Cómo quieres fichar?")).toBeVisible();
  await page.screenshot({ path: "/tmp/fichaje-1-dialog.png" });
  await dialog.getByRole("button", { name: /Teletrabajo/ }).click();
  await expect(page.getByText("Trabajando · Teletrabajo")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("table").getByText("Teletrabajo").first()).toBeVisible();
  await page.screenshot({ path: "/tmp/fichaje-2-teletrabajo-azul.png", fullPage: true });

  // salida para resetear
  await page.getByRole("button", { name: "Fichar salida" }).click();
  await expect(page.getByRole("button", { name: /Fichar nueva entrada/ })).toBeVisible({ timeout: 15000 });

  // ---- 2) PRESENCIAL DENTRO ----
  await page.getByRole("button", { name: /Fichar nueva entrada/ }).click();
  await expect(dialog.getByText("¿Cómo quieres fichar?")).toBeVisible();
  await dialog.getByRole("button", { name: /Presencial/ }).click();
  await expect(page.getByText("Trabajando · Presencial")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("table").getByText("Coctelería Habana").first()).toBeVisible();
  await page.screenshot({ path: "/tmp/fichaje-3-presencial-verde.png", fullPage: true });

  await page.getByRole("button", { name: "Fichar salida" }).click();
  await expect(page.getByRole("button", { name: /Fichar nueva entrada/ })).toBeVisible({ timeout: 15000 });

  // ---- 3) PRESENCIAL FUERA (debe bloquear) ----
  await context.setGeolocation(LEJOS);
  await page.getByRole("button", { name: /Fichar nueva entrada/ }).click();
  await expect(dialog.getByText("¿Cómo quieres fichar?")).toBeVisible();
  await dialog.getByRole("button", { name: /Presencial/ }).click();
  // Toast de error de sonner; sigue sin estar "trabajando".
  await expect(page.getByText(/Acércate a un local|radio permitido|geolocaliz/i)).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: "/tmp/fichaje-4-presencial-fuera-bloqueo.png", fullPage: true });
});
