"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarEmbeddings } from "@/lib/ia/embeddings";
import { MODULO_GENERAL } from "@/lib/soporte/modulos";
import type { Curso, Leccion, Puesto, Seccion } from "@/features/formacion/types";
import type { RecursoEnlace, RecursoVideo } from "@/features/soporte/types";

/**
 * Indexado automático de Formación en soporte_conocimiento (PRP-055).
 *
 * Formación vive en localStorage (cliente), así que el indexado se dispara
 * desde el panel admin enviando un snapshot. Esta acción:
 *   1. Construye un chunk por curso (resumen) y por lección (con vídeo + recursos).
 *   2. Mapea el puesto/ámbito del curso a un módulo canónico (candado de rol).
 *   3. Re-embebe solo lo que cambió y hace upsert idempotente por origen_ref.
 *   4. Borra los chunks de Formación cuyo origen ya no existe (cursos/lecciones eliminados).
 */

// Puesto del modelo de Formación → módulo canónico (debe casar con puedeVer()).
// Los puestos sin módulo propio (artista, mantenimiento) caen en GENERAL para
// que su formación siga llegándoles.
const PUESTO_A_MODULO: Record<Puesto, string> = {
  CAMARERO: "SALA",
  "JEFE DE SALA": "SALA",
  COCINERO: "COCINA",
  "JEFE DE COCINA": "COCINA",
  CACHIMBERO: "SALA",
  ARTISTA: MODULO_GENERAL,
  MANTENIMIENTO: MODULO_GENERAL,
  GERENTE: "GERENCIA",
  CONTABLE: "CONTABILIDAD",
};

function moduloDeCurso(curso: Curso): string {
  if (curso.ambito === "general" || !curso.puesto) return MODULO_GENERAL;
  return PUESTO_A_MODULO[curso.puesto] ?? MODULO_GENERAL;
}

export interface SnapshotFormacion {
  cursos: Curso[];
  secciones: Seccion[];
  lecciones: Leccion[];
}

interface ChunkIndexable {
  origen_ref: string;
  modulo: string;
  puesto: string | null;
  titulo: string;
  contenido: string;
  enlaces: RecursoEnlace[];
  videos: RecursoVideo[];
}

async function requireAdminOrDirector() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data } = await supabase
    .from("usuario_roles")
    .select("role")
    .eq("user_id", user.id);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin") && !roles.includes("director")) {
    throw new Error("No tienes permisos para sincronizar la formación");
  }
}

/** Construye los chunks indexables a partir del snapshot (solo cursos publicados). */
function construirChunks(snap: SnapshotFormacion): ChunkIndexable[] {
  const cursosPublicados = snap.cursos.filter((c) => c.publicado);
  const cursoById = new Map(cursosPublicados.map((c) => [c.id, c]));
  const chunks: ChunkIndexable[] = [];

  // Resumen de cada curso.
  for (const curso of cursosPublicados) {
    const modulo = moduloDeCurso(curso);
    chunks.push({
      origen_ref: `curso:${curso.id}`,
      modulo,
      puesto: curso.ambito === "puesto" ? (curso.puesto ?? null) : null,
      titulo: curso.titulo,
      contenido: `${curso.titulo}\n\n${curso.descripcion}`.trim(),
      enlaces: [],
      videos: [],
    });
  }

  // Una lección = un chunk con su vídeo y recursos.
  for (const lec of snap.lecciones) {
    const curso = cursoById.get(lec.cursoId);
    if (!curso) continue; // lección de curso no publicado o inexistente
    const modulo = moduloDeCurso(curso);
    const videos: RecursoVideo[] = lec.url
      ? [{ titulo: lec.titulo, url: lec.url, duracion_min: lec.duracionMin }]
      : [];
    const enlaces: RecursoEnlace[] = (lec.recursos ?? [])
      .filter((r) => r.url)
      .map((r) => ({ titulo: r.titulo, url: r.url }));
    chunks.push({
      origen_ref: `leccion:${lec.id}`,
      modulo,
      puesto: curso.ambito === "puesto" ? (curso.puesto ?? null) : null,
      titulo: lec.titulo,
      contenido: `${curso.titulo} › ${lec.titulo}\n\n${lec.descripcion}`.trim(),
      enlaces,
      videos,
    });
  }

  return chunks;
}

export async function sincronizarFormacion(
  snap: SnapshotFormacion,
): Promise<{ error?: string; indexados?: number; borrados?: number; reembebidos?: number }> {
  try {
    await requireAdminOrDirector();
    const admin = createAdminClient();
    const chunks = construirChunks(snap);

    // Chunks de Formación ya existentes (para re-embeber solo lo cambiado).
    const { data: existentes } = await admin
      .from("soporte_conocimiento")
      .select("origen_ref,contenido,embedding")
      .eq("fuente", "formacion");
    const previo = new Map(
      (existentes ?? []).map((r: { origen_ref: string; contenido: string; embedding: unknown }) => [
        r.origen_ref,
        { contenido: r.contenido, tieneEmbedding: r.embedding != null },
      ]),
    );

    // Decide qué textos hay que embeber (contenido nuevo o cambiado).
    const aEmbeber: { idx: number; texto: string }[] = [];
    chunks.forEach((c, idx) => {
      const prev = previo.get(c.origen_ref);
      if (!prev || prev.contenido !== c.contenido || !prev.tieneEmbedding) {
        aEmbeber.push({ idx, texto: c.contenido });
      }
    });

    // Embeddings en lotes para no enviar payloads enormes.
    const embeddingPorIdx = new Map<number, number[]>();
    const LOTE = 32;
    for (let i = 0; i < aEmbeber.length; i += LOTE) {
      const lote = aEmbeber.slice(i, i + LOTE);
      const vectores = await generarEmbeddings(lote.map((x) => x.texto));
      if (!vectores) return { error: "No se pudieron generar los embeddings" };
      lote.forEach((x, j) => embeddingPorIdx.set(x.idx, vectores[j]));
    }

    // Upsert idempotente por origen_ref.
    const filas = chunks.map((c, idx) => {
      const emb = embeddingPorIdx.get(idx);
      return {
        fuente: "formacion" as const,
        origen_ref: c.origen_ref,
        modulo: c.modulo,
        puesto: c.puesto,
        titulo: c.titulo,
        contenido: c.contenido,
        enlaces: c.enlaces,
        videos: c.videos,
        activo: true,
        updated_at: new Date().toISOString(),
        // Solo incluimos embedding si lo recalculamos; si no, conservamos el previo.
        ...(emb ? { embedding: JSON.stringify(emb) } : {}),
      };
    });

    if (filas.length > 0) {
      const { error } = await admin
        .from("soporte_conocimiento")
        .upsert(filas, { onConflict: "origen_ref" });
      if (error) return { error: error.message };
    }

    // Borra chunks de Formación cuyo origen ya no existe.
    const refsActuales = new Set(chunks.map((c) => c.origen_ref));
    const huérfanos = (existentes ?? [])
      .map((r: { origen_ref: string }) => r.origen_ref)
      .filter((ref: string) => ref && !refsActuales.has(ref));
    let borrados = 0;
    if (huérfanos.length > 0) {
      const { error } = await admin
        .from("soporte_conocimiento")
        .delete()
        .eq("fuente", "formacion")
        .in("origen_ref", huérfanos);
      if (!error) borrados = huérfanos.length;
    }

    return {
      indexados: filas.length,
      borrados,
      reembebidos: embeddingPorIdx.size,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
