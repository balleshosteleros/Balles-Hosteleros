"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { listEmpleados } from "@/features/rrhh/actions/empleados-actions";
import { ESTADOS_LABEL, ESTADOS_COLOR, type EmpleadoUI } from "@/features/rrhh/components/empleados/empleado-ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings, Lock } from "lucide-react";
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
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { EmpresaBadge } from "@/shared/components/EmpresaBadge";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
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

// Las áreas llegan en mayúsculas desde BD (OPERATIVA / ADMINISTRATIVA); en la UI
// se muestran en sentence case.
function formatArea(area: string) {
  return area.charAt(0).toUpperCase() + area.slice(1).toLowerCase();
}

type EmpleadoBDRow = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email_personal: string | null;
  email_empresa: string | null;
  telefono: string | null;
  estado: string;
  departamentos?: { nombre: string } | null;
  areas?: string[];
  es_principal?: boolean;
  empresas_acceso?: Array<{ id: string; nombre: string }>;
  validador_trabajo_nombre?: string | null;
  validador_ausencias_nombre?: string | null;
};

type EmpleadoConAcceso = EmpleadoUI & {
  esPrincipal: boolean;
  empresasAcceso: Array<{ id: string; nombre: string }>;
};

function normalizarEstadoEmpleado(estado: string): EmpleadoUI["estado"] {
  return estado === "Activo" ? "Activo" : "Inactivo";
}

function bdToEmpleado(row: EmpleadoBDRow): EmpleadoConAcceso {
  return {
    id: row.id,
    nombre: row.nombre ?? "",
    apellidos: row.apellidos ?? "",
    estado: normalizarEstadoEmpleado(row.estado),
    horarioTipo: "—",
    horarioSemanal: "—",
    horasHoy: "—",
    departamento: row.departamentos?.nombre ?? "—",
    areas: row.areas ?? [],
    telefono: row.telefono ?? "—",
    emailEmpresa: row.email_empresa ?? "",
    emailPersonal: row.email_personal ?? "",
    validadorTrabajo: row.validador_trabajo_nombre ?? "—",
    validadorAusencias: row.validador_ausencias_nombre ?? "—",
    esPrincipal: row.es_principal ?? true,
    empresasAcceso: row.empresas_acceso ?? [],
  };
}

export function EmpleadosView() {
  const { empresaActual } = useEmpresa();
  const router = useRouter();

  const [empleados, setEmpleados] = useState<EmpleadoConAcceso[]>([]);
  const [loading, setLoading] = useState(true);

  useGlobalLoadingSync(loading);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listEmpleados();
    const rows = (res.data ?? []) as EmpleadoBDRow[];
    setEmpleados(rows.map(bdToEmpleado));
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar, empresaActual.id]);

  const [busqueda, setBusqueda] = useState("");
  // Por defecto solo se muestran los empleados activos; los desactivados quedan
  // ocultos salvo que el usuario cambie manualmente este filtro de Estado.
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([
    { id: "default-estado-activo", campo: "estado", etiqueta: "Estado", valores: [ESTADOS_LABEL.Activo] },
  ]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [showConfig, setShowConfig] = useState(false);

  const departamentosUsados = useMemo(
    () => [...new Set(empleados.map((e) => e.departamento).filter((d) => d && d !== "—"))].sort(),
    [empleados],
  );
  const empresasUsadas = useMemo(
    () => [...new Set(empleados.flatMap((e) => e.empresasAcceso.map((a) => a.nombre)))].sort(),
    [empleados],
  );
  const areasUsadas = useMemo(
    () => [...new Set(empleados.flatMap((e) => e.areas.map(formatArea)))].sort(),
    [empleados],
  );

  const acceso = (e: EmpleadoConAcceso, campo: string): unknown => {
    if (campo === "empleado") return `${e.nombre} ${e.apellidos}`.trim();
    if (campo === "empresas") return e.empresasAcceso.map((a) => a.nombre);
    if (campo === "estado") return ESTADOS_LABEL[e.estado];
    if (campo === "horario") return e.horarioTipo;
    if (campo === "horasHoy") {
      // Orden por volumen de horas trabajadas (numérico, no alfabético).
      const n = parseFloat(String(e.horasHoy).replace(",", "."));
      return Number.isNaN(n) ? -1 : n;
    }
    if (campo === "departamento") return e.departamento;
    if (campo === "area") return e.areas.map(formatArea);
    if (campo === "telefono") return e.telefono;
    if (campo === "emailEmpresa") return e.emailEmpresa;
    if (campo === "emailPersonal") return e.emailPersonal;
    if (campo === "validador") return e.validadorTrabajo;
    if (campo === "validadorAusencias") return e.validadorAusencias;
    return (e as unknown as Record<string, unknown>)[campo];
  };

  const filtrados = useMemo(() => {
    let lista = empleados.filter((e) => {
      const texto = `${e.nombre} ${e.apellidos} ${e.departamento} ${e.emailEmpresa} ${e.emailPersonal} ${e.telefono}`.toLowerCase();
      if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;
      return true;
    });
    // Filtros multi-valor: "empresas" y "area" son arrays → match si cualquier opción
    // seleccionada está en el array del empleado. aplicarFiltrosToolbar trata el valor
    // escalar; los tratamos aparte.
    const filtrosEmpresas = filtros.filter((f) => f.campo === "empresas");
    const filtrosArea = filtros.filter((f) => f.campo === "area");
    const otrosFiltros = filtros.filter((f) => f.campo !== "empresas" && f.campo !== "area");
    lista = aplicarFiltrosToolbar(lista, otrosFiltros, acceso);
    if (filtrosEmpresas.length > 0) {
      lista = lista.filter((e) =>
        filtrosEmpresas.every((f) =>
          f.valores?.some((v) => e.empresasAcceso.some((a) => a.nombre === v)),
        ),
      );
    }
    if (filtrosArea.length > 0) {
      lista = lista.filter((e) =>
        filtrosArea.every((f) =>
          f.valores?.some((v) => e.areas.map(formatArea).includes(v)),
        ),
      );
    }
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
    { campo: "empleado", label: "Empleado", bloqueada: true },
    { campo: "empresas", label: "Empresas" },
    { campo: "estado", label: "Estado" },
    { campo: "horario", label: "Horario" },
    { campo: "horasHoy", label: "Horas hoy" },
    { campo: "departamento", label: "Departamento" },
    { campo: "area", label: "Área" },
    { campo: "telefono", label: "Teléfono" },
    { campo: "emailEmpresa", label: "Email empresa" },
    { campo: "emailPersonal", label: "Email personal" },
    { campo: "validador", label: "Validador trabajo" },
    { campo: "validadorAusencias", label: "Validador ausencias" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (emp: EmpleadoConAcceso) => ReactNode }> = {
    empleado: {
      th: (
        <TableColumnHeader
          key="empleado"
          label="Empleado"
          campo="empleado"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (emp) => (
        <td key="empleado" className="px-3 py-2 align-middle">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0 border-2 border-muted">
              <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundColor: avatarColor(emp.id) }}>
                {iniciales(emp.nombre, emp.apellidos)}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-foreground whitespace-nowrap text-sm">{emp.nombre} {emp.apellidos}</span>
            </div>
          </div>
        </td>
      ),
    },
    empresas: {
      th: (
        <TableColumnHeader
          key="empresas"
          label="Empresas"
          campo="empresas"
          filtroTipo="lista"
          opciones={empresasUsadas}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (emp) => (
        <td key="empresas" className="px-3 py-2 align-middle">
          <div className="flex flex-wrap gap-1">
            {emp.empresasAcceso.length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : (
              emp.empresasAcceso.map((e) => (
                <EmpresaBadge key={e.id} nombre={e.nombre} size="sm" />
              ))
            )}
          </div>
        </td>
      ),
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
          label="Estado"
          campo="estado"
          align="center"
          filtroTipo="lista"
          opciones={Object.values(ESTADOS_LABEL)}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (emp) => (
        <td key="estado" className="px-3 py-2 align-middle text-center">
          <div className="flex items-center justify-center gap-2">
            <span className={`h-2 w-2 rounded-full shrink-0 ${ESTADOS_COLOR[emp.estado]}`} />
            <span className="text-sm text-muted-foreground">{ESTADOS_LABEL[emp.estado]}</span>
          </div>
        </td>
      ),
    },
    horario: {
      th: (
        <TableColumnHeader
          key="horario"
          label="Horario"
          campo="horario"
          align="center"
        />
      ),
      td: (emp) => (
        <td key="horario" className="px-3 py-2 align-middle text-center">
          <div className="leading-tight">
            <span className="text-sm font-semibold text-foreground">{emp.horarioTipo}</span>
            <p className="text-[11px] text-muted-foreground">({emp.horarioSemanal})</p>
          </div>
        </td>
      ),
    },
    horasHoy: {
      th: (
        <TableColumnHeader
          key="horasHoy"
          label="Horas hoy"
          campo="horasHoy"
          align="center"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
          ordenLabelAsc="Menos horas"
          ordenLabelDesc="Más horas"
        />
      ),
      td: (emp) => (
        <td key="horasHoy" className="px-3 py-2 align-middle text-center"><span className="text-sm text-muted-foreground">{emp.horasHoy}</span></td>
      ),
    },
    departamento: {
      th: (
        <TableColumnHeader
          key="departamento"
          label="Departamento"
          campo="departamento"
          align="center"
          filtroTipo="lista"
          opciones={departamentosUsados}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (emp) => (
        <td key="departamento" className="px-3 py-2 align-middle text-center"><span className="text-sm font-bold text-foreground">{emp.departamento}</span></td>
      ),
    },
    area: {
      th: (
        <TableColumnHeader
          key="area"
          label="Área"
          campo="area"
          align="center"
          filtroTipo="lista"
          opciones={areasUsadas}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (emp) => (
        <td key="area" className="px-3 py-2 align-middle text-center">
          <div className="flex flex-wrap justify-center gap-1">
            {emp.areas.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              emp.areas.map((a) => (
                <span
                  key={a}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground"
                >
                  {formatArea(a)}
                </span>
              ))
            )}
          </div>
        </td>
      ),
    },
    telefono: {
      th: (
        <TableColumnHeader
          key="telefono"
          label="Teléfono"
          campo="telefono"
          align="center"
        />
      ),
      td: (emp) => (
        <td key="telefono" className="px-3 py-2 align-middle text-center"><span className="text-sm text-muted-foreground whitespace-nowrap">{emp.telefono}</span></td>
      ),
    },
    emailEmpresa: {
      th: (
        <TableColumnHeader
          key="emailEmpresa"
          label="Email empresa"
          campo="emailEmpresa"
        />
      ),
      td: (emp) => (
        <td key="emailEmpresa" className="px-3 py-2 align-middle"><span className="text-sm text-primary truncate max-w-[180px] block">{emp.emailEmpresa}</span></td>
      ),
    },
    emailPersonal: {
      th: (
        <TableColumnHeader
          key="emailPersonal"
          label="Email personal"
          campo="emailPersonal"
          align="center"
        />
      ),
      td: (emp) => (
        <td key="emailPersonal" className="px-3 py-2 align-middle text-center"><span className="text-sm text-muted-foreground">{emp.emailPersonal}</span></td>
      ),
    },
    validador: {
      th: (
        <TableColumnHeader
          key="validador"
          label="Validador trabajo"
          campo="validador"
        />
      ),
      td: (emp) => (
        <td key="validador" className="px-3 py-2 align-middle"><span className="text-sm text-foreground whitespace-nowrap">{emp.validadorTrabajo}</span></td>
      ),
    },
    validadorAusencias: {
      th: (
        <TableColumnHeader
          key="validadorAusencias"
          label="Validador ausencias"
          campo="validadorAusencias"
        />
      ),
      td: (emp) => (
        <td key="validadorAusencias" className="px-3 py-2 align-middle"><span className="text-sm text-foreground whitespace-nowrap">{emp.validadorAusencias}</span></td>
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

      {showConfig && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Configuración de empleados</h3>
          <div className="mt-3 flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Checkbox checked disabled className="mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  No permitir borrar empleados ya grabados
                </span>
                <Lock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Un empleado con horarios, turnos o fichajes no se puede borrar nunca; solo
                marcarse como Inactivo (registro legal). Este ajuste está bloqueado de momento.
              </p>
            </div>
          </div>
        </div>
      )}

      <ResizableColumnsProvider storageKey="rrhh-empleados">
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="w-10 pl-4 py-1.5"><Checkbox checked={todosSeleccionados} onCheckedChange={toggleAll} /></th>
                {columnasRender.map((c) => columnDefs[c.campo]?.th)}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((emp) => (
                <tr key={emp.id} className="cursor-pointer h-16 border-b last:border-0 hover:bg-muted/30 transition-colors" onClick={() => router.push(`/rrhh/empleados/${emp.id}`)}>
                  <td className="pl-4 align-middle" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={seleccionados.has(emp.id)} onCheckedChange={() => toggleOne(emp.id)} />
                  </td>
                  {columnasRender.map((c) => columnDefs[c.campo]?.td(emp))}
                </tr>
              ))}
              {loading && empleados.length === 0 && (
                <tr>
                  <td colSpan={columnasRender.length + 1} className="text-center py-12 text-muted-foreground">
                    Cargando empleados…
                  </td>
                </tr>
              )}
              {!loading && empleados.length === 0 && (
                <tr>
                  <td colSpan={columnasRender.length + 1} className="text-center py-12 text-muted-foreground">
                    No hay empleados todavía. Pulsa <span className="font-medium text-foreground">+ Nuevo</span> para dar de alta el primero.
                  </td>
                </tr>
              )}
              {!loading && empleados.length > 0 && filtrados.length === 0 && (
                <tr>
                  <td colSpan={columnasRender.length + 1} className="text-center py-12 text-muted-foreground">
                    No se encontraron empleados con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>
    </div>
  );
}
