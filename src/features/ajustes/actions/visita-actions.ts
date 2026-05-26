"use server";

/**
 * Server actions de la landing de visita.
 *
 * - getVisitaConfig(): lee la config de la empresa activa (o devuelve un
 *   default si la empresa aún no la ha guardado).
 * - guardarVisitaConfig(): upsert con validación Zod.
 *
 * Las inserciones de leads y emails programados las hace el endpoint
 * público /api/visita/lead con service-role.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";

const configSchema = z.object({
  activado: z.boolean().default(false),
  hero_url: z.string().url().nullable().optional(),
  bienvenida_titulo: z.string().trim().min(1).max(200),
  bienvenida_subtitulo: z.string().trim().max(400).default(""),
  popup_titulo: z.string().trim().min(1).max(200),
  popup_subtitulo: z.string().trim().max(400).default(""),
  popup_boton_texto: z.string().trim().min(1).max(60),
  email_asunto: z.string().trim().min(1).max(200),
  email_cuerpo: z.string().trim().min(1).max(4000),
  email_delay_minutos: z.number().int().min(0).max(60 * 24 * 7),
  redirigir_5estrellas_google: z.boolean().default(true),
  google_review_url: z
    .string()
    .url()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

export type VisitaConfigInput = z.infer<typeof configSchema>;

export type VisitaConfigData = VisitaConfigInput & {
  empresa_id: string;
  carta_slug: string | null;
  empresa_nombre: string;
};

const DEFAULTS: VisitaConfigInput = {
  activado: false,
  hero_url: null,
  bienvenida_titulo: "Bienvenidos a {nombre_empresa}",
  bienvenida_subtitulo:
    "Disfruta de nuestra carta y déjanos darte recomendaciones a medida",
  popup_titulo: "🎁 Solo para nuestros comensales",
  popup_subtitulo:
    "Suscríbete y recibe las recomendaciones del chef + un detalle en tu próxima visita",
  popup_boton_texto: "Suscribirme",
  email_asunto: "¿Qué tal lo pasaste en {nombre_empresa}? 🌟",
  email_cuerpo:
    "Hola {nombre},\n\nEsperamos que lo hayas pasado en grande con nosotros. ¿Nos cuentas qué te ha parecido?\n\nUn abrazo,\nEl equipo de {nombre_empresa}",
  email_delay_minutos: 120,
  redirigir_5estrellas_google: true,
  google_review_url: null,
};

export async function getVisitaConfig(): Promise<VisitaConfigData | null> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return null;

  const [{ data, error }, empresaRes] = await Promise.all([
    supabase
      .from("visita_config")
      .select(
        "empresa_id, activado, hero_url, bienvenida_titulo, bienvenida_subtitulo, popup_titulo, popup_subtitulo, popup_boton_texto, email_asunto, email_cuerpo, email_delay_minutos, redirigir_5estrellas_google, google_review_url",
      )
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    supabase
      .from("empresas")
      .select("nombre, carta_slug")
      .eq("id", empresaId)
      .maybeSingle(),
  ]);

  if (error) console.error("[visita-actions] getVisitaConfig:", error.message);

  const empresaNombre = (empresaRes.data?.nombre as string) ?? "";
  const cartaSlug = (empresaRes.data?.carta_slug as string | null) ?? null;

  if (!data) {
    return {
      empresa_id: empresaId,
      carta_slug: cartaSlug,
      empresa_nombre: empresaNombre,
      ...DEFAULTS,
    };
  }

  return {
    empresa_id: data.empresa_id as string,
    carta_slug: cartaSlug,
    empresa_nombre: empresaNombre,
    activado: Boolean(data.activado),
    hero_url: (data.hero_url as string | null) ?? null,
    bienvenida_titulo: (data.bienvenida_titulo as string) ?? DEFAULTS.bienvenida_titulo,
    bienvenida_subtitulo:
      (data.bienvenida_subtitulo as string) ?? DEFAULTS.bienvenida_subtitulo,
    popup_titulo: (data.popup_titulo as string) ?? DEFAULTS.popup_titulo,
    popup_subtitulo: (data.popup_subtitulo as string) ?? DEFAULTS.popup_subtitulo,
    popup_boton_texto:
      (data.popup_boton_texto as string) ?? DEFAULTS.popup_boton_texto,
    email_asunto: (data.email_asunto as string) ?? DEFAULTS.email_asunto,
    email_cuerpo: (data.email_cuerpo as string) ?? DEFAULTS.email_cuerpo,
    email_delay_minutos:
      (data.email_delay_minutos as number) ?? DEFAULTS.email_delay_minutos,
    redirigir_5estrellas_google: Boolean(data.redirigir_5estrellas_google),
    google_review_url: (data.google_review_url as string | null) ?? null,
  };
}

export async function guardarVisitaConfig(
  input: VisitaConfigInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const cfg = parsed.data;
  const row = {
    empresa_id: empresaId,
    activado: cfg.activado,
    hero_url: cfg.hero_url ?? null,
    bienvenida_titulo: cfg.bienvenida_titulo,
    bienvenida_subtitulo: cfg.bienvenida_subtitulo,
    popup_titulo: cfg.popup_titulo,
    popup_subtitulo: cfg.popup_subtitulo,
    popup_boton_texto: cfg.popup_boton_texto,
    email_asunto: cfg.email_asunto,
    email_cuerpo: cfg.email_cuerpo,
    email_delay_minutos: cfg.email_delay_minutos,
    redirigir_5estrellas_google: cfg.redirigir_5estrellas_google,
    google_review_url: cfg.google_review_url ?? null,
  };

  const { error } = await supabase
    .from("visita_config")
    .upsert(row, { onConflict: "empresa_id" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ajustes");
  return { ok: true };
}
