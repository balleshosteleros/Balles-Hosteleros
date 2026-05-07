import { useState, useEffect, useCallback, useMemo } from "react";
import { Departamento, Rol } from "@/features/ajustes/data/ajustes";
import { getEmployees } from "@/actions/admin";
import {
  listDepartamentos,
  type DepartamentoRow,
} from "@/features/ajustes/actions/departamentos-actions";
import { loadRolesFromSupabase } from "@/features/ajustes/actions/roles-actions";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, ChevronDown, ChevronRight } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { ReglasSubmodulosPanel } from "@/features/ajustes/components/ReglasSubmodulosPanel";
import { moduloKeyDesdeNombreDept } from "@/features/ajustes/lib/reglas-submodulos-catalogo";

interface UsuarioOption {
  id: string;
  nombre: string;
  email: string;
  rolLabel: string;
}

function getNombreFromProfile(p: Record<string, unknown>): string {
  const nombre = [p.nombre, p.apellidos].filter(Boolean).join(" ").trim();
  if (nombre) return nombre;
  if (p.full_name) return p.full_name as string;
  return (p.email as string) ?? "—";
}

function rowToDepartamento(r: DepartamentoRow): Departamento {
  return {
    id: r.id,
    nombre: r.nombre,
    responsableId: r.responsable_id ?? "",
    descripcion: r.descripcion,
    estado: r.estado,
  };
}

// Mantener el mismo orden que el menú lateral (app-sidebar.tsx).
const ORDEN_DEPARTAMENTOS = [
  "DIRECCION",
  "SALA",
  "COCINA",
  "LOGISTICA",
  "GERENCIA",
  "RECURSOS HUMANOS",
  "MARKETING",
  "CONTABILIDAD",
  "CALIDAD",
  "GESTORIA",
  "JURIDICO",
];

function normalizarNombreDept(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

function ordenIndexDept(nombre: string): number {
  const idx = ORDEN_DEPARTAMENTOS.indexOf(normalizarNombreDept(nombre));
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

export function DepartamentosTab() {
  const { empresaActual } = useEmpresa();
  const empresaDbId = empresaActual.dbId;

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadDepartamentos = useCallback(async () => {
    setLoading(true);
    const rows = await listDepartamentos(empresaDbId);
    setDepartamentos(rows.map(rowToDepartamento));
    setLoading(false);
  }, [empresaDbId]);

  const [usuariosSupabase, setUsuariosSupabase] = useState<UsuarioOption[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);

  const loadUsuarios = useCallback(async () => {
    try {
      const result = await getEmployees();
      const profiles = (result.data ?? []) as Record<string, unknown>[];
      setUsuariosSupabase(
        profiles.map((p) => ({
          id: p.id as string,
          nombre: getNombreFromProfile(p),
          email: (p.email as string) ?? "",
          rolLabel: (p.rol_label as string | null)?.trim() ?? "",
        }))
      );
    } catch {
      // Sin Supabase configurado: dejar lista vacía
    }
  }, []);

  const loadRoles = useCallback(async () => {
    const rolesRemote = await loadRolesFromSupabase(empresaDbId);
    setRoles(rolesRemote ?? []);
  }, [empresaDbId]);

  useEffect(() => {
    loadDepartamentos();
    loadUsuarios();
    loadRoles();
  }, [loadDepartamentos, loadUsuarios, loadRoles]);

  const norm = (s: string) => s.trim().toLowerCase();

  const departamentosOrdenados = useMemo(
    () =>
      [...departamentos].sort((a, b) => {
        const ia = ordenIndexDept(a.nombre);
        const ib = ordenIndexDept(b.nombre);
        if (ia !== ib) return ia - ib;
        return a.nombre.localeCompare(b.nombre);
      }),
    [departamentos]
  );

  const usuariosPorDept = useMemo(() => {
    const map = new Map<string, UsuarioOption[]>();
    for (const d of departamentos) {
      const deptKey = norm(d.nombre);
      const rolesConAcceso = new Set(
        roles
          .filter((r) => r.permisos.some((p) => norm(p.modulo) === deptKey && p.ver))
          .map((r) => norm(r.nombre))
      );
      const usuarios = usuariosSupabase.filter((u) => u.rolLabel && rolesConAcceso.has(norm(u.rolLabel)));
      map.set(d.id, usuarios);
    }
    return map;
  }, [departamentos, roles, usuariosSupabase]);

  return (
    <div className="space-y-2">
      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {!loading && departamentosOrdenados.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No hay departamentos disponibles.
        </div>
      )}

      {!loading &&
        departamentosOrdenados.map((d) => {
          const isOpen = expandedId === d.id;
          const usuariosConAcceso = usuariosPorDept.get(d.id) ?? [];
          const moduloKey = moduloKeyDesdeNombreDept(d.nombre);

          return (
            <Card key={d.id} className="overflow-hidden">
              <CardHeader
                className="py-2 px-4 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(isOpen ? null : d.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-semibold text-foreground truncate">{d.nombre}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          title={`${usuariosConAcceso.length} ${usuariosConAcceso.length === 1 ? "usuario" : "usuarios"} con acceso`}
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span className="font-semibold tabular-nums">{usuariosConAcceso.length}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="w-64 p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="border-b px-3 py-2">
                          <p className="text-[10px] font-bold tracking-wider text-muted-foreground">USUARIOS CON ACCESO</p>
                          <p className="text-sm font-semibold">{d.nombre} · {usuariosConAcceso.length}</p>
                        </div>
                        {usuariosConAcceso.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                            Ningún usuario tiene acceso a este departamento.
                          </div>
                        ) : (
                          <ul className="max-h-64 overflow-y-auto py-1">
                            {usuariosConAcceso.map((u) => (
                              <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-muted/50">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{u.nombre}</p>
                                  {u.email && (
                                    <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                                  )}
                                </div>
                                {u.rolLabel && (
                                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                    {u.rolLabel}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent className="border-t bg-muted/20 px-4 py-3">
                  {moduloKey ? (
                    <ReglasSubmodulosPanel moduloKey={moduloKey} />
                  ) : (
                    <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Las reglas de submódulos aparecerán cuando este departamento coincida con un módulo del sistema.
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
    </div>
  );
}
