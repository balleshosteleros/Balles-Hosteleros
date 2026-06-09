"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Faq, FaqInput, FaqsByCategory } from "@/features/soporte/types";

const APP_ROLES = [
  "admin",
  "director",
  "gerencia",
  "responsable",
  "empleado",
  "solo_lectura",
] as const;

const faqSchema = z.object({
  categoria: z.string().min(1, "La categoría es obligatoria").max(50),
  pregunta: z.string().min(3, "La pregunta es obligatoria").max(500),
  respuesta: z.string().min(1, "La respuesta es obligatoria").max(10000),
  visible_para: z
    .array(z.enum(APP_ROLES))
    .min(1, "Debe ser visible al menos para un rol"),
  orden: z.number().int().min(0).default(0),
});

async function requireAdminOrDirector() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { data: rolesData } = await supabase
    .from("usuario_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
  const canEdit = roles.includes("admin") || roles.includes("director");

  if (!canEdit) throw new Error("No tienes permisos para editar FAQs");

  return user;
}

/**
 * Lista las FAQs visibles para el usuario actual, agrupadas por categoría.
 * RLS de Supabase se encarga del filtrado por rol automáticamente.
 */
export async function listFaqsForCurrentUser(): Promise<FaqsByCategory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .order("categoria", { ascending: true })
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error listing FAQs:", error);
    return [];
  }

  // Agrupar por categoría
  const grouped = new Map<string, Faq[]>();
  for (const row of (data ?? []) as Faq[]) {
    const arr = grouped.get(row.categoria) ?? [];
    arr.push(row);
    grouped.set(row.categoria, arr);
  }

  return Array.from(grouped.entries()).map(([categoria, faqs]) => ({
    categoria,
    faqs,
  }));
}

/**
 * Lista TODAS las FAQs para el panel admin (sin filtrar por rol visible).
 * Solo accesible por admin/director.
 */
export async function listAllFaqs(): Promise<Faq[]> {
  await requireAdminOrDirector();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .order("categoria", { ascending: true })
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error listing all FAQs:", error);
    return [];
  }

  return (data ?? []) as Faq[];
}

export async function createFaq(
  input: FaqInput
): Promise<{ error?: string; success?: boolean }> {
  try {
    const user = await requireAdminOrDirector();
    const parsed = faqSchema.safeParse(input);

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("faqs").insert({
      ...parsed.data,
      created_by: user.id,
    });

    if (error) return { error: error.message };

    revalidatePath("/ajustes/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function updateFaq(
  id: string,
  input: FaqInput
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireAdminOrDirector();
    const parsed = faqSchema.safeParse(input);

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("faqs")
      .update(parsed.data)
      .eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/ajustes/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function deleteFaq(
  id: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireAdminOrDirector();

    const supabase = await createClient();
    const { error } = await supabase.from("faqs").delete().eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/ajustes/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
