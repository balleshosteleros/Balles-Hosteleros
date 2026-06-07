"use client";

import { useState } from "react";
import {
  LayoutGrid,
  Clock,
  Coffee,
  Layers,
  Fingerprint,
  CalendarOff,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { CuadrantesSection } from "@/features/rrhh/components/horarios/CuadrantesSection";
import { TurnosSection } from "@/features/rrhh/components/horarios/TurnosSection";
import { DescansosSection } from "@/features/rrhh/components/horarios/DescansosSection";
import { PatronesSection } from "@/features/rrhh/components/horarios/PatronesSection";
import { TiposFichajeSection } from "@/features/rrhh/components/horarios/TiposFichajeSection";
import { TiposAusenciaSection } from "@/features/rrhh/components/horarios/TiposAusenciaSection";

const SECCIONES = [
  { id: "turnos", label: "Turnos", icon: Clock },
  { id: "patrones", label: "Patrones", icon: Layers },
  { id: "descansos", label: "Descansos", icon: Coffee },
  { id: "cuadrantes", label: "Cuadrantes", icon: LayoutGrid },
  { id: "fichaje", label: "Tipos de fichaje", icon: Fingerprint },
  { id: "ausencia", label: "Tipos de ausencia", icon: CalendarOff },
] as const;

type SeccionId = (typeof SECCIONES)[number]["id"];

export function ConfiguracionHorariosSheet({
  empresaId,
  onVolver,
  seccionInicial = "turnos",
}: {
  empresaId: string;
  onVolver: () => void;
  seccionInicial?: SeccionId;
}) {
  const [seccion, setSeccion] = useState<SeccionId>(seccionInicial);

  const renderSeccion = () => {
    switch (seccion) {
      case "turnos":
        return <TurnosSection empresaId={empresaId} />;
      case "patrones":
        return <PatronesSection empresaId={empresaId} />;
      case "descansos":
        return <DescansosSection empresaId={empresaId} />;
      case "cuadrantes":
        return <CuadrantesSection empresaId={empresaId} />;
      case "fichaje":
        return <TiposFichajeSection empresaId={empresaId} />;
      case "ausencia":
        return <TiposAusenciaSection empresaId={empresaId} />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <Button variant="outline" size="sm" onClick={onVolver} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Volver a horarios
        </Button>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">
            Configuración de horarios
          </h2>
          <p className="text-sm text-muted-foreground leading-tight">
            Crea y gestiona turnos, patrones, descansos, cuadrantes y tipos.
          </p>
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
        <aside className="w-[210px] shrink-0 border-r bg-muted/30 p-3 space-y-1 overflow-y-auto">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                seccion === s.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </aside>
        <div className="flex-1 overflow-y-auto p-6">{renderSeccion()}</div>
      </div>
    </div>
  );
}
