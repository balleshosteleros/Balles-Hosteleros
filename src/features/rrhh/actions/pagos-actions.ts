"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export type EmpleadoArea = "administrativa" | "operativa";

export interface EmpleadoPagoRow {
  empleadoId: string;
  empleadoNombre: string;
  puesto: string | null;
  area: EmpleadoArea;
}

export async function listEmpleadosParaPagos(): Promise<{ ok: boolean; data: EmpleadoPagoRow[] }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };

    const { data: accesosUE } = await supabase
      .from("user_empresas")
      .select("user_id")
      .eq("empresa_id", empresaId);
    const userIdsConAcceso = (accesosUE ?? []).map((r) => r.user_id as string);

    const filtro = userIdsConAcceso.length > 0
      ? `empresa_id.eq.${empresaId},user_id.in.(${userIdsConAcceso.join(",")})`
      : `empresa_id.eq.${empresaId}`;

    const { data, error } = await supabase
      .from("empleados")
      .select("id, nombre, apellidos, puesto, estado, user_id, empresa_id, departamentos(nombre, area)")
      .or(filtro)
      .eq("estado", "Activo")
      .order("nombre", { ascending: true });

    if (error) throw error;

    // Dedup por user_id: un usuario con ficha en varias empresas (p.ej. director
    // multiempresa) aparecería duplicado porque el filtro OR lo incluye por
    // empresa_id (su empresa principal) y por user_empresas (acceso secundario).
    // Damos prioridad a la ficha cuya empresa_id = empresaId activa.
    const porUser = new Map<string, typeof data[number]>();
    const sinUser: typeof data = [];
    for (const e of data ?? []) {
      const uid = e.user_id as string | null;
      if (!uid) {
        sinUser.push(e);
        continue;
      }
      const prev = porUser.get(uid);
      if (!prev) {
        porUser.set(uid, e);
        continue;
      }
      const prevPrincipal = prev.empresa_id === empresaId;
      const currPrincipal = e.empresa_id === empresaId;
      if (currPrincipal && !prevPrincipal) porUser.set(uid, e);
    }

    const rows: EmpleadoPagoRow[] = [...porUser.values(), ...sinUser].map((e) => {
      const deptoRel = e.departamentos as
        | { nombre?: string | null; area?: string | null }
        | Array<{ nombre?: string | null; area?: string | null }>
        | null;
      const deptoObj = Array.isArray(deptoRel) ? deptoRel[0] : deptoRel;
      const puesto = (e.puesto as string | null) ?? null;
      const area: EmpleadoArea =
        deptoObj?.area === "OPERATIVA" ? "operativa" : "administrativa";
      return {
        empleadoId: e.id as string,
        empleadoNombre: `${(e.nombre as string) ?? ""} ${(e.apellidos as string) ?? ""}`.trim(),
        puesto,
        area,
      };
    });
    rows.sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre, "es"));

    return { ok: true, data: rows };
  } catch (err) {
    console.error("[rrhh] listEmpleadosParaPagos:", err);
    return { ok: false, data: [] };
  }
}
