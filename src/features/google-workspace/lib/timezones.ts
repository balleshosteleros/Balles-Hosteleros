// Helpers de zona horaria secundaria, compartidos entre el Calendario, Meet y
// el panel de Ajustes. La preferencia es POR USUARIO (no por empresa): cada
// usuario decide si quiere ver una segunda columna de horas y en qué huso.

// Clave única en `user_preferences` (jsonb por usuario). La comparten el
// Calendario, Meet y el panel de Ajustes para que la elección sea consistente
// en todas las superficies.
export const TZ_HORA_SECUNDARIA_KEY = "google_tz_secundaria";

// Huso secundario por defecto al activar la opción si el usuario aún no eligió.
export const TZ_SECUNDARIA_DEFECTO = "Asia/Makassar"; // Bali

export const TZ_OPCIONES: { value: string; label: string }[] = [
  { value: "Asia/Makassar", label: "Bali (UTC+8)" },
  { value: "Asia/Jakarta", label: "Yakarta (UTC+7)" },
  { value: "America/New_York", label: "Nueva York (UTC−5/4)" },
  { value: "America/Los_Angeles", label: "Los Ángeles (UTC−8/7)" },
  { value: "America/Mexico_City", label: "Ciudad de México" },
  { value: "Europe/London", label: "Londres" },
  { value: "Asia/Tokyo", label: "Tokio (UTC+9)" },
  { value: "Asia/Dubai", label: "Dubái (UTC+4)" },
  { value: "Australia/Sydney", label: "Sídney" },
];

// Zonas destacadas: nombre amistoso en español + sinónimos de búsqueda, para
// zonas cuya ciudad IANA no coincide con lo que la gente escribe
// (p. ej. Bali = Asia/Makassar, España = Europe/Madrid).
export const TZ_DESTACADAS: { value: string; nombre: string; buscar?: string[] }[] = [
  { value: "Europe/Madrid", nombre: "España (Madrid)", buscar: ["espana", "spain", "madrid", "peninsula"] },
  { value: "Atlantic/Canary", nombre: "Canarias", buscar: ["canary", "tenerife", "las palmas", "gran canaria"] },
  { value: "Asia/Makassar", nombre: "Bali", buscar: ["bali", "indonesia"] },
  { value: "Asia/Jakarta", nombre: "Yakarta", buscar: ["jakarta", "indonesia"] },
  { value: "America/New_York", nombre: "Nueva York", buscar: ["new york", "ny"] },
  { value: "America/Los_Angeles", nombre: "Los Ángeles", buscar: ["los angeles", "la"] },
  { value: "America/Mexico_City", nombre: "Ciudad de México", buscar: ["mexico", "cdmx"] },
  { value: "Europe/London", nombre: "Londres", buscar: ["london", "reino unido", "uk"] },
  { value: "Asia/Tokyo", nombre: "Tokio", buscar: ["tokyo", "japon"] },
  { value: "Asia/Dubai", nombre: "Dubái", buscar: ["dubai", "emiratos"] },
  { value: "Australia/Sydney", nombre: "Sídney", buscar: ["sydney", "australia"] },
];

const TZ_DEST_MAP = new Map(TZ_DESTACADAS.map((d) => [d.value, d]));

export function ciudadTZ(tz: string): string {
  const last = tz.split("/").pop() || tz;
  return last.replace(/_/g, " ");
}

export function offsetTZ(tz: string, base: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("es-ES", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(base);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function listaZonas(): string[] {
  try {
    const intl = Intl as unknown as {
      supportedValuesOf?: (k: string) => string[];
    };
    const all = intl.supportedValuesOf?.("timeZone");
    if (Array.isArray(all) && all.length > 0) return all;
  } catch {}
  return TZ_OPCIONES.map((o) => o.value);
}

export const normTZ = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const nombreZona = (z: string): string =>
  TZ_DEST_MAP.get(z)?.nombre || ciudadTZ(z);

export const sinonimosZona = (z: string): string[] => {
  const d = TZ_DEST_MAP.get(z);
  const base = [ciudadTZ(z), z];
  return d ? [d.nombre, ...(d.buscar ?? []), ...base] : base;
};

// Hora (HH:MM, 24h) de un huso dado, para una hora concreta del día base.
export function horaEnTZ(h: number, tz: string, base: Date): string {
  const d = new Date(base);
  d.setHours(h, 0, 0, 0);
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
    hour12: false,
  }).format(d);
}

// Etiqueta corta de cualquier huso (cabecera de columna). Usa nombres
// amistosos en español; cae a la ciudad IANA si no hay mapeo.
export function shortTZLabel(tz: string): string {
  const map: Record<string, string> = {
    "Europe/Madrid": "España",
    "Atlantic/Canary": "Canarias",
    "Asia/Makassar": "Bali",
    "Asia/Jakarta": "Yakarta",
    "America/New_York": "NY",
    "America/Los_Angeles": "LA",
    "America/Mexico_City": "MX",
    "Europe/London": "Londres",
    "Asia/Tokyo": "Tokio",
    "Asia/Dubai": "Dubái",
    "Australia/Sydney": "Sídney",
  };
  return map[tz] || ciudadTZ(tz);
}

// Etiqueta corta del huso local del dispositivo (columna principal).
export function labelTZLocal(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return shortTZLabel(tz);
  } catch {
    return "Local";
  }
}
