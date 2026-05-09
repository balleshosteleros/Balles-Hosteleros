"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { ESTADOS_LABEL, ESTADOS_COLOR, type EstadoEmpleado, type Empleado } from "@/features/rrhh/data/rrhh";
import { listEmpleados } from "@/features/rrhh/actions/empleados-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings } from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
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

// Adapta el row de la tabla `empleados` (BD) al shape `Empleado` que esperan
// los componentes de listado/filtros. Los campos que la BD aún no tiene se
// dejan como guiones — se irán rellenando cuando se conecten los submódulos
// reales (fichajes, horarios, etc.).
type EmpleadoBDRow = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email_personal: string | null;
  email_empresa: string | null;
  telefono: string | null;
  estado: string;
  departamentos?: { nombre: string } | null;
};

function bdToEmpleado(row: EmpleadoBDRow): Empleado {
  return {
    id: row.id,
    nombre: row.nombre ?? "",
    apellidos: row.apellidos ?? "",
    estado: "trabajando", // Mientras no haya estado real desde fichajes
    horarioTipo: "—",
    horarioSemanal: "—",
    horasHoy: "—",
    departamento: row.departamentos?.nombre ?? "—",
    telefono: row.telefono ?? "—",
    fichajes: 0,
    emailEmpresa: row.email_empresa ?? "",
    emailPersonal: row.email_personal ?? "",
    validadorFichajes: "—",
  };
}

export function EmpleadosView() {
  const { empresaActual } = useEmpresa();
  const router = useRouter();

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listEmpleados();
    const rows = (res.data ?? []) as EmpleadoBDRow[];
    setEmpleados(rows.map(bdToEmpleado));
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar, empresaActual.id]);

  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [showConfig, setShowConfig] = useState(false);

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
    return (e as unknown as Record<string, unknown>)[campo];
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

  const columnasDef: ToolbarColumna[] = [
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
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (emp: Empleado) => ReactNode }> = {
    empleado: {
      th: <TableHead key="empleado" className="min-w-[200px] text-xs font-medium text-muted-foreground">Empleado</TableHead>,
      td: (emp) => (
        <TableCell key="empleado">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0 border-2 border-muted">
              <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundColor: avatarColor(emp.id) }}>
                {iniciales(emp.nombre, emp.apellidos)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground whitespace-nowrap text-sm">{emp.nombre} {emp.apellidos}</span>
          </div>
        </TableCell>
      ),
    },
    estado: {
      th: <TableHead key="estado" className="text-xs font-medium text-muted-foreground text-center">Estado</TableHead>,
      td: (emp) => (
        <TableCell key="estado" className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className={`h-2 w-2 rounded-full shrink-0 ${ESTADOS_COLOR[emp.estado]}`} />
            <span className="text-sm text-muted-foreground">{ESTADOS_LABEL[emp.estado]}</span>
          </div>
        </TableCell>
      ),
    },
    horario: {
      th: <TableHead key="horario" className="text-xs font-medium text-muted-foreground text-center">Horario</TableHead>,
      td: (emp) => (
        <TableCell key="horario" className="text-center">
          <div className="leading-tight">
            <span className="text-sm font-semibold text-foreground">{emp.horarioTipo}</span>
            <p className="text-[11px] text-muted-foreground">({emp.horarioSemanal})</p>
          </div>
        </TableCell>
      ),
    },
    horasHoy: {
      th: <TableHead key="horasHoy" className="text-xs font-medium text-muted-foreground text-center">Horas hoy</TableHead>,
      td: (emp) => (
        <TableCell key="horasHoy" className="text-center"><span className="text-sm text-muted-foreground">{emp.horasHoy}</span></TableCell>
      ),
    },
    departamento: {
      th: <TableHead key="departamento" className="text-xs font-medium text-muted-foreground text-center">Departamento</TableHead>,
      td: (emp) => (
        <TableCell key="departamento" className="text-center"><span className="text-sm font-bold text-foreground">{emp.departamento}</span></TableCell>
      ),
    },
    telefono: {
      th: <TableHead key="telefono" className="text-xs font-medium text-muted-foreground text-center">Teléfono</TableHead>,
      td: (emp) => (
        <TableCell key="telefono" className="text-center"><span className="text-sm text-muted-foreground whitespace-nowrap">{emp.telefono}</span></TableCell>
      ),
    },
    fichajes: {
      th: <TableHead key="fichajes" className="text-xs font-medium text-muted-foreground text-center">Fichajes</TableHead>,
      td: (emp) => (
        <TableCell key="fichajes" className="text-center"><div className="flex justify-center"><FichajeBar fichajes={emp.fichajes} /></div></TableCell>
      ),
    },
    emailEmpresa: {
      th: <TableHead key="emailEmpresa" className="text-xs font-medium text-muted-foreground">Email empresa</TableHead>,
      td: (emp) => (
        <TableCell key="emailEmpresa"><span className="text-sm text-primary truncate max-w-[180px] block">{emp.emailEmpresa}</span></TableCell>
      ),
    },
    emailPersonal: {
      th: <TableHead key="emailPersonal" className="text-xs font-medium text-muted-foreground text-center">Email personal</TableHead>,
      td: (emp) => (
        <TableCell key="emailPersonal" className="text-center"><span className="text-sm text-muted-foreground">{emp.emailPersonal}</span></TableCell>
      ),
    },
    validador: {
      th: <TableHead key="validador" className="text-xs font-medium text-muted-foreground">Validador fichajes</TableHead>,
      td: (emp) => (
        <TableCell key="validador"><span className="text-sm text-foreground whitespace-nowrap">{emp.validadorFichajes}</span></TableCell>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={() => router.push("/rrhh/empleados/nuevo")}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        orden={orden}
        onOrdenChange={setOrden}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <>
            <IOActions
              config={empleadosIO}
              context={{ empresaId: empresaActual.id }}
              onSuccess={() => window.location.reload()}
            />
            <Button
              size="icon"
              variant={showConfig ? "default" : "outline"}
              className="h-9 w-9"
              onClick={() => setShowConfig((v) => !v)}
              title="Configuración"
              aria-label="Configuración"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      />


      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="w-10 pl-4"><Checkbox checked={todosSeleccionados} onCheckedChange={toggleAll} /></TableHead>
              {columnasRender.map((c) => columnDefs[c.campo]?.th)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((emp) => (
              <TableRow key={emp.id} className="cursor-pointer h-16 border-b last:border-0" onClick={() => router.push(`/rrhh/empleados/${emp.id}`)}>
                <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={seleccionados.has(emp.id)} onCheckedChange={() => toggleOne(emp.id)} />
                </TableCell>
                {columnasRender.map((c) => columnDefs[c.campo]?.td(emp))}
              </TableRow>
            ))}
            {loading && empleados.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  Cargando empleados…
                </TableCell>
              </TableRow>
            )}
            {!loading && empleados.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  No hay empleados todavía. Pulsa <span className="font-medium text-foreground">+ Nuevo</span> para dar de alta el primero.
                </TableCell>
              </TableRow>
            )}
            {!loading && empleados.length > 0 && filtrados.length === 0 && (
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
