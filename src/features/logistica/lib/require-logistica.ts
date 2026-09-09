import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";

/**
 * Exige permiso de EDICIÓN sobre Logística. Manda el permiso del rol (Ajustes →
 * Roles), no el flag de director: el cargo no da acceso, el rol sí.
 *
 * Estaba copiado dentro de `producto-actions.ts`; se saca aquí porque el cierre de
 * almacén necesita la misma puerta y no tiene sentido tener dos.
 */
export async function requireLogisticaEdit(accion = "hacer esto") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { permisos } = await getRolContext();
  if (!puedeEditarModulo(permisos, "LOGÍSTICA")) {
    throw new Error(`Sin permisos: necesitas Logística para ${accion}`);
  }
  return user;
}
