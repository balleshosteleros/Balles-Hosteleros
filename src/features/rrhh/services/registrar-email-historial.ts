/**
 * Registra en el historial de actividad del CANDIDATO un email suelto (sin cambio
 * de fase): alta a la gestoría, contrato interno/oficial a firmar, aviso de
 * prueba, etc. Así TODOS los correos enviados aparecen en la pestaña «Actividad»
 * de la ficha del candidato, no solo los de cambio de fase.
 *
 * Best-effort: nunca lanza. El registro es informativo; si falla, no rompe el
 * envío del correo.
 *
 * Se localiza el candidato por su `empleado_id` (los correos de onboarding se
 * disparan con el empleado ya creado) o directamente por `candidatoId`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function registrarEmailEnHistorial(
  admin: SupabaseClient,
  params: {
    empresaId: string;
    /** Candidato ligado. Si no se pasa, se resuelve por `empleadoId`. */
    candidatoId?: string | null;
    /** Empleado ligado (para resolver el candidato si no viene `candidatoId`). */
    empleadoId?: string | null;
    asunto: string;
    /** HTML del correo enviado (opcional, para el visor). */
    html?: string | null;
  },
): Promise<void> {
  try {
    let candidatoId = params.candidatoId ?? null;

    // Resolver el candidato desde el empleado si hace falta.
    if (!candidatoId && params.empleadoId) {
      const { data } = await admin
        .from("candidatos")
        .select("id")
        .eq("empleado_id", params.empleadoId)
        .eq("empresa_id", params.empresaId)
        .maybeSingle();
      candidatoId = (data?.id as string | null) ?? null;
    }
    if (!candidatoId) return; // sin candidato ligado, no hay historial que anotar

    // Fase/estado actuales (columnas NOT NULL). No hay cambio de fase: se repite.
    const { data: cand } = await admin
      .from("candidatos")
      .select("fase, estado")
      .eq("id", candidatoId)
      .maybeSingle();
    const fase = (cand?.fase as string | null) ?? "onboarding";
    const estado = (cand?.estado as string | null) ?? "contratacion";

    await admin.from("candidato_historial").insert({
      empresa_id: params.empresaId,
      candidato_id: candidatoId,
      fase_anterior: fase,
      estado_anterior: estado,
      fase_nueva: fase,
      estado_nuevo: estado,
      email_enviado: true,
      email_asunto: params.asunto,
      email_html: params.html ?? null,
    });
  } catch (e) {
    console.error("[historial] registrar email suelto:", e);
  }
}
