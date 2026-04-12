"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ContactRound } from "lucide-react";

export function CalidadClientesView() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ContactRound className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">CALIDAD — CLIENTES</h1>
          <p className="text-sm text-muted-foreground">
            Satisfacción, reseñas y experiencia del cliente
          </p>
        </div>
      </div>

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
