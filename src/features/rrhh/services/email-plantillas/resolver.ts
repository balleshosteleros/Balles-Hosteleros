import "server-only";

/**
 * Resolución de plantillas de email del onboarding (gestoría, contratos, prueba)
 * desde la tabla editable `reclutamiento_email_plantillas` (la misma que usan
 * las plantillas de estado del pipeline).
 *
 * Cada correo del flujo de onboarding tiene una plantilla con un NOMBRE reservado
 * (ver PLANTILLAS_ONBOARDING). El asunto/cuerpo se editan desde la UI «Plantillas
 * de email» y, al enviar, este resolver los lee de BD y sustituye las variables
 * `{{clave}}`. Si la plantilla no existe o está inactiva, el llamador usa su
 * texto por defecto (fallback), de modo que el flujo nunca se rompe.
 *
 * Funciona con o sin sesión: acepta un cliente (service role en crons) y un
 * empresaId ya resuelto.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sustituirVariablesReclutamiento } from "@/features/rrhh/lib/reclutamiento-email";

/** Nombres reservados de las plantillas del onboarding (1 por correo). */
export const PLANTILLAS_ONBOARDING = {
  gestoriaAlta: "Gestoría · alta de contrato",
  gestoriaRecordatorio: "Gestoría · recordatorio de contrato",
  contratoInterno: "Contrato interno (a firmar)",
  contratoOficial: "Contrato oficial (a firmar)",
  pruebaAviso: "Aviso de periodo de prueba (RRHH)",
} as const;

export type PlantillaOnboardingNombre =
  (typeof PLANTILLAS_ONBOARDING)[keyof typeof PLANTILLAS_ONBOARDING];

export interface PlantillaResuelta {
  asunto: string;
  cuerpo: string;
}

/**
 * Lee una plantilla por nombre y sustituye las variables. Devuelve null si la
 * plantilla no existe o está desactivada (el llamador usa entonces su default).
 */
export async function resolverPlantillaOnboarding(
  admin: SupabaseClient,
  empresaId: string,
  nombre: PlantillaOnboardingNombre,
  vars: Record<string, string>,
): Promise<PlantillaResuelta | null> {
  try {
    const { data } = await admin
      .from("reclutamiento_email_plantillas")
      .select("asunto, cuerpo, activa")
      .eq("empresa_id", empresaId)
      .eq("nombre", nombre)
      .maybeSingle();
    if (!data || data.activa === false) return null;
    return {
      asunto: sustituirVariablesReclutamiento((data.asunto as string) ?? "", vars),
      cuerpo: sustituirVariablesReclutamiento((data.cuerpo as string) ?? "", vars),
    };
  } catch (err) {
    console.error("[email-plantillas] resolverPlantillaOnboarding:", err);
    return null;
  }
}

/** Convierte el cuerpo (texto plano con saltos de línea) en HTML simple. */
export function cuerpoOnboardingAHtml(cuerpo: string): string {
  const escapado = cuerpo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escapado
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
