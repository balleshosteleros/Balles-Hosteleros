import { useMemo } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { getVacacionesPorEmpresa, getFestivosPorEmpresa, getBajasPorEmpresa, getJustificadasPorEmpresa } from "@/data/calendarios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Palmtree, PartyPopper, HeartPulse, FileCheck } from "lucide-react";
import { CalendarioLaboral } from "@/components/calendarios/CalendarioLaboral";
import { CalendarioAusencias } from "@/components/calendarios/CalendarioAusencias";

export default function RRHHCalendarios() {
  const { empresaActual } = useEmpresa();

  const vacaciones = useMemo(() =>
    getVacacionesPorEmpresa(empresaActual.id).map(v => ({
      id: v.id, empleadoNombre: v.empleadoNombre, departamento: v.departamento,
      fechaInicio: v.fechaInicio, fechaFin: v.fechaFin, estado: v.estado,
      detalle: `${v.dias} días`,
    })),
    [empresaActual.id]
  );

  const festivos = useMemo(() =>
    getFestivosPorEmpresa(empresaActual.id).map(f => ({
      id: f.id, empleadoNombre: f.nombre, departamento: f.centro,
      fechaInicio: f.fecha, estado: f.tipo,
    })),
    [empresaActual.id]
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

        <TabsContent value="vacaciones">
          <CalendarioAusencias
            modalidad="vacaciones"
            titulo="Vacaciones"
            items={vacaciones}
            botonNuevo="Registrar vacaciones"
            columnaExtra={{ header: "Días", render: item => <span className="font-semibold">{item.detalle}</span> }}
          />
        </TabsContent>

        <TabsContent value="festivos">
          <CalendarioAusencias
            modalidad="festivos"
            titulo="Festivos"
            items={festivos}
            botonNuevo="Añadir festivo"
          />
        </TabsContent>

        <TabsContent value="bajas">
          <CalendarioAusencias
            modalidad="bajas"
            titulo="Bajas médicas"
            items={bajas}
            botonNuevo="Registrar baja"
            columnaExtra={{ header: "Motivo", render: item => <span className="text-muted-foreground">{item.detalle || "—"}</span> }}
          />
        </TabsContent>

        <TabsContent value="justificadas">
          <CalendarioAusencias
            modalidad="justificadas"
            titulo="Justificadas"
            items={justificadas}
            botonNuevo="Registrar ausencia"
            columnaExtra={{ header: "Tipo", render: item => <span>{item.tipo || "—"}</span> }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
