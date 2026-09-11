"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { generarEmbedding } from "@/lib/ia/embeddings";
import { MODULOS_SOPORTE } from "@/lib/soporte/modulos";
import type {
  ConocimientoChunk,
  ConocimientoManualInput,
} from "@/features/soporte/types";

const enlaceSchema = z.object({
  titulo: z.string().min(1).max(200),
  url: z.string().url("URL no válida").max(1000),
});
const videoSchema = z.object({
  titulo: z.string().min(1).max(200),
  url: z.string().url("URL no válida").max(1000),
  duracion_min: z.number().int().min(0).max(600).optional(),
});

const manualSchema = z.object({
  modulo: z.enum(MODULOS_SOPORTE as unknown as [string, ...string[]]),
  titulo: z.string().min(3, "El título es obligatorio").max(200),
  contenido: z.string().min(10, "El contenido es obligatorio").max(10000),
  enlaces: z.array(enlaceSchema).max(20).default([]),
  videos: z.array(videoSchema).max(20).default([]),
  activo: z.boolean().default(true),
});

/** La base del asistente se gestiona desde Dirección, no desde Ajustes. */
async function requireAdminOrDirector() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { permisos } = await getRolContext();
  if (!puedeEditarModulo(permisos, "DIRECCIÓN")) {
    throw new Error("Sin permisos: la base del asistente se gestiona desde Dirección");
  }
  return user;
}

/** Texto que se embebe: título + contenido (lo que el bot busca por similitud). */
function textoParaEmbedding(titulo: string, contenido: string): string {
  return `${titulo}\n\n${contenido}`.trim();
}

/** pgvector espera el literal '[0.1,0.2,...]', no un array JS crudo. */
function aVectorLiteral(embedding: number[] | null): string | null {
  return embedding ? JSON.stringify(embedding) : null;
}

/** Lista TODO (admin). soporte_conocimiento es global → service role. */
export async function listConocimiento(): Promise<ConocimientoChunk[]> {
  await requireAdminOrDirector();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("soporte_conocimiento")
    .select(
      "id,fuente,origen_ref,modulo,departamento,puesto,titulo,contenido,enlaces,videos,activo,created_at,updated_at",
    )
    .order("fuente", { ascending: true })
    .order("modulo", { ascending: true })
    .order("titulo", { ascending: true });

  if (error) {
    console.error("[conocimiento] list:", error);
    return [];
  }
  return (data ?? []) as ConocimientoChunk[];
}

/** Resumen para el panel: nº de chunks por fuente y módulo + cuántos sin embedding. */
export async function estadoIndice(): Promise<{
  total: number;
  porFuente: Record<string, number>;
  porModulo: Record<string, number>;
  sinEmbedding: number;
}> {
  await requireAdminOrDirector();
  const admin = createAdminClient();
  // Sin traer `embedding`: son 384 números por artículo y solo hacía falta
  // saber cuántos están vacíos. Con el manual entero indexado eso eran varios
  // megas por cada vez que se abre la pantalla, para pintar cinco cifras.
  const { data, error } = await admin
    .from("soporte_conocimiento")
    .select("fuente,modulo");

  const porFuente: Record<string, number> = {};
  const porModulo: Record<string, number> = {};
  if (error || !data) {
    if (error) console.error("[conocimiento] estado:", error);
    return { total: 0, porFuente, porModulo, sinEmbedding: 0 };
  }
  for (const row of data as { fuente: string; modulo: string }[]) {
    porFuente[row.fuente] = (porFuente[row.fuente] ?? 0) + 1;
    porModulo[row.modulo] = (porModulo[row.modulo] ?? 0) + 1;
  }

  // Los que se quedaron sin preparar: el asistente no los encuentra nunca.
  const { count } = await admin
    .from("soporte_conocimiento")
    .select("id", { count: "exact", head: true })
    .is("embedding", null);

  return { total: data.length, porFuente, porModulo, sinEmbedding: count ?? 0 };
}

export async function createConocimientoManual(
  input: ConocimientoManualInput,
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireAdminOrDirector();
    const parsed = manualSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { modulo, titulo, contenido, enlaces, videos, activo } = parsed.data;
    const embedding = await generarEmbedding(textoParaEmbedding(titulo, contenido));

    const admin = createAdminClient();
    const { error } = await admin.from("soporte_conocimiento").insert({
      fuente: "manual",
      modulo,
      titulo,
      contenido,
      enlaces,
      videos,
      activo,
      embedding: aVectorLiteral(embedding),
    });
    if (error) return { error: error.message };

    revalidatePath("/direccion/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function updateConocimientoManual(
  id: string,
  input: ConocimientoManualInput,
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireAdminOrDirector();
    const parsed = manualSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { modulo, titulo, contenido, enlaces, videos, activo } = parsed.data;
    // Re-embeber siempre al guardar (el texto pudo cambiar).
    const embedding = await generarEmbedding(textoParaEmbedding(titulo, contenido));

    const admin = createAdminClient();
    const { error } = await admin
      .from("soporte_conocimiento")
      .update({
        modulo,
        titulo,
        contenido,
        enlaces,
        videos,
        activo,
        embedding: aVectorLiteral(embedding),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("fuente", "manual"); // no se editan a mano los chunks de Formación
    if (error) return { error: error.message };

    revalidatePath("/direccion/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function deleteConocimientoManual(
  id: string,
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireAdminOrDirector();
    const admin = createAdminClient();
    const { error } = await admin
      .from("soporte_conocimiento")
      .delete()
      .eq("id", id)
      .eq("fuente", "manual");
    if (error) return { error: error.message };

    revalidatePath("/direccion/ayuda");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/**
 * Vuelve a meter el manual del software en la base del asistente.
 *
 * El manual viaja con el código, así que normalmente se actualiza solo al
 * desplegar. Este botón existe para el caso en que haga falta forzarlo: por
 * ejemplo si una pasada anterior se quedó a medias y hay artículos sin
 * preparar, que son artículos que el asistente no encontraría nunca.
 *
 * Es idempotente: no duplica nada.
 */
export async function reindexarManual(): Promise<{
  error?: string;
  success?: boolean;
  resumen?: string;
}> {
  try {
    await requireAdminOrDirector();
    const { indexarManualSoftware } = await import(
      "@/features/soporte/services/indexar-manual"
    );
    const r = await indexarManualSoftware();

    revalidatePath("/direccion/ayuda");
    const partes = [`${r.total} artículos`];
    if (r.insertados) partes.push(`${r.insertados} nuevos`);
    if (r.actualizados) partes.push(`${r.actualizados} actualizados`);
    if (r.sinEmbedding) partes.push(`${r.sinEmbedding} sin preparar`);
    return { success: true, resumen: partes.join(", ") };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
