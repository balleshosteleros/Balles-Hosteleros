"use server";

/**
 * Configuración de mensajería de la empresa activa.
 *
 * Las credenciales del proveedor se guardan CIFRADAS y NUNCA se devuelven al
 * navegador: la vista solo sabe si están puestas, no cuáles son.
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { encrypt } from "@/features/accesos/lib/crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EstadoAlta =
  | "SIN_CONECTAR"
  | "PENDIENTE_VERIFICACION"
  | "ACTIVO"
  | "SUSPENDIDO";

/** Tipos de aviso que pueden salir por WhatsApp. La valoración no está: pedir
 *  opinión por WhatsApp quema el canal, y para eso el correo ya funciona. */
export const TIPOS_AVISO = [
  "CONFIRMACION",
  "RECONFIRMACION",
  "RECORDATORIO",
  "CANCELACION",
] as const;

export type TipoAviso = (typeof TIPOS_AVISO)[number];

export const TIPO_AVISO_LABEL: Record<TipoAviso, string> = {
  CONFIRMACION: "Confirmación al reservar",
  RECONFIRMACION: "Reconfirmación",
  RECORDATORIO: "Recordatorio",
  CANCELACION: "Aviso de cancelación",
};

export const TIPO_AVISO_DESCRIPCION: Record<TipoAviso, string> = {
  CONFIRMACION: "Nada más hacer la reserva, con el enlace para cancelar.",
  RECONFIRMACION: "Los días antes, para que confirme que viene. Es el que más mesas salva.",
  RECORDATORIO: "El mismo día, unas horas antes.",
  CANCELACION: "Cuando la reserva se cancela.",
};

export interface MensajeriaConfigVista {
  estadoAlta: EstadoAlta;
  /** true si hay credenciales guardadas. Las credenciales en sí no salen. */
  credencialesPuestas: boolean;
  whatsappNumero: string | null;
  smsNumero: string | null;
  whatsappActivo: boolean;
  smsActivo: boolean;
  smsRespaldoActivo: boolean;
  avisosActivos: Record<string, boolean>;
  topeMensualCents: number | null;
  /** Gasto del mes en curso, para poder enseñarlo junto al tope. */
  gastoMesCents: number;
}

const VACIA: MensajeriaConfigVista = {
  estadoAlta: "SIN_CONECTAR",
  credencialesPuestas: false,
  whatsappNumero: null,
  smsNumero: null,
  whatsappActivo: false,
  smsActivo: false,
  smsRespaldoActivo: true,
  avisosActivos: {},
  topeMensualCents: null,
  gastoMesCents: 0,
};

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

export async function getMensajeriaConfig(): Promise<MensajeriaConfigVista> {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return VACIA;

    const { data } = await supabase
      .from("empresa_mensajeria_config")
      .select("estado_alta, proveedor_subcuenta_id, proveedor_token_cifrado, whatsapp_numero, sms_numero, whatsapp_activo, sms_activo, sms_respaldo_activo, avisos_activos, tope_mensual_cents")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (!data) return VACIA;

    const admin = createAdminClient();
    const { data: gasto } = await admin.rpc("gasto_mensajeria_mes", {
      p_empresa_id: empresaId,
    });

    return {
      estadoAlta: data.estado_alta as EstadoAlta,
      credencialesPuestas: Boolean(
        data.proveedor_subcuenta_id && data.proveedor_token_cifrado,
      ),
      whatsappNumero: (data.whatsapp_numero as string | null) ?? null,
      smsNumero: (data.sms_numero as string | null) ?? null,
      whatsappActivo: Boolean(data.whatsapp_activo),
      smsActivo: Boolean(data.sms_activo),
      smsRespaldoActivo: Boolean(data.sms_respaldo_activo),
      avisosActivos: (data.avisos_activos as Record<string, boolean> | null) ?? {},
      topeMensualCents: (data.tope_mensual_cents as number | null) ?? null,
      gastoMesCents: (gasto as number | null) ?? 0,
    };
  } catch {
    return VACIA;
  }
}

const guardarSchema = z.object({
  whatsappActivo: z.boolean().optional(),
  smsActivo: z.boolean().optional(),
  smsRespaldoActivo: z.boolean().optional(),
  avisosActivos: z.record(z.string(), z.boolean()).optional(),
  /** Tope mensual en céntimos. Null lo quita. */
  topeMensualCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

export type GuardarMensajeriaInput = z.input<typeof guardarSchema>;

/** Guarda los ajustes que la empresa puede tocar. Las credenciales no entran
 *  aquí: las pone el alta, no el usuario a mano. */
export async function guardarMensajeriaConfig(input: GuardarMensajeriaInput) {
  const parsed = guardarSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos no válidos" };

  try {
    const { empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "Sesión no válida" };

    const fila: Record<string, unknown> = { empresa_id: empresaId };
    const d = parsed.data;
    if (d.whatsappActivo !== undefined) fila.whatsapp_activo = d.whatsappActivo;
    if (d.smsActivo !== undefined) fila.sms_activo = d.smsActivo;
    if (d.smsRespaldoActivo !== undefined) fila.sms_respaldo_activo = d.smsRespaldoActivo;
    if (d.avisosActivos !== undefined) fila.avisos_activos = d.avisosActivos;
    if (d.topeMensualCents !== undefined) fila.tope_mensual_cents = d.topeMensualCents;

    const admin = createAdminClient();
    const { error } = await admin
      .from("empresa_mensajeria_config")
      .upsert(fila, { onConflict: "empresa_id" });
    if (error) throw error;

    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "No se pudo guardar" };
  }
}

const credencialesSchema = z.object({
  subcuentaId: z.string().trim().min(10).max(200),
  token: z.string().trim().min(10).max(500),
  whatsappNumero: z.string().trim().max(20).nullable(),
  smsNumero: z.string().trim().max(20).nullable(),
});

export type GuardarCredencialesInput = z.input<typeof credencialesSchema>;

/**
 * Guarda las credenciales del proveedor, cifradas.
 *
 * Fase 2: se meten a mano. En la fase 4 las escribirá el alta automática, y
 * esta acción quedará solo para arreglar una conexión rota.
 */
export async function guardarCredenciales(input: GuardarCredencialesInput) {
  const parsed = credencialesSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Credenciales no válidas" };

  try {
    const { empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "Sesión no válida" };

    const admin = createAdminClient();
    const { error } = await admin.from("empresa_mensajeria_config").upsert(
      {
        empresa_id: empresaId,
        proveedor_subcuenta_id: parsed.data.subcuentaId,
        proveedor_token_cifrado: encrypt(parsed.data.token),
        whatsapp_numero: parsed.data.whatsappNumero || null,
        sms_numero: parsed.data.smsNumero || null,
        // Con credenciales puestas la conexión pasa a estar viva; los canales
        // siguen apagados hasta que la empresa los encienda.
        estado_alta: "ACTIVO",
      },
      { onConflict: "empresa_id" },
    );
    if (error) throw error;

    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "No se pudieron guardar las credenciales" };
  }
}
