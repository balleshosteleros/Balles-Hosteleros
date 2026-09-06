import "server-only";

/**
 * Confirmación de liquidación por ENLACE de correo (empleado).
 *
 * Al enviar la liquidación, además del pop-up in-app, se manda al empleado un
 * correo con un enlace tokenizado. En ese enlace (sin sesión) ve un recuadro con
 * SUS datos del mes y confirma que es correcto. Confirmar = marcar
 * `rrhh_pagos.confirmacion_aceptada_at` (mismo campo que el pop-up: ambos canales
 * conviven, el primero que confirme gana).
 *
 * El enlace es por EMPLEADO + MES y de un solo uso lógico (una vez confirmado no
 * vuelve a aceptar). Patrón hash-only idéntico a `nominas_gestoria_tokens`: solo
 * se persiste el HMAC del token.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generarToken, hashToken, compararToken } from "@/features/rrhh/services/firmas/crypto";
import { sendEmail } from "@/lib/email/send";
import { getSiteUrl } from "@/features/rrhh/services/gestoria/gestoria-contrato";
import { nombreMes } from "@/features/rrhh/services/nominas/nominas-gestoria";
import { fetchEmpresaBrand } from "@/lib/email/brand-header";
import {
} from "@/features/rrhh/lib/desglose-nomina";

/** Datos del mes de un empleado que se muestran en el recuadro del enlace. */
export interface LiquidacionDetalle {
  empleadoNombre: string;
  periodo: string;
  mesLabel: string;
  empresaNombre: string;
  fijo: boolean;
  nomina: number;
  complemento: number;
  ajuste: number;
  horasExtras: number;
  bonus: number;
  ssEmpleado: number;
  ssEmpresa: number;
  irpf: number;
  total: number;
  confirmadoEn: string | null;
  /** Isotipo (o logo) de la empresa para la pantalla de éxito. */
  marcaUrl: string | null;
}

/** Enlace público que abre el empleado para confirmar su liquidación. */
export function urlConfirmarLiquidacion(token: string): string {
  return `${getSiteUrl()}/liquidacion/${encodeURIComponent(token)}`;
}


/**
 * Crea (o regenera) el token de confirmación de un empleado para un mes y
 * devuelve el token en claro (para el correo). Un único enlace vigente por
 * empleado+mes (upsert por la restricción única). Caduca a los 60 días.
 */
export async function crearTokenConfirmacionPago(
  admin: SupabaseClient,
  params: { empresaId: string; empleadoId: string; periodo: string; pagoId: string },
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const token = generarToken();
    const tokenHash = hashToken(token);
    const expira = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await admin
      .from("rrhh_pagos_confirmacion_tokens")
      .upsert(
        {
          empresa_id: params.empresaId,
          empleado_id: params.empleadoId,
          periodo: params.periodo,
          pago_id: params.pagoId,
          token_hash: tokenHash,
          expira_en: expira,
          enviado_en: new Date().toISOString(),
          confirmado_en: null,
        },
        { onConflict: "empresa_id,empleado_id,periodo" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true, token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error creando token de confirmación" };
  }
}

/**
 * Motivo por el que un enlace de liquidación no se puede abrir.
 *
 * `used` no es un fallo: el empleado ya confirmó y vuelve a pulsar el enlace
 * (relee el correo, otro dispositivo…). Se distingue de `not_found` para poder
 * decírselo con esas palabras en vez de acusar al enlace de no ser válido.
 */
export type MotivoTokenLiquidacion = "not_found" | "expired" | "used";

/** Resuelve un token de confirmación (valida hash + expiración). */
export async function resolverTokenConfirmacionPago(
  admin: SupabaseClient,
  token: string,
): Promise<
  | { ok: true; row: { id: string; empresa_id: string; empleado_id: string; periodo: string; pago_id: string; confirmado_en: string | null } }
  | { ok: false; reason: MotivoTokenLiquidacion; confirmadoEn?: string | null; periodo?: string }
> {
  const tokenHash = hashToken(token);
  const { data } = await admin
    .from("rrhh_pagos_confirmacion_tokens")
    .select("id, empresa_id, empleado_id, periodo, pago_id, token_hash, expira_en, confirmado_en")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (!compararToken(token, data.token_hash as string)) return { ok: false, reason: "not_found" };
  // Caducado, pero YA confirmado: no es un enlace muerto, es uno que cumplió su
  // función. Prevalece "ya usado" sobre "caducado": es lo que le importa saber.
  if (new Date(data.expira_en as string).getTime() < Date.now()) {
    return data.confirmado_en
      ? {
          ok: false,
          reason: "used",
          confirmadoEn: data.confirmado_en as string,
          periodo: data.periodo as string,
        }
      : { ok: false, reason: "expired" };
  }
  return {
    ok: true,
    row: {
      id: data.id as string,
      empresa_id: data.empresa_id as string,
      empleado_id: data.empleado_id as string,
      periodo: data.periodo as string,
      pago_id: data.pago_id as string,
      confirmado_en: data.confirmado_en as string | null,
    },
  };
}

/** Lee el detalle de la liquidación (SOLO la de ese empleado/mes) para el recuadro. */
export async function detalleLiquidacionPorToken(
  admin: SupabaseClient,
  row: { empresa_id: string; pago_id: string; periodo: string; confirmado_en: string | null },
): Promise<
  | { ok: true; detalle: LiquidacionDetalle }
  | { ok: false; error: string; reason?: MotivoTokenLiquidacion }
> {
  const { data: pago } = await admin
    .from("rrhh_pagos")
    .select(
      "empleado_nombre, fijo, nomina, complemento, ajuste, horas_extras, bonus, ss_empleado, ss_empresa, irpf, total, confirmacion_aceptada_at",
    )
    .eq("id", row.pago_id)
    .maybeSingle();
  // El pago ya no está (el mes se rechazó a la gestoría y se rehízo). Si el
  // empleado ya había confirmado con este enlace, se le dice eso y no que el
  // enlace "no es válido": lo usó, y funcionó.
  if (!pago) {
    return row.confirmado_en
      ? { ok: false, reason: "used", error: "Este enlace ya se ha usado." }
      : { ok: false, error: "Liquidación no encontrada" };
  }

  const brand = await fetchEmpresaBrand(row.empresa_id);
  const marcaUrl = brand?.isotipoUrl || brand?.logoUrl || null;

  return {
    ok: true,
    detalle: {
      empleadoNombre: (pago.empleado_nombre as string) ?? "",
      periodo: row.periodo,
      mesLabel: nombreMes(row.periodo),
      empresaNombre: brand?.nombre || "la empresa",
      fijo: Boolean(pago.fijo),
      nomina: Number(pago.nomina),
      complemento: Number(pago.complemento),
      ajuste: Number(pago.ajuste),
      horasExtras: Number(pago.horas_extras),
      bonus: Number(pago.bonus),
      ssEmpleado: Number(pago.ss_empleado),
      ssEmpresa: Number(pago.ss_empresa),
      irpf: Number(pago.irpf),
      total: Number(pago.total),
      // Confirmado si el token lo registra O si el pago ya está aceptado (pop-up in-app).
      confirmadoEn: (row.confirmado_en as string | null) ?? (pago.confirmacion_aceptada_at as string | null) ?? null,
      marcaUrl,
    },
  };
}

/**
 * Confirma la liquidación desde el enlace: marca `confirmacion_aceptada_at` en
 * `rrhh_pagos` (si aún no lo estaba) y `confirmado_en` en el token. Idempotente:
 * si ya estaba confirmada, devuelve ok igualmente.
 */
export async function confirmarLiquidacionPorToken(
  admin: SupabaseClient,
  row: { id: string; empresa_id: string; pago_id: string },
): Promise<{ ok: boolean; error?: string }> {
  const nowIso = new Date().toISOString();

  // Solo marca aceptada si el pago sigue enviado y sin aceptar (respeta el lock BD).
  const { error: e1 } = await admin
    .from("rrhh_pagos")
    .update({ confirmacion_aceptada_at: nowIso })
    .eq("id", row.pago_id)
    .not("confirmacion_enviada_at", "is", null)
    .is("confirmacion_aceptada_at", null);
  if (e1) return { ok: false, error: e1.message };

  await admin
    .from("rrhh_pagos_confirmacion_tokens")
    .update({ confirmado_en: nowIso })
    .eq("id", row.id)
    .is("confirmado_en", null);

  // Cierra el aviso in-app de esa liquidación: al aprobar por enlace, la
  // notificación del portal queda ya como "Aprobada" y no pide LIQUIDAR de nuevo
  // (el mismo campo lo aprueba desde ambos sitios; el primero que confirme gana).
  try {
    const { marcarNotificacionesVistasPorRef } = await import(
      "@/features/notificaciones/actions/notificaciones-actions"
    );
    await marcarNotificacionesVistasPorRef("rrhh_pagos", row.pago_id, { accionar: true });
  } catch (e) {
    console.error("[rrhh-pagos-confirmacion] cerrar notif in-app:", e);
  }

  return { ok: true };
}



/**
 * Botón HTML «Ver y confirmar» para el correo al empleado.
 *
 * Es el ÚNICO acceso del correo: debajo ya no se repite la URL en texto. Por eso
 * se envuelve en una tabla, que es lo que Outlook renderiza de forma fiable
 * (un <div> con padding se le descuadra), y el propio texto va dentro del <a>
 * para que toda la zona sea pulsable.
 */
function botonConfirmarHtml(token: string): string {
  const url = urlConfirmarLiquidacion(token);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">
      <tr>
        <td align="center" bgcolor="#16a34a" style="border-radius:8px">
          <a href="${url}" target="_blank" rel="noopener"
             style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;
                    padding:13px 24px;border-radius:8px;font-weight:600;font-size:15px;
                    font-family:Arial,Helvetica,sans-serif;line-height:1">
            Ver y confirmar mi liquidación
          </a>
        </td>
      </tr>
    </table>`;
}

/**
 * Envía al empleado el correo con el detalle de su liquidación + enlace para
 * confirmar. Best-effort: si no tiene correo o falla el SMTP, devuelve ok:false
 * (el llamador no rompe el flujo; queda la notificación in-app).
 */
export async function enviarCorreoConfirmacionLiquidacion(
  admin: SupabaseClient,
  params: {
    empresaId: string;
    empleadoId: string;
    periodo: string;
    pagoId: string;
    detalle: LiquidacionDetalle;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { data: emp } = await admin
    .from("empleados")
    .select("email_empresa, email_personal")
    .eq("id", params.empleadoId)
    .maybeSingle();
  const to = ((emp?.email_empresa as string | null) || (emp?.email_personal as string | null) || "").trim();
  if (!to) return { ok: false, error: "El empleado no tiene correo" };

  const tk = await crearTokenConfirmacionPago(admin, {
    empresaId: params.empresaId,
    empleadoId: params.empleadoId,
    periodo: params.periodo,
    pagoId: params.pagoId,
  });
  if (!tk.ok) return { ok: false, error: tk.error };

  const d = params.detalle;
  const enlace = urlConfirmarLiquidacion(tk.token);
  const subject = `Tu liquidación de ${d.mesLabel} ya está lista · ${d.empresaNombre}`;
  const html = `
    <p>Hola ${d.empleadoNombre.split(" ")[0] || ""},</p>
    <p>Ya tienes lista tu liquidación de <b>${d.mesLabel}</b> en ${d.empresaNombre}.</p>
    <p>Entra en <b>Pagos</b>, dentro de tu panel, para verla y confirmar que es correcta.
    Hasta que la confirmes no se tramita el cobro.</p>
    ${botonConfirmarHtml(tk.token)}
    <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${d.empresaNombre}.</p>`;
  const text =
    `Ya tienes lista tu liquidación de ${d.mesLabel} en ${d.empresaNombre}. ` +
    `Entra en Pagos, dentro de tu panel, para verla y confirmar que es correcta: ${enlace}`;

  const res = await sendEmail({ to, subject, html, text, empresaId: params.empresaId });
  if (!res.ok) return { ok: false, error: "No se pudo enviar el correo" };
  return { ok: true };
}
