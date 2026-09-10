"use client";

/**
 * Corta el paso a quien debe documentación, PERO NUNCA al fichaje.
 *
 * Antes esto era un `redirect()` en el layout: quien tuviera el perfil sin
 * completar acababa en el asistente hiciera lo que hiciera, y el layout no sabe
 * en qué pantalla estaba. Consecuencia real: Ruth González no ha podido fichar
 * ni un solo día desde mayo de 2026 — llegaba a fichar, el gate la mandaba al
 * asistente y no llegaba nunca al botón. Cero fichajes en la única persona con
 * el perfil a medias, mientras sus compañeros fichaban a diario.
 *
 * El registro de jornada es una obligación legal del trabajador Y de la empresa:
 * ninguna gestión interna puede impedirlo. Por eso el corte se hace aquí, en
 * cliente, que sí sabe la ruta: en las pantallas de fichaje se deja pasar (con
 * un aviso) y en todo lo demás se tapa la pantalla hasta que suba lo suyo.
 *
 * No es una barrera de seguridad —es de proceso—: quien tenga que autorizar de
 * verdad son las server actions, que siguen validando permisos por su cuenta.
 */

import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { ModoPrimerAcceso } from "@/features/primer-acceso/data/empleado-status";

/** Pantallas donde JAMÁS se bloquea: fichar siempre tiene que poder hacerse. */
const RUTAS_LIBRES = ["/m/fichajes", "/mi-panel/fichajes"];

export function GateDocumentacion({
  activo,
  modo,
  bloquea,
  children,
}: {
  activo: boolean;
  modo: ModoPrimerAcceso;
  /** false = solo se avisa (DIRECCIÓN); true = se tapa la pantalla. */
  bloquea: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  if (!activo) return <>{children}</>;

  const esFichaje = RUTAS_LIBRES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  // Quien no se bloquea (DIRECCIÓN) ve el mismo recuadro que en el fichaje, en
  // todas las pantallas, pero sigue trabajando con normalidad.
  // Fichando: pasa, pero con el recuadro rojo bien visible.
  //
  // Rojo y no ámbar: en ámbar sobre fondo amarillo parecía un aviso de virus del
  // navegador y la gente lo ignora. Un recuadro rojo limpio, con el borde y el
  // texto como único color, se lee como lo que es: la empresa reclamando algo.
  if (esFichaje || !bloquea) {
    return (
      <>
        <div className="p-3 pb-0">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-destructive">
                Nos falta documentación tuya
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-destructive/80">
                Necesitamos que lo regularices.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/primer-acceso")}
              className="mt-0.5 shrink-0 rounded-md border border-destructive/40 px-2.5 py-1 text-[11px] font-semibold text-destructive"
            >
              Subirla
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
            {modo === "alta" ? "Tu perfil está sin completar" : "Nos falta documentación tuya"}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-destructive/80">
            {modo === "alta"
              ? "Necesitamos que lo regularices: son los datos de tu contrato y tu nómina."
              : "Necesitamos que lo regularices. Con tu DNI y tu certificado bancario ya está."}
          </p>
        </div>
        <Button className="w-full" onClick={() => router.push("/primer-acceso")}>
          Subirlo ahora
        </Button>
        {/* Decir «puedes fichar» sin dar forma de llegar al fichaje dejaba a la
            persona mirando una frase que no podía usar. */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push("/m/fichajes")}
        >
          Ir a fichar
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Fichar puedes hacerlo aunque no hayas subido nada. Lo demás se abre en cuanto lo subas.
        </p>
      </div>
    </div>
  );
}
