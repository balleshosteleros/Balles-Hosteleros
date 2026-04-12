"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import type { TipoProducto } from "@/features/logistica/data/productos";

export type TaxonomiaKind = "categoria" | "familia";

export interface TaxonomiaEntry {
  id: string;
  nombre: string;
  orden: number;
  tipo_producto: TipoProducto;
  kind: TaxonomiaKind;
}

const taxonomiaInputSchema = z.object({
  tipo_producto: z.enum(["compra", "venta"]),
  kind: z.enum(["categoria", "familia"]),
  nombre: z.string().min(1, "El nombre no puede estar vacío").max(100),
  orden: z.number().int().min(0).default(0),
});

async function requireManagement() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
  const canManage =
    roles.includes("admin") ||
    roles.includes("director") ||
    roles.includes("gerencia") ||
    roles.includes("responsable");

  if (!canManage) throw new Error("No tienes permisos");

  return user;
}

async function getUserEmpresaId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", userId)
    .single();
  return (data as { empresa_id: string | null } | null)?.empresa_id ?? null;
}

/**
 * Lista todas las entradas de taxonomía (categorías y familias) para un tipo
 * de producto dado, agrupadas por kind. Ordenadas por el campo `orden`.
 */
export async function listTaxonomia(tipo: TipoProducto): Promise<{
  categorias: TaxonomiaEntry[];
  familias: TaxonomiaEntry[];
}> {
  try {
    const { supabase } = await getLogisticaContext();
    const { data, error } = await supabase
      .from("producto_taxonomia")
      .select("*")
      .eq("tipo_producto", tipo)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error listing taxonomia:", error);
      return { categorias: [], familias: [] };
    }

    const rows = (data ?? []) as TaxonomiaEntry[];
    return {
      categorias: rows.filter((r) => r.kind === "categoria"),
      familias: rows.filter((r) => r.kind === "familia"),
    };
  } catch (err) {
    console.error("listTaxonomia failed:", err);
    return { categorias: [], familias: [] };
  }
}

export async function createTaxonomia(
  tipo: TipoProducto,
  kind: TaxonomiaKind,
  nombre: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    const user = await requireManagement();
    const parsed = taxonomiaInputSchema.safeParse({
      tipo_producto: tipo,
      kind,
      nombre: nombre.trim(),
      orden: 0,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const empresaId = await getUserEmpresaId(user.id);
    if (!empresaId) return { error: "No tienes empresa asignada" };

    const supabase = await createClient();

    // Orden al final de la lista
    const { data: existing } = await supabase
      .from("producto_taxonomia")
      .select("orden")
      .eq("empresa_id", empresaId)
      .eq("tipo_producto", tipo)
      .eq("kind", kind)
      .order("orden", { ascending: false })
      .limit(1);

    const nextOrden =
      ((existing as { orden: number }[] | null)?.[0]?.orden ?? 0) + 1;

    const { error } = await supabase.from("producto_taxonomia").insert({
      empresa_id: empresaId,
      tipo_producto: tipo,
      kind,
      nombre: parsed.data.nombre,
      orden: nextOrden,
      created_by: user.id,
    });

    if (error) {
      if (error.code === "23505") {
        return { error: `Ya existe "${parsed.data.nombre}" en esta lista` };
      }
      return { error: error.message };
    }

    revalidatePath("/logistica/productos");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function renameTaxonomia(
  id: string,
  newNombre: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireManagement();
    const trimmed = newNombre.trim();
    if (!trimmed) return { error: "El nombre no puede estar vacío" };
    if (trimmed.length > 100) return { error: "Nombre demasiado largo" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("producto_taxonomia")
      .update({ nombre: trimmed })
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        return { error: `Ya existe "${trimmed}" en esta lista` };
      }
      return { error: error.message };
    }

    revalidatePath("/logistica/productos");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function deleteTaxonomia(
  id: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireManagement();
    const supabase = await createClient();
    const { error } = await supabase
      .from("producto_taxonomia")
      .delete()
      .eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/logistica/productos");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
