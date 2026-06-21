"use server";

/**
 * Guard server-side para el acceso al POS.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { getRolContext } from "@/features/auth/actions/permisos-actions";

const ROLES_PERMITIDOS = new Set(["admin", "director", "gerencia", "responsable", "empleado"]);

export async function getPOSPermisos(): Promise<{
  allowed: boolean;
  userId: string | null;
  roles: string[];
  reason?: string;
}> {
  const { userId } = await getAppContext();
  if (!userId) return { allowed: false, userId: null, roles: [], reason: "No autenticado" };

  // Fuente única (PRP-063): el rol de plataforma se deriva del rol del usuario.
  const { esDirector } = await getRolContext(userId);
  const lista = esDirector ? ["director"] : ["empleado"];
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
