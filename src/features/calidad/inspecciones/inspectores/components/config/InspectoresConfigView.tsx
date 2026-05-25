"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Users,
  Globe,
  FileText,
  LayoutPanelTop,
  Mail,
  Building2,
  Settings,
} from "lucide-react";
import { InspectoresPoolConfig } from "./InspectoresPoolConfig";
import { BolsaPublicaConfig } from "./BolsaPublicaConfig";
import { PlantillasInspeccionConfig } from "./PlantillasInspeccionConfig";
import { PresentacionConfig } from "./PresentacionConfig";
import { EmailsConfig } from "./EmailsConfig";
import { DatosEmpresaConfig } from "./DatosEmpresaConfig";
import { ConfigGeneralInspeccionesConfig } from "./ConfigGeneralInspeccionesConfig";

type ConfigSection =
  | "inspectores"
  | "bolsa"
  | "plantillas"
  | "presentacion"
  | "emails"
  | "datos_empresa"
  | "configuracion";

const SECTIONS: { id: ConfigSection; label: string; icon: React.ReactNode }[] = [
  { id: "inspectores", label: "Inspectores", icon: <Users className="h-4 w-4" /> },
  { id: "bolsa", label: "Bolsa pública", icon: <Globe className="h-4 w-4" /> },
  { id: "plantillas", label: "Plantillas de inspección", icon: <FileText className="h-4 w-4" /> },
  { id: "presentacion", label: "Presentación", icon: <LayoutPanelTop className="h-4 w-4" /> },
  { id: "emails", label: "Plantillas de email", icon: <Mail className="h-4 w-4" /> },
  { id: "datos_empresa", label: "Datos de tu empresa", icon: <Building2 className="h-4 w-4" /> },
  { id: "configuracion", label: "Configuración general", icon: <Settings className="h-4 w-4" strokeWidth={1.75} /> },
];

const CONTENT: Record<ConfigSection, React.ReactNode> = {
  inspectores: <InspectoresPoolConfig />,
  bolsa: <BolsaPublicaConfig />,
  plantillas: <PlantillasInspeccionConfig />,
  presentacion: <PresentacionConfig />,
  emails: <EmailsConfig />,
  datos_empresa: <DatosEmpresaConfig />,
  configuracion: <ConfigGeneralInspeccionesConfig />,
};

export function InspectoresConfigView() {
  const [active, setActive] = useState<ConfigSection>("inspectores");

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
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">{CONTENT[active]}</div>
    </div>
  );
}
