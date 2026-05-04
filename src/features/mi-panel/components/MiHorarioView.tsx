"use client";

import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function MiHorarioView() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <Card className="p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
          {DIAS.map((dia) => (
            <div
              key={dia}
              className="rounded-lg border bg-muted/20 p-3 min-h-[120px] flex flex-col"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {dia}
              </p>
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/60">
                —
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <Construction className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">
              Asignación pendiente
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Tu horario semanal aparecerá aquí cuando RRHH lo asigne. Mientras tanto,
              consulta tu calendario para ver los días trabajados.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
