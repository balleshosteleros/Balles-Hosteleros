// Tipos y constantes de festivos.
// Vive SEPARADO de `festivos-actions.ts` porque ese archivo es "use server"
// y un módulo "use server" solo puede exportar funciones async.

export type AmbitoFestivo = "nacional" | "autonomico" | "local";
export type OrigenFestivo = "auto" | "manual";

export interface FestivoBD {
  id: string;
  fecha: string; // "YYYY-MM-DD"
  nombre: string;
  ambito: AmbitoFestivo;
  origen: OrigenFestivo;
}

/**
 * Comunidades y ciudades autónomas de España. El `value` guardado en
 * `empresas.config_operativa.comunidadAutonoma` debe coincidir (case-insensitive)
 * con las claves reconocidas por la función SQL `festivos_autonomicos`.
 */
export const COMUNIDADES_AUTONOMAS = [
  "Andalucía", "Aragón", "Asturias", "Baleares", "Canarias", "Cantabria",
  "Castilla-La Mancha", "Castilla y León", "Cataluña", "Comunidad Valenciana",
  "Extremadura", "Galicia", "La Rioja", "Madrid", "Murcia", "Navarra",
  "País Vasco", "Ceuta", "Melilla",
] as const;

export type ComunidadAutonoma = (typeof COMUNIDADES_AUTONOMAS)[number];
