"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export function CalidadAuditoriasView() {
  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            Submódulo de Auditorías listo para configurar
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2">
            Aquí podrás programar auditorías, asignar responsables, registrar
            hallazgos y generar informes. Dile a Claude qué quieres añadir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
