"use client";

import { ClipboardList, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SubpageHeader } from "./SubpageHeader";

export function MisCuestionariosView() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <SubpageHeader
        title="Cuestionarios"
        subtitle="Encuestas y evaluaciones que tienes asignadas"
        icon={ClipboardList}
      />

      <Card className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
        <Inbox className="h-8 w-8 mb-2" />
        <p className="text-sm font-medium">No tienes cuestionarios pendientes</p>
        <p className="text-xs mt-1">
          Cuando RRHH o Gerencia te asignen una encuesta o evaluación, aparecerá aquí.
        </p>
      </Card>
    </div>
  );
}
