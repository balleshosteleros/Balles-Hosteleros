/**
 * Tests E2E — NORMA: una empresa no se registra con datos incompletos.
 *
 * El alta no pedía teléfono ni correo de contacto: ni siquiera existían como
 * campos. La empresa nacía sin ellos y el fallo aparecía semanas después, en
 * los correos de reservas (que salen desde un no-reply, así que el teléfono es
 * la única vía de contacto que se le ofrece al cliente), en los de
 * reclutamiento y en los textos legales de la web pública.
 *
 * PRERREQUISITO (si no, la app redirige a /login y los tests se saltan):
 *   - npm run dev corriendo en http://localhost:3000
 *   - Sesión iniciada: NEXT_PUBLIC_DEV_BYPASS_AUTH=true en .env.local, o bien
 *     un storageState con sesión real en playwright.config.ts
 *
 * EJECUTAR:
 *   npx playwright test tests/empresa-datos-completos.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";

/** Abre Ajustes → Empresa → Nueva empresa, pasando por el aviso previo. */
async function abrirAltaEmpresa(page: Page) {
  await page.getByRole("button", { name: /Nueva empresa/i }).first().click();
  await page.getByRole("button", { name: /Continuar/i }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByText("Nueva empresa")).toBeVisible();
  return dialogo;
}

test.describe("Empresa · datos obligatorios al registrarla", () => {
  test.beforeEach(async ({ page }) => {
    // "empresa" ya es la pestaña por defecto; se fija por URL para no depender
    // del texto del trigger (se oculta en pantallas pequeñas).
    await page.goto("/ajustes?tab=empresa");
    await page.waitForLoadState("networkidle");
    // Sin sesión no se puede probar la pantalla: se avisa en vez de dar un
    // falso verde (un login vacío también "cumple" cualquier aserción).
    // El redirect a /login puede llegar DESPUÉS del networkidle (lo dispara el
    // cliente), así que se espera a que aparezca la pantalla o el login.
    const enAjustes = page.getByRole("button", { name: /Nueva empresa/i }).first();
    const enLogin = page.getByRole("heading", { name: /Iniciar sesión/i });
    await expect(enAjustes.or(enLogin).first()).toBeVisible({ timeout: 30_000 });
    test.skip(
      await enLogin.isVisible(),
      "Requiere sesión iniciada: activa NEXT_PUBLIC_DEV_BYPASS_AUTH o usa storageState.",
    );
  });

  test("no deja crear una empresa vacía y dice QUÉ falta", async ({ page }) => {
    const dialogo = await abrirAltaEmpresa(page);

    await dialogo.getByRole("button", { name: /Crear empresa/i }).click();

    // Debe nombrar los campos que faltan, no un "rellena todo" genérico que
    // obliga a buscarlos a ojo en un formulario de varias tarjetas.
    await expect(page.getByText(/Faltan datos obligatorios/i).first()).toBeVisible();
    // Y NO cerrarse: si se cerrara, la empresa se habría creado a medias.
    await expect(dialogo).toBeVisible();
  });

  test("el teléfono y el correo son obligatorios, no solo la identidad fiscal", async ({ page }) => {
    const dialogo = await abrirAltaEmpresa(page);

    // Identidad fiscal completa…
    for (const [label, valor] of [
      ["Nombre comercial", "TEST QA"],
      ["Razón social", "TEST QA S.L."],
      ["CIF", "B00000000"],
      ["Dirección", "C/ Prueba, 1"],
      ["Ciudad", "Madrid"],
      ["Provincia", "Madrid"],
      ["Código postal", "28001"],
    ] as const) {
      await dialogo.getByLabel(new RegExp(`^${label}`, "i")).fill(valor);
    }

    // …pero sin contacto: sigue sin poder crearse.
    await dialogo.getByRole("button", { name: /Crear empresa/i }).click();
    await expect(page.getByText(/Tel[eé]fono principal/i).first()).toBeVisible();
    await expect(dialogo).toBeVisible();
  });

  test("avisa de un correo mal escrito sin molestar mientras se teclea", async ({ page }) => {
    const dialogo = await abrirAltaEmpresa(page);
    const correo = dialogo.getByLabel(/^Correo general/i);

    // A medio escribir (sin "@") todavía no se avisa: el valor aún puede
    // acabar siendo válido.
    await correo.fill("hola");
    await expect(dialogo.getByText("Correo no válido")).toHaveCount(0);

    // Con "@" y un dominio imposible, ya se avisa.
    await correo.fill("hola@sinpunto");
    await expect(dialogo.getByText("Correo no válido")).toBeVisible();

    // Y al completarlo bien, el aviso desaparece.
    await correo.fill("hola@turestaurante.com");
    await expect(dialogo.getByText("Correo no válido")).toHaveCount(0);
  });

  test("el teléfono no admite letras", async ({ page }) => {
    const dialogo = await abrirAltaEmpresa(page);
    const tel = dialogo.getByLabel(/^Teléfono principal/i);

    await tel.fill("912345678");
    await expect(dialogo.getByText(/solo puede llevar n[uú]meros/i)).toHaveCount(0);

    await tel.fill("91234abc");
    await expect(dialogo.getByText(/solo puede llevar n[uú]meros/i)).toBeVisible();
  });
});
