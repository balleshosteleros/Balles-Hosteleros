"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ContactRound } from "lucide-react";

export function CalidadClientesView() {
  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ContactRound className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            Submódulo de Calidad de Clientes listo para configurar
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2">
            Aquí podrás gestionar encuestas de satisfacción, reseñas, NPS,
            quejas y reclamaciones, y métricas de experiencia. Dile a Claude
            qué quieres añadir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
