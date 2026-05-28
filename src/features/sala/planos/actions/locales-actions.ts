"use server";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { LocalMin } from "@/features/sala/planos/data/planos";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, empresaId };
}

/** Lista los locales de la empresa activa. */
export async function listLocalesEmpresa() {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as LocalMin[] };
    const { data, error } = await supabase
      .from("locales")
      .select("id, empresa_id, nombre")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        id: r.id as string,
        empresaId: r.empresa_id as string,
        nombre: r.nombre as string,
      })) as LocalMin[],
    };
  } catch (err) {
    console.error("[locales] list:", err);
    return { ok: false, data: [] as LocalMin[] };
  }
}
