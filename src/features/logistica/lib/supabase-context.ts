import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = {
  supabase: SupabaseClient;
  userId: string | null;
  empresaId: string | null;
};

export async function getLogisticaContext(): Promise<Ctx> {
  const devBypass = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

  if (devBypass) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("empresas")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return {
      supabase: admin as unknown as SupabaseClient,
      userId: null,
      empresaId: data?.id ?? null,
    };
  }

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
