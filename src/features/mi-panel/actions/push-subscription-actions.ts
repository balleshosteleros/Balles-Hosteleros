"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaId } from "@/features/empresa/actions/empresa-activa-actions";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10),
  auth: z.string().min(4),
  userAgent: z.string().max(500).optional(),
  deviceLabel: z.string().max(80).optional(),
});

export async function savePushSubscription(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = subscribeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Suscripción inválida" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };
  const empresaId = await getEmpresaActivaId();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        empresa_id: empresaId,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        user_agent: parsed.data.userAgent ?? null,
        device_label: parsed.data.deviceLabel ?? null,
        enabled: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removePushSubscription(
  endpoint: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  await supabase
    .from("push_subscriptions")
    .update({ enabled: false })
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  return { ok: true };
}
