import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

/**
 * Empresa sobre la que operan las acciones de Ajustes (roles, departamentos,
 * reglas de submódulo).
 *
 * Sustituye a tres copias literales del mismo helper que caían a
 * `usuarios.empresa_id` (la empresa de ORIGEN del usuario) e incluso a un UUID
 * cableado de HABANA. Con eso, un usuario multiempresa editando BACANAL podía
 * leer —y SOBRESCRIBIR— los roles y permisos de HABANA.
 *
 * Orden de resolución:
 *   1. `empresaIdParam`, solo si el usuario pertenece de verdad a esa empresa.
 *   2. La empresa activa del selector (cookie), validada contra sus empresas.
 *   3. Nada: `null`. NUNCA se cae a una empresa "por defecto" — escribir en la
 *      sociedad equivocada es peor que no escribir.
 */
export async function resolverEmpresaAjustes(
  supabase: SupabaseClient,
  empresaIdParam?: string,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const activa = await getEmpresaActivaForUser(supabase, user.id);

  if (empresaIdParam) {
    if (empresaIdParam === activa) return empresaIdParam;

    // Pide otra empresa distinta de la activa: solo si es realmente suya.
    const { data: acceso } = await supabase
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaIdParam)
      .maybeSingle();
    if (acceso) return empresaIdParam;

    const { data: perfil } = await supabase
      .from("usuarios")
      .select("empresa_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (perfil?.empresa_id === empresaIdParam) return empresaIdParam;

    // Pidió una empresa que no es suya: no se sirve NI se cae a otra.
    return null;
  }

  return activa;
}
