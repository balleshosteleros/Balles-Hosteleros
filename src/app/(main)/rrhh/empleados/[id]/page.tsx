"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { FichaEmpleadoHeader } from "@/features/rrhh/components/empleados/FichaEmpleadoHeader";
import {
  FichajesTab, HorariosTab,
} from "@/features/rrhh/components/empleados/FichaTabsContent";
import { SubmoduloPorEmpleadoPlaceholder } from "@/features/rrhh/components/empleados/SubmoduloPorEmpleadoPlaceholder";
import { DatosPersonalesForm } from "@/features/mi-panel/components/DatosPersonalesForm";
import type { DatosPersonalesCompletos } from "@/features/mi-panel/actions/datos-personales-actions";
import { getEmpleadoConPerfil } from "@/features/rrhh/actions/empleados-actions";
import type { Empleado } from "@/features/rrhh/data/rrhh";
import { getFichaEmpleado } from "@/features/rrhh/data/empleados-ficha";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { cn } from "@/shared/lib/utils";
import {
  User,
  Fingerprint, Inbox, FileSignature, Calendar, Timer,
  UserRoundSearch, UserCheck, Gift, Trophy, HandCoins,
  GraduationCap, ClipboardList, FileQuestion, Building2,
} from "lucide-react";

type EmpresaAcceso = { id: string; nombre: string; esPrincipal: boolean };

const TOP_TABS = [
  { id: "perfil",          label: "Perfil",         icon: User              },
  { id: "fichajes",        label: "Fichajes",       icon: Fingerprint       },
  { id: "solicitudes",     label: "Solicitudes",    icon: Inbox             },
  { id: "firmas",          label: "Firmas",         icon: FileSignature     },
  { id: "calendarios",     label: "Calendarios",    icon: Calendar          },
  { id: "horarios",        label: "Horarios",       icon: Timer             },
  { id: "reclutamiento",   label: "Reclutamiento",  icon: UserRoundSearch   },
  { id: "boarding",        label: "Boarding",       icon: UserCheck         },
  { id: "bonus",           label: "Bonus",          icon: Gift              },
  { id: "points",          label: "Points",         icon: Trophy            },
  { id: "pagos",           label: "Pagos",          icon: HandCoins         },
  { id: "formacion",       label: "Formación",      icon: GraduationCap     },
  { id: "encuestas",       label: "Encuestas",      icon: ClipboardList     },
  { id: "cuestionarios",   label: "Cuestionarios",  icon: FileQuestion      },
] as const;

type TopTab = typeof TOP_TABS[number]["id"];

// Forma del row real de Supabase (joineado con departamentos).
type EmpleadoBD = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email_personal: string | null;
  email_empresa: string | null;
  telefono: string | null;
  user_id: string;
  departamento_id: string | null;
  estado: string;
  departamentos?: { nombre: string } | null;
};

/**
 * Convierte el empleado de BD al shape `Empleado` que esperan los tabs
 * heredados (FichajesTab, HorariosTab) — esos componentes son mock-driven
 * y aún no se han migrado.
 */
function bdToEmpleadoMock(emp: EmpleadoBD): Empleado {
  return {
    id: emp.id,
    nombre: emp.nombre ?? "",
    apellidos: emp.apellidos ?? "",
    estado: "trabajando",
    horarioTipo: "—",
    horarioSemanal: "—",
    horasHoy: "—",
    departamento: emp.departamentos?.nombre ?? "—",
    telefono: emp.telefono ?? "—",
    fichajes: 0,
    emailEmpresa: emp.email_empresa ?? "",
    emailPersonal: emp.email_personal ?? "",
    validadorFichajes: "—",
  };
}

export default function FichaEmpleadoPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();
  const { empresaActual } = useEmpresa();

  const [loading, setLoading] = useState(true);
  const [empleadoBD, setEmpleadoBD] = useState<EmpleadoBD | null>(null);
  const [datosPersonales, setDatosPersonales] = useState<DatosPersonalesCompletos | null>(null);
  const [empresasAcceso, setEmpresasAcceso] = useState<EmpresaAcceso[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TopTab>("perfil");

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    getEmpleadoConPerfil(id).then((res) => {
      if (!alive) return;
      if (!res.ok) {
        setError(res.error ?? "Empleado no encontrado");
        setEmpleadoBD(null);
        setDatosPersonales(null);
        setEmpresasAcceso([]);
      } else {
        setEmpleadoBD(res.empleado as EmpleadoBD);
        setDatosPersonales(res.datosPersonales ?? null);
        setEmpresasAcceso((res.empresasAcceso as EmpresaAcceso[]) ?? []);
        setError(null);
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [id]);

  const empleadoMock = useMemo(
    () => (empleadoBD ? bdToEmpleadoMock(empleadoBD) : null),
    [empleadoBD],
  );
  // La ficha "vieja" (mocks legacy) se sigue consultando para los tabs que aún
  // no se han migrado a BD. Si el id no coincide con un mock, devuelve null y
  // los tabs heredados muestran un fallback.
  const ficha = useMemo(
    () => (id ? getFichaEmpleado(empresaActual.id, id) : null),
    [id, empresaActual.id],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !empleadoBD || !empleadoMock || !datosPersonales) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-muted-foreground">{error ?? "Empleado no encontrado."}</p>
        <button
          onClick={() => router.push("/rrhh/empleados")}
          className="text-sm text-primary hover:underline"
        >
          Volver al listado
        </button>
      </div>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case "perfil":
        // Mismo formulario que el empleado ve en Mi Panel → Perfil, pero en
        // modo editable. El guardado va contra el profile vinculado al
        // empleado vía la admin action `guardarPerfilEmpleado`.
        return (
          <div className="p-4 md:p-6 max-w-3xl mx-auto">
            <DatosPersonalesForm
              initial={datosPersonales!}
              targetEmpleadoId={empleadoBD!.id}
            />
          </div>
        );
      case "fichajes":
        return <div className="p-6"><FichajesTab empleado={empleadoMock!} /></div>;
      case "horarios":
        return ficha
          ? <div className="p-6"><HorariosTab empleado={empleadoMock!} ficha={ficha} /></div>
          : <SubmoduloPorEmpleadoPlaceholder modulo="Horarios" path="/rrhh/horarios" empleado={empleadoMock!} />;
      case "solicitudes":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Solicitudes" path="/rrhh/solicitudes" empleado={empleadoMock!} />;
      case "firmas":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Firmas" path="/rrhh/firmas" empleado={empleadoMock!} />;
      case "calendarios":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Calendarios" path="/rrhh/calendarios" empleado={empleadoMock!} />;
      case "reclutamiento":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Reclutamiento" path="/rrhh/reclutamiento" empleado={empleadoMock!} />;
      case "boarding":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Boarding" path="/rrhh/boarding" empleado={empleadoMock!} />;
      case "bonus":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Bonus" path="/rrhh/bonus" empleado={empleadoMock!} />;
      case "points":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Points" path="/rrhh/points" empleado={empleadoMock!} />;
      case "pagos":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Pagos" path="/rrhh/pagos" empleado={empleadoMock!} />;
      case "formacion":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Formación" path="/rrhh/formacion" empleado={empleadoMock!} />;
      case "encuestas":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Encuestas" path="/rrhh/encuestas" empleado={empleadoMock!} />;
      case "cuestionarios":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Cuestionarios" path="/rrhh/cuestionarios" empleado={empleadoMock!} />;
    }
  }

  return (
    <div className="flex flex-col h-full">
      <FichaEmpleadoHeader
        empleado={empleadoMock}
        onBack={() => router.push("/rrhh/empleados")}
        onSave={() => { /* el form gestiona su propio guardado */ }}
      />

      {empresasAcceso.length > 0 && (
        <div className="border-b bg-card px-6 py-2.5 flex items-center gap-2 flex-wrap shrink-0">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">
            Empresas:
          </span>
          {empresasAcceso.map((e) => (
            <span
              key={e.id}
              className={cn(
                "text-xs px-2 py-0.5 rounded font-medium",
                e.esPrincipal
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-foreground"
              )}
              title={e.esPrincipal ? "Empresa principal" : "Acceso secundario"}
            >
              {e.nombre}
              {e.esPrincipal && (
                <span className="ml-1.5 text-[9px] uppercase tracking-wider opacity-70">
                  Principal
                </span>
              )}
            </span>
          ))}
        </div>
      )}

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
