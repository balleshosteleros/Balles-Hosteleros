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
    "https://app.balleshosteleros.com";
  return raw.replace(/\/$/, "");
}

/** Construye la URL pública del formulario de documentación a partir del token. */
export function enlaceDocumentacion(token: string): string {
  return `${appBaseUrl()}/documentacion/${token}`;
}

/**
 * Devuelve el token de documentación del candidato, generándolo si aún no existe
 * (perezoso). Usa el cliente que reciba (service-role en el flujo público, o el
 * cliente de sesión en el Kanban). Best-effort: si falla la escritura, devuelve
 * el token igualmente para no romper el envío del correo.
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

  const existente = (cand?.documentacion_token as string | null) ?? null;
  if (existente) return existente;

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("candidatos")
    .update({ documentacion_token: token })
    .eq("id", candidatoId)
    .eq("empresa_id", empresaId);
  if (error) {
    console.error("[documentacion] no se pudo generar token:", error.message);
    return token; // best-effort: el enlace seguirá resolviendo si se persiste en otro intento
  }
  return token;
}
