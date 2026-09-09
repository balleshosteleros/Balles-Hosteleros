"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { leerVideosDeYoutube, type VideoYoutube } from "../services/youtube-lista";

/**
 * Traer un módulo entero desde YouTube.
 *
 * Los vídeos de la escuela viven en YouTube y ahí se quedan: esto solo copia el
 * TÍTULO y la dirección de cada uno para crear las lecciones de golpe, en vez de
 * pegarlas una a una. Si un vídeo ya está en el curso, no se repite: se puede
 * volver a lanzar cuando se añadan vídeos nuevos a la lista.
 */

const esquema = z.object({
  cursoId: z.string().uuid(),
  url: z.string().trim().min(1),
  tituloModulo: z.string().trim().max(200).default(""),
});

export type ResultadoImportacion = {
  ok: boolean;
  creadas?: number;
  repetidas?: number;
  error?: string;
};

/** Lo que se va a traer, para enseñarlo ANTES de crear nada. */
export async function previsualizarYoutube(
  url: string,
): Promise<{ ok: boolean; videos: VideoYoutube[]; error?: string }> {
  return leerVideosDeYoutube(url);
}

export async function importarDesdeYoutube(
  entrada: z.input<typeof esquema>,
): Promise<ResultadoImportacion> {
  const parsed = esquema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: "Datos no válidos" };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const empresaId = user ? await getEmpresaActivaForUser(supabase, user.id) : null;
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { cursoId, url, tituloModulo } = parsed.data;

    // El curso tiene que ser de la escuela y de esta empresa: no se importa
    // sobre un curso de la plantilla por equivocarse de identificador.
    const { data: curso } = await supabase
      .from("formacion_cursos")
      .select("id, ambito")
      .eq("id", cursoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!curso || curso.ambito !== "escuela") return { ok: false, error: "Curso no encontrado" };

    const lectura = await leerVideosDeYoutube(url);
    if (!lectura.ok) return { ok: false, error: lectura.error };

    const { data: existentes } = await supabase
      .from("formacion_lecciones")
      .select("video_url")
      .eq("curso_id", cursoId);
    const yaEstan = new Set(
      ((existentes ?? []) as { video_url: string | null }[])
        .map((l) => l.video_url ?? "")
        .filter(Boolean),
    );

    const nuevos = lectura.videos.filter((v) => !yaEstan.has(direccionVideo(v.videoId)));
    if (!nuevos.length) return { ok: true, creadas: 0, repetidas: lectura.videos.length };

    // Módulo donde caen las lecciones: el que se haya escrito, o uno nuevo.
    const { data: modulos } = await supabase
      .from("formacion_secciones")
      .select("id, titulo, orden")
      .eq("curso_id", cursoId)
      .order("orden", { ascending: true });

    const nombreModulo = tituloModulo || "Vídeos de YouTube";
    let moduloId = ((modulos ?? []) as { id: string; titulo: string }[]).find(
      (m) => m.titulo.trim().toLowerCase() === nombreModulo.trim().toLowerCase(),
    )?.id;

    if (!moduloId) {
      const { data: creado, error } = await supabase
        .from("formacion_secciones")
        .insert({
          empresa_id: empresaId,
          curso_id: cursoId,
          titulo: nombreModulo,
          orden: (modulos ?? []).length,
        })
        .select("id")
        .single();
      if (error) throw error;
      moduloId = creado?.id as string;
    }

    const { count: yaEnModulo } = await supabase
      .from("formacion_lecciones")
      .select("id", { count: "exact", head: true })
      .eq("seccion_id", moduloId);

    const desde = yaEnModulo ?? 0;
    const { error } = await supabase.from("formacion_lecciones").insert(
      nuevos.map((v, i) => ({
        empresa_id: empresaId,
        curso_id: cursoId,
        seccion_id: moduloId,
        titulo: v.titulo || "Lección sin título",
        video_url: direccionVideo(v.videoId),
        orden: desde + i,
      })),
    );
    if (error) throw error;

    return {
      ok: true,
      creadas: nuevos.length,
      repetidas: lectura.videos.length - nuevos.length,
    };
  } catch (e) {
    console.error("[escuela] importarDesdeYoutube:", e);
    return { ok: false, error: friendlyError(e, "importarDesdeYoutube") };
  }
}

function direccionVideo(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
