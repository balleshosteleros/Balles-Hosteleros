"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildReservaUrl,
  validarPalabraClave,
  type ReservaLink,
} from "@/features/sala/data/reserva-links";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, empresaSlug: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  let empresaSlug: string | null = null;
  if (empresaId) {
    const { data } = await supabase.from("empresas").select("slug").eq("id", empresaId).maybeSingle();
    empresaSlug = (data?.slug as string) ?? null;
  }
  return { supabase, user, empresaId, empresaSlug };
}

type Row = Record<string, unknown>;

function rowToLink(row: Row, empresaSlug: string | null = null): ReservaLink {
  const palabraClave = row.palabra_clave as string;
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    palabraClave,
    urlGenerada: empresaSlug ? buildReservaUrl(empresaSlug, palabraClave) : (row.url_generada as string),
    activo: row.activo as boolean,
    creadoPor: (row.creado_por as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listReservaLinks() {
  try {
    const { supabase, empresaId, empresaSlug } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as ReservaLink[], error: "Sin empresa" };
    const { data, error } = await supabase
      .from("reserva_links")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((row) => rowToLink(row, empresaSlug)) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, data: [] as ReservaLink[], error: msg };
  }
}

export async function createReservaLink(palabraClaveRaw: string) {
  try {
    const v = validarPalabraClave(palabraClaveRaw);
    if (!v.ok) return { ok: false, error: v.error };
    const { supabase, user, empresaId, empresaSlug } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    if (!empresaSlug) return { ok: false, error: "La empresa no tiene slug configurado" };
    const url = buildReservaUrl(empresaSlug, v.valor);
    const { data, error } = await supabase
      .from("reserva_links")
      .insert({
        empresa_id: empresaId,
        palabra_clave: v.valor,
        url_generada: url,
        creado_por: user?.id ?? null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un link con esa palabra clave" };
      throw error;
    }
    revalidatePath("/sala/reservas/links");
    return { ok: true, data: rowToLink(data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

export async function toggleReservaLink(id: string, activo: boolean) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const { error } = await supabase
      .from("reserva_links")
      .update({ activo, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/sala/reservas/links");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

export async function deleteReservaLink(id: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const { error } = await supabase
      .from("reserva_links")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/sala/reservas/links");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}
