import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, CalendarDays, BarChart3, FileSignature, FolderOpen, Star, Plus } from "lucide-react";
import type { FichaEmpleado } from "@/features/rrhh/data/empleados-ficha";
import type { EmpleadoUI } from "@/features/rrhh/components/empleados/empleado-ui";
import type { FichajeEmpleadoResumen } from "@/features/rrhh/actions/fichajes-actions";
import type { EmpleadoHorarioActual } from "@/features/rrhh/actions/empleados-actions";
import type { SolicitudPersonal } from "@/features/mi-panel/types";
import { ESTADO_COLOR, ESTADO_LABEL, SUBTIPO_LABEL } from "@/features/mi-panel/types";

function EmptyState({ icon: Icon, texto }: { icon: React.ElementType; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

/* ─── FICHAJES ─── */
function formatearFechaHora(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function FichajesTab({
  fichajes = [],
}: {
  fichajes?: FichajeEmpleadoResumen[];
}) {
  return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Historial de fichajes</h3>
          <Badge variant="outline">{fichajes.length} registros</Badge>
        </div>
        {fichajes.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fichajes.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{formatearFecha(f.fecha)}</TableCell>
                    <TableCell>{formatearFechaHora(f.horaEntrada)}</TableCell>
                    <TableCell>{formatearFechaHora(f.horaSalida)}</TableCell>
                    <TableCell>{f.horasTotales.toFixed(2)}h</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline">{f.estado}</Badge>
                        {f.incidencia && (
                          <span className="text-xs text-amber-700 dark:text-amber-300">
                            {f.incidencia}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState icon={Clock} texto="No hay fichajes reales registrados para este empleado." />
        )}
      </div>
    );
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

/* ─── AUSENCIAS ─── */
export function AusenciasTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Ausencias y vacaciones</h3>
        <Button variant="outline" size="sm" className="gap-2"><Plus className="h-3 w-3" /> Registrar ausencia</Button>
      </div>
      <EmptyState icon={CalendarDays} texto="No hay ausencias registradas en el periodo actual." />
    </div>
  );
}

/* ─── ESTADÍSTICAS ─── */
export function EstadisticasTab({ empleado }: { empleado: EmpleadoUI }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Estadísticas del empleado</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Horas hoy", value: empleado.horasHoy },
          { label: "Horario semanal", value: empleado.horarioSemanal },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      <EmptyState icon={BarChart3} texto="Gráficos de evolución y asistencia próximamente." />
    </div>
  );
}

/* ─── CONTRATOS ─── */
export function ContratosTab({ ficha }: { ficha: FichaEmpleado }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Contratos</h3>
        <Button variant="outline" size="sm" className="gap-2"><Plus className="h-3 w-3" /> Añadir contrato</Button>
      </div>
      {ficha.contratos.length > 0 ? (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Tipo</TableHead><TableHead>Inicio</TableHead><TableHead>Fin</TableHead><TableHead>Estado</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {ficha.contratos.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.tipo}</TableCell>
                  <TableCell>{c.fechaInicio}</TableCell>
                  <TableCell>{c.fechaFin}</TableCell>
                  <TableCell><Badge variant={c.estado === "Vigente" ? "default" : "secondary"}>{c.estado}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : <EmptyState icon={FileSignature} texto="No hay contratos registrados." />}
    </div>
  );
}

/* ─── DOCUMENTOS ─── */
export function DocumentosTab({ ficha }: { ficha: FichaEmpleado }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Documentos</h3>
        <Button variant="outline" size="sm" className="gap-2"><Plus className="h-3 w-3" /> Subir documento</Button>
      </div>
      {ficha.documentos.length > 0 ? (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>Fecha</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {ficha.documentos.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.nombre}</TableCell>
                  <TableCell>{d.tipo}</TableCell>
                  <TableCell>{d.fecha}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : <EmptyState icon={FolderOpen} texto="No hay documentos subidos." />}
    </div>
  );
}

/* ─── HORARIOS ─── */
function formatearFecha(iso: string): string {
  if (!iso || iso === "—") return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function HorariosTab({
  horario,
}: {
  horario?: EmpleadoHorarioActual | null;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Horarios del empleado</h3>
      <div className="rounded-lg border bg-card p-4">
        {horario ? (
          <>
            <p className="text-sm text-muted-foreground">Patrón activo: <span className="font-semibold text-foreground">{horario.nombre}</span></p>
            <p className="text-sm text-muted-foreground mt-1">Tipo: <span className="font-semibold text-foreground">{horario.tipo}</span></p>
            <p className="text-sm text-muted-foreground mt-1">Asignado: <span className="font-semibold text-foreground">{formatearFechaHora(horario.asignadoAt)}</span></p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">No hay un patrón real asignado a este empleado.</p>
            <p className="text-xs text-muted-foreground mt-3">La configuración de horarios sigue pendiente del discovery específico de `TASK-003`.</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── EVALUACIONES ─── */
export function EvaluacionesTab({ ficha }: { ficha: FichaEmpleado }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Evaluaciones</h3>
        <Button variant="outline" size="sm" className="gap-2"><Plus className="h-3 w-3" /> Nueva evaluación</Button>
      </div>
      {ficha.evaluaciones.length > 0 ? (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Resultado</TableHead><TableHead>Evaluador</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {ficha.evaluaciones.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell>{ev.fecha}</TableCell>
                  <TableCell>{ev.tipo}</TableCell>
                  <TableCell><Badge variant="secondary">{ev.resultado}</Badge></TableCell>
                  <TableCell>{ev.evaluador}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : <EmptyState icon={Star} texto="No hay evaluaciones registradas." />}
    </div>
  );
}
