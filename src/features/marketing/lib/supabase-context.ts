import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = {
  supabase: SupabaseClient;
  userId: string | null;
  empresaId: string | null;
};

export async function getMarketingContext(): Promise<Ctx> {
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
