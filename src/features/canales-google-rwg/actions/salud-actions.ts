"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface FeedRunRow {
  feedType: string;
  iniciadoEn: string;
  finalizadoEn: string | null;
  estado: string;
  bytes: number | null;
  slotsCount: number | null;
  empresasCount: number | null;
  errorMsg: string | null;
}

export interface EndpointSaludRow {
  endpoint: string;
  llamadas24h: number;
  ok24h: number;
  p95Ms: number | null;
  errores5xx24h: number;
}

export interface NotifResumen {
  pendientes: number;
  fallidas: number;
  enviadas24h: number;
}

export interface SaludRwgData {
  feeds: FeedRunRow[];
  endpoints: EndpointSaludRow[];
  notif: NotifResumen;
}

export async function getSaludRwg(): Promise<SaludRwgData> {
  const admin = createAdminClient();

  const [feedsR, endpointsR, pendientesR, fallidasR, enviadasR] = await Promise.all([
    admin.from("google_rwg_feed_runs")
      .select("feed_type, iniciado_en, finalizado_en, estado, bytes, slots_count, empresas_count, errores_json")
      .order("iniciado_en", { ascending: false })
      .limit(28),
    admin.from("v_google_rwg_salud")
      .select("endpoint, llamadas_24h, ok_24h, p95_ms, errores_5xx_24h"),
    admin.from("google_rwg_notificaciones").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    admin.from("google_rwg_notificaciones").select("id", { count: "exact", head: true }).eq("estado", "fallido"),
    admin.from("google_rwg_notificaciones").select("id", { count: "exact", head: true })
      .eq("estado", "enviado").gt("enviado_en", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const feeds: FeedRunRow[] = ((feedsR.data ?? []) as Array<{
    feed_type: string; iniciado_en: string; finalizado_en: string | null;
    estado: string; bytes: number | null; slots_count: number | null;
    empresas_count: number | null; errores_json: { error?: string } | null;
  }>).map((r) => ({
    feedType: r.feed_type,
    iniciadoEn: r.iniciado_en,
    finalizadoEn: r.finalizado_en,
    estado: r.estado,
    bytes: r.bytes,
    slotsCount: r.slots_count,
    empresasCount: r.empresas_count,
    errorMsg: r.errores_json?.error ?? null,
  }));

  const endpoints: EndpointSaludRow[] = ((endpointsR.data ?? []) as Array<{
    endpoint: string; llamadas_24h: number; ok_24h: number;
    p95_ms: number | null; errores_5xx_24h: number;
  }>).map((r) => ({
    endpoint: r.endpoint,
    llamadas24h: Number(r.llamadas_24h ?? 0),
    ok24h: Number(r.ok_24h ?? 0),
    p95Ms: r.p95_ms == null ? null : Math.round(Number(r.p95_ms)),
    errores5xx24h: Number(r.errores_5xx_24h ?? 0),
  }));

  return {
    feeds,
    endpoints,
    notif: {
      pendientes: pendientesR.count ?? 0,
      fallidas: fallidasR.count ?? 0,
      enviadas24h: enviadasR.count ?? 0,
    },
  };
}

export async function reintentarNotifsFallidas() {
  const admin = createAdminClient();
  const { error } = await admin
    .from("google_rwg_notificaciones")
    .update({ estado: "pendiente", intentos: 0, proximo_intento_en: null, ultimo_error: null })
    .eq("estado", "fallido");
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
