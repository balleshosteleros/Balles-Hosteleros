"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getEmpleadosPorEmpresa, ESTADOS_LABEL, ESTADOS_COLOR, type EstadoEmpleado } from "@/features/rrhh/data/rrhh";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { empleadosIO } from "@/features/rrhh/io/empleados.io";

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

export function EmpleadosView() {
  const { empresaActual } = useEmpresa();
  const router = useRouter();
  const empleados = useMemo(() => getEmpleadosPorEmpresa(empresaActual.id), [empresaActual.id]);

  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const departamentosUsados = useMemo(
    () => [...new Set(empleados.map((e) => e.departamento))].sort(),
    [empleados],
  );

  const acceso = (e: typeof empleados[number], campo: string): unknown => {
    if (campo === "estado") return ESTADOS_LABEL[e.estado];
    if (campo === "departamento") return e.departamento;
    if (campo === "horarioTipo") return e.horarioTipo;
    if (campo === "horasHoy") return e.horasHoy;
    if (campo === "fichajes") return e.fichajes;
    if (campo === "nombre") return `${e.nombre} ${e.apellidos}`;
    return (e as Record<string, unknown>)[campo];
  };

  const filtrados = useMemo(() => {
    let lista = empleados.filter((e) => {
      const texto = `${e.nombre} ${e.apellidos} ${e.departamento} ${e.emailEmpresa}`.toLowerCase();
      if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;
      return true;
    });
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [empleados, busqueda, filtros, orden]);

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

  return (
    <div className="space-y-4 p-4 md:p-6">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar empleado..."
        onNuevo={() => router.push("/rrhh/empleados/nuevo")}
        campos={[
          {
            campo: "estado",
            label: "Estado",
            tipo: "lista",
            opciones: (Object.keys(ESTADOS_LABEL) as EstadoEmpleado[]).map((k) => ESTADOS_LABEL[k]),
          },
          {
            campo: "departamento",
            label: "Departamento",
            tipo: "lista",
            opciones: departamentosUsados,
          },
          { campo: "horarioTipo", label: "Tipo horario", tipo: "lista", opciones: [...new Set(empleados.map(e => e.horarioTipo))] },
          { campo: "horasHoy", label: "Horas hoy", tipo: "numero" },
          { campo: "fichajes", label: "Fichajes", tipo: "numero" },
        ]}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        ordenOpciones={[
          { campo: "nombre", label: "Nombre" },
          { campo: "departamento", label: "Departamento" },
          { campo: "horasHoy", label: "Horas hoy" },
          { campo: "fichajes", label: "Fichajes" },
        ]}
        orden={orden}
        onOrdenChange={setOrden}
        columnas={[
          { campo: "empleado", label: "Empleado" },
          { campo: "estado", label: "Estado" },
          { campo: "horario", label: "Horario" },
          { campo: "horasHoy", label: "Horas hoy" },
          { campo: "departamento", label: "Departamento" },
          { campo: "telefono", label: "Teléfono" },
          { campo: "fichajes", label: "Fichajes" },
          { campo: "emailEmpresa", label: "Email empresa" },
          { campo: "emailPersonal", label: "Email personal" },
          { campo: "validador", label: "Validador fichajes" },
        ]}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        extraDerecha={
          <IOActions
            config={empleadosIO}
            context={{ empresaId: empresaActual.id }}
            onSuccess={() => window.location.reload()}
          />
        }
      />


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
