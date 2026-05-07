"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Contacto,
  ContactoInput,
  Etiqueta,
  EtiquetaInput,
} from "@/features/agenda/types";

async function getEmpresaId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .single();
  return data?.empresa_id ?? null;
}

// ─────────────────────────── Contactos ───────────────────────────

export async function listContactos(): Promise<Contacto[]> {
  try {
    const supabase = await createClient();
    const empresaId = await getEmpresaId();
    const query = supabase
      .from("contactos_agenda")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Contacto[];
  } catch (err) {
    console.error("[contactos] listContactos:", err);
    return [];
  }
}

export async function createContacto(input: ContactoInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const empresaId = await getEmpresaId();
    const { error } = await supabase.from("contactos_agenda").insert({
      ...input,
      etiqueta_id: input.etiqueta_id ?? null,
      empresa_id: empresaId,
      created_by: user?.id ?? null,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contactos] createContacto:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateContacto(id: string, input: ContactoInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("contactos_agenda")
      .update({
        ...input,
        etiqueta_id: input.etiqueta_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contactos] updateContacto:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteContacto(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("contactos_agenda")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contactos] deleteContacto:", msg);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────── Etiquetas ───────────────────────────

export async function listEtiquetas(): Promise<Etiqueta[]> {
  try {
    const supabase = await createClient();
    const empresaId = await getEmpresaId();
    const query = supabase
      .from("contacto_etiquetas")
      .select("*")
      .order("nombre", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Etiqueta[];
  } catch (err) {
    console.error("[contactos] listEtiquetas:", err);
    return [];
  }
}

export async function createEtiqueta(input: EtiquetaInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const empresaId = await getEmpresaId();
    const { data, error } = await supabase
      .from("contacto_etiquetas")
      .insert({
        nombre,
        categoria: input.categoria,
        color: input.color,
        empresa_id: empresaId,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data?.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contactos] createEtiqueta:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateEtiqueta(id: string, input: EtiquetaInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
    const supabase = await createClient();
    const { error } = await supabase
      .from("contacto_etiquetas")
      .update({
        nombre,
        categoria: input.categoria,
        color: input.color,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contactos] updateEtiqueta:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteEtiqueta(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("contacto_etiquetas")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contactos] deleteEtiqueta:", msg);
    return { ok: false, error: msg };
  }
}
