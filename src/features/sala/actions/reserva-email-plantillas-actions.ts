"use server";

/**
 * Server actions de gestión de PLANTILLAS DE EMAIL del módulo de Reservas.
 *
 * El usuario solo puede editar dos campos por plantilla:
 *   · asunto_personalizado  (null = usar el del seed)
 *   · mensaje_personalizado (null = usar el del seed)
 * Más el flag `activa` para silenciar el envío automático.
 *
 * El resto (estructura del HTML, logo, color, datos de la reserva, footer)
 * está fijado en el mailer y NO es editable, para garantizar coherencia
 * visual entre empresas.
 */

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RESERVA_EMAIL_TIPOS,
  RESERVA_EMAIL_TIPO_LABELS,
  type ReservaEmailTipo,
} from "@/lib/seeds/reserva-email-plantillas";
import { previewReservaEmail } from "@/lib/email/reservas/mailer";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

export interface ReservaEmailPlantilla {
  tipo: ReservaEmailTipo;
  tipoLabel: string;
  activa: boolean;
  asuntoPersonalizado: string | null;
  mensajePersonalizado: string | null;
}

/**
 * Lista las 6 plantillas de la empresa activa. Si por algún motivo faltan
 * filas (empresa creada antes de la migración), se devuelven con defaults
 * para no romper la UI; la siguiente edición las creará.
 */
export async function listReservaEmailPlantillas(): Promise<{
  ok: boolean;
  data: ReservaEmailPlantilla[];
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };

    const { data, error } = await supabase
      .from("reserva_email_plantillas")
      .select("tipo, activa, asunto_personalizado, mensaje_personalizado")
      .eq("empresa_id", empresaId);
    if (error) throw error;

    const porTipo = new Map<string, typeof data[number]>(
      (data ?? []).map((r) => [r.tipo as string, r]),
    );

    const out: ReservaEmailPlantilla[] = RESERVA_EMAIL_TIPOS.map((tipo) => {
      const r = porTipo.get(tipo);
      return {
        tipo,
        tipoLabel: RESERVA_EMAIL_TIPO_LABELS[tipo],
        activa: (r?.activa as boolean | undefined) ?? true,
        asuntoPersonalizado:
          (r?.asunto_personalizado as string | null | undefined) ?? null,
        mensajePersonalizado:
          (r?.mensaje_personalizado as string | null | undefined) ?? null,
      };
    });

    return { ok: true, data: out };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reserva-email-plantillas] list:", msg);
    return { ok: false, data: [], error: msg };
  }
}

/**
 * Upsert de una plantilla. Si el cliente no quiere personalizar pasa null en
 * asunto/mensaje y el mailer caerá al seed de fábrica.
 */
export async function updateReservaEmailPlantilla(input: {
  tipo: ReservaEmailTipo;
  activa: boolean;
  asuntoPersonalizado: string | null;
  mensajePersonalizado: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Vaciar strings → null para que el mailer use el seed.
    const asunto =
      input.asuntoPersonalizado && input.asuntoPersonalizado.trim() !== ""
        ? input.asuntoPersonalizado.trim()
        : null;
    const mensaje =
      input.mensajePersonalizado && input.mensajePersonalizado.trim() !== ""
        ? input.mensajePersonalizado.trim()
        : null;

    const { error } = await supabase
      .from("reserva_email_plantillas")
      .upsert(
        {
          empresa_id: empresaId,
          tipo: input.tipo,
          activa: input.activa,
          asunto_personalizado: asunto,
          mensaje_personalizado: mensaje,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "empresa_id,tipo" },
      );
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reserva-email-plantillas] update:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Resetea la plantilla a los valores de fábrica (asunto y mensaje a NULL).
 * Mantiene el flag `activa`.
 */
export async function resetReservaEmailPlantilla(
  tipo: ReservaEmailTipo,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { error } = await supabase
      .from("reserva_email_plantillas")
      .update({
        asunto_personalizado: null,
        mensaje_personalizado: null,
        updated_at: new Date().toISOString(),
      })
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reserva-email-plantillas] reset:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Devuelve el HTML de preview del correo con datos de ejemplo y los
 * overrides actuales. Server-side por dos motivos: (1) el mailer es
 * "server-only" (lee Storage / SMTP) y (2) así el cliente recibe HTML
 * listo para meter en un iframe srcDoc, sin tener que duplicar el render.
 */
export async function previewReservaEmailPlantilla(input: {
  tipo: ReservaEmailTipo;
  asuntoOverride: string | null;
  mensajeOverride: string | null;
}): Promise<{
  ok: boolean;
  subject?: string;
  html?: string;
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const [{ data: empresa }, { data: cfg }] = await Promise.all([
      supabase
        .from("empresas")
        .select("nombre, logo_url, color")
        .eq("id", empresaId)
        .maybeSingle(),
      supabase
        .from("empresa_reservas_config")
        .select("cancelacion_horas_antes, cancelacion_importe_eur")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
    ]);

    const { subject, html } = previewReservaEmail({
      tipo: input.tipo,
      empresaNombre: (empresa?.nombre as string | undefined) ?? "",
      logoUrl: (empresa?.logo_url as string | null | undefined) ?? null,
      colorPrimario: (empresa?.color as string | null | undefined) ?? null,
      asuntoOverride: input.asuntoOverride,
      mensajeOverride: input.mensajeOverride,
      config: {
        cancelacionHorasAntes:
          (cfg?.cancelacion_horas_antes as number | null | undefined) ?? null,
        cancelacionImporteEur:
          (cfg?.cancelacion_importe_eur as number | null | undefined) ?? null,
      },
    });
    return { ok: true, subject, html };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reserva-email-plantillas] preview:", msg);
    return { ok: false, error: msg };
  }
}
