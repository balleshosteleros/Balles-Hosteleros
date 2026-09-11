"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { getModulosVisibles } from "@/lib/soporte/modulos-visibles";
import { MODULOS_SOPORTE } from "@/lib/soporte/modulos";
import type { Faq, FaqInput, FaqsByCategory } from "@/features/soporte/types";

/**
 * Preguntas frecuentes: las escribe el software solo, y se gestionan en
 * Dirección.
 *
 * El candado de quién ve qué tiene dos piezas, y las dos son de servidor:
 *   - la empresa, por RLS (`empresas_del_usuario()`), y siempre la ACTIVA;
 *   - el módulo, con el MISMO `getModulosVisibles()` que usa el asistente.
 *
 * Se reutiliza ese helper a propósito, en vez de escribir aquí otra vez la
 * lógica de permisos: si mañana cambia lo que ve un rol, cambia en un solo
 * sitio y el chat y las preguntas frecuentes no pueden separarse.
 */

const faqSchema = z.object({
  modulo: z.enum(MODULOS_SOPORTE as unknown as [string, ...string[]]),
  pregunta: z.string().min(3, "La pregunta es obligatoria").max(500),
  respuesta: z.string().min(1, "La respuesta es obligatoria").max(10000),
  estado: z.enum(["publicada", "borrador", "archivada"]).default("publicada"),
});

/** Gestionar la ayuda es cosa de Dirección, no de Ajustes. */
async function requireDireccion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { permisos } = await getRolContext();
  if (!puedeEditarModulo(permisos, "DIRECCIÓN")) {
    throw new Error("Sin permisos: la ayuda se gestiona desde Dirección");
  }
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { user, empresaId };
}

interface FilaFaq {
  id: string;
  empresa_id: string;
  modulo: string;
  pregunta: string;
  respuesta: string;
  veces_preguntada: number;
  origen: "ia" | "manual";
  estado: "publicada" | "borrador" | "archivada";
  created_at: string;
  updated_at: string;
}

function aFaq(f: FilaFaq): Faq {
  return {
    id: f.id,
    modulo: f.modulo,
    pregunta: f.pregunta,
    respuesta: f.respuesta,
    veces_preguntada: f.veces_preguntada,
    origen: f.origen,
    estado: f.estado,
    created_at: f.created_at,
    updated_at: f.updated_at,
  };
}

/**
 * Las preguntas frecuentes que puede ver el usuario actual, agrupadas por
 * módulo y ordenadas por cuánto se preguntan.
 */
export async function listFaqsForCurrentUser(): Promise<FaqsByCategory[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ modulos }, empresaId] = await Promise.all([
    getModulosVisibles(),
    getEmpresaActivaForUser(supabase, user.id),
  ]);
  if (!empresaId || modulos.length === 0) return [];

  const { data, error } = await supabase
    .from("soporte_faq")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("estado", "publicada")
    // CANDADO DE ROL: el filtro va en la propia consulta, no después.
    .in("modulo", modulos)
    .order("veces_preguntada", { ascending: false });

  if (error) {
    console.error("[soporte_faq] listar", error);
    return [];
  }

  const grouped = new Map<string, Faq[]>();
  for (const row of (data ?? []) as FilaFaq[]) {
    const arr = grouped.get(row.modulo) ?? [];
    arr.push(aFaq(row));
    grouped.set(row.modulo, arr);
  }

  return [...grouped.entries()]
    .map(([categoria, faqs]) => ({ categoria, faqs }))
    .sort((a, b) => b.faqs[0].veces_preguntada - a.faqs[0].veces_preguntada);
}

/** Todas las de la empresa activa, para el panel de Dirección. */
export async function listAllFaqs(): Promise<Faq[]> {
  const { empresaId } = await requireDireccion();
  if (!empresaId) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("soporte_faq")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("veces_preguntada", { ascending: false });

  if (error) {
    console.error("[soporte_faq] listar todas", error);
    return [];
  }
  return ((data ?? []) as FilaFaq[]).map(aFaq);
}

export async function createFaq(
  input: FaqInput,
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { user, empresaId } = await requireDireccion();
    if (!empresaId) return { error: "No hay empresa activa" };

    const parsed = faqSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const admin = createAdminClient();
    const { error } = await admin.from("soporte_faq").insert({
      ...parsed.data,
      empresa_id: empresaId,
      origen: "manual",
      veces_preguntada: 0,
      revisada_por: user.id,
      revisada_en: new Date().toISOString(),
    });
    if (error) return { error: error.message };

    revalidatePath("/direccion/ayuda");
    revalidatePath("/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function updateFaq(
  id: string,
  input: FaqInput,
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { user, empresaId } = await requireDireccion();
    const parsed = faqSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("soporte_faq")
      .update({
        ...parsed.data,
        revisada_por: user.id,
        revisada_en: new Date().toISOString(),
      })
      .eq("id", id)
      // Nunca se toca la pregunta de otra empresa, ni por error de la interfaz.
      .eq("empresa_id", empresaId ?? "");
    if (error) return { error: error.message };

    revalidatePath("/direccion/ayuda");
    revalidatePath("/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/**
 * Quitar una pregunta de la vista.
 *
 * Se archiva, no se borra: las que escribe el software conservan de qué
 * consultas salieron, y borrarlas sería perder ese rastro. Además, una
 * archivada no se vuelve a publicar sola en la siguiente pasada.
 */
export async function archivarFaq(
  id: string,
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { user, empresaId } = await requireDireccion();
    const admin = createAdminClient();
    const { error } = await admin
      .from("soporte_faq")
      .update({
        estado: "archivada",
        revisada_por: user.id,
        revisada_en: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("empresa_id", empresaId ?? "");
    if (error) return { error: error.message };

    revalidatePath("/direccion/ayuda");
    revalidatePath("/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function publicarFaq(
  id: string,
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { user, empresaId } = await requireDireccion();
    const admin = createAdminClient();
    const { error } = await admin
      .from("soporte_faq")
      .update({
        estado: "publicada",
        revisada_por: user.id,
        revisada_en: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("empresa_id", empresaId ?? "");
    if (error) return { error: error.message };

    revalidatePath("/direccion/ayuda");
    revalidatePath("/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
