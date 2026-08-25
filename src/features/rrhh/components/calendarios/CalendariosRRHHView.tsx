"use client";

import { useEffect, useMemo, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  listAusenciasEmpresa,
  type AusenciaCalendario,
} from "@/features/rrhh/actions/calendario-ausencias-actions";
import { useFestivos } from "@/features/rrhh/hooks/useFestivos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palmtree, PartyPopper, HeartPulse, FileCheck, Loader2 } from "lucide-react";
import { CalendarioAusencias } from "@/features/rrhh/components/calendarios/CalendarioAusencias";
import { RegistrarAusenciaDialog } from "@/features/rrhh/components/calendarios/RegistrarAusenciaDialog";
import type { SolicitudSubtipoAusencia } from "@/features/mi-panel/types";

const AMBITO_LABEL: Record<string, string> = {
  nacional: "Nacional",
  autonomico: "Autonómico",
  local: "Local",
};

export function CalendariosRRHHView() {
  const { empresaActual } = useEmpresa();
  // Año natural en curso: festivos reales de la BD (generados automáticamente).
  const [anio] = useState<number>(() => new Date().getFullYear());
  const { festivos: festivosBD } = useFestivos(anio);

  // Ausencias reales de la plantilla (aprobadas y pendientes). Antes esta
  // pantalla enseñaba nombres y fechas inventados.
  const [ausencias, setAusencias] = useState<{
    vacaciones: AusenciaCalendario[];
    bajas: AusenciaCalendario[];
    permisos: AusenciaCalendario[];
  }>({ vacaciones: [], bajas: [], permisos: [] });
  const [cargandoAusencias, setCargandoAusencias] = useState(true);
  // Tipo de ausencia que RRHH está registrando a mano, o null si no hay diálogo.
  const [registrando, setRegistrando] = useState<SolicitudSubtipoAusencia | null>(null);
  // Cambia al guardar para forzar la recarga del calendario.
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargandoAusencias(true);
    Promise.all([
      listAusenciasEmpresa(empresaActual.id, "vacaciones", anio),
      listAusenciasEmpresa(empresaActual.id, "baja_medica", anio),
      listAusenciasEmpresa(empresaActual.id, "permiso", anio),
    ]).then(([vac, baj, per]) => {
      if (!activo) return;
      setAusencias({
        vacaciones: vac.data,
        bajas: baj.data,
        permisos: per.data,
      });
      setCargandoAusencias(false);
    });
    return () => {
      activo = false;
    };
  }, [empresaActual.id, anio, recarga]);

  const vacaciones = useMemo(() =>
    ausencias.vacaciones.map(v => ({
      id: v.id, empleadoNombre: v.empleadoNombre, departamento: v.departamento,
      fechaInicio: v.fechaInicio, fechaFin: v.fechaFin ?? undefined, estado: v.estado,
      detalle: v.dias != null ? `${v.dias} días` : "—",
    })),
    [ausencias.vacaciones]
  );

  const festivos = useMemo(() =>
    festivosBD
      .filter(f => f.fecha.startsWith(String(anio)))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map(f => ({
        id: f.id, empleadoNombre: f.nombre, departamento: AMBITO_LABEL[f.ambito] ?? f.ambito,
        fechaInicio: f.fecha, estado: f.ambito,
      })),
    [festivosBD, anio]
  );

  const bajas = useMemo(() =>
    ausencias.bajas.map(b => ({
      id: b.id, empleadoNombre: b.empleadoNombre, departamento: b.departamento,
      fechaInicio: b.fechaInicio, fechaFin: b.fechaFin ?? undefined, estado: b.estado,
      // Sin fecha de alta prevista la baja sigue abierta: se dice, no se deja en blanco.
      detalle: b.motivo ?? (b.fechaFin ? undefined : "Sin fecha de alta prevista"),
    })),
    [ausencias.bajas]
  );

  const justificadas = useMemo(() =>
    ausencias.permisos.map(p => ({
      id: p.id, empleadoNombre: p.empleadoNombre, departamento: p.departamento,
      fechaInicio: p.fechaInicio, fechaFin: p.fechaFin ?? undefined, estado: p.estado,
      detalle: p.motivo ?? undefined,
      tipo: p.dias != null ? `${p.dias} ${p.dias === 1 ? "día" : "días"}` : "—",
    })),
    [ausencias.permisos]
  );

  // Un calendario vacío puede ser "aún cargando" o "no hay nada este año", y
  // sin decirlo parece que la pantalla está rota.
  function avisoAusencias(total: number, quePlural: string) {
    if (cargandoAusencias) {
      return (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
        </p>
      );
    }
    if (total > 0) return null;
    return (
      <p className="text-sm text-muted-foreground">
        No hay {quePlural} en {anio}.
      </p>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="vacaciones" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="vacaciones" className="gap-1"><Palmtree className="h-4 w-4" />Vacaciones</TabsTrigger>
          <TabsTrigger value="bajas" className="gap-1"><HeartPulse className="h-4 w-4" />Bajas médicas</TabsTrigger>
          <TabsTrigger value="justificadas" className="gap-1"><FileCheck className="h-4 w-4" />Permisos</TabsTrigger>
          <TabsTrigger value="festivos" className="gap-1"><PartyPopper className="h-4 w-4" />Festivos</TabsTrigger>
        </TabsList>

        <TabsContent value="vacaciones" className="space-y-3">
          {avisoAusencias(vacaciones.length, "vacaciones registradas")}
          <CalendarioAusencias
            empresaId={empresaActual.id}
            modalidad="vacaciones"
            titulo="Vacaciones"
            items={vacaciones}
            botonNuevo="Registrar vacaciones"
            onNuevo={() => setRegistrando("vacaciones")}
            columnaExtra={{ header: "Días", render: item => <span className="font-semibold">{item.detalle}</span> }}
          />
        </TabsContent>

        <TabsContent value="bajas" className="space-y-3">
          {avisoAusencias(bajas.length, "bajas médicas registradas")}
          <CalendarioAusencias
            empresaId={empresaActual.id}
            modalidad="bajas"
            titulo="Bajas médicas"
            items={bajas}
            botonNuevo="Registrar baja"
            onNuevo={() => setRegistrando("baja_medica")}
            columnaExtra={{ header: "Motivo", render: item => <span className="text-muted-foreground">{item.detalle || "—"}</span> }}
          />
        </TabsContent>

        <TabsContent value="justificadas" className="space-y-3">
          {avisoAusencias(justificadas.length, "permisos registrados")}
          <CalendarioAusencias
            empresaId={empresaActual.id}
            modalidad="justificadas"
            titulo="Permisos"
            items={justificadas}
            botonNuevo="Registrar permiso"
            onNuevo={() => setRegistrando("permiso")}
            columnaExtra={{ header: "Días", render: item => <span className="font-semibold">{item.tipo || "—"}</span> }}
          />
        </TabsContent>

        <TabsContent value="festivos">
          {/* Los festivos se generan solos según la comunidad autónoma. */}
          <CalendarioAusencias
            empresaId={empresaActual.id}
            modalidad="festivos"
            titulo="Festivos"
            items={festivos}
            botonNuevo="Registrar festivo"
          />
        </TabsContent>
      </Tabs>

      <RegistrarAusenciaDialog
        subtipo={registrando}
        onOpenChange={(abierto) => { if (!abierto) setRegistrando(null); }}
        onRegistrada={() => { setRegistrando(null); setRecarga((n) => n + 1); }}
      />
    </div>
  );
}
