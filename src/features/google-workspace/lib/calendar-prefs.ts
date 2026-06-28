"use client";

import { loadUserPref, saveUserPref } from "@/shared/io/user-preferences";

// Selección de calendarios "fijados" del usuario, compartida por los paneles de
// Calendar y Meet. Es una preferencia POR USUARIO (no por empresa): los
// calendarios que el usuario deja marcados se conservan tras cerrar sesión y en
// cualquier dispositivo. Se guarda como JSON de IDs en `usuario_preferencias`.
export const CALENDARIOS_SELECCIONADOS_KEY = "google_calendarios_seleccionados";

// Devuelve la lista de IDs guardada, o `null` si el usuario nunca eligió (para
// distinguir "primera vez" de "deseleccionó todo", que es un array vacío válido).
export async function loadCalendariosSeleccionados(): Promise<string[] | null> {
  const raw = await loadUserPref(CALENDARIOS_SELECCIONADOS_KEY);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : null;
  } catch {
    return null;
  }
}

// Persiste la selección actual. Guardamos siempre (incluido el array vacío) para
// respetar la intención de "no mostrar ninguno".
export function saveCalendariosSeleccionados(ids: Set<string> | string[]): void {
  const arr = Array.from(ids);
  void saveUserPref(CALENDARIOS_SELECCIONADOS_KEY, JSON.stringify(arr));
}
