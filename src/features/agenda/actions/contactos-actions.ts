"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
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
  return getEmpresaActivaForUser(supabase, user.id);
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

/**
 * Cuenta los contactos añadidos a la agenda en los últimos `dias` días.
 * Cada contacto cuenta para el badge durante su ventana de anuncio: a los
 * `dias` días deja de contar, pero otros más recientes siguen anunciándose.
 */
export async function contarContactosNuevos(dias = 7): Promise<number> {
  try {
    const supabase = await createClient();
    const empresaId = await getEmpresaId();
    if (!empresaId) return 0;
    const ventana = Math.max(1, Math.min(365, Math.floor(dias)));
    const cutoff = new Date(Date.now() - ventana * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("contactos_agenda")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .gte("created_at", cutoff);
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error("[contactos] contarContactosNuevos:", err);
    return 0;
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
    // Los contactos automáticos (emergencias, empleados, proveedores) no se
    // editan aquí: sus datos se gestionan en su ficha original.
    const { data: existente } = await supabase
      .from("contactos_agenda")
      .select("protegido")
      .eq("id", id)
      .single();
    if (existente?.protegido) {
      return { ok: false, error: "Este contacto es automático: edítalo en su ficha original." };
    }
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
    // Los contactos protegidos (emergencias por defecto y los sincronizados desde
    // empleados/proveedores) no se pueden borrar a mano: se gestionan en su origen.
    const { data: existente } = await supabase
      .from("contactos_agenda")
      .select("protegido")
      .eq("id", id)
      .single();
    if (existente?.protegido) {
      return { ok: false, error: "Este contacto no se puede eliminar (se gestiona desde su origen)." };
    }
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
