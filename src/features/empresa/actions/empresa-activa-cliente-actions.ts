"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

/**
 * Empresa activa (la del selector) para componentes de CLIENTE.
 *
 * `getEmpresaActivaForUser` es `server-only` y la cookie es HttpOnly, así que
 * el navegador no puede resolverla por su cuenta. Antes cada formulario se
 * apañaba leyendo `usuarios.empresa_id` (la empresa de ORIGEN), y por eso las
 * imágenes de la web acababan guardadas en la carpeta de otra sociedad.
 *
 * Devuelve `null` si no hay sesión o empresa: quien llame NO debe caer a otra
 * empresa, debe abortar.
 */
export async function obtenerEmpresaActivaCliente(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return await getEmpresaActivaForUser(supabase, user.id);
  } catch {
    return null;
  }
}
