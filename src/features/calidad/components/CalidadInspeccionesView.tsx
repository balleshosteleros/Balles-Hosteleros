"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileSearch } from "lucide-react";

export function CalidadInspeccionesView() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <FileSearch className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">INSPECCIONES</h1>
          <p className="text-sm text-muted-foreground">
            Inspecciones sanitarias, técnicas y de seguridad alimentaria
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FileSearch className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            Submódulo de Inspecciones listo para configurar
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2">
            Aquí podrás registrar visitas de Sanidad, APPCC, ITV, mantenimiento
            preventivo y cualquier inspección con sus actas y resultados. Dile
            a Claude qué quieres añadir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
