"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10),
  auth: z.string().min(4),
  userAgent: z.string().max(500).optional(),
  deviceLabel: z.string().max(80).optional(),
  deviceId: z.string().max(64).optional(),
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
  // El empleado que activa los avisos desde el móvil normalmente nunca ha tocado
  // el selector de empresa del escritorio, así que NO existe la cookie: hay que
  // caer a su empresa real (usuario_empresas / usuarios.empresa_id).
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const deviceId = parsed.data.deviceId ?? null;

  // Un aparato = una suscripción viva. El navegador renueva su suscripción por
  // su cuenta y cada renovación trae un endpoint NUEVO, así que sin esto la fila
  // anterior del mismo aparato se quedaba viva para siempre y la pantalla de
  // Ajustes → Usuarios enseñaba verde apoyándose en dispositivos ya muertos.
  if (deviceId) {
    await supabase
      .from("push_subscriptions")
      .update({ enabled: false })
      .eq("user_id", user.id)
      .eq("device_id", deviceId)
      .neq("endpoint", parsed.data.endpoint);
  }

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
        device_id: deviceId,
        enabled: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * ¿Está este dispositivo (endpoint) realmente guardado y activo en la BD?
 *
 * El permiso del navegador y la suscripción en servidor son cosas distintas: si
 * el guardado falla, el permiso se queda concedido igualmente y el dispositivo
 * queda "mudo" (no recibe nada) sin que la app pueda darse cuenta. Esto permite
 * detectar ese estado y volver a ofrecer la activación.
 */
export async function isPushSubscriptionSaved(
  endpoint: string,
): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint")
    .eq("endpoint", endpoint)
    .eq("user_id", user.id)
    .eq("enabled", true)
    .maybeSingle();
  return !!data;
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
