/**
 * Wrap del handler con medición de latencia y persistencia en bsv_metricas.
 * Fail-open: si el INSERT de métrica falla, NO rompe la respuesta de Google.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { validateBookingServerAuth, isRwgEnabled } from "./booking-server-auth";

export type EndpointName =
  | "HealthCheck"
  | "BatchAvailabilityLookup"
  | "CreateBooking"
  | "UpdateBooking"
  | "SetMarketingPreference";

export interface MetricaCtx {
  empresaId?: string | null;
  causa?: string | null;
  requestId?: string | null;
}

export type HandlerResult = {
  status: number;
  body: unknown;
  metrica?: MetricaCtx;
};

export type Handler = (request: Request) => Promise<HandlerResult>;

async function persistirMetrica(
  endpoint: EndpointName,
  duracionMs: number,
  statusHttp: number,
  ctx: MetricaCtx | undefined,
) {
  try {
    const admin = createAdminClient();
    await admin.from("bsv_metricas").insert({
      endpoint,
      empresa_id: ctx?.empresaId ?? null,
      duracion_ms: duracionMs,
      status_http: statusHttp,
      causa: ctx?.causa ?? null,
      request_id: ctx?.requestId ?? null,
    });
  } catch {
    // Fail-open: nunca propagar errores de telemetría.
  }
}

export function withMetricas(endpoint: EndpointName, handler: Handler) {
  return async (request: Request): Promise<Response> => {
    const t0 = performance.now();

    // Kill-switch global
    if (!isRwgEnabled()) {
      const dur = Math.round(performance.now() - t0);
      await persistirMetrica(endpoint, dur, 503, { causa: "rwg_disabled" });
      return Response.json(
        { error: "rwg_disabled" },
        { status: 503 },
      );
    }

    // Auth
    const auth = validateBookingServerAuth(request);
    if (!auth.ok) {
      const dur = Math.round(performance.now() - t0);
      await persistirMetrica(endpoint, dur, 401, { causa: auth.reason });
      return new Response("Unauthorized", { status: 401 });
    }

    // Handler real
    try {
      const result = await handler(request);
      const dur = Math.round(performance.now() - t0);
      await persistirMetrica(endpoint, dur, result.status, result.metrica);
      return Response.json(result.body, { status: result.status });
    } catch (err) {
      const dur = Math.round(performance.now() - t0);
      const msg = err instanceof Error ? err.message : "unknown_error";
      await persistirMetrica(endpoint, dur, 500, { causa: msg.slice(0, 120) });
      return Response.json({ error: "internal_error" }, { status: 500 });
    }
  };
}
