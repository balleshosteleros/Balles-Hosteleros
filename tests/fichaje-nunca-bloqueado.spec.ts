/**
 * NORMA: NADA PUEDE DEJAR EL BOTÓN DE FICHAR SIN RESPONDER.
 *
 * Qué pasó (12-09-2026): a Iván y a Farid les saltó un comunicado a su hora de
 * entrada. Ese aviso es un diálogo MODAL de Radix y, mientras está abierto,
 * Radix deja el `body` en `pointer-events: none`. El aviso de fichar se pinta
 * FUERA de ese diálogo: se veía encima y el dedo no le llegaba. Pulsaban el
 * botón verde y no pasaba nada.
 *
 * Estas comprobaciones leen el código fuente (no necesitan navegador ni app
 * levantada) y sujetan las cuatro reglas que lo impiden. Si alguien las rompe,
 * el test falla ANTES de que nadie se quede sin fichar.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const raiz = process.cwd();

/**
 * El código SIN comentarios. Es imprescindible: la primera versión de este
 * test buscaba "pointer-events-auto" en el fichero entero y daba verde aunque
 * la clase se hubiera borrado, porque la palabra seguía viva en el comentario
 * que explica por qué hace falta. Un guardián que no detecta la rotura no
 * guarda nada. Aquí se mira lo que EJECUTA el navegador, no lo que contamos.
 */
function codigo(rel: string): string {
  return readFileSync(join(raiz, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}


const CAPA = "src/features/mi-panel/mobile/components/CapaFichaje.tsx";
const PROVIDER = "src/features/mi-panel/mobile/components/MobileFichajeProvider.tsx";
const BOTON = "src/features/mi-panel/mobile/components/BigClockButton.tsx";
const GATE = "src/features/notificaciones/components/NotificacionesGate.tsx";

test.describe("El fichaje nunca se queda sin responder", () => {
  test("la capa de fichaje recupera los toques aunque haya un modal abierto", () => {
    const capa = codigo(CAPA);
    // Sin esto, el `pointer-events: none` que Radix pone en el body mata el
    // botón verde: se ve, pero no se puede pulsar.
    expect(capa, "CapaFichaje se ha quedado sin `pointer-events-auto`.").toContain(
      "pointer-events-auto",
    );
    // Y en un portal sobre el body, para que ningún contenedor la recorte.
    expect(capa, "CapaFichaje tiene que pintarse en un portal sobre el body.").toContain(
      "createPortal",
    );
  });

  test("la capa de fichaje va por encima de cualquier otra capa de la app", () => {
    const capa = codigo(CAPA);
    const nivelesFichaje = [...capa.matchAll(/z-\[(\d+)\]/g)].map((m) => Number(m[1]));
    expect(nivelesFichaje.length).toBeGreaterThan(0);
    const minFichaje = Math.min(...nivelesFichaje);

    // El z-index más alto que usa el resto de la app (toasts aparte: sonner se
    // pinta con su propia capa altísima, y así debe ser: los avisos de error
    // del propio fichaje salen por ahí).
    const salida = execSync(
      `grep -rho "z-\\[[0-9]\\+\\]" src --include="*.tsx" || true`,
      { cwd: raiz, encoding: "utf8" },
    );
    const otros = [...salida.matchAll(/z-\[(\d+)\]/g)]
      .map((m) => Number(m[1]))
      .filter((n) => !nivelesFichaje.includes(n));
    const maxOtros = otros.length ? Math.max(...otros) : 0;

    expect(
      minFichaje,
      `La capa del fichaje (${minFichaje}) tiene que ir por encima de todo lo demás (${maxOtros}). ` +
        "Si algo necesita ponerse delante del fichaje, no: el fichaje va primero.",
    ).toBeGreaterThan(maxOtros);
  });

  test("ningún overlay del fichaje se escribe a mano: todos pasan por CapaFichaje", () => {
    for (const rel of [PROVIDER, BOTON]) {
      const src = codigo(rel);
      expect(src).toContain("CapaFichaje");
      // Un `fixed inset-0` suelto es justo el error de partida: una capa propia
      // que se olvida de los toques y del z-index.
      expect(
        src.includes("fixed inset-0"),
        `${rel} pinta un overlay a mano ("fixed inset-0"). Tiene que usar <CapaFichaje>.`,
      ).toBe(false);
    }
  });

  test("los avisos de la app se apartan mientras toca fichar", () => {
    const gate = codigo(GATE);
    expect(
      gate.includes("useAvisoFichajeActivo"),
      "NotificacionesGate tiene que consultar useAvisoFichajeActivo y no pintarse mientras toca fichar.",
    ).toBe(true);
    expect(gate).toMatch(/if \(!actual \|\| ficharAhora\) return null;/);
  });

  test("la cuenta atrás dice con el signo y el color si falta tiempo o si sobra", () => {
    const src = codigo(PROVIDER);
    // "+01:21" verde = te faltan. "-01:21" rojo = vas con retraso. El signo
    // solo a secas y en verde se leía al revés (Iván, 12-09-2026).
    expect(
      src,
      "La cuenta atrás tiene que llevar el signo delante: + si falta, - si va con retraso.",
    ).toContain('const signo = segundos < 0 ? "-" : "+"');
    expect(
      src,
      "Ir con retraso se pinta en ROJO, igual que ir tarde.",
    ).toContain('llegaTarde || conRetraso ? "text-rose-600" : "text-emerald-600"');
    expect(src).toContain("De retraso");
  });
});
