"use server";

/**
 * Ajustes de la valoración en mesa, los que se tocan desde la carta digital.
 *
 * Leen y escriben `visita_config`, la misma fila donde ya viven el filtro de
 * cinco estrellas y el enlace de reseñas de Google: son la misma cosa vista
 * desde dos sitios, y duplicar la configuración acabaría con dos pantallas
 * diciendo cosas distintas.
 *
 * La fila puede no existir todavía (una empresa que nunca tocó esto), así que
 * la lectura devuelve los valores de partida y el guardado hace upsert.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";

const schema = z.object({
  activa: z.boolean(),
  minutos: z.number().int().min(15).max(300),
  reintentoMinutos: z.number().int().min(5).max(120),
  margenMinutos: z.number().int().min(1).max(120),
  redirigir5EstrellasGoogle: z.boolean(),
  googleReviewUrl: z
    .union([z.string().trim().url(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export type ValoracionMesaConfig = z.infer<typeof schema>;

const DEFAULTS: ValoracionMesaConfig = {
  activa: false,
  minutos: 90,
  reintentoMinutos: 15,
  margenMinutos: 10,
  redirigir5EstrellasGoogle: true,
  googleReviewUrl: null,
};

export async function getValoracionMesaConfig(): Promise<ValoracionMesaConfig> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return DEFAULTS;

  const { data, error } = await supabase
    .from("visita_config")
    .select(
      "carta_valoracion_activa, carta_valoracion_minutos, carta_valoracion_reintento_minutos, carta_valoracion_margen_minutos, redirigir_5estrellas_google, google_review_url",
    )
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) {
    console.error("[valoracion-mesa] get:", error.message);
    return DEFAULTS;
  }
  if (!data) return DEFAULTS;

  return {
    activa: Boolean(data.carta_valoracion_activa),
    minutos: (data.carta_valoracion_minutos as number) ?? DEFAULTS.minutos,
    reintentoMinutos:
      (data.carta_valoracion_reintento_minutos as number) ?? DEFAULTS.reintentoMinutos,
    margenMinutos:
      (data.carta_valoracion_margen_minutos as number) ?? DEFAULTS.margenMinutos,
    redirigir5EstrellasGoogle: Boolean(data.redirigir_5estrellas_google),
    googleReviewUrl: (data.google_review_url as string | null) ?? null,
  };
}

export async function guardarValoracionMesaConfig(
  input: ValoracionMesaConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const cfg = parsed.data;

  // Sin enlace de Google el filtro no lleva a ninguna parte: el cliente pulsa
  // "escribir en Google" y no pasa nada. Antes de dejarlo encendido a ciegas,
  // se dice.
  if (cfg.redirigir5EstrellasGoogle && !cfg.googleReviewUrl) {
    return {
      ok: false,
      error: "Pon el enlace de reseñas de Google o apaga el salto a Google",
    };
  }

  const { error } = await supabase.from("visita_config").upsert(
    {
      empresa_id: empresaId,
      carta_valoracion_activa: cfg.activa,
      carta_valoracion_minutos: cfg.minutos,
      carta_valoracion_reintento_minutos: cfg.reintentoMinutos,
      carta_valoracion_margen_minutos: cfg.margenMinutos,
      redirigir_5estrellas_google: cfg.redirigir5EstrellasGoogle,
      google_review_url: cfg.googleReviewUrl,
    },
    { onConflict: "empresa_id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/marketing/carta-digital");
  return { ok: true };
}
