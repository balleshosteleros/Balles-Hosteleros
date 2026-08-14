"use client";

import { loadUserPref, saveUserPref } from "@/shared/io/user-preferences";

// Selección de calendarios "fijados", compartida por los paneles de Calendar y
// Meet. Se conserva tras cerrar sesión y entre dispositivos (vive en
// `usuario_preferencias`).
//
// La selección es POR CUENTA DE GOOGLE, no por usuario del software. Cada cuenta
// (p. ej. dirección de Bacanal y dirección de Habana) ve calendarios distintos:
// los suyos y los que le han compartido. Con una única clave común, los
// calendarios marcados en una cuenta se aplicaban también a la otra, donde NO
// existen, y el panel salía vacío y el badge contaba 0 sin explicación.
const BASE_KEY = "google_calendarios_seleccionados";

/** Clave de preferencia de la cuenta indicada. */
function claveDe(cuenta: string | null): string {
  if (!cuenta) return BASE_KEY;
  return `${BASE_KEY}:${cuenta.toLowerCase()}`;
}

// Devuelve la lista de IDs guardada para esa cuenta, o `null` si nunca eligió
// (para distinguir "primera vez" de "deseleccionó todo", que es un [] válido).
export async function loadCalendariosSeleccionados(
  cuenta: string | null,
): Promise<string[] | null> {
  const parse = (raw: string | null): string[] | null => {
    if (!raw) return null;
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr)
        ? arr.filter((x): x is string => typeof x === "string")
        : null;
    } catch {
      return null;
    }
  };

  const propia = parse(await loadUserPref(claveDe(cuenta)));
  if (propia !== null) return propia;

  // Sin selección propia todavía. Si existe la preferencia antigua (de cuando
  // era única para todas las cuentas) la reutilizamos como punto de partida:
  // los IDs que no pertenezcan a esta cuenta se descartan luego al validarlos
  // contra su lista real de calendarios.
  if (cuenta) return parse(await loadUserPref(BASE_KEY));
  return null;
}

// Persiste la selección de esa cuenta. Guardamos siempre (incluido el array
// vacío) para respetar la intención de "no mostrar ninguno".
export function saveCalendariosSeleccionados(
  cuenta: string | null,
  ids: Set<string> | string[],
): void {
  const arr = Array.from(ids);
  void saveUserPref(claveDe(cuenta), JSON.stringify(arr));
}
