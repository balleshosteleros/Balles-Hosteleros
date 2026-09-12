import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { tieneHerramienta } from "@/features/auth/lib/herramienta-guard";

/** Mensaje único cuando el rol no tiene cámaras. */
export const SIN_PERMISO_CAMARAS = "Tu rol no tiene acceso a cámaras.";

type Ctx = {
  supabase: SupabaseClient;
  userId: string | null;
  empresaId: string | null;
  /**
   * ¿El rol tiene CÁMARAS encendido en Ajustes → Roles? Las cámaras graban a
   * empleados y clientes: esconder el icono en la barra no es seguridad, así
   * que el permiso se comprueba también AQUÍ, en el servidor, y toda acción de
   * cámaras pasa por este contexto.
   */
  puedeCamaras: boolean;
};

export async function getCamarasContext(): Promise<Ctx> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      supabase: supabase as unknown as SupabaseClient,
      userId: null,
      empresaId: null,
      puedeCamaras: false,
    };
  }
  const [empresaId, puedeCamaras] = await Promise.all([
    getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id),
    tieneHerramienta("CÁMARAS"),
  ]);
  return {
    supabase: supabase as unknown as SupabaseClient,
    userId: user.id,
    empresaId,
    puedeCamaras,
  };
}
