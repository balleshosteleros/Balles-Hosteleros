/**
 * getAppContext — contexto autenticado compartido para Server Actions.
 *
 * Todos los módulos deben importar esta función en vez de duplicar getContext().
 * `empresaId` sigue la empresa activa del usuario (cookie del selector), no
 * la principal del profile.
 */
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppContext = {
  supabase: SupabaseClient;
  userId: string | null;
  empresaId: string | null;
};

export async function getAppContext(): Promise<AppContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase: supabase as unknown as SupabaseClient, userId: null, empresaId: null };
  }

  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );

  return {
    supabase: supabase as unknown as SupabaseClient,
    userId: user.id,
    empresaId,
  };
}
