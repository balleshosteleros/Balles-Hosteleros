"use client";

/**
 * Corta el paso a quien tenga la ficha a medias — FICHAJE INCLUIDO (12-sep-2026).
 *
 * Antes esto era un `redirect()` en el layout: quien tuviera el perfil sin
 * completar acababa en el asistente hiciera lo que hiciera, y el layout no sabe
 * en qué pantalla estaba. Consecuencia real: Ruth González no pudo fichar ni un
 * solo día desde mayo de 2026 — llegaba a fichar, el gate la mandaba al
 * asistente y no llegaba nunca al botón.
 *
 * Así que el fichaje NO puede quedar cerrado: el registro de jornada es una
 * obligación legal de la empresa, y la empresa incumple si impide fichar. Pero
 * tampoco puede ser una puerta abierta por la que se pasa de largo sin leer,
 * que es lo que estaba pasando: el aviso era una tira roja arriba y la gente
 * seguía a lo suyo.
 *
 * El equilibrio, decidido por Iván el 12-sep-2026:
 *
 *   · El aviso TAPA la pantalla también en el fichaje: para fichar hay que
 *     verlo sí o sí y decidir qué hacer con él.
 *   · Debajo del botón de rellenar hay una salida —«Solo voy a fichar»— que
 *     abre el fichaje y NADA MÁS. El resto del software sigue anulado, y en la
 *     pantalla de fichaje queda la tira roja recordándolo.
 *   · Esa salida dura lo que dure la sesión del navegador. Al volver a abrir la
 *     app, el aviso vuelve a salir entero.
 *
 * No es una barrera de seguridad —es de proceso—: quien tenga que autorizar de
 * verdad son las server actions, que siguen validando permisos por su cuenta.
 */

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { ModoPrimerAcceso } from "@/features/primer-acceso/data/empleado-status";
import type { CampoPendiente } from "@/features/primer-acceso/lib/ficha-incompleta";
import { enPalabras } from "@/features/primer-acceso/lib/ficha-incompleta";

/** Pantallas de fichaje. Solo se abren tras pedir el pase, y nunca el resto. */
const RUTAS_FICHAJE = ["/m/fichajes", "/mi-panel/fichajes"];

/** Dónde se recuerda el pase. Sesión del navegador: al cerrar la app, caduca. */
const CLAVE_PASE = "bh_pase_fichaje";

/**
 * El pase, leído del navegador sin romper la hidratación.
 *
 * En el servidor no hay `sessionStorage`, así que allí SIEMPRE vale `false`: el
 * servidor pinta el aviso y el navegador decide después si ya había pase. Con un
 * `useState` leyendo el almacenamiento, servidor y cliente pintaban cosas
 * distintas en el primer render y React repintaba a lo bruto.
 */
let oyentes: (() => void)[] = [];

function suscribirPase(avisar: () => void) {
  oyentes.push(avisar);
  return () => {
    oyentes = oyentes.filter((o) => o !== avisar);
  };
}

function leerPase(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_PASE) === "1";
  } catch {
    // Navegador con el almacenamiento capado: se queda sin pase y ya está.
    return false;
  }
}

function darPase() {
  try {
    sessionStorage.setItem(CLAVE_PASE, "1");
  } catch {
    // Sin almacenamiento no se recuerda entre recargas, pero esta pantalla sí
    // se entera: los oyentes se avisan igual.
  }
  for (const avisar of oyentes) avisar();
}

export function GateDocumentacion({
  activo,
  modo,
  bloquea,
  pendientes = [],
  children,
}: {
  activo: boolean;
  modo: ModoPrimerAcceso;
  /** false = solo se avisa (DIRECCIÓN); true = se tapa la pantalla. */
  bloquea: boolean;
  /** Qué le falta exactamente, para decírselo por su nombre. */
  pendientes?: CampoPendiente[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const pase = useSyncExternalStore(suscribirPase, leerPase, () => false);

  if (!activo) return <>{children}</>;

  const enFichaje = RUTAS_FICHAJE.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const falta = enPalabras(pendientes);

  function irAFichar() {
    darPase();
    // Cada sitio tiene su pantalla de fichaje: mandar a todo el mundo a "/m"
    // sacaba al de escritorio a la app del móvil.
    router.push(pathname.startsWith("/m") ? "/m/fichajes" : "/mi-panel/fichajes");
  }

  // DIRECCIÓN (no se bloquea) y quien ya pidió el pase y está fichando: pasan,
  // con el recuadro rojo bien visible encima.
  //
  // Rojo y no ámbar: en ámbar sobre fondo amarillo parecía un aviso de virus del
  // navegador y la gente lo ignora. Un recuadro rojo limpio, con el borde y el
  // texto como único color, se lee como lo que es: la empresa reclamando algo.
  if (!bloquea || (enFichaje && pase)) {
    return (
      <>
        <div className="p-3 pb-0">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-destructive">
                Tu ficha está incompleta
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-destructive/80">
                {falta
                  ? `Nos falta ${falta}. El software queda anulado hasta que lo rellenes.`
                  : "El software queda anulado hasta que la completes."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/primer-acceso")}
              className="mt-0.5 shrink-0 rounded-md border border-destructive/40 px-2.5 py-1 text-[11px] font-semibold text-destructive"
            >
              Rellenar
            </button>
          </div>
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-4">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3.5 py-3">
          <p className="text-[13px] font-semibold text-destructive">
            {modo === "alta" ? "Tu ficha está incompleta" : "Nos falta documentación tuya"}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-destructive/80">
            {falta
              ? `Nos falta ${falta}. Son los datos de tu contrato y tu nómina, y sin ellos no podemos tenerte en regla.`
              : "Necesitamos que lo regularices: son los datos de tu contrato y tu nómina."}
          </p>
        </div>
        <Button className="w-full" onClick={() => router.push("/primer-acceso")}>
          Rellenarlo ahora
        </Button>
        {/* La salida legal: fichar no se le puede impedir a nadie. Va como
            botón secundario y lleva SOLO al fichaje — el resto sigue cerrado. */}
        <Button variant="outline" className="w-full" onClick={irAFichar}>
          Solo voy a fichar
        </Button>
        <p className="text-[11px] text-muted-foreground">
          El uso del software queda anulado hasta que completes tu ficha. Lo único que puedes
          hacer mientras tanto es fichar.
        </p>
      </div>
    </div>
  );
}
