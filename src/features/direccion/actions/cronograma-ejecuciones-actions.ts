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

    const { data, error } = await supabase
      .from("usuarios")
      .select("user_id, nombre, apellidos, full_name, departamento, role")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? [])
      .filter((p) => p.user_id)
      .map((p) => ({
        user_id: p.user_id as string,
        nombre:
          [p.nombre, p.apellidos].filter(Boolean).join(" ") ||
          (p.full_name as string | null) ||
          "(sin nombre)",
        rol: (p.departamento as string | null) || (p.role as string | null) || "—",
      }));
    return { ok: true, data: rows };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
