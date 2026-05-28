/**
 * Dispatcher de notificaciones salientes Balles → Google (Partner Notification API).
 * Procesa la cola `google_rwg_notificaciones` con reintentos exponenciales.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPartnerAccessToken } from "./partner-oauth";

const MAX_INTENTOS = 3;
const BACKOFFS_S = [1, 4, 16];
const BATCH_SIZE = 25;

export interface DispatchResult {
  total: number;
  enviados: number;
  fallidos: number;
  reprogramados: number;
  skipped?: string;
}

interface NotifRow {
  id: string;
  empresa_id: string;
  tipo: string;
  payload_json: Record<string, unknown>;
  intentos: number;
}

async function postNotificacion(token: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.GOOGLE_RWG_PARTNER_API_URL?.trim();
  if (!url) return { ok: false, error: "missing_partner_api_url" };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (resp.ok) return { ok: true };
  const txt = await resp.text().catch(() => "");
  return { ok: false, error: `http_${resp.status}: ${txt.slice(0, 160)}` };
}

export async function dispatchPendingNotifs(admin: SupabaseClient): Promise<DispatchResult> {
  // Auth temprana
  const token = await getPartnerAccessToken();
  if (!token) {
    return { total: 0, enviados: 0, fallidos: 0, reprogramados: 0, skipped: "no_oauth_key" };
  }

  // Tomar batch
  const { data: pendientes } = await admin
    .from("google_rwg_notificaciones")
    .select("id, empresa_id, tipo, payload_json, intentos")
    .eq("estado", "pendiente")
    .or("proximo_intento_en.is.null,proximo_intento_en.lt." + new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  const rows = (pendientes ?? []) as NotifRow[];
  let enviados = 0;
  let fallidos = 0;
  let reprogramados = 0;

  for (const row of rows) {
    const intentoActual = row.intentos + 1;
    const r = await postNotificacion(token, row.payload_json);
    if (r.ok) {
      await admin
        .from("google_rwg_notificaciones")
        .update({
          estado: "enviado",
          intentos: intentoActual,
          enviado_en: new Date().toISOString(),
          ultimo_error: null,
        })
        .eq("id", row.id);
      enviados++;
      continue;
    }
    if (intentoActual >= MAX_INTENTOS) {
      await admin
        .from("google_rwg_notificaciones")
        .update({
          estado: "fallido",
          intentos: intentoActual,
          ultimo_error: r.error ?? "unknown",
        })
        .eq("id", row.id);
      fallidos++;
      continue;
    }
    const backoffMs = BACKOFFS_S[intentoActual - 1] * 1000;
    await admin
      .from("google_rwg_notificaciones")
      .update({
        intentos: intentoActual,
        proximo_intento_en: new Date(Date.now() + backoffMs).toISOString(),
        ultimo_error: r.error ?? "unknown",
      })
      .eq("id", row.id);
    reprogramados++;
  }

  return { total: rows.length, enviados, fallidos, reprogramados };
}
