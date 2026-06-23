import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Briefcase, Users, Globe, FileText,
} from "lucide-react";
import { OfertasTrabajoConfig } from "./OfertasTrabajoConfig";
import { CandidatosConfig } from "./CandidatosConfig";
import { PortalEmpleoConfig } from "./PortalEmpleoConfig";
import { PlantillasConfig } from "./PlantillasConfig";

type ConfigSection =
  | "ofertas"
  | "candidatos"
  | "portal"
  | "plantillas";

const SECTIONS: { id: ConfigSection; label: string; icon: React.ReactNode }[] = [
  { id: "ofertas", label: "Vacantes", icon: <Briefcase className="h-4 w-4" /> },
  { id: "candidatos", label: "Candidatos", icon: <Users className="h-4 w-4" /> },
  { id: "portal", label: "Portal de empleo", icon: <Globe className="h-4 w-4" /> },
  { id: "plantillas", label: "Plantillas", icon: <FileText className="h-4 w-4" /> },
];

const CONTENT: Record<ConfigSection, React.ReactNode> = {
  ofertas: <OfertasTrabajoConfig />,
  candidatos: <CandidatosConfig />,
  portal: <PortalEmpleoConfig />,
  plantillas: <PlantillasConfig />,
};

export function ReclutamientoConfigView() {
  const [active, setActive] = useState<ConfigSection>("ofertas");

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Sidebar */}
      <nav className="w-56 shrink-0 space-y-0.5">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            aria-label={s.label}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
              active === s.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {CONTENT[active]}
      </div>
    </div>
  );
}
