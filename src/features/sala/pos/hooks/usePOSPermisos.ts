"use server";

/**
 * Guard server-side para el acceso al POS.
 */

import { getAppContext } from "@/lib/supabase/get-context";

const ROLES_PERMITIDOS = new Set(["admin", "director", "gerencia", "responsable", "empleado"]);

export async function getPOSPermisos(): Promise<{
  allowed: boolean;
  userId: string | null;
  roles: string[];
  reason?: string;
}> {
  const { supabase, userId } = await getAppContext();
  if (!userId) return { allowed: false, userId: null, roles: [], reason: "No autenticado" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("[pos][permisos] Error cargando roles:", error.message);
    return { allowed: false, userId, roles: [], reason: "Error cargando roles" };
  }

  const lista = (roles ?? []).map((r) => (r as { role: string }).role);
  const tieneSoloLectura = lista.includes("solo_lectura") && lista.length === 1;
  const tieneAutorizado = lista.some((r) => ROLES_PERMITIDOS.has(r));
  const allowed = !tieneSoloLectura && (tieneAutorizado || lista.length === 0);

  return {
    allowed,
    userId,
    roles: lista,
    reason: allowed ? undefined : "Rol insuficiente para operar POS",
  };
}
