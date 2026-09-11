"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { generarEmbedding } from "@/lib/ia/embeddings";
import { MODULOS_SOPORTE } from "@/lib/soporte/modulos";
import type { HuecoConocimiento } from "@/features/soporte/types";

/**
 * Huecos: lo que la gente pregunta y el asistente no sabe contestar.
 *
 * Es la lista de trabajo de Dirección y el motor de que esto se alimente solo:
 * se escribe el artículo UNA vez, el asistente ya sabe contestar esa duda, y a
 * partir de ahí la pregunta acaba publicándose sola en las frecuentes.
 *
 * Por eso taparlo escribe directamente en la base del asistente y marca el hueco
 * como resuelto en el mismo gesto: si fueran dos pasos separados, la lista se
 * llenaría de huecos ya escritos y dejaría de servir para nada.
 */

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

export async function listHuecos(): Promise<HuecoConocimiento[]> {
  const { empresaId } = await requireDireccion();
  if (!empresaId) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("soporte_huecos")
    .select("id, pregunta, veces_preguntada, modulo_probable, estado, created_at, updated_at")
    .eq("empresa_id", empresaId)
    .eq("estado", "abierto")
    .order("veces_preguntada", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[soporte_huecos] listar", error);
    return [];
  }
  return (data ?? []) as HuecoConocimiento[];
}

const respuestaSchema = z.object({
  huecoId: z.string().uuid(),
  modulo: z.enum(MODULOS_SOPORTE as unknown as [string, ...string[]]),
  titulo: z.string().min(3, "El título es obligatorio").max(200),
  contenido: z.string().min(10, "La explicación es obligatoria").max(10000),
});

/**
 * Tapa un hueco: escribe el artículo en la base del asistente y da el hueco por
 * resuelto.
 *
 * El artículo va a `soporte_conocimiento`, que es global (el manual del software
 * es el mismo para todas las empresas). El hueco, en cambio, era de la empresa
 * que preguntó: se cierra solo ese.
 */
export async function responderHueco(input: {
  huecoId: string;
  modulo: string;
  titulo: string;
  contenido: string;
}): Promise<{ error?: string; success?: boolean }> {
  try {
    const { user, empresaId } = await requireDireccion();
    const parsed = respuestaSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { huecoId, modulo, titulo, contenido } = parsed.data;

    const embedding = await generarEmbedding(`${titulo}\n\n${contenido}`);
    if (!embedding) {
      // Sin embedding el artículo no se encontraría nunca: mejor no guardarlo
      // y decirlo, que dejar una fila muda en la base.
      return { error: "No se ha podido preparar el artículo. Inténtalo de nuevo." };
    }

    const admin = createAdminClient();
    const { data: creado, error: errCrear } = await admin
      .from("soporte_conocimiento")
      .insert({
        fuente: "manual",
        modulo,
        titulo,
        contenido,
        enlaces: [],
        videos: [],
        embedding: JSON.stringify(embedding),
        activo: true,
      })
      .select("id")
      .single();
    if (errCrear) return { error: errCrear.message };

    const { error: errCerrar } = await admin
      .from("soporte_huecos")
      .update({
        estado: "resuelto",
        conocimiento_id: creado?.id ?? null,
        resuelto_por: user.id,
        resuelto_en: new Date().toISOString(),
      })
      .eq("id", huecoId)
      .eq("empresa_id", empresaId ?? "");
    if (errCerrar) return { error: errCerrar.message };

    revalidatePath("/direccion/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/** Descarta un hueco que no merece artículo (una pregunta suelta, una prueba). */
export async function descartarHueco(
  huecoId: string,
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { user, empresaId } = await requireDireccion();
    const admin = createAdminClient();
    const { error } = await admin
      .from("soporte_huecos")
      .update({
        estado: "descartado",
        resuelto_por: user.id,
        resuelto_en: new Date().toISOString(),
      })
      .eq("id", huecoId)
      .eq("empresa_id", empresaId ?? "");
    if (error) return { error: error.message };

    revalidatePath("/direccion/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
