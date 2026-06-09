"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Preferencias POR USUARIO (no por empresa). Guardadas en `user_preferences`
 * como jsonb libre, así que cualquier ajuste personal nuevo se añade sin
 * migrar nada. Persisten tras logout y en cualquier dispositivo (van atadas
 * a la cuenta, no al navegador).
 */
const TABLE = "usuario_preferencias";

export async function loadUserPref(key: string): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("prefs")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[user-preferences] load error", error);
    return null;
  }
  const prefs = (data?.prefs as Record<string, unknown>) ?? {};
  const v = prefs[key];
  return typeof v === "string" ? v : null;
}

export async function saveUserPref(
  key: string,
  value: string | null,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Mezclamos con lo ya guardado para no pisar otras preferencias.
  const { data } = await supabase
    .from(TABLE)
    .select("prefs")
    .eq("user_id", user.id)
    .maybeSingle();

  const prefs: Record<string, unknown> = {
    ...((data?.prefs as Record<string, unknown>) ?? {}),
  };
  if (value === null || value === "") delete prefs[key];
  else prefs[key] = value;

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: user.id,
      prefs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) console.error("[user-preferences] save error", error);
}
