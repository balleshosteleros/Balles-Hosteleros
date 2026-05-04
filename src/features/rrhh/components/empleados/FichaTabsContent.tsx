import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Clock, CalendarDays, BarChart3, FileSignature, FolderOpen, Star, Plus, ChevronRight } from "lucide-react";
import type { FichaEmpleado } from "@/features/rrhh/data/empleados-ficha";
import type { Empleado } from "@/features/rrhh/data/rrhh";

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
function formatearFecha(iso: string): string {
  if (!iso || iso === "—") return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

interface HistorialHorario {
  desde: string;
  hasta: string | null;
  tipo: string;
  semanal: string;
}

function generarHistorialHorarios(empleado: Empleado, ficha: FichaEmpleado): HistorialHorario[] {
  const fechaAlta = ficha.datosLaborales.fechaAlta;
  if (!fechaAlta || fechaAlta === "—") return [];

  const inicio = new Date(fechaAlta);
  const hoy = new Date();
  if (isNaN(inicio.getTime()) || inicio > hoy) return [];

  let semilla = 0;
  for (let i = 0; i < empleado.id.length; i++) semilla = (semilla * 31 + empleado.id.charCodeAt(i)) >>> 0;
  const tramos = (semilla % 3) + 1;

  const tiposDisponibles = ["Mañana", "Tarde", "Noche", "Partido", "Media jornada"];
  const semanalesDisponibles = ["20h", "30h", "35h", "40h"];

  const totalDias = Math.max(1, Math.floor((hoy.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
  const cortes: number[] = [];
  for (let i = 1; i < tramos; i++) {
    const proporcion = i / tramos;
    const variacion = ((semilla >> (i * 3)) & 0xff) / 255 - 0.5;
    cortes.push(Math.floor(totalDias * (proporcion + variacion * 0.15)));
  }
  cortes.sort((a, b) => a - b);

  const historial: HistorialHorario[] = [];
  let cursor = new Date(inicio);

  for (let i = 0; i < tramos; i++) {
    const desde = new Date(cursor);
    let hasta: Date | null;
    if (i === tramos - 1) {
      hasta = null;
    } else {
      hasta = new Date(inicio);
      hasta.setDate(inicio.getDate() + cortes[i]);
      cursor = new Date(hasta);
      cursor.setDate(cursor.getDate() + 1);
    }

    const esActual = i === tramos - 1;
    const tipo = esActual ? empleado.horarioTipo : tiposDisponibles[(semilla >> (i * 5)) % tiposDisponibles.length];
    const semanal = esActual ? empleado.horarioSemanal : semanalesDisponibles[(semilla >> (i * 7)) % semanalesDisponibles.length];

    historial.push({
      desde: desde.toISOString().slice(0, 10),
      hasta: hasta ? hasta.toISOString().slice(0, 10) : null,
      tipo,
      semanal,
    });
  }

  return historial.reverse();
}

export function HorariosTab({ empleado, ficha }: { empleado: Empleado; ficha: FichaEmpleado }) {
  const [abierto, setAbierto] = useState(false);
  const historial = generarHistorialHorarios(empleado, ficha);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Horarios del empleado</h3>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Horario base: <span className="font-semibold text-foreground">{empleado.horarioTipo}</span></p>
        <p className="text-sm text-muted-foreground mt-1">Jornada semanal: <span className="font-semibold text-foreground">{empleado.horarioSemanal}</span></p>
      </div>

      <Collapsible open={abierto} onOpenChange={setAbierto}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${abierto ? "rotate-90" : ""}`} />
          <span>Historial de horarios{historial.length > 0 ? ` (${historial.length})` : ""}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {historial.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-5">Sin historial registrado.</p>
          ) : (
            <ul className="pl-5 space-y-1">
              {historial.map((h, i) => (
                <li key={i} className="flex items-baseline gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {formatearFecha(h.desde)} → {h.hasta ? formatearFecha(h.hasta) : "actual"}
                  </span>
                  <span className="text-foreground">·</span>
                  <span className="text-foreground">{h.tipo}</span>
                  <span>({h.semanal})</span>
                </li>
              ))}
            </ul>
          )}
        </CollapsibleContent>
      </Collapsible>
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
