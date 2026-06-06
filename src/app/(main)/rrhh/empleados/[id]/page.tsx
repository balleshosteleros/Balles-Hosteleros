"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { FichaEmpleadoHeader } from "@/features/rrhh/components/empleados/FichaEmpleadoHeader";
import {
  FichajesTab, HorariosTab, SolicitudesEmpleadoTab,
} from "@/features/rrhh/components/empleados/FichaTabsContent";
import {
  GestionEmpleadoCard,
  type GestionEmpleadoCardHandle,
} from "@/features/rrhh/components/empleados/GestionEmpleadoCard";
import { SubmoduloPorEmpleadoPlaceholder } from "@/features/rrhh/components/empleados/SubmoduloPorEmpleadoPlaceholder";
import { FirmasEmpleadoTab } from "@/features/rrhh/components/empleados/FirmasEmpleadoTab";
import { InspeccionesEmpleadoTab } from "@/features/rrhh/components/empleados/InspeccionesEmpleadoTab";
import { CuestionariosEmpleadoTab } from "@/features/rrhh/components/empleados/CuestionariosEmpleadoTab";
import { ValidadoresEmpleadoCard } from "@/features/rrhh/components/empleados/ValidadoresEmpleadoCard";
import {
  DatosPersonalesForm,
  type DatosPersonalesFormHandle,
} from "@/features/mi-panel/components/DatosPersonalesForm";
import { Button } from "@/components/ui/button";
import type { DatosPersonalesCompletos } from "@/features/mi-panel/actions/datos-personales-actions";
import {
  getEmpleadoConPerfil,
  getEmpleadoHorarioActual,
  listSolicitudesEmpleado,
  type EmpleadoHorarioActual,
} from "@/features/rrhh/actions/empleados-actions";
import {
  listFichajesEmpleado,
  type FichajeEmpleadoResumen,
} from "@/features/rrhh/actions/fichajes-actions";
import type { SolicitudPersonal } from "@/features/mi-panel/types";
import type { EmpleadoUI } from "@/features/rrhh/components/empleados/empleado-ui";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { cn } from "@/shared/lib/utils";
import {
  User,
  Fingerprint, Inbox, FileSignature, Calendar, Timer,
  UserRoundSearch, UserCheck, Gift, Trophy, HandCoins,
  GraduationCap, ClipboardList, FileQuestion, FileSearch, Building2,
  Save, Loader2,
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
  { id: "inspecciones",    label: "Inspecciones",   icon: FileSearch        },
] as const;

type TopTab = typeof TOP_TABS[number]["id"];

// Forma del row real de Supabase (joineado con departamentos).
type EmpleadoBD = {
  id: string;
  empresa_id: string;
  nombre: string;
  apellidos: string | null;
  email_personal: string | null;
  email_empresa: string | null;
  telefono: string | null;
  user_id: string;
  departamento_id: string | null;
  puesto: string | null;
  local_id: string | null;
  permite_teletrabajo: boolean | null;
  fecha_baja: string | null;
  estado: string;
  validador_trabajo_id: string | null;
  validador_ausencias_id: string | null;
  departamentos?: { nombre: string } | null;
};

/**
 * Convierte el empleado real de BD al shape UI usado por la ficha.
 * Los campos que todavía dependen de futuros bloques se dejan explícitamente
 * como no disponibles en vez de fabricar estados mock.
 */
function bdToEmpleadoUI(emp: EmpleadoBD): EmpleadoUI {
  return {
    id: emp.id,
    nombre: emp.nombre ?? "",
    apellidos: emp.apellidos ?? "",
    estado: emp.estado === "Activo" ? "Activo" : "Desactivado",
    horarioTipo: "—",
    horarioSemanal: "—",
    horasHoy: "—",
    departamento: emp.departamentos?.nombre ?? "—",
    areas: [],
    telefono: emp.telefono ?? "—",
    fichajes: 0,
    emailEmpresa: emp.email_empresa ?? "",
    emailPersonal: emp.email_personal ?? "",
    validadorTrabajo: "—",
    validadorAusencias: "—",
  };
}

export default function FichaEmpleadoPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [empleadoBD, setEmpleadoBD] = useState<EmpleadoBD | null>(null);
  const [datosPersonales, setDatosPersonales] = useState<DatosPersonalesCompletos | null>(null);
  const [empresasAcceso, setEmpresasAcceso] = useState<EmpresaAcceso[]>([]);
  const [fichajes, setFichajes] = useState<FichajeEmpleadoResumen[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudPersonal[]>([]);
  const [horarioActual, setHorarioActual] = useState<EmpleadoHorarioActual | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TopTab>("perfil");
  const [savingPerfil, setSavingPerfil] = useState(false);
  const datosRef = useRef<DatosPersonalesFormHandle>(null);
  const gestionRef = useRef<GestionEmpleadoCardHandle>(null);

  const cargarFicha = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [res, fichajesRes, solicitudesRes, horarioRes] = await Promise.all([
      getEmpleadoConPerfil(id),
      listFichajesEmpleado(id),
      listSolicitudesEmpleado(id),
      getEmpleadoHorarioActual(id),
    ]);

    if (!res.ok) {
      setError(res.error ?? "Empleado no encontrado");
      setEmpleadoBD(null);
      setDatosPersonales(null);
      setEmpresasAcceso([]);
      setFichajes([]);
      setSolicitudes([]);
      setHorarioActual(null);
    } else {
      setEmpleadoBD(res.empleado as EmpleadoBD);
      setDatosPersonales(res.datosPersonales ?? null);
      setEmpresasAcceso((res.empresasAcceso as EmpresaAcceso[]) ?? []);
      setFichajes(fichajesRes.ok ? fichajesRes.data : []);
      setSolicitudes(solicitudesRes.ok ? solicitudesRes.data : []);
      setHorarioActual(horarioRes.ok ? horarioRes.data : null);
      setError(null);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void cargarFicha();
  }, [cargarFicha]);

  const empleadoUI = useMemo(
    () => (empleadoBD ? bdToEmpleadoUI(empleadoBD) : null),
    [empleadoBD],
  );

  // Un único guardado para todo el perfil: datos personales + gestión laboral +
  // accesos multiempresa. El recuadro rojo (estado/baja) tiene su propio botón
  // con reconfirmación y NO se incluye aquí.
  const guardarPerfilCompleto = useCallback(async () => {
    if (savingPerfil) return;
    setSavingPerfil(true);
    try {
      const [rDatos, rGestion] = await Promise.all([
        datosRef.current?.save() ?? Promise.resolve({ ok: true as const }),
        gestionRef.current?.saveGeneral() ?? Promise.resolve({ ok: true as const }),
      ]);
      const errMsg = !rDatos.ok ? rDatos.error : !rGestion.ok ? rGestion.error : null;
      if (errMsg) {
        toast.error(errMsg);
        return;
      }
      toast.success("Cambios guardados");
      await cargarFicha();
    } finally {
      setSavingPerfil(false);
    }
  }, [savingPerfil, cargarFicha]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !empleadoBD || !empleadoUI || !datosPersonales) {
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

  const empleado = empleadoUI;
  const empleadoRegistro = empleadoBD;
  const datosPerfil = datosPersonales;

  function renderTabContent() {
    switch (activeTab) {
      case "perfil":
        // Mismo formulario que el empleado ve en Mi Panel → Perfil, pero en
        // modo editable. El guardado va contra el profile vinculado al
        // empleado vía la admin action `guardarPerfilEmpleado`.
        return (
          <div className="relative p-4 md:p-6">
            <div className="sticky top-4 z-20 flex justify-end pointer-events-none">
              <Button
                onClick={guardarPerfilCompleto}
                size="lg"
                className="gap-2 pointer-events-auto shadow-md"
                disabled={savingPerfil}
              >
                {savingPerfil ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</>
                ) : (
                  <><Save className="h-4 w-4" />Guardar</>
                )}
              </Button>
            </div>
            <div className="max-w-3xl mx-auto space-y-6 -mt-14">
            <DatosPersonalesForm
              ref={datosRef}
              hideSaveButton
              initial={datosPerfil}
              targetEmpleadoId={empleadoRegistro.id}
            />
            <GestionEmpleadoCard
              ref={gestionRef}
              empleadoId={empleadoRegistro.id}
              initial={{
                empresaId: empleadoRegistro.empresa_id,
                empresasAcceso: empresasAcceso.map((e) => e.id),
                nombre: empleadoRegistro.nombre,
                apellidos: empleadoRegistro.apellidos,
                departamentoId: empleadoRegistro.departamento_id,
                puesto: empleadoRegistro.puesto,
                localId: empleadoRegistro.local_id,
                permiteTeletrabajo: empleadoRegistro.permite_teletrabajo,
                estado: empleadoRegistro.estado === "Activo" ? "Activo" : "Desactivado",
                fechaBaja: empleadoRegistro.fecha_baja,
              }}
              onUpdated={cargarFicha}
              onDeleted={() => router.push("/rrhh/empleados")}
            />
            </div>
          </div>
        );
      case "fichajes":
        return <div className="p-6"><FichajesTab empleado={empleado} fichajes={fichajes} /></div>;
      case "horarios":
        return <div className="p-6"><HorariosTab horario={horarioActual} /></div>;
      case "solicitudes":
        return (
          <div className="p-6 space-y-6">
            <ValidadoresEmpleadoCard
              empleadoId={empleadoRegistro.id}
              validadorTrabajoId={empleadoRegistro.validador_trabajo_id}
              validadorAusenciasId={empleadoRegistro.validador_ausencias_id}
              onSaved={cargarFicha}
            />
            <SolicitudesEmpleadoTab solicitudes={solicitudes} />
          </div>
        );
      case "firmas":
        return <FirmasEmpleadoTab empleadoId={empleadoRegistro.id} />;
      case "calendarios":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Calendarios" path="/rrhh/calendarios" empleado={empleado} />;
      case "reclutamiento":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Reclutamiento" path="/rrhh/reclutamiento" empleado={empleado} />;
      case "boarding":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Boarding" path="/rrhh/boarding" empleado={empleado} />;
      case "bonus":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Bonus" path="/rrhh/bonus" empleado={empleado} />;
      case "points":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Points" path="/rrhh/points" empleado={empleado} />;
      case "pagos":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Pagos" path="/rrhh/pagos" empleado={empleado} />;
      case "formacion":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Formación" path="/rrhh/formacion" empleado={empleado} />;
      case "encuestas":
        return <SubmoduloPorEmpleadoPlaceholder modulo="Encuestas" path="/rrhh/encuestas" empleado={empleado} />;
      case "cuestionarios":
        return <CuestionariosEmpleadoTab empleadoId={empleadoRegistro.id} />;
      case "inspecciones":
        return <InspeccionesEmpleadoTab empleadoId={empleadoRegistro.id} />;
    }
  }

  return (
    <div className="flex flex-col h-full">
      <FichaEmpleadoHeader
        empleado={empleado}
        onBack={() => router.push("/rrhh/empleados")}
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
              className="text-xs px-2 py-0.5 rounded font-medium bg-muted text-foreground"
            >
              {e.nombre}
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
