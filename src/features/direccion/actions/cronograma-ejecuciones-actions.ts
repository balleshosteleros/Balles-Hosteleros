"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

export interface ProductividadFila {
  empresa_id: string;
  departamento: string;
  user_id: string;
  fecha_programada: string;
  total: number;
  hechas: number;
  pendientes: number;
  omitidas: number;
  pospuestas: number;
  pospuestas_totales: number;
  pct_cumplimiento: number | null;
}

export interface DashboardFiltros {
  fechaDesde: string; // YYYY-MM-DD
  fechaHasta: string; // YYYY-MM-DD
  departamentos?: string[]; // null/empty = todos
  userIds?: string[];
}

/**
 * Obtiene el agregado de productividad para el dashboard Dirección.
 * Solo admin lo invoca (la RLS + la admin client lo permiten).
 */
export async function getProductividad(
  filtros: DashboardFiltros
): Promise<{ ok: true; data: ProductividadFila[] } | { ok: false; error: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sin sesión" };
    const empresaId = await getEmpresaActivaForUser(supabase, user.id);
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    let q = supabase
      .from("v_cronograma_productividad")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("fecha_programada", filtros.fechaDesde)
      .lte("fecha_programada", filtros.fechaHasta);

    if (filtros.departamentos && filtros.departamentos.length > 0) {
      q = q.in("departamento", filtros.departamentos);
    }
    if (filtros.userIds && filtros.userIds.length > 0) {
      q = q.in("user_id", filtros.userIds);
    }

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as ProductividadFila[] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Devuelve lista de empleados (profiles) de la empresa del admin
 * para poder filtrar en el dashboard.
 */
export async function getEmpleadosEmpresa(): Promise<
  | { ok: true; data: Array<{ user_id: string; nombre: string; rol: string }> }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sin sesión" };
    const empresaId = await getEmpresaActivaForUser(supabase, user.id);
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    // Vía RPC SECURITY DEFINER: resuelve el PUESTO real (empleado_puestos) y
    // filtra solo activos. `rol` etiqueta el cargo del empleado en el dashboard,
    // así que preferimos el puesto real y caemos al departamento como respaldo
    // (`rol_label` en este sistema ES el nombre del departamento, no el puesto).
    const { data, error } = await supabase.rpc("chat_empleados", { p_empresa: empresaId });
    if (error) return { ok: false, error: error.message };
    const rows = ((data ?? []) as Array<Record<string, unknown>>)
      .filter((p) => p.user_id)
      .map((p) => ({
        user_id: p.user_id as string,
        nombre:
          [p.nombre as string | null, p.apellidos as string | null]
            .filter(Boolean)
            .join(" ") || "(sin nombre)",
        rol:
          (p.puesto as string | null) ||
          (p.departamento as string | null) ||
          (p.rol_label as string | null) ||
          "—",
      }));
    return { ok: true, data: rows };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
