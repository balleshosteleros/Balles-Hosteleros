"use server";

import { createClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, nombre: null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id, nombre, apellidos")
    .eq("user_id", user.id)
    .single();
  return {
    supabase,
    user,
    empresaId: data?.empresa_id ?? null,
    nombre: data ? `${data.nombre} ${data.apellidos}` : null,
  };
}

export async function listCanales() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase.from("canales").select("*").order("nombre");
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[comunicacion] listCanales:", err);
    return { ok: false, data: [] };
  }
}

export async function createCanal(
  nombre: string,
  tipo: string = "grupo",
  miembrosUserIds: string[] = [],
) {
  try {
    const { supabase, empresaId } = await getContext();
    const { data, error } = await supabase
      .from("canales")
      .insert({
        nombre,
        tipo,
        empresa_id: empresaId ?? "",
        miembros_user_ids: miembrosUserIds,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] createCanal:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCanalMiembros(
  canalId: string,
  miembrosUserIds: string[],
) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("canales")
      .update({ miembros_user_ids: miembrosUserIds })
      .eq("id", canalId)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] updateCanalMiembros:", msg);
    return { ok: false, error: msg };
  }
}

export interface EmpleadoCanal {
  userId: string;
  nombre: string;
  apellidos: string;
  rolLabel: string | null;
  departamento: string | null;
}

export async function listEmpleadosEmpresa(): Promise<{
  ok: boolean;
  data: EmpleadoCanal[];
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, nombre, apellidos, rol_label, departamento")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return {
      ok: true,
      data: (data ?? [])
        .filter((r: Record<string, unknown>) => !!r.user_id)
        .map((r: Record<string, unknown>) => ({
          userId: r.user_id as string,
          nombre: (r.nombre as string) ?? "",
          apellidos: (r.apellidos as string) ?? "",
          rolLabel: (r.rol_label as string | null) ?? null,
          departamento: (r.departamento as string | null) ?? null,
        })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] listEmpleadosEmpresa:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function listMensajes(canalId: string) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("mensajes")
      .select("*")
      .eq("canal_id", canalId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[comunicacion] listMensajes:", err);
    return { ok: false, data: [] };
  }
}

export async function sendMensaje(canalId: string, texto: string) {
  try {
    const { supabase, user, nombre } = await getContext();
    const { data, error } = await supabase
      .from("mensajes")
      .insert({
        canal_id: canalId,
        autor_id: user?.id ?? null,
        autor_nombre: nombre ?? "Anónimo",
        texto,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] sendMensaje:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCanalNombre(canalId: string, nombre: string) {
  try {
    const { supabase } = await getContext();
    const limpio = nombre.trim();
    if (!limpio) return { ok: false, error: "El nombre no puede estar vacío" };
    const { data, error } = await supabase
      .from("canales")
      .update({ nombre: limpio })
      .eq("id", canalId)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] updateCanalNombre:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Borra los canales obsoletos: cualquier canal de tipo distinto a "asunto"
 * cuyo nombre no esté en la lista permitida. Útil para sanear los grupos
 * heredados ("BACANAL X", "Cocina", "Sala", "JEFES SAL/COC", etc.) cuando se
 * pasa al modelo "1 grupo por departamento del organigrama".
 *
 * Los canales de tipo "asunto" (creados manualmente por el usuario) se preservan.
 */
export async function purgeCanalesObsoletos(nombresPermitidos: string[]) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado", borrados: 0 };
    const allowed = new Set(nombresPermitidos.map((n) => n.trim().toUpperCase()));
    const { data, error } = await supabase
      .from("canales")
      .select("id, nombre, tipo")
      .eq("empresa_id", empresaId);
    if (error) throw error;
    const aBorrar = (data ?? [])
      .filter((c: Record<string, unknown>) => {
        const tipo = (c.tipo as string) ?? "";
        if (tipo === "asunto") return false; // preservar los manuales
        const nombre = String(c.nombre ?? "").trim().toUpperCase();
        return !allowed.has(nombre);
      })
      .map((c: Record<string, unknown>) => c.id as string);
    if (aBorrar.length === 0) return { ok: true, borrados: 0 };
    const { error: delErr } = await supabase
      .from("canales")
      .delete()
      .in("id", aBorrar);
    if (delErr) throw delErr;
    return { ok: true, borrados: aBorrar.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] purgeCanalesObsoletos:", msg);
    return { ok: false, error: msg, borrados: 0 };
  }
}

export async function deleteCanal(canalId: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("canales").delete().eq("id", canalId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] deleteCanal:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCanalConfig(
  canalId: string,
  patch: {
    descripcion?: string | null;
    solo_admins_envian?: boolean;
    bloquear_ajustes?: boolean;
    mensajes_efimeros_dias?: number | null;
  }
) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("canales")
      .update(patch)
      .eq("id", canalId)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] updateCanalConfig:", msg);
    return { ok: false, error: msg };
  }
}

export async function listCanalPreferencias() {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("canales_preferencias")
      .select("*")
      .eq("user_id", user.id);
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[comunicacion] listCanalPreferencias:", err);
    return { ok: false, data: [] };
  }
}

export async function upsertCanalPreferencia(
  canalId: string,
  patch: { silenciado?: boolean; fijado?: boolean; last_read_at?: string }
) {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };
    const { data, error } = await supabase
      .from("canales_preferencias")
      .upsert(
        { user_id: user.id, canal_id: canalId, ...patch },
        { onConflict: "user_id,canal_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] upsertCanalPreferencia:", msg);
    return { ok: false, error: msg };
  }
}

export async function vaciarCanal(canalId: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("mensajes").delete().eq("canal_id", canalId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] vaciarCanal:", msg);
    return { ok: false, error: msg };
  }
}

export async function toggleFijado(mensajeId: string, fijado: boolean) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("mensajes")
      .update({ fijado })
      .eq("id", mensajeId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] toggleFijado:", msg);
    return { ok: false, error: msg };
  }
}
