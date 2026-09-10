/**
 * Qué es un local a efectos de licencia y de convenio.
 *
 * Van aquí, y no escritos a mano en cada formulario, porque son listas
 * cerradas: si se dejan como texto libre cada uno escribe una variante
 * ("Rest.", "restaurante", "Restaurante 2 tenedores") y luego nadie sabe
 * qué poner. Los consume la ficha del local en Ajustes.
 */

/** Lo que es el local a efectos de la licencia de actividad. */
export const TIPOS_ESTABLECIMIENTO = [
  "Restaurante",
  "Bar",
  "Cafetería",
  "Bar-restaurante",
  "Cervecería",
  "Coctelería",
  "Discoteca",
  "Salón de banquetes",
  "Catering",
  "Otro",
] as const;

/**
 * Categoría oficial por tenedores. La regula cada comunidad autónoma, pero la
 * escala es la misma en toda España: 5 tenedores es lujo y 1 es cuarta.
 * "No aplica" es para los locales que no son restaurante (un bar o una
 * coctelería no se clasifican por tenedores).
 */
export const CLASES_RESTAURANTE = [
  "No aplica",
  "5 tenedores (lujo)",
  "4 tenedores (primera)",
  "3 tenedores (segunda)",
  "2 tenedores (tercera)",
  "1 tenedor (cuarta)",
] as const;

/**
 * Convenio colectivo de hostelería que rige a la plantilla del local.
 *
 * Es PROVINCIAL, no estatal ni autonómico: por encima está el ALEH (marco
 * estatal, fija grupos profesionales y mínimos), pero el propio ALEH remite
 * los salarios y la jornada al convenio de ámbito territorial inferior. Por
 * eso el convenio lo marca dónde está el local, no de quién es la empresa:
 * dos locales de la misma sociedad en provincias distintas van a convenios
 * distintos.
 */
/** Las 52 provincias, incluidas Ceuta y Melilla. */
export const PROVINCIAS = [
  "A Coruña",
  "Álava",
  "Albacete",
  "Alicante",
  "Almería",
  "Asturias",
  "Ávila",
  "Badajoz",
  "Baleares",
  "Barcelona",
  "Burgos",
  "Cáceres",
  "Cádiz",
  "Cantabria",
  "Castellón",
  "Ceuta",
  "Ciudad Real",
  "Córdoba",
  "Cuenca",
  "Girona",
  "Granada",
  "Guadalajara",
  "Guipúzcoa",
  "Huelva",
  "Huesca",
  "Jaén",
  "La Rioja",
  "Las Palmas",
  "León",
  "Lleida",
  "Lugo",
  "Madrid",
  "Málaga",
  "Melilla",
  "Murcia",
  "Navarra",
  "Ourense",
  "Palencia",
  "Pontevedra",
  "Salamanca",
  "Santa Cruz de Tenerife",
  "Segovia",
  "Sevilla",
  "Soria",
  "Tarragona",
  "Teruel",
  "Toledo",
  "Valencia",
  "Valladolid",
  "Vizcaya",
  "Zamora",
  "Zaragoza",
] as const;

/**
 * Convenio colectivo de hostelería que rige a la plantilla del local.
 *
 * Es PROVINCIAL, no estatal ni autonómico: por encima está el ALEH (marco
 * estatal, fija grupos profesionales y mínimos), pero el propio ALEH remite
 * los salarios y la jornada al convenio de ámbito territorial inferior. Por
 * eso el convenio lo marca dónde está el local, no de quién es la empresa:
 * dos locales de la misma sociedad en provincias distintas van a convenios
 * distintos.
 */
export const CONVENIOS_HOSTELERIA = PROVINCIAS.map((p) => `Hostelería de ${p}`);

/** El convenio que le toca a una provincia. Vacío si la provincia no consta. */
export function convenioDeProvincia(provincia: string): string {
  return PROVINCIAS.includes(provincia as (typeof PROVINCIAS)[number])
    ? `Hostelería de ${provincia}`
    : "";
}
