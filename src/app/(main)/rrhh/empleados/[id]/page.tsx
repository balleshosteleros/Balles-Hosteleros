"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getEmpleadosPorEmpresa } from "@/features/rrhh/data/rrhh";
import { getFichaEmpleado } from "@/features/rrhh/data/empleados-ficha";
import { FichaEmpleadoHeader } from "@/features/rrhh/components/empleados/FichaEmpleadoHeader";
import {
  DatosPersonalesSection, DatosLaboralesSection, CamposPersonalizadosSection,
  FormacionSection, JourneySection, AccesosSection, RolesSection,
  AutomatizacionesSection, ConfiguracionSection,
} from "@/features/rrhh/components/empleados/perfilSections";
import {
  FichajesTab, AusenciasTab, EstadisticasTab, ContratosTab,
  DocumentosTab, HorariosTab, EvaluacionesTab,
} from "@/features/rrhh/components/empleados/FichaTabsContent";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import {
  User, Briefcase, ListChecks, GraduationCap, Milestone,
  ShieldCheck, UserCog, Zap, Settings,
  Clock, CalendarDays, BarChart3, FileSignature, FolderOpen, Timer, Star,
} from "lucide-react";

const TOP_TABS = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "fichajes", label: "Fichajes", icon: Clock },
  { id: "ausencias", label: "Ausencias y vacaciones", icon: CalendarDays },
  { id: "estadisticas", label: "Estadísticas", icon: BarChart3 },
  { id: "contratos", label: "Contratos", icon: FileSignature },
  { id: "documentos", label: "Documentos", icon: FolderOpen },
  { id: "horarios", label: "Horarios", icon: Timer },
  { id: "evaluaciones", label: "Evaluaciones", icon: Star },
] as const;

const PERFIL_SECTIONS = [
  { id: "datos-personales", label: "Datos personales", icon: User },
  { id: "datos-laborales", label: "Datos laborales", icon: Briefcase },
  { id: "campos-personalizados", label: "Campos personalizados", icon: ListChecks },
  { id: "formacion", label: "Formación y habilidades", icon: GraduationCap },
  { id: "journey", label: "Journey", icon: Milestone },
  { id: "accesos", label: "Accesos", icon: ShieldCheck },
  { id: "roles", label: "Roles", icon: UserCog },
  { id: "automatizaciones", label: "Automatizaciones", icon: Zap },
  { id: "configuracion", label: "Configuración", icon: Settings },
] as const;

type TopTab = typeof TOP_TABS[number]["id"];
type PerfilSection = typeof PERFIL_SECTIONS[number]["id"];

export default function FichaEmpleadoPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();
  const { empresaActual } = useEmpresa();

  const empleados = useMemo(() => getEmpleadosPorEmpresa(empresaActual.id), [empresaActual.id]);
  const empleado = useMemo(() => empleados.find((e) => e.id === id), [empleados, id]);
  const ficha = useMemo(() => (id ? getFichaEmpleado(empresaActual.id, id) : null), [empresaActual.id, id]);

  const [activeTab, setActiveTab] = useState<TopTab>("perfil");
  const [activePerfilSection, setActivePerfilSection] = useState<PerfilSection>("datos-personales");

  if (!empleado || !ficha) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Empleado no encontrado.</p>
      </div>
    );
  }

  function handleSave() {
    toast.success("Cambios guardados correctamente");
  }

  function renderPerfilContent() {
    switch (activePerfilSection) {
      case "datos-personales": return <DatosPersonalesSection ficha={ficha!} />;
      case "datos-laborales": return <DatosLaboralesSection ficha={ficha!} />;
      case "campos-personalizados": return <CamposPersonalizadosSection ficha={ficha!} />;
      case "formacion": return <FormacionSection ficha={ficha!} />;
      case "journey": return <JourneySection ficha={ficha!} />;
      case "accesos": return <AccesosSection ficha={ficha!} empresaId={empresaActual.id} />;
      case "roles": return <RolesSection ficha={ficha!} />;
      case "automatizaciones": return <AutomatizacionesSection />;
      case "configuracion": return <ConfiguracionSection />;
    }
  }

  function renderTabContent() {
    switch (activeTab) {
      case "perfil":
        return (
          <div className="flex flex-1 min-h-0">
            <nav className="w-56 shrink-0 border-r bg-muted/30 py-4 space-y-0.5">
              {PERFIL_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActivePerfilSection(s.id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-4 py-2 text-sm transition-colors text-left",
                    activePerfilSection === s.id
                      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <s.icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </button>
              ))}
            </nav>
            <div className="flex-1 p-6 overflow-auto">
              {renderPerfilContent()}
            </div>
          </div>
        );
      case "fichajes": return <div className="p-6"><FichajesTab empleado={empleado!} /></div>;
      case "ausencias": return <div className="p-6"><AusenciasTab /></div>;
      case "estadisticas": return <div className="p-6"><EstadisticasTab empleado={empleado!} /></div>;
      case "contratos": return <div className="p-6"><ContratosTab ficha={ficha!} /></div>;
      case "documentos": return <div className="p-6"><DocumentosTab ficha={ficha!} /></div>;
      case "horarios": return <div className="p-6"><HorariosTab empleado={empleado!} /></div>;
      case "evaluaciones": return <div className="p-6"><EvaluacionesTab ficha={ficha!} /></div>;
    }
  }

  return (
    <div className="flex flex-col h-full">
      <FichaEmpleadoHeader empleado={empleado} onBack={() => router.push("/rrhh/empleados")} onSave={handleSave} />

      <div className="border-b bg-card px-6 flex gap-0 overflow-x-auto shrink-0">
        {TOP_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col overflow-auto">
        {renderTabContent()}
      </div>
    </div>
  );
}
