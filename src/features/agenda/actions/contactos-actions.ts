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
 * Cuenta los contactos NUEVOS que el usuario todavía no ha visto: los creados
 * después de la última vez que abrió la agenda (marca `agenda_contactos_vistos`).
 * El parámetro `dias` acota la ventana máxima hacia atrás para un usuario que
 * nunca ha abierto la agenda (no anunciar contactos muy antiguos). En cuanto el
 * usuario abre la agenda, su marca se actualiza a "ahora" y el badge se pone a 0
 * SOLO para él, sin afectar a los demás.
 */
export async function contarContactosNuevos(dias = 7): Promise<number> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const empresaId = await getEmpresaId();
    if (!user || !empresaId) return 0;

    const ventana = Math.max(1, Math.min(365, Math.floor(dias)));
    const ventanaCutoff = new Date(
      Date.now() - ventana * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Marca "visto hasta" del usuario para esta empresa.
    const { data: vista } = await supabase
      .from("agenda_contactos_vistos")
      .select("visto_at")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    // El corte es el más reciente entre "lo que ya vio" y la ventana máxima:
    // así nunca contamos contactos anteriores a la última visita ni contactos
    // muy antiguos para un usuario que nunca ha entrado.
    const cutoff =
      vista?.visto_at && vista.visto_at > ventanaCutoff
        ? vista.visto_at
        : ventanaCutoff;

    const { count, error } = await supabase
      .from("contactos_agenda")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .gt("created_at", cutoff);
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error("[contactos] contarContactosNuevos:", err);
    return 0;
  }
}

/**
 * Devuelve la marca "visto hasta" del usuario para la empresa activa, o el
 * inicio de la ventana de anuncio si nunca ha abierto la agenda. La lista de
 * contactos usa este valor para resaltar los creados después (contactos nuevos).
 */
export async function getContactosVistosAt(dias = 7): Promise<string> {
  const ventana = Math.max(1, Math.min(365, Math.floor(dias)));
  const ventanaCutoff = new Date(
    Date.now() - ventana * 24 * 60 * 60 * 1000,
  ).toISOString();
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const empresaId = await getEmpresaId();
    if (!user || !empresaId) return ventanaCutoff;
    const { data } = await supabase
      .from("agenda_contactos_vistos")
      .select("visto_at")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (data?.visto_at && data.visto_at > ventanaCutoff) return data.visto_at;
    return ventanaCutoff;
  } catch (err) {
    console.error("[contactos] getContactosVistosAt:", err);
    return ventanaCutoff;
  }
}

/**
 * Marca los contactos de la agenda como vistos para el usuario actual en la
 * empresa activa (upsert de `visto_at = ahora`). Al llamarse desde la agenda,
 * el badge de "contactos nuevos" se pone a 0 para este usuario. Idempotente.
 */
export async function marcarContactosVistos(): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const empresaId = await getEmpresaId();
    if (!user || !empresaId) return { ok: false };
    const { error } = await supabase
      .from("agenda_contactos_vistos")
      .upsert(
        { user_id: user.id, empresa_id: empresaId, visto_at: new Date().toISOString() },
        { onConflict: "user_id,empresa_id" },
      );
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[contactos] marcarContactosVistos:", err);
    return { ok: false };
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
