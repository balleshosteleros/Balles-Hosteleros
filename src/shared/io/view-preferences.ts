"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Preferencias de vista por (usuario × empresa × view_key).
 *
 * Hoy guardamos visibilidad de columnas. La forma de `prefs` es jsonb
 * libre, así que en el futuro podemos añadir más claves (orden, filtros,
 * densidad, etc.) sin migrar nada.
 */
export interface ViewPrefs {
  columnsHidden?: Record<string, boolean>;
}

const TABLE = "user_view_preferences";

/**
 * Lee la preferencia guardada para esta vista. Devuelve `null` si no
 * hay nada guardado o si faltan parámetros (sin sesión, sin empresa).
 */
export async function loadViewPreferences(
  viewKey: string,
  empresaDbId: string | null | undefined,
): Promise<ViewPrefs | null> {
  if (!viewKey || !empresaDbId) return null;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("prefs")
    .eq("user_id", user.id)
    .eq("empresa_id", empresaDbId)
    .eq("view_key", viewKey)
    .maybeSingle();

  if (error) {
    console.error("[view-preferences] load error", error);
    return null;
  }
  return (data?.prefs as ViewPrefs) ?? null;
}

/**
 * Persiste la preferencia (upsert por la PK compuesta).
 * Lanza si no hay sesión o empresa — el llamador decide cómo notificar.
 */
export async function saveViewPreferences(
  viewKey: string,
  empresaDbId: string | null | undefined,
  prefs: ViewPrefs,
): Promise<void> {
  if (!viewKey) throw new Error("viewKey requerido");
  if (!empresaDbId) throw new Error("empresa activa sin id en BD");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("sesión requerida");

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: user.id,
      empresa_id: empresaDbId,
      view_key: viewKey,
      prefs,
    },
    { onConflict: "user_id,empresa_id,view_key" },
  );

  if (error) {
    console.error("[view-preferences] save error", error);
    throw error;
  }
}
