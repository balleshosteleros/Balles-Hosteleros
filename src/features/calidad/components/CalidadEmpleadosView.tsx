"use client";

import { Card, CardContent } from "@/components/ui/card";
import { UsersRound } from "lucide-react";

export function CalidadEmpleadosView() {
  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <UsersRound className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            Submódulo de Calidad de Empleados listo para configurar
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2">
            Aquí podrás registrar evaluaciones, feedback, planes de mejora
            individual y métricas de calidad por empleado. Dile a Claude qué
            quieres añadir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
