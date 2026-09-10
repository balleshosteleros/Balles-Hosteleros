"use server";

import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPermisos } from "@/features/auth/actions/permisos-actions";
import { puedeVerModulo } from "@/features/auth/lib/permisos";
import {
  getMetaCredenciales,
  type MetaCredenciales,
} from "@/features/marketing/meta-ads/services/meta-credenciales";
import {
  getEstadoVideo,
  subirImagenAMeta,
  subirVideoAMeta,
  MAX_IMAGEN_BYTES,
  TIPOS_IMAGEN,
  TIPOS_VIDEO,
} from "@/features/marketing/meta-ads/services/meta-medios";
import { presignGetR2, presignPutR2 } from "@/shared/lib/r2";
import { MetaApiError } from "@/features/marketing/meta-ads/lib/meta-api";

/**
 * PRP-087 · Fase 6 — Subir a Meta las fotos y los vídeos del anuncio.
 *
 * Fotos: van por aquí, que pesan poco.
 * Vídeos: NO pasan por el servidor. El navegador los sube directo a R2 y luego
 * se le dice a Meta de dónde descargarlo. Un vídeo de un reel puede pesar
 * cientos de megas y no tiene sentido moverlo dos veces.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

async function contexto(): Promise<
  | { ok: true; empresaId: string; cred: MetaCredenciales; admin: ReturnType<typeof createAdminClient> }
  | { ok: false; error: string }
> {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return fallo("Sesión no válida.");
  if (!empresaId) return fallo("Sin empresa activa.");

  const { permisos } = await getUserPermisos();
  if (!puedeVerModulo(permisos, "MARKETING")) {
    return fallo("No tienes permiso para gestionar la publicidad de Meta.");
  }

  const admin = createAdminClient();
  const cred = await getMetaCredenciales(admin, empresaId);
  if (!cred) return fallo("Esta empresa no tiene Meta conectado. Ve a Ajustes → Integraciones.");

  return { ok: true, empresaId, cred, admin };
}

/**
 * Sube una foto a Meta y la deja registrada como medio de la empresa.
 * Devuelve el `image_hash`, que es lo que se usa al montar el anuncio.
 */
export async function subirImagenMetaAction(
  formData: FormData,
): Promise<Resultado<{ medioId: string; imageHash: string; url: string | null }>> {
  const c = await contexto();
  if (!c.ok) return c;

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) return fallo("No ha llegado ninguna imagen.");

  if (!TIPOS_IMAGEN.includes(archivo.type as (typeof TIPOS_IMAGEN)[number])) {
    return fallo("La imagen tiene que ser JPG, PNG o WEBP.");
  }
  if (archivo.size > MAX_IMAGEN_BYTES) {
    return fallo("La imagen pesa más de 8 MB, que es el máximo que admite Meta.");
  }

  try {
    const nombre = archivo.name || `imagen-${Date.now()}.jpg`;
    const { imageHash, url } = await subirImagenAMeta(c.cred, archivo, nombre);

    const { data, error } = await c.admin
      .from("meta_medios")
      .insert({
        empresa_id: c.empresaId,
        tipo: "imagen",
        nombre,
        url_origen: url ?? "",
        image_hash: imageHash,
        estado: "listo",
      })
      .select("id")
      .single<{ id: string }>();

    if (error) return fallo(error.message);
    return { ok: true, data: { medioId: data.id, imageHash, url } };
  } catch (err) {
    if (err instanceof MetaApiError) return fallo(err.message);
    return fallo(err instanceof Error ? err.message : "No se ha podido subir la imagen.");
  }
}

const presignSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  tipo: z.string().trim().min(1),
  bytes: z.number().int().positive().max(1_073_741_824, "El vídeo no puede pasar de 1 GB."),
});

/**
 * Paso 1 del vídeo: dirección para que el navegador lo suba directo a R2.
 * Así el archivo no atraviesa la función, que tiene límite de tamaño y de tiempo.
 */
export async function presignVideoMetaAction(
  input: z.input<typeof presignSchema>,
): Promise<Resultado<{ clave: string; urlSubida: string }>> {
  // `bytes` lo valida Zod (tope de 1 GB) antes de dar ninguna dirección de
  // subida: no tiene sentido firmar una subida que va a rebotar.
  const parsed = presignSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  const { nombre, tipo } = parsed.data;

  const c = await contexto();
  if (!c.ok) return c;

  if (!TIPOS_VIDEO.includes(tipo as (typeof TIPOS_VIDEO)[number])) {
    return fallo("El vídeo tiene que ser MP4 o MOV.");
  }

  // Carpeta por empresa: los vídeos de HABANA no se mezclan con los de BACANAL.
  const limpio = nombre.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const clave = `meta-ads/${c.empresaId}/${Date.now()}-${limpio}`;

  // Media hora para subir: un vídeo largo por una conexión mala tarda, pero
  // una dirección de subida abierta indefinidamente no debe existir.
  return { ok: true, data: { clave, urlSubida: presignPutR2(clave, tipo, 1800) } };
}

const videoSchema = z.object({
  clave: z.string().trim().min(1),
  nombre: z.string().trim().min(1).max(200),
});

/**
 * Paso 2 del vídeo: ya está en R2, así que se le pasa a Meta la dirección para
 * que lo descargue. La URL firmada dura 2 horas: de sobra para que Meta lo
 * coja, y no queda un enlace público permanente.
 */
export async function registrarVideoMetaAction(
  input: z.input<typeof videoSchema>,
): Promise<Resultado<{ medioId: string; videoId: string }>> {
  const parsed = videoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  const { clave, nombre } = parsed.data;

  const c = await contexto();
  if (!c.ok) return c;

  // Que la clave sea de ESTA empresa, no de otra: la manda el navegador.
  if (!clave.startsWith(`meta-ads/${c.empresaId}/`)) {
    return fallo("Ese vídeo no pertenece a esta empresa.");
  }

  try {
    const urlDescarga = presignGetR2(clave, 7200);
    const { videoId } = await subirVideoAMeta(c.cred, urlDescarga, nombre);

    const { data, error } = await c.admin
      .from("meta_medios")
      .insert({
        empresa_id: c.empresaId,
        tipo: "video",
        nombre,
        url_origen: clave,
        video_id: videoId,
        estado: "procesando",
      })
      .select("id")
      .single<{ id: string }>();

    if (error) return fallo(error.message);
    return { ok: true, data: { medioId: data.id, videoId } };
  } catch (err) {
    if (err instanceof MetaApiError) return fallo(err.message);
    return fallo(err instanceof Error ? err.message : "No se ha podido mandar el vídeo a Meta.");
  }
}

/**
 * ¿Ya está el vídeo listo para poder anunciarlo?
 *
 * Meta tarda de segundos a varios minutos. Publicar antes de que termine hace
 * que rechace el anuncio, así que la pantalla pregunta por aquí hasta que diga
 * que sí.
 */
export async function estadoVideoMetaAction(
  videoId: string,
): Promise<Resultado<{ estado: string; progreso: number; miniatura: string | null }>> {
  const c = await contexto();
  if (!c.ok) return c;

  try {
    const estado = await getEstadoVideo(c.cred, videoId);

    await c.admin
      .from("meta_medios")
      .update({
        estado: estado.estado === "listo" ? "listo" : estado.estado === "error" ? "error" : "procesando",
        miniatura_url: estado.miniatura,
        error: estado.error,
      })
      .eq("empresa_id", c.empresaId)
      .eq("video_id", videoId);

    return {
      ok: true,
      data: { estado: estado.estado, progreso: estado.progreso, miniatura: estado.miniatura },
    };
  } catch (err) {
    if (err instanceof MetaApiError) return fallo(err.message);
    return fallo("No se ha podido consultar el estado del vídeo.");
  }
}
