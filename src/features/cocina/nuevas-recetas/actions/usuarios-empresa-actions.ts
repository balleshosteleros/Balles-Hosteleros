"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type { ActionResult } from "../types";

export interface UsuarioEmpresa {
  user_id: string;
  nombre_completo: string;
}

/**
 * Lista los profiles de la empresa actual para selectores de responsable.
 */
export async function listUsuariosEmpresa(): Promise<ActionResult<UsuarioEmpresa[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("usuarios")
      .select("user_id, nombre, apellidos, email")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as Array<{
      user_id: string;
      nombre: string | null;
      apellidos: string | null;
      email: string | null;
    }>;
    return {
      ok: true,
      data: rows.map((r) => {
        const nombre = [r.nombre, r.apellidos].filter(Boolean).join(" ").trim();
        return {
          user_id: r.user_id,
          nombre_completo: nombre || r.email || "—",
        };
      }),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
