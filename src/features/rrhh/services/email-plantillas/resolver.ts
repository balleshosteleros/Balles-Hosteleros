import "server-only";

/**
 * Resolución de plantillas de email del onboarding (gestoría, contratos, prueba)
 * desde la tabla editable `reclutamiento_email_plantillas` (la misma que usan
 * las plantillas de estado del pipeline).
 *
 * Cada correo del flujo se localiza por su CLAVE estable (`clave`), NO por su
 * nombre: así el nombre es libremente editable y se propaga solo. El asunto/cuerpo
 * se editan desde la UI «Plantillas de email» y, al enviar, este resolver los lee
 * de BD y sustituye las variables `{{clave}}`. Si la plantilla no existe o está
 * inactiva, el llamador usa su texto por defecto (fallback): el flujo nunca se
 * rompe.
 *
 * También resuelve el DESTINATARIO configurado (candidato / gestoría / rrhh /
 * personalizado) leyendo el email correspondiente de Ajustes de la empresa.
 *
 * Funciona con o sin sesión: acepta un cliente (service role en crons) y un
 * empresaId ya resuelto.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sustituirVariablesReclutamiento } from "@/features/rrhh/lib/reclutamiento-email";
import {
  normalizarDestino,
  type ClaveOnboarding,
  type DestinoPlantilla,
} from "@/features/rrhh/lib/plantillas-onboarding";

// Las claves/constantes puras viven en un archivo compartido (cliente + servidor).
// Se reexportan aquí para no romper los imports existentes.
export {
  PLANTILLAS_ONBOARDING,
  CLAVES_ONBOARDING,
} from "@/features/rrhh/lib/plantillas-onboarding";
export type { ClaveOnboarding } from "@/features/rrhh/lib/plantillas-onboarding";

export interface PlantillaResuelta {
  asunto: string;
  cuerpo: string;
  destino: DestinoPlantilla;
  destinoEmail: string | null;
}

/**
 * Lee una plantilla por CLAVE y sustituye las variables. Devuelve null si la
 * plantilla no existe o está desactivada (el llamador usa entonces su default).
 */
export async function resolverPlantillaOnboarding(
  admin: SupabaseClient,
  empresaId: string,
  clave: ClaveOnboarding,
  vars: Record<string, string>,
): Promise<PlantillaResuelta | null> {
  try {
    const { data } = await admin
      .from("reclutamiento_email_plantillas")
      .select("asunto, cuerpo, activa, destino, destino_email")
      .eq("empresa_id", empresaId)
      .eq("clave", clave)
      .maybeSingle();
    if (!data || data.activa === false) return null;
    return {
      asunto: sustituirVariablesReclutamiento((data.asunto as string) ?? "", vars),
      cuerpo: sustituirVariablesReclutamiento((data.cuerpo as string) ?? "", vars),
      destino: normalizarDestino(data.destino),
      destinoEmail: (data.destino_email as string | null) ?? null,
    };
  } catch (err) {
    console.error("[email-plantillas] resolverPlantillaOnboarding:", err);
    return null;
  }
}

/**
 * Resuelve la dirección de correo del DESTINATARIO configurado en una plantilla:
 *  · candidato     → email del candidato/empleado (lo pasa el llamador en `fallbackCandidato`).
 *  · gestoria      → `reclutamiento_config.gestoria_email` (+ cc).
 *  · rrhh          → `empresas.datos_generales.correoRrhh` (fallback correoGeneral).
 *  · personalizado → `destino_email` de la propia plantilla.
 *
 * Devuelve `{ to, cc }`. `to` vacío = no se puede enviar (el llamador decide).
 */
export async function resolverDestinatario(
  admin: SupabaseClient,
  empresaId: string,
  destino: DestinoPlantilla,
  destinoEmail: string | null,
  fallbackCandidato: string | null,
): Promise<{ to: string; cc: string | null }> {
  const limpio = (s: string | null | undefined) => (s ?? "").trim();
  switch (destino) {
    case "personalizado":
      return { to: limpio(destinoEmail), cc: null };
    case "gestoria": {
      const { data } = await admin
        .from("reclutamiento_config")
        .select("gestoria_email, gestoria_email_cc")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      return {
        to: limpio(data?.gestoria_email as string | null),
        cc: limpio(data?.gestoria_email_cc as string | null) || null,
      };
    }
    case "rrhh": {
      const { data } = await admin
        .from("empresas")
        .select("datos_generales, email_contacto")
        .eq("id", empresaId)
        .maybeSingle();
      const dg = (data?.datos_generales as Record<string, unknown> | null) ?? {};
      const dgStr = (k: string) => (typeof dg[k] === "string" ? (dg[k] as string) : "");
      return {
        to:
          limpio(dgStr("correoRrhh")) ||
          limpio(data?.email_contacto as string | null) ||
          limpio(dgStr("correoGeneral")),
        cc: null,
      };
    }
    default:
      return { to: limpio(fallbackCandidato), cc: null };
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
