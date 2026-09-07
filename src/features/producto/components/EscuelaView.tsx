"use client";

import { Card } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

/**
 * ESCUELA — submódulo de PRODUCTO (empresa matriz).
 *
 * De momento solo existe el hueco: el submódulo ya vive en el menú y tiene su
 * sitio, pero su contenido está por definir. Se deja explícito en pantalla en
 * lugar de inventar una funcionalidad que nadie ha pedido.
 */
export function EscuelaView() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Escuela</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Formación de los clientes que contratan el software.
        </p>
      </div>

      <Card className="p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl bg-muted/60 p-3 text-muted-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Este submódulo todavía no tiene contenido.
          </p>
        </div>
      </Card>
    </div>
  );
}
