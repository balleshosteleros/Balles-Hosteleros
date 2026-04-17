/**
 * Helpers de estado de mesa (puro, sin server).
 * El schema real de `mesas` (supabase/migrations/027) guarda estado como text
 * con check ('Libre','Ocupada','Reservada','Bloqueada').
 * En UI y tipos usamos mayúsculas (enum-like) para consistencia.
 */

export type EstadoMesa = "LIBRE" | "OCUPADA" | "RESERVADA" | "BLOQUEADA";

export function normEstadoDb(e: string | null | undefined): EstadoMesa {
  switch ((e ?? "").toLowerCase()) {
    case "ocupada":
      return "OCUPADA";
    case "reservada":
      return "RESERVADA";
    case "bloqueada":
      return "BLOQUEADA";
    default:
      return "LIBRE";
  }
}

export function toEstadoDb(e: EstadoMesa): string {
  switch (e) {
    case "OCUPADA":
      return "Ocupada";
    case "RESERVADA":
      return "Reservada";
    case "BLOQUEADA":
      return "Bloqueada";
    default:
      return "Libre";
  }
}
