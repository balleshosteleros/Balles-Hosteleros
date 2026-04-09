import { useState } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Clock, Coffee, Layers, Fingerprint, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { TurnosSection } from "@/components/horarios/TurnosSection";
import { DescansosSection } from "@/components/horarios/DescansosSection";
import { PatronesSection } from "@/components/horarios/PatronesSection";
import { TiposFichajeSection } from "@/components/horarios/TiposFichajeSection";
import { TiposAusenciaSection } from "@/components/horarios/TiposAusenciaSection";

const SECCIONES = [
  { id: "turnos", label: "Turnos", icon: Clock },
  { id: "descansos", label: "Descansos", icon: Coffee },
  { id: "patrones", label: "Patrones", icon: Layers },
  { id: "fichaje", label: "Tipos de fichaje", icon: Fingerprint },
  { id: "ausencia", label: "Tipos de ausencia", icon: CalendarOff },
] as const;

type SeccionId = (typeof SECCIONES)[number]["id"];

export default function RRHHHorarios() {
  const { empresaActual } = useEmpresa();
  const [seccion, setSeccion] = useState<SeccionId>("turnos");

  const renderSeccion = () => {
    switch (seccion) {
      case "turnos": return <TurnosSection empresaId={empresaActual.id} />;
      case "descansos": return <DescansosSection empresaId={empresaActual.id} />;
      case "patrones": return <PatronesSection empresaId={empresaActual.id} />;
      case "fichaje": return <TiposFichajeSection />;
      case "ausencia": return <TiposAusenciaSection />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Menú lateral interno */}
      <aside className="w-[220px] shrink-0 border-r bg-muted/30 p-3 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase px-2 mb-2">Configuración</p>
        {SECCIONES.map(s => (
          <button
            key={s.id}
            onClick={() => setSeccion(s.id)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
              seccion === s.id
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <s.icon className="h-4 w-4 shrink-0" />
            {s.label}
          </button>
        ))}
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderSeccion()}
      </div>
    </div>
  );
}
