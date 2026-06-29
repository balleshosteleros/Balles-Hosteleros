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
  // PRP-070 — onboarding
  formacion_url: string | null;
  contrato_interno_plantilla: string | null;
  prueba_duracion_dias: number;
  prueba_aviso_dias: number;
  prueba_aviso_canal: string;
  prueba_aviso_activo: boolean;
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
  formacion_url: null,
  contrato_interno_plantilla: null,
  prueba_duracion_dias: 30,
  prueba_aviso_dias: 10,
  prueba_aviso_canal: "ambos",
  prueba_aviso_activo: true,
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
          "notif_alta_gestoria, notif_recordatorio_gestoria, notif_contrato_subido, notif_contrato_firmado, " +
          "formacion_url, contrato_interno_plantilla, prueba_duracion_dias, prueba_aviso_dias, " +
          "prueba_aviso_canal, prueba_aviso_activo",
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
        formacion_url: string | null;
        contrato_interno_plantilla: string | null;
        prueba_duracion_dias: number | null;
        prueba_aviso_dias: number | null;
        prueba_aviso_canal: string | null;
        prueba_aviso_activo: boolean | null;
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
      formacion_url: (data.formacion_url as string | null) ?? null,
      contrato_interno_plantilla: (data.contrato_interno_plantilla as string | null) ?? null,
      prueba_duracion_dias: data.prueba_duracion_dias ?? 30,
      prueba_aviso_dias: data.prueba_aviso_dias ?? 10,
      prueba_aviso_canal: (data.prueba_aviso_canal as string) ?? "ambos",
      prueba_aviso_activo: data.prueba_aviso_activo ?? true,
    };
  } catch (err) {
    console.error("[gestoria] getReclutamientoConfigPorEmpresa:", err);
    return DEFAULT;
  }
}
