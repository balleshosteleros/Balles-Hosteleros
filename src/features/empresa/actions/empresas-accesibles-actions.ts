"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export type EmpresaAccesible = {
  id: string;
  slug: string | null;
  nombre: string;
  iniciales: string | null;
  color: string | null;
};

// Devuelve las empresas a las que el usuario tiene acceso (vía user_empresas)
// además de su empresa actual (profiles.empresa_id). Únicas y ordenadas.
export async function getEmpresasAccesibles(): Promise<{
  ok: boolean;
  data: EmpresaAccesible[];
  error?: string;
}> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: false, data: [], error: "No autenticado" };

    const [ueRes, profRes] = await Promise.all([
      supabase
        .from("usuario_empresas")
        .select("empresa_id")
        .eq("user_id", userId),
      supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (ueRes.error) throw ueRes.error;

    const ids = new Set<string>();
    for (const r of ueRes.data ?? []) {
      if (r.empresa_id) ids.add(r.empresa_id as string);
    }
    if (profRes.data?.empresa_id) ids.add(profRes.data.empresa_id as string);
    if (ids.size === 0) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("empresas")
      .select("id, slug, nombre, iniciales, color")
      .in("id", Array.from(ids))
      .order("nombre", { ascending: true });
    if (error) throw error;

    return {
      ok: true,
      data: (data ?? []).map((e) => ({
        id: e.id as string,
        slug: (e.slug as string | null) ?? null,
        nombre: (e.nombre as string) ?? "",
        iniciales: (e.iniciales as string | null) ?? null,
        color: (e.color as string | null) ?? null,
      })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[empresa] getEmpresasAccesibles:", msg);
    return { ok: false, data: [], error: msg };
  }
}
