/**
 * Helpers del paso «Documentación» del pipeline de reclutamiento.
 *
 * El candidato recibe un enlace personal (`/documentacion/<token>`) donde sube su
 * documentación (DNI/NIE, IBAN, nº Seguridad Social). El `token` es un uuid único
 * guardado en `candidatos.documentacion_token` y se genera de forma perezosa la
 * primera vez que se envía el correo del estado `documentacion`.
 *
 * Módulo plano (sin "use server"): lo usan el resolver de email autenticado y el
 * helper de email público, ambos con su propio cliente Supabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Tipos de documento que aporta el candidato (claves de los paths en storage). */
export type DocTipoCandidato = "dni_anverso" | "dni_reverso" | "iban" | "ss";

export const DOC_TIPOS_CANDIDATO: DocTipoCandidato[] = [
  "dni_anverso",
  "dni_reverso",
  "iban",
  "ss",
];

/** Bucket privado donde se guardan los documentos del candidato. */
export const BUCKET_DOC_CANDIDATOS = "documentacion-candidatos";

/** Días que el enlace de documentación permanece válido desde su envío. */
export const DOCUMENTACION_TOKEN_DIAS = 7;

/**
 * Base URL pública del sitio (para construir enlaces en correos). Mismo patrón
 * que el resto de actions de RRHH (firmas, contratación, cuestionarios).
 */
export function appBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : null) ??
    "https://sistema.balleshosteleros.com";
  return raw.replace(/\/$/, "");
}

/** Construye la URL pública del formulario de documentación a partir del token. */
export function enlaceDocumentacion(token: string): string {
  return `${appBaseUrl()}/documentacion/${token}`;
}

/** Días que el enlace público de formación permanece válido desde su envío. */
export const FORMACION_TOKEN_DIAS = 7;

/** Construye la URL pública del visor de formación a partir del token. */
export function enlaceFormacionPublica(token: string): string {
  return `${appBaseUrl()}/formacion/${token}`;
}

/**
 * Devuelve el token del enlace público de formación del candidato, generándolo
 * si no existe (perezoso) y RENOVANDO su caducidad a +7 días en cada envío
 * (reenviar el correo reinicia el plazo). Espejo de `asegurarTokenDocumentacion`.
 * Best-effort: si falla la escritura, devuelve el token igualmente.
 */
export async function asegurarTokenFormacion(
  supabase: SupabaseClient,
  candidatoId: string,
  empresaId: string,
): Promise<string | null> {
  const { data: cand } = await supabase
    .from("candidatos")
    .select("formacion_token")
    .eq("id", candidatoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const token = (cand?.formacion_token as string | null) ?? crypto.randomUUID();
  const expira = new Date(
    Date.now() + FORMACION_TOKEN_DIAS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase
    .from("candidatos")
    .update({ formacion_token: token, formacion_token_expira_en: expira })
    .eq("id", candidatoId)
    .eq("empresa_id", empresaId);
  if (error) {
    console.error("[formacion] no se pudo generar/renovar token:", error.message);
    return token; // best-effort
  }
  return token;
}

/** Fecha de caducidad del enlace: ahora + DOCUMENTACION_TOKEN_DIAS días. */
export function fechaCaducidadDocumentacion(): string {
  return new Date(
    Date.now() + DOCUMENTACION_TOKEN_DIAS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

/**
 * Devuelve el token de documentación del candidato, generándolo si aún no existe
 * (perezoso), y RENUEVA su caducidad a +7 días en cada envío (reenviar el correo
 * reinicia el plazo). Usa el cliente que reciba (service-role en el flujo
 * público, o el cliente de sesión en el Kanban). Best-effort: si falla la
 * escritura, devuelve el token igualmente para no romper el envío del correo.
 */
export async function asegurarTokenDocumentacion(
  supabase: SupabaseClient,
  candidatoId: string,
  empresaId: string,
): Promise<string | null> {
  const { data: cand } = await supabase
    .from("candidatos")
    .select("documentacion_token")
    .eq("id", candidatoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const token = (cand?.documentacion_token as string | null) ?? crypto.randomUUID();
  const expira = fechaCaducidadDocumentacion();

  const { error } = await supabase
    .from("candidatos")
    .update({ documentacion_token: token, documentacion_token_expira_en: expira })
    .eq("id", candidatoId)
    .eq("empresa_id", empresaId);
  if (error) {
    console.error("[documentacion] no se pudo generar/renovar token:", error.message);
    return token; // best-effort: el enlace seguirá resolviendo si se persiste en otro intento
  }
  return token;
}
