import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, CalendarDays, BarChart3, FileSignature, FolderOpen, Timer, Star, Plus } from "lucide-react";
import type { FichaEmpleado } from "@/data/empleados-ficha";
import type { Empleado } from "@/data/rrhh";

function EmptyState({ icon: Icon, texto }: { icon: React.ElementType; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

/* ─── FICHAJES ─── */
export function FichajesTab({ empleado }: { empleado: Empleado }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Historial de fichajes</h3>
      </div>
      {empleado.fichajes > 0 ? (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Fichajes registrados hoy: <span className="font-semibold text-foreground">{empleado.fichajes}</span></p>
          <p className="text-sm text-muted-foreground mt-1">Horas acumuladas hoy: <span className="font-semibold text-foreground">{empleado.horasHoy}</span></p>
        </div>
      ) : (
        <EmptyState icon={Clock} texto="No hay fichajes registrados para hoy." />
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
export function EstadisticasTab({ empleado }: { empleado: Empleado }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Estadísticas del empleado</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Horas hoy", value: empleado.horasHoy },
          { label: "Horario semanal", value: empleado.horarioSemanal },
          { label: "Fichajes hoy", value: String(empleado.fichajes) },
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
export function HorariosTab({ empleado }: { empleado: Empleado }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Horarios del empleado</h3>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Horario base: <span className="font-semibold text-foreground">{empleado.horarioTipo}</span></p>
        <p className="text-sm text-muted-foreground mt-1">Jornada semanal: <span className="font-semibold text-foreground">{empleado.horarioSemanal}</span></p>
      </div>
      <EmptyState icon={Timer} texto="Calendario de turnos asignados próximamente." />
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
