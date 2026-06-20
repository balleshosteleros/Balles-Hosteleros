"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";

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

// Devuelve TODAS las empresas del GRUPO (cuenta) al que pertenece la empresa de
// referencia, aunque el usuario no las gestione directamente. Es el origen de
// los destinos de "copiar empleado" y del acceso multiempresa: la operación es
// legítima dentro del grupo (las acciones de servidor validan la pertenencia).
// Si la empresa no tiene grupo (cuenta individual), devuelve solo esa empresa.
// Requiere que el usuario tenga acceso a la empresa de referencia; si no, cae
// al comportamiento seguro (sus empresas accesibles), sin escalar privilegios.
export async function getEmpresasDelGrupo(empresaReferenciaId: string): Promise<{
  ok: boolean;
  data: EmpresaAccesible[];
  error?: string;
}> {
  try {
    const { userId } = await getAppContext();
    if (!userId) return { ok: false, data: [], error: "No autenticado" };

    const accesibles = await getEmpresasAccesibles();
    const idsAccesibles = new Set((accesibles.data ?? []).map((e) => e.id));
    if (!idsAccesibles.has(empresaReferenciaId)) {
      // Sin acceso a la empresa de referencia: no se revela el grupo.
      return accesibles;
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return accesibles;
    }

    const { data: ref } = await admin
      .from("empresas")
      .select("grupo_id")
      .eq("id", empresaReferenciaId)
      .maybeSingle();
    const grupoId = (ref?.grupo_id as string | null) ?? null;

    const query = admin.from("empresas").select("id, slug, nombre, iniciales, color");
    const { data, error } = grupoId
      ? await query.eq("grupo_id", grupoId).order("nombre", { ascending: true })
      : await query.eq("id", empresaReferenciaId);
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
    console.error("[empresa] getEmpresasDelGrupo:", msg);
    return { ok: false, data: [], error: msg };
  }
}
