"use client";

import { Badge } from "@/components/ui/badge";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays } from "lucide-react";
import type { EmpleadoHorarioActual } from "@/features/rrhh/actions/empleados-actions";
import type { SolicitudPersonal } from "@/features/mi-panel/types";
import { ESTADO_COLOR, ESTADO_LABEL, SUBTIPO_LABEL } from "@/features/mi-panel/types";
import { HorarioSemanaPanel } from "@/features/mi-panel/components/HorarioSemanaPanel";

function EmptyState({ icon: Icon, texto }: { icon: React.ElementType; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

/** dd/mm/aaaa a partir de una fecha ISO. */
function formatearFecha(iso: string): string {
  if (!iso || iso === "—") return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/* ─── SOLICITUDES ─── */
export function SolicitudesEmpleadoTab({ solicitudes }: { solicitudes: SolicitudPersonal[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Solicitudes del empleado</h3>
        <Badge variant="outline">{solicitudes.length} registros</Badge>
      </div>
      {solicitudes.length > 0 ? (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Validada por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {solicitudes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase text-muted-foreground">
                        {s.tipo === "ausencia" ? "Ausencia" : "Trabajo"}
                      </span>
                      <span className="font-medium">{SUBTIPO_LABEL[s.subtipo]}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatearFecha(s.fechaInicio)}
                    {s.fechaFin && s.fechaFin !== s.fechaInicio ? ` - ${formatearFecha(s.fechaFin)}` : ""}
                    {s.horas != null ? ` · ${s.horas}h` : ""}
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {s.motivo || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ESTADO_COLOR[s.estado]}>
                      {ESTADO_LABEL[s.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className={s.revisadoPor ? "text-sm text-foreground" : "text-sm text-muted-foreground"}>
                      {s.revisadoPor ?? "—"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={CalendarDays} texto="No hay solicitudes reales registradas para este empleado." />
      )}
    </div>
  );
}

/* ─── HORARIO ─── */
/**
 * Su semana de horario, la misma que él tiene delante en su panel y en el
 * móvil, con el patrón que se le asignó como encabezado.
 */
export function HorariosTab({
  empleadoId,
  horario,
}: {
  empleadoId: string;
  horario?: EmpleadoHorarioActual | null;
}) {
  const { empresaActual } = useEmpresa();
  const tz = empresaActual.zonaHoraria;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-lg border bg-card p-4">
        {horario ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              Patrón asignado: <span className="font-semibold text-foreground">{horario.nombre}</span>
            </span>
            <span className="text-muted-foreground">
              Tipo: <span className="font-semibold text-foreground">{horario.tipo}</span>
            </span>
            <span className="text-muted-foreground">
              Desde:{" "}
              <span className="font-semibold text-foreground">
                {formatFechaHoraEnZona(horario.asignadoAt ?? "", tz, { year: undefined }) || "—"}
              </span>
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No tiene un patrón asignado. Aun así, abajo se ve lo que tenga planificado o
            asignado día a día.
          </p>
        )}
      </div>

      <HorarioSemanaPanel empleadoId={empleadoId} />
    </div>
  );
}
