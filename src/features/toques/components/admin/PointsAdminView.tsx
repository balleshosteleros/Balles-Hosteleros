"use client";

import { Trophy } from "lucide-react";

/**
 * RRHH → Points, de momento en obras.
 *
 * El juego que ve el trabajador (la píldora de arriba) sigue funcionando; lo
 * que todavía no se enseña es la parte de gestión —canjes y configuración—,
 * así que el submódulo se queda con este cartelito y nada más (Iván, 12-sep).
 *
 * Las dos pantallas de gestión siguen escritas y probadas en `CanjesAdminView`
 * y `ToquesAdminTab`: para devolverlas basta con volver a montarlas aquí.
 */
export function PointsAdminView() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border bg-muted/30 px-8 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Trophy className="h-7 w-7" />
        </span>
        <p className="text-base font-semibold">Próximamente</p>
        <p className="text-sm text-muted-foreground">
          Estamos preparando la gestión de points: canjes de premios y configuración de
          cómo se ganan.
        </p>
      </div>
    </div>
  );
}
