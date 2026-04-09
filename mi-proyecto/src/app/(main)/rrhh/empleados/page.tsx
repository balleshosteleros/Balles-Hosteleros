"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getEmpleadosPorEmpresa, ESTADOS_LABEL, ESTADOS_COLOR, type EstadoEmpleado } from "@/features/rrhh/data/rrhh";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, UserPlus, Users } from "lucide-react";

const AVATAR_COLORS = [
  "hsl(var(--primary))", "hsl(25 80% 55%)", "hsl(280 60% 55%)", "hsl(160 55% 42%)",
  "hsl(340 65% 50%)", "hsl(200 70% 50%)", "hsl(45 80% 48%)", "hsl(0 65% 50%)",
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function iniciales(nombre: string, apellidos: string) {
  return (nombre[0] + (apellidos[0] ?? "")).toUpperCase();
}

function FichajeBar({ fichajes }: { fichajes: number }) {
  const pct = Math.min(fichajes * 25, 100);
  const colors: Record<number, string> = { 0: "bg-muted", 1: "bg-amber-400", 2: "bg-sky-500", 3: "bg-emerald-500" };
  const colorClass = colors[Math.min(fichajes, 3)] ?? "bg-emerald-500";
  if (pct === 0) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function RRHHEmpleadosPage() {
  const { empresaActual } = useEmpresa();
  const router = useRouter();
  const empleados = useMemo(() => getEmpleadosPorEmpresa(empresaActual.id), [empresaActual.id]);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroDepartamento, setFiltroDepartamento] = useState("todos");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const filtrados = useMemo(() => {
    return empleados.filter((e) => {
      const texto = `${e.nombre} ${e.apellidos} ${e.departamento} ${e.emailEmpresa}`.toLowerCase();
      if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;
      if (filtroEstado !== "todos" && e.estado !== filtroEstado) return false;
      if (filtroDepartamento !== "todos" && e.departamento !== filtroDepartamento) return false;
      return true;
    });
  }, [empleados, busqueda, filtroEstado, filtroDepartamento]);

  const todosSeleccionados = filtrados.length > 0 && filtrados.every((e) => seleccionados.has(e.id));

  function toggleAll() {
    if (todosSeleccionados) setSeleccionados(new Set());
    else setSeleccionados(new Set(filtrados.map((e) => e.id)));
  }

  function toggleOne(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const departamentosUsados = [...new Set(empleados.map((e) => e.departamento))].sort();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Empleados</h1>
            <p className="text-sm text-muted-foreground">{filtrados.length} empleados en plantilla</p>
          </div>
        </div>
        <Button size="sm" className="gap-2"><UserPlus className="h-4 w-4" /> Añadir empleado</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empleado..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {(Object.keys(ESTADOS_LABEL) as EstadoEmpleado[]).map((k) => (
              <SelectItem key={k} value={k}>{ESTADOS_LABEL[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroDepartamento} onValueChange={setFiltroDepartamento}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {departamentosUsados.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="w-10 pl-4"><Checkbox checked={todosSeleccionados} onCheckedChange={toggleAll} /></TableHead>
              <TableHead className="min-w-[200px] text-xs font-medium text-muted-foreground">Empleado</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center">Estado</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center">Horario</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center">Horas hoy</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center">Departamento</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center">Teléfono</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center">Fichajes</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Email empresa</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center">Email personal</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Validador fichajes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((emp) => (
              <TableRow key={emp.id} className="cursor-pointer h-16 border-b last:border-0" onClick={() => router.push(`/rrhh/empleados/${emp.id}`)}>
                <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={seleccionados.has(emp.id)} onCheckedChange={() => toggleOne(emp.id)} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0 border-2 border-muted">
                      <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundColor: avatarColor(emp.id) }}>
                        {iniciales(emp.nombre, emp.apellidos)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground whitespace-nowrap text-sm">{emp.nombre} {emp.apellidos}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${ESTADOS_COLOR[emp.estado]}`} />
                    <span className="text-sm text-muted-foreground">{ESTADOS_LABEL[emp.estado]}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="leading-tight">
                    <span className="text-sm font-semibold text-foreground">{emp.horarioTipo}</span>
                    <p className="text-[11px] text-muted-foreground">({emp.horarioSemanal})</p>
                  </div>
                </TableCell>
                <TableCell className="text-center"><span className="text-sm text-muted-foreground">{emp.horasHoy}</span></TableCell>
                <TableCell className="text-center"><span className="text-sm font-bold text-foreground">{emp.departamento}</span></TableCell>
                <TableCell className="text-center"><span className="text-sm text-muted-foreground whitespace-nowrap">{emp.telefono}</span></TableCell>
                <TableCell className="text-center"><div className="flex justify-center"><FichajeBar fichajes={emp.fichajes} /></div></TableCell>
                <TableCell><span className="text-sm text-primary truncate max-w-[180px] block">{emp.emailEmpresa}</span></TableCell>
                <TableCell className="text-center"><span className="text-sm text-muted-foreground">{emp.emailPersonal}</span></TableCell>
                <TableCell><span className="text-sm text-foreground whitespace-nowrap">{emp.validadorFichajes}</span></TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  No se encontraron empleados con los filtros seleccionados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
