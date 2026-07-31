"use server";

/**
 * Guard server-side para el acceso al POS.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeVerModulo } from "@/features/auth/lib/permisos";

export async function getPOSPermisos(): Promise<{
  allowed: boolean;
  userId: string | null;
  reason?: string;
}> {
  const { userId } = await getAppContext();
  if (!userId) return { allowed: false, userId: null, reason: "No autenticado" };

  // Acceso por PERMISOS reales: el POS es del módulo SALA. Puede operarlo quien
  // tiene permiso de ver SALA (o es admin de plataforma). Sin nombres de rol
  // técnicos hardcodeados.
  const { esDirector, permisos } = await getRolContext(userId);
  const allowed = puedeVerModulo(esDirector, permisos, "SALA");

  return {
    allowed,
    userId,
    reason: allowed ? undefined : "Rol insuficiente para operar POS",
  };
}
