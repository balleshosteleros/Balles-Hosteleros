import "server-only";

import webpush, { type PushSubscription } from "web-push";
import { createClient } from "@/lib/supabase/server";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:notificaciones@balleshosteleros.com";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn("[push] VAPID keys ausentes — push deshabilitado");
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

export type PushEventType =
  | "solicitud_resuelta"
  | "comunicado_nuevo"
  | "cronograma_cambiado";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export async function sendPushToUser(args: {
  userId: string;
  empresaId: string;
  eventType: PushEventType;
  payload: PushPayload;
}): Promise<{ delivered: number; failed: number }> {
  if (!ensureConfigured()) return { delivered: 0, failed: 0 };

  const supabase = await createClient();

  // Filtrar por opt-in del canal en profiles.
  const { data: profile } = await supabase
    .from("profiles")
    .select("push_solicitudes, push_comunicados, push_cronograma")
    .eq("user_id", args.userId)
    .maybeSingle();

  const optInMap: Record<PushEventType, "push_solicitudes" | "push_comunicados" | "push_cronograma"> = {
    solicitud_resuelta: "push_solicitudes",
    comunicado_nuevo: "push_comunicados",
    cronograma_cambiado: "push_cronograma",
  };
  if (profile && profile[optInMap[args.eventType]] === false) {
    return { delivered: 0, failed: 0 };
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", args.userId)
    .eq("enabled", true);

  if (!subs || subs.length === 0) return { delivered: 0, failed: 0 };

  let delivered = 0;
  let failed = 0;
  const toDisable: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      const subscription: PushSubscription = {
        endpoint: s.endpoint as string,
        keys: {
          p256dh: s.p256dh as string,
          auth: s.auth as string,
        },
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(args.payload));
        delivered++;
      } catch (e: unknown) {
        failed++;
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          toDisable.push(s.id as string);
        }
      }
    }),
  );

  if (toDisable.length > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ enabled: false })
      .in("id", toDisable);
  }

  await supabase.from("push_events_log").insert({
    empresa_id: args.empresaId,
    user_id: args.userId,
    event_type: args.eventType,
    payload: args.payload as never,
    delivered_count: delivered,
    failed_count: failed,
  });

  return { delivered, failed };
}
