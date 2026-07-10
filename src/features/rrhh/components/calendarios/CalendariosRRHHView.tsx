"use client";

import { useMemo, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getVacacionesPorEmpresa, getBajasPorEmpresa, getJustificadasPorEmpresa } from "@/features/rrhh/data/calendarios";
import { useFestivos } from "@/features/rrhh/hooks/useFestivos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Palmtree, PartyPopper, HeartPulse, FileCheck } from "lucide-react";
import { CalendarioLaboral } from "@/features/rrhh/components/calendarios/CalendarioLaboral";
import { CalendarioAusencias } from "@/features/rrhh/components/calendarios/CalendarioAusencias";
import { CalendariosVacacionesPanel } from "@/features/rrhh/components/calendarios/CalendariosVacacionesPanel";

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

  const vacaciones = useMemo(() =>
    getVacacionesPorEmpresa(empresaActual.id).map(v => ({
      id: v.id, empleadoNombre: v.empleadoNombre, departamento: v.departamento,
      fechaInicio: v.fechaInicio, fechaFin: v.fechaFin, estado: v.estado,
      detalle: `${v.dias} días`,
    })),
    [empresaActual.id]
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
    getBajasPorEmpresa(empresaActual.id).map(b => ({
      id: b.id, empleadoNombre: b.empleadoNombre, departamento: b.departamento,
      fechaInicio: b.fechaInicio, fechaFin: b.fechaFin, estado: b.estado,
      detalle: b.motivo,
    })),
    [empresaActual.id]
  );

  const justificadas = useMemo(() =>
    getJustificadasPorEmpresa(empresaActual.id).map(j => ({
      id: j.id, empleadoNombre: j.empleadoNombre, departamento: j.departamento,
      fechaInicio: j.fecha, fechaFin: j.fechaFin, estado: j.estado,
      detalle: j.observaciones, tipo: j.tipo,
    })),
    [empresaActual.id]
  );

  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="laboral" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="laboral" className="gap-1"><CalendarDays className="h-4 w-4" />Laboral</TabsTrigger>
          <TabsTrigger value="vacaciones" className="gap-1"><Palmtree className="h-4 w-4" />Vacaciones</TabsTrigger>
          <TabsTrigger value="festivos" className="gap-1"><PartyPopper className="h-4 w-4" />Festivos</TabsTrigger>
          <TabsTrigger value="bajas" className="gap-1"><HeartPulse className="h-4 w-4" />Bajas médicas</TabsTrigger>
          <TabsTrigger value="justificadas" className="gap-1"><FileCheck className="h-4 w-4" />Justificadas</TabsTrigger>
        </TabsList>

        <TabsContent value="laboral">
          <CalendarioLaboral empresaId={empresaActual.id} />
        </TabsContent>

        <TabsContent value="vacaciones" className="space-y-8">
          <CalendariosVacacionesPanel empresaId={empresaActual.id} />

          <div className="space-y-3 border-t pt-6">
            <div>
              <h3 className="text-sm font-semibold">Vacaciones solicitadas</h3>
              <p className="text-sm text-muted-foreground">
                Vacaciones registradas de los empleados.
              </p>
            </div>
            <CalendarioAusencias
              empresaId={empresaActual.id}
              modalidad="vacaciones"
              titulo="Vacaciones"
              items={vacaciones}
              botonNuevo="Registrar vacaciones"
              columnaExtra={{ header: "Días", render: item => <span className="font-semibold">{item.detalle}</span> }}
            />
          </div>
        </TabsContent>

        <TabsContent value="festivos">
          <CalendarioAusencias
            empresaId={empresaActual.id}
            modalidad="festivos"
            titulo="Festivos"
            items={festivos}
            botonNuevo="Registrar festivo"
          />
        </TabsContent>

        <TabsContent value="bajas">
          <CalendarioAusencias
            empresaId={empresaActual.id}
            modalidad="bajas"
            titulo="Bajas médicas"
            items={bajas}
            botonNuevo="Registrar baja"
            columnaExtra={{ header: "Motivo", render: item => <span className="text-muted-foreground">{item.detalle || "—"}</span> }}
          />
        </TabsContent>

        <TabsContent value="justificadas">
          <CalendarioAusencias
            empresaId={empresaActual.id}
            modalidad="justificadas"
            titulo="Justificadas"
            items={justificadas}
            botonNuevo="Registrar justificada"
            columnaExtra={{ header: "Tipo", render: item => <span>{item.tipo || "—"}</span> }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
