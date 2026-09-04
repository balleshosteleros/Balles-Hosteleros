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

/**
 * Provincia → comunidad autónoma. Al crear una empresa se pide la provincia,
 * así que la comunidad se deduce de ahí y sus festivos quedan bien desde el
 * primer día, sin que nadie tenga que acordarse de configurarla. Se puede
 * cambiar después en RRHH → Calendarios.
 */
const PROVINCIA_A_COMUNIDAD: Record<string, ComunidadAutonoma> = {
  "almería": "Andalucía", "cádiz": "Andalucía", "córdoba": "Andalucía",
  "granada": "Andalucía", "huelva": "Andalucía", "jaén": "Andalucía",
  "málaga": "Andalucía", "sevilla": "Andalucía",
  "huesca": "Aragón", "teruel": "Aragón", "zaragoza": "Aragón",
  "asturias": "Asturias", "oviedo": "Asturias",
  "baleares": "Baleares", "illes balears": "Baleares", "islas baleares": "Baleares",
  "las palmas": "Canarias", "santa cruz de tenerife": "Canarias", "tenerife": "Canarias",
  "cantabria": "Cantabria", "santander": "Cantabria",
  "albacete": "Castilla-La Mancha", "ciudad real": "Castilla-La Mancha",
  "cuenca": "Castilla-La Mancha", "guadalajara": "Castilla-La Mancha",
  "toledo": "Castilla-La Mancha",
  "ávila": "Castilla y León", "burgos": "Castilla y León", "león": "Castilla y León",
  "palencia": "Castilla y León", "salamanca": "Castilla y León",
  "segovia": "Castilla y León", "soria": "Castilla y León",
  "valladolid": "Castilla y León", "zamora": "Castilla y León",
  "barcelona": "Cataluña", "girona": "Cataluña", "gerona": "Cataluña",
  "lleida": "Cataluña", "lérida": "Cataluña", "tarragona": "Cataluña",
  "alicante": "Comunidad Valenciana", "alacant": "Comunidad Valenciana",
  "castellón": "Comunidad Valenciana", "castelló": "Comunidad Valenciana",
  "valencia": "Comunidad Valenciana", "valència": "Comunidad Valenciana",
  "badajoz": "Extremadura", "cáceres": "Extremadura",
  "a coruña": "Galicia", "la coruña": "Galicia", "lugo": "Galicia",
  "ourense": "Galicia", "orense": "Galicia", "pontevedra": "Galicia",
  "la rioja": "La Rioja", "logroño": "La Rioja",
  "madrid": "Madrid",
  "murcia": "Murcia",
  "navarra": "Navarra", "pamplona": "Navarra",
  "álava": "País Vasco", "araba": "País Vasco", "vitoria": "País Vasco",
  "guipúzcoa": "País Vasco", "gipuzkoa": "País Vasco", "san sebastián": "País Vasco",
  "vizcaya": "País Vasco", "bizkaia": "País Vasco", "bilbao": "País Vasco",
  "ceuta": "Ceuta",
  "melilla": "Melilla",
};

/**
 * Comunidad autónoma que corresponde a una provincia, o "" si no se reconoce
 * (entonces la empresa se queda sin comunidad y solo tendrá los festivos
 * nacionales, hasta que alguien la elija a mano).
 */
export function comunidadDeProvincia(provincia: string | null | undefined): string {
  const clave = (provincia ?? "")
    .trim()
    .toLowerCase()
    // "Provincia de Burgos" / "Burgos (España)" → "burgos"
    .replace(/^provincia\s+de\s+/, "")
    .replace(/\s*\(.*\)\s*$/, "");
  if (!clave) return "";
  return PROVINCIA_A_COMUNIDAD[clave] ?? "";
}
