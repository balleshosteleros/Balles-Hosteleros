"use server";

/**
 * Guard server-side para el acceso al panel de Comandas (KDS).
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeVerModulo } from "@/features/auth/lib/permisos";

export async function getComandasPermisos(): Promise<{
  allowed: boolean;
  userId: string | null;
  reason?: string;
}> {
  const { userId } = await getAppContext();
  if (!userId) return { allowed: false, userId: null, reason: "No autenticado" };

  // Acceso por PERMISOS reales: el panel de Comandas (KDS) es del módulo COCINA.
  // Puede operarlo quien tiene permiso de ver COCINA (o es admin de plataforma).
  const { esDirector, permisos } = await getRolContext(userId);
  const allowed = puedeVerModulo(esDirector, permisos, "COCINA");

  return {
    allowed,
    userId,
    reason: allowed ? undefined : "Rol insuficiente para operar el panel de Comandas",
  };
}
