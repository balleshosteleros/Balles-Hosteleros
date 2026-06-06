# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: _tmp_fichaje.spec.ts >> fichaje presencial/teletrabajo con colores
- Location: tests/_tmp_fichaje.spec.ts:11:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog').getByText('¿Cómo quieres fichar?')
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for getByRole('dialog').getByText('¿Cómo quieres fichar?')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e7]:
      - generic [ref=e9]:
        - button "Fijar menú abierto" [ref=e10] [cursor=pointer]:
          - img [ref=e11]
        - img "Balles Hosteleros" [ref=e15]
        - generic [ref=e16]: Software de Gestión
      - generic [ref=e18]:
        - generic [ref=e19]: MIS PANELES
        - list [ref=e21]:
          - listitem [ref=e22]:
            - link "DASHBOARD" [ref=e23] [cursor=pointer]:
              - /url: /mi-panel
              - img [ref=e24]
              - generic [ref=e29]: DASHBOARD
          - listitem [ref=e30]:
            - link "PERFIL" [ref=e31] [cursor=pointer]:
              - /url: /mi-panel/datos-personales
              - img [ref=e32]
              - generic [ref=e36]: PERFIL
          - listitem [ref=e37]:
            - link "POINTS" [ref=e38] [cursor=pointer]:
              - /url: /mi-panel/points
              - img [ref=e39]
              - generic [ref=e45]: POINTS
          - listitem [ref=e46]:
            - link "CALENDARIO" [ref=e47] [cursor=pointer]:
              - /url: /mi-panel/calendario
              - img [ref=e48]
              - generic [ref=e50]: CALENDARIO
          - listitem [ref=e51]:
            - link "CRONOGRAMA" [ref=e52] [cursor=pointer]:
              - /url: /mi-panel/cronograma
              - img [ref=e53]
              - generic [ref=e57]: CRONOGRAMA
          - listitem [ref=e58]:
            - link "HORARIO" [ref=e59] [cursor=pointer]:
              - /url: /mi-panel/horario
              - img [ref=e60]
              - generic [ref=e63]: HORARIO
          - listitem [ref=e64]:
            - link "FICHAJES" [ref=e65] [cursor=pointer]:
              - /url: /mi-panel/fichajes
              - img [ref=e66]
              - generic [ref=e75]: FICHAJES
          - listitem [ref=e76]:
            - link "FORMACIÓN" [ref=e77] [cursor=pointer]:
              - /url: /mi-panel/formacion
              - img [ref=e78]
              - generic [ref=e81]: FORMACIÓN
          - listitem [ref=e82]:
            - link "CONDICIONES" [ref=e83] [cursor=pointer]:
              - /url: /mi-panel/condiciones
              - img [ref=e84]
              - generic [ref=e88]: CONDICIONES
          - listitem [ref=e89]:
            - link "ENCUESTAS" [ref=e90] [cursor=pointer]:
              - /url: /mi-panel/encuestas
              - img [ref=e91]
              - generic [ref=e94]: ENCUESTAS
          - listitem [ref=e95]:
            - link "CUESTIONARIOS" [ref=e96] [cursor=pointer]:
              - /url: /mi-panel/cuestionarios
              - img [ref=e97]
              - generic [ref=e100]: CUESTIONARIOS
          - listitem [ref=e101]:
            - link "SOLICITUDES" [ref=e102] [cursor=pointer]:
              - /url: /mi-panel/ausencias
              - img [ref=e103]
              - generic [ref=e106]: SOLICITUDES
          - listitem [ref=e107]:
            - link "COMUNICADOS" [ref=e108] [cursor=pointer]:
              - /url: /mi-panel/comunicados
              - img [ref=e109]
              - generic [ref=e112]: COMUNICADOS
          - listitem [ref=e113]:
            - link "DOCUMENTOS" [ref=e114] [cursor=pointer]:
              - /url: /mi-panel/documentos
              - img [ref=e115]
              - generic [ref=e119]: DOCUMENTOS
          - listitem [ref=e120]:
            - link "INSPECCIONES" [ref=e121] [cursor=pointer]:
              - /url: /mi-panel/inspecciones
              - img [ref=e122]
              - generic [ref=e127]: INSPECCIONES
          - listitem [ref=e128]:
            - link "EQUIPO" [ref=e129] [cursor=pointer]:
              - /url: /mi-panel/equipo
              - img [ref=e130]
              - generic [ref=e135]: EQUIPO
    - generic [ref=e137]:
      - banner [ref=e138]:
        - heading "FICHAJES" [level=1] [ref=e139]:
          - img [ref=e140]
          - generic [ref=e149]: FICHAJES
        - generic [ref=e150]:
          - generic [ref=e151]:
            - link "Conectar mi Google" [ref=e152] [cursor=pointer]:
              - /url: /api/google/connect?next=%2Fmi-panel%2Ffichajes
              - img [ref=e153]
            - button "Correo" [ref=e158] [cursor=pointer]:
              - img
            - button "Calendario" [ref=e159] [cursor=pointer]:
              - img
            - button "Reuniones Meet" [ref=e160] [cursor=pointer]:
              - img
            - button "Grabar pantalla" [ref=e161] [cursor=pointer]:
              - generic [ref=e162]:
                - img
            - button "Mis tareas" [ref=e165] [cursor=pointer]:
              - img
            - button "Comunicación interna" [ref=e166] [cursor=pointer]:
              - img
            - button "1" [ref=e167] [cursor=pointer]:
              - img
              - generic [ref=e168]: "1"
            - button "Agenda de contactos" [ref=e169] [cursor=pointer]:
              - img
            - button "Videovigilancia" [ref=e170] [cursor=pointer]:
              - img
            - button "Accesos a aplicaciones" [ref=e172] [cursor=pointer]:
              - img
          - generic [ref=e173]:
            - button "HABANA" [ref=e174] [cursor=pointer]:
              - img "HABANA" [ref=e175]
            - generic [ref=e177]:
              - generic "Alejandro Mojica" [ref=e178]
              - generic [ref=e179]: Empleado
            - button "Mi panel" [ref=e180] [cursor=pointer]:
              - img "Alejandro Mojica" [ref=e182]
      - main [ref=e183]:
        - generic [ref=e184]:
          - generic [ref=e186]:
            - generic [ref=e187]:
              - img [ref=e189]
              - generic [ref=e192]:
                - generic [ref=e194]: Sin fichar
                - generic [ref=e195]: 0:00 h
            - generic [ref=e196]:
              - button "Fichar entrada" [disabled]:
                - img
                - text: Fichar entrada
          - generic [ref=e197]:
            - heading "Historial" [level=2] [ref=e198]
            - generic [ref=e199]:
              - img [ref=e200]
              - text: Aún no tienes fichajes registrados.
    - button "Hablar con un agente de soporte" [ref=e204] [cursor=pointer]:
      - img [ref=e205]
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e214] [cursor=pointer]:
    - generic [ref=e217]:
      - text: Rendering
      - generic [ref=e218]:
        - generic [ref=e219]: .
        - generic [ref=e220]: .
        - generic [ref=e221]: .
  - alert [ref=e222]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import fs from "fs";
  3  | 
  4  | const HABANA = "00000000-0000-0000-0000-000000000001";
  5  | const LOCAL = { latitude: 40.4168, longitude: -3.7038 }; // = coords temporales del local
  6  | const LEJOS = { latitude: 40.45, longitude: -3.7038 };    // ~3.7 km fuera del radio (100 m)
  7  | const session = JSON.parse(fs.readFileSync("/tmp/_session.json", "utf8"));
  8  | 
  9  | test.use({ geolocation: LOCAL, permissions: ["geolocation"] });
  10 | 
  11 | test("fichaje presencial/teletrabajo con colores", async ({ page, context }) => {
  12 |   await context.addCookies([
  13 |     ...session.cookies.map((c: { name: string; value: string }) => ({
  14 |       name: c.name, value: c.value, url: "http://localhost:3000",
  15 |     })),
  16 |     { name: "bh_empresa_activa", value: HABANA, url: "http://localhost:3000" },
  17 |   ]);
  18 |   // Salta el overlay de onboarding (guard basado en localStorage).
  19 |   await context.addInitScript((uid) => {
  20 |     try { localStorage.setItem(`balles:onboarding-completado-${uid}`, "true"); } catch { /* noop */ }
  21 |   }, session.userId);
  22 | 
  23 |   await page.goto("/mi-panel/fichajes");
  24 |   console.log("URL tras navegar:", page.url());
  25 |   await expect(page.getByText("Historial")).toBeVisible({ timeout: 20000 });
  26 |   await page.waitForTimeout(1000); // deja cargar getMiConfigFichaje (permiteTeletrabajo)
  27 |   await page.screenshot({ path: "/tmp/fichaje-0-inicial.png", fullPage: true });
  28 | 
  29 |   // ---- 1) TELETRABAJO ----
  30 |   await page.getByRole("button", { name: "Fichar entrada" }).click();
  31 |   const dialog = page.getByRole("dialog");
> 32 |   await expect(dialog.getByText("¿Cómo quieres fichar?")).toBeVisible();
     |                                                           ^ Error: expect(locator).toBeVisible() failed
  33 |   await page.screenshot({ path: "/tmp/fichaje-1-dialog.png" });
  34 |   await dialog.getByRole("button", { name: /Teletrabajo/ }).click();
  35 |   await expect(page.getByText("Trabajando · Teletrabajo")).toBeVisible({ timeout: 15000 });
  36 |   await expect(page.locator("table").getByText("Teletrabajo").first()).toBeVisible();
  37 |   await page.screenshot({ path: "/tmp/fichaje-2-teletrabajo-azul.png", fullPage: true });
  38 | 
  39 |   // salida para resetear
  40 |   await page.getByRole("button", { name: "Fichar salida" }).click();
  41 |   await expect(page.getByRole("button", { name: /Fichar nueva entrada/ })).toBeVisible({ timeout: 15000 });
  42 | 
  43 |   // ---- 2) PRESENCIAL DENTRO ----
  44 |   await page.getByRole("button", { name: /Fichar nueva entrada/ }).click();
  45 |   await expect(dialog.getByText("¿Cómo quieres fichar?")).toBeVisible();
  46 |   await dialog.getByRole("button", { name: /Presencial/ }).click();
  47 |   await expect(page.getByText("Trabajando · Presencial")).toBeVisible({ timeout: 15000 });
  48 |   await expect(page.locator("table").getByText("Coctelería Habana").first()).toBeVisible();
  49 |   await page.screenshot({ path: "/tmp/fichaje-3-presencial-verde.png", fullPage: true });
  50 | 
  51 |   await page.getByRole("button", { name: "Fichar salida" }).click();
  52 |   await expect(page.getByRole("button", { name: /Fichar nueva entrada/ })).toBeVisible({ timeout: 15000 });
  53 | 
  54 |   // ---- 3) PRESENCIAL FUERA (debe bloquear) ----
  55 |   await context.setGeolocation(LEJOS);
  56 |   await page.getByRole("button", { name: /Fichar nueva entrada/ }).click();
  57 |   await expect(dialog.getByText("¿Cómo quieres fichar?")).toBeVisible();
  58 |   await dialog.getByRole("button", { name: /Presencial/ }).click();
  59 |   // Toast de error de sonner; sigue sin estar "trabajando".
  60 |   await expect(page.getByText(/Acércate a un local|radio permitido|geolocaliz/i)).toBeVisible({ timeout: 15000 });
  61 |   await page.screenshot({ path: "/tmp/fichaje-4-presencial-fuera-bloqueo.png", fullPage: true });
  62 | });
  63 | 
```