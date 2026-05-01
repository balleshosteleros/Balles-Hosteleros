import { createClient } from "@/lib/supabase/server";
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
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .single();
  return {
    supabase: supabase as unknown as SupabaseClient,
    userId: user.id,
    empresaId: (data?.empresa_id as string) ?? null,
  };
}
