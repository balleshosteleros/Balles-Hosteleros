"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

export async function listProcesos() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("procesos_juridicos")
      .select(
        `*,
         actualizaciones:actualizaciones_juridicas(id, texto, fecha, apuntado_por),
         documentos:documentos_juridicos(id, nombre, descripcion, categoria, url, tipo_mime, subido_por, fecha_documento)`
      )
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[juridico] listProcesos:", err);
    return { ok: false, data: [] };
  }
}

export async function createProceso(input: {
  titulo: string;
  tipo: string;
  descripcion?: string;
  abogado?: string;
  fecha_inicio?: string;
  referencia?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("procesos_juridicos")
      .insert({
        empresa_id: empresaId,
        titulo: input.titulo,
        tipo: input.tipo,
        descripcion: input.descripcion ?? null,
        abogado: input.abogado ?? null,
        fecha_inicio: input.fecha_inicio ?? new Date().toISOString().split("T")[0],
        referencia: input.referencia ?? null,
        estado: "abierto",
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[juridico] createProceso:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateProceso(
  id: string,
  input: {
    titulo?: string;
    tipo?: string;
    descripcion?: string;
    abogado?: string;
    estado?: string;
    fecha_resolucion?: string;
    notas?: string;
  }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("procesos_juridicos")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[juridico] updateProceso:", msg);
    return { ok: false, error: msg };
  }
}
