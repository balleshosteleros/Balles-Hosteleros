/**
 * Origenes canónicos de una reserva. La columna `reservas.origen` es `text` libre,
 * pero TODA la UI nueva debe escribir/leer estos valores. Los strings legacy
 * (`channel-*`, palabras sueltas de campañas, null) se mapean a `OTROS` para
 * analítica vía {@link normalizarOrigen}.
 *
 * Regla operativa: si `estado === "WALK_IN"` el origen es siempre `WALKIN`,
 * tanto en alta como en edición — el restaurante no captó al cliente por
 * ningún canal digital, llegó andando.
 */
export type OrigenReserva =
  | "WEB"
  | "GOOGLE"
  | "LOCAL"
  | "WALKIN"
  | "INSTAGRAM"
  | "FACEBOOK";

/** Valor extra que se usa SOLO en la analítica para agrupar origenes desconocidos. */
export type OrigenBucket = OrigenReserva | "OTROS";

export const ORIGENES_RESERVA: OrigenReserva[] = [
  "WEB",
  "GOOGLE",
  "LOCAL",
  "WALKIN",
  "INSTAGRAM",
  "FACEBOOK",
];

export const ORIGEN_LABELS: Record<OrigenBucket, string> = {
  WEB: "Web",
  GOOGLE: "Google",
  LOCAL: "Local",
  WALKIN: "Walk In",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  OTROS: "Otros",
};

/**
 * Paleta calcada del dashboard de CoverManager: rojos para tráfico físico,
 * verde Google, teal motor web propio, naranja redes sociales, gris para
 * desconocido.
 */
export const ORIGEN_COLORS: Record<OrigenBucket, string> = {
  WEB: "#0d9488",       // teal-600 — motor web propio
  GOOGLE: "#22c55e",    // green-500 — Reserve with Google
  LOCAL: "#3b82f6",     // blue-500 — alta manual en local
  WALKIN: "#ef4444",    // red-500 — cliente andante
  INSTAGRAM: "#ec4899", // pink-500
  FACEBOOK: "#6366f1",  // indigo-500
  OTROS: "#94a3b8",     // slate-400
};

/**
 * Mapea cualquier string crudo de `reservas.origen` al bucket canónico.
 * - null / "" → "OTROS"
 * - Coincide case-insensitive con los 6 canónicos.
 * - `channel-*` y resto de strings legacy → "OTROS"
 */
export function normalizarOrigen(raw: string | null | undefined): OrigenBucket {
  if (!raw) return "OTROS";
  const up = raw.trim().toUpperCase();
  if (up.length === 0) return "OTROS";
  if ((ORIGENES_RESERVA as string[]).includes(up)) return up as OrigenReserva;
  // Aliases tolerantes para datos viejos:
  if (up === "WALK_IN" || up === "WALK-IN" || up === "WALK IN") return "WALKIN";
  if (up === "WWW" || up === "MOTOR_WEB" || up === "MOTOR WEB") return "WEB";
  if (up === "IG") return "INSTAGRAM";
  if (up === "FB") return "FACEBOOK";
  return "OTROS";
}
