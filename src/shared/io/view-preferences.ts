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
  /**
   * Orden personalizado de columnas (lista de `campo`).
   * Solo incluye columnas no bloqueadas — las bloqueadas mantienen su
   * posición fija al inicio definida por el código. Si una columna nueva
   * se añade en el futuro y no está en este array, se renderiza al final
   * en el orden que aparece en el código.
   */
  columnsOrder?: string[];
}

const TABLE = "user_view_preferences";

/**
 * Lee la preferencia guardada para esta vista. Devuelve `null` si no
 * hay nada guardado o si faltan parámetros (sin sesión, sin empresa).
 *
 * Recibe `userId` desde el caller (AuthContext) en lugar de re-fetchearlo
 * con `auth.getUser()`: ese roundtrip añadía latencia y, si la sesión del
 * cliente Supabase aún no estaba hidratada en el primer render, devolvía
 * `null` silenciosamente y la hidratación se perdía.
 */
export async function loadViewPreferences(
  viewKey: string,
  empresaDbId: string | null | undefined,
  userId: string | null | undefined,
): Promise<ViewPrefs | null> {
  if (!viewKey || !empresaDbId || !userId) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("prefs")
    .eq("user_id", userId)
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
 * Lanza si faltan parámetros — el llamador decide cómo notificar.
 */
export async function saveViewPreferences(
  viewKey: string,
  empresaDbId: string | null | undefined,
  userId: string | null | undefined,
  prefs: ViewPrefs,
): Promise<void> {
  if (!viewKey) throw new Error("viewKey requerido");
  if (!empresaDbId) throw new Error("empresa activa sin id en BD");
  if (!userId) throw new Error("sesión requerida");

  const supabase = createClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
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
