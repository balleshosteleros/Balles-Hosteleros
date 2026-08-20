"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { CategoriaMaterial, TipoMaterial } from "@/features/rrhh/data/entregas";

/**
 * Catálogo de tipos de material y uniforme.
 *
 * Cada empresa se crea sus propias "palabras clave" (Camiseta, Chaquetilla,
 * Llaves del local...) desde el engranaje de Configuración del submódulo
 * Entregas. Luego se eligen al registrar una entrega.
 */

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

function mensajeError(err: unknown): string {
  if (err instanceof Error) {
    // 23505 = índice único (empresa_id, lower(nombre)).
    if (err.message.includes("23505") || err.message.includes("duplicate key")) {
      return "Ya existe un tipo con ese nombre";
    }
    return err.message;
  }
  if (err && typeof err === "object" && "code" in err) {
    if ((err as { code?: string }).code === "23505") return "Ya existe un tipo con ese nombre";
  }
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Error desconocido";
}

type FilaTipo = {
  id: string;
  nombre: string;
  categoria: string;
  requiere_talla: boolean | null;
  requiere_devolucion: boolean | null;
  activo: boolean | null;
  orden: number | null;
};

function mapTipo(r: FilaTipo): TipoMaterial {
  return {
    id: r.id,
    nombre: r.nombre,
    categoria: (r.categoria === "uniforme" ? "uniforme" : "material") as CategoriaMaterial,
    requiereTalla: !!r.requiere_talla,
    requiereDevolucion: !!r.requiere_devolucion,
    activo: !!r.activo,
    orden: r.orden ?? 0,
  };
}

/**
 * Lista el catálogo de la empresa activa.
 * La configuración lo llama con `incluirInactivos = true`; los selectores, no.
 */
export async function listTiposMaterial(incluirInactivos = false): Promise<TipoMaterial[]> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return [];

  let query = supabase
    .from("entregas_tipos_material")
    .select("id, nombre, categoria, requiere_talla, requiere_devolucion, activo, orden")
    .eq("empresa_id", empresaId);
  if (!incluirInactivos) query = query.eq("activo", true);

  const { data, error } = await query
    .order("categoria", { ascending: true })
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    console.error("[rrhh] listTiposMaterial:", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapTipo(r as FilaTipo));
}

export async function createTipoMaterial(input: {
  nombre: string;
  categoria: CategoriaMaterial;
  requiereTalla: boolean;
  requiereDevolucion: boolean;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false as const, error: "El nombre es obligatorio" };

    // Siguiente orden dentro de su categoría.
    const { data: ult } = await supabase
      .from("entregas_tipos_material")
      .select("orden")
      .eq("empresa_id", empresaId)
      .eq("categoria", input.categoria)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const orden = ((ult?.orden as number) ?? 0) + 1;

    const { data, error } = await supabase
      .from("entregas_tipos_material")
      .insert({
        empresa_id: empresaId,
        nombre,
        categoria: input.categoria,
        requiere_talla: input.requiereTalla,
        requiere_devolucion: input.requiereDevolucion,
        orden,
      })
      .select("id, nombre, categoria, requiere_talla, requiere_devolucion, activo, orden")
      .single();
    if (error) throw error;

    revalidatePath("/rrhh/entregas");
    return { ok: true as const, tipo: mapTipo(data as FilaTipo) };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

export async function updateTipoMaterial(
  id: string,
  cambios: {
    nombre?: string;
    categoria?: CategoriaMaterial;
    requiereTalla?: boolean;
    requiereDevolucion?: boolean;
    activo?: boolean;
  },
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (cambios.nombre !== undefined) {
      const nombre = cambios.nombre.trim();
      if (!nombre) return { ok: false as const, error: "El nombre es obligatorio" };
      payload.nombre = nombre;
    }
    if (cambios.categoria !== undefined) payload.categoria = cambios.categoria;
    if (cambios.requiereTalla !== undefined) payload.requiere_talla = cambios.requiereTalla;
    if (cambios.requiereDevolucion !== undefined) payload.requiere_devolucion = cambios.requiereDevolucion;
    if (cambios.activo !== undefined) payload.activo = cambios.activo;

    const { error } = await supabase
      .from("entregas_tipos_material")
      .update(payload)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    revalidatePath("/rrhh/entregas");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/**
 * Borra un tipo del catálogo. Las entregas ya hechas NO se tocan: guardan el
 * nombre congelado en `tipo_nombre`, así que el histórico sigue diciendo lo
 * mismo (la FK es ON DELETE SET NULL).
 */
export async function deleteTipoMaterial(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const { error } = await supabase
      .from("entregas_tipos_material")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    revalidatePath("/rrhh/entregas");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}
