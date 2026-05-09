import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

type Ctx = {
  supabase: SupabaseClient;
  userId: string | null;
  empresaId: string | null;
};

export async function getLogisticaContext(): Promise<Ctx> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase: supabase as unknown as SupabaseClient, userId: null, empresaId: null };
  }
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return {
    supabase: supabase as unknown as SupabaseClient,
    userId: user.id,
    empresaId,
  };
}
