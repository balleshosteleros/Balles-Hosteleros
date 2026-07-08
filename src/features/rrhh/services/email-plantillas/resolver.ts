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
  normalizarDestinoDepartamento,
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
 *  · departamento  → `empresas.datos_generales[<clave>]` (la clave va en `destino_email`,
 *                    p. ej. "correoGestoria"), fuente única de Ajustes → Empresa.
 *  · personalizado → `destino_email` de la propia plantilla.
 *  · gestoria/rrhh → HEREDADOS: se mapean a departamento (correoGestoria / correoRrhh).
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

  // Retrocompatibilidad: gestoria/rrhh heredados → departamento con su clave.
  const norm = normalizarDestinoDepartamento(destino, destinoEmail);

  if (norm.destino === "personalizado") {
    return { to: limpio(norm.destinoEmail), cc: null };
  }

  if (norm.destino === "departamento") {
    // Correos de departamento: FUENTE ÚNICA = Ajustes → Empresa (datos_generales).
    // `destino_email` guarda la CLAVE del departamento (p. ej. "correoGestoria").
    const { data } = await admin
      .from("empresas")
      .select("datos_generales, email_contacto")
      .eq("id", empresaId)
      .maybeSingle();
    const dg = (data?.datos_generales as Record<string, unknown> | null) ?? {};
    const dgStr = (k: string) => (typeof dg[k] === "string" ? (dg[k] as string) : "");
    const clave = limpio(norm.destinoEmail) || "correoGeneral";
    return {
      to:
        limpio(dgStr(clave)) ||
        limpio(data?.email_contacto as string | null) ||
        limpio(dgStr("correoGeneral")),
      cc: null,
    };
  }

  // candidato (por defecto)
  return { to: limpio(fallbackCandidato), cc: null };
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
