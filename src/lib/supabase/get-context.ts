/**
 * getAppContext — contexto autenticado compartido para Server Actions.
 *
 * Todos los módulos deben importar esta función en vez de duplicar getContext().
 */
import { createClient } from "@/lib/supabase/server";
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

  let empresaId: string | null = null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .single();
    empresaId = (data?.empresa_id as string) ?? null;
  } catch (e) {
    console.error("[getAppContext] Profile error:", e);
  }

  return {
    supabase: supabase as unknown as SupabaseClient,
    userId: user.id,
    empresaId,
  };
}
