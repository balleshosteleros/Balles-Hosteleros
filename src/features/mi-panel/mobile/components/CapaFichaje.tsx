"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/utils";
import { useCapaFichajeMontada } from "@/shared/lib/aviso-fichaje-activo";

/**
 * LA CAPA DEL FICHAJE. Todo lo que se pinte encima de la app para fichar pasa
 * por aquí, y por aquí se le garantizan de una vez las tres cosas que el
 * 12-09-2026 fallaron y dejaron a Iván y Farid sin poder fichar su entrada:
 *
 *   1. SE PUEDE TOCAR. Un diálogo modal de Radix abierto (un comunicado, una
 *      liquidación) deja el `body` en `pointer-events: none`. El botón verde se
 *      veía perfectamente y el dedo no le llegaba. `pointer-events-auto`
 *      devuelve los toques a esta capa pase lo que pase detrás.
 *   2. SE VE. Va por encima de CUALQUIER otra capa de la app (la más alta que
 *      existe es 10001, el recorder). Nada se pone delante del fichaje.
 *   3. APARTA LOS AVISOS. Por el hecho de estar montada avisa a la app de que
 *      toca fichar, y los avisos esperan su turno (`useAvisoFichajeActivo`).
 *
 * Y se pinta en un portal sobre el `body`: así no la puede recortar ni tapar
 * ningún contenedor de la pantalla en la que esté el empleado.
 *
 * REGLA: ningún overlay de fichaje se escribe a mano con `fixed inset-0`. Se
 * usa esto. El test `tests/fichaje-nunca-bloqueado.spec.ts` lo vigila.
 */
const sinSuscripcion = () => () => {};

interface Props {
  children: React.ReactNode;
  /** Qué hacer al tocar el fondo oscuro (posponer, cerrar la hoja…). */
  onFondo?: () => void;
  /** Hoja que se abre SOBRE el aviso de fichar (confirmar, elegir tipo…). */
  encima?: boolean;
  /** Cómo se coloca el contenido dentro de la capa. */
  className?: string;
}

export function CapaFichaje({ children, onFondo, encima = false, className }: Props) {
  useCapaFichajeMontada();
  // El portal necesita el `body`, que en el render del servidor no existe:
  // hasta que esto corre en el navegador, no se pinta nada. Se resuelve con
  // `useSyncExternalStore` (false en servidor, true en cliente) y no con un
  // `useState` + efecto, que dispara un render de más en cada apertura.
  const enElNavegador = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  if (!enElNavegador) return null;

  return createPortal(
    <div
      data-capa-fichaje={encima ? "hoja" : "aviso"}
      onClick={onFondo}
      className={cn(
        // `pointer-events-auto` y el z-index NO son decorativos: ver arriba.
        "pointer-events-auto fixed inset-0 flex flex-col justify-end bg-black/50",
        encima ? "z-[10110]" : "z-[10100]",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
