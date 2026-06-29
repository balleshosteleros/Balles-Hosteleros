import "server-only";

/**
 * Lectura de la config de reclutamiento POR EMPRESA (sin sesión), para crons y
 * endpoints públicos que ya tienen un cliente service y el empresaId resuelto.
 * La variante con sesión vive en `gestoria-actions.ts` (getReclutamientoConfig).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReclutamientoConfigNotif {
  gestoria_email: string;
  gestoria_email_cc: string;
  gestoria_recordatorio_activo: boolean;
  gestoria_recordatorio_dias: number;
  notif_alta_gestoria: boolean;
  notif_recordatorio_gestoria: boolean;
  notif_contrato_subido: boolean;
  notif_contrato_firmado: boolean;
}

const DEFAULT: ReclutamientoConfigNotif = {
  gestoria_email: "",
  gestoria_email_cc: "",
  gestoria_recordatorio_activo: true,
  gestoria_recordatorio_dias: 3,
  notif_alta_gestoria: true,
  notif_recordatorio_gestoria: true,
  notif_contrato_subido: true,
  notif_contrato_firmado: true,
};

export async function getReclutamientoConfigPorEmpresa(
  admin: SupabaseClient,
  empresaId: string,
): Promise<ReclutamientoConfigNotif> {
  try {
    const { data } = await admin
      .from("reclutamiento_config")
      .select(
        "gestoria_email, gestoria_email_cc, gestoria_recordatorio_activo, gestoria_recordatorio_dias, " +
          "notif_alta_gestoria, notif_recordatorio_gestoria, notif_contrato_subido, notif_contrato_firmado",
      )
      .eq("empresa_id", empresaId)
      .maybeSingle<{
        gestoria_email: string | null;
        gestoria_email_cc: string | null;
        gestoria_recordatorio_activo: boolean | null;
        gestoria_recordatorio_dias: number | null;
        notif_alta_gestoria: boolean | null;
        notif_recordatorio_gestoria: boolean | null;
        notif_contrato_subido: boolean | null;
        notif_contrato_firmado: boolean | null;
      }>();
    if (!data) return DEFAULT;
    return {
      gestoria_email: (data.gestoria_email as string) ?? "",
      gestoria_email_cc: (data.gestoria_email_cc as string) ?? "",
      gestoria_recordatorio_activo: data.gestoria_recordatorio_activo ?? true,
      gestoria_recordatorio_dias: data.gestoria_recordatorio_dias ?? 3,
      notif_alta_gestoria: data.notif_alta_gestoria ?? true,
      notif_recordatorio_gestoria: data.notif_recordatorio_gestoria ?? true,
      notif_contrato_subido: data.notif_contrato_subido ?? true,
      notif_contrato_firmado: data.notif_contrato_firmado ?? true,
    };
  } catch (err) {
    console.error("[gestoria] getReclutamientoConfigPorEmpresa:", err);
    return DEFAULT;
  }
}
