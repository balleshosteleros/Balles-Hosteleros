/**
 * Formateo de fechas para MOSTRAR al usuario: siempre día/mes/año.
 *
 * Regla del proyecto: en pantalla, PDF y correos una fecha se lee
 * "03/09/2026" (día, mes, año). El formato "2026-09-03" es solo interno
 * (claves, orden, `<input type="date">`, parámetros de API y BD).
 *
 * Estas funciones trabajan sobre la CADENA, sin convertir a `Date`: así no
 * pueden desplazar el día por la zona horaria del navegador. Sirven para
 * fechas de calendario (`date` de BD) y para el día ya recortado de un
 * `timestamptz`.
 *
 * IMPORTANTE — para un instante completo (`created_at`, `updated_at` y demás
 * `timestamptz`) usa `formatFechaEnZona` / `formatFechaHoraEnZona` de
 * `@/features/empresa/lib/zona-horaria`: solo esas aplican la zona horaria de
 * la empresa (PRP-069). Recortar el ISO con `.slice(0, 10)` toma el día en UTC
 * y puede adelantar o atrasar la fecha una jornada.
 */

/** Fecha ISO "AAAA-MM-DD" (o ISO completo) a "dd/mm/aaaa". */
export function formatearFechaEs(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (!a || !m || !d) return "";
  return `${d}/${m}/${a}`;
}

/** ISO completo a "dd/mm/aaaa hh:mm". Si no trae hora, devuelve solo la fecha. */
export function formatearFechaHoraEs(iso: string | null | undefined): string {
  if (!iso) return "";
  const fecha = formatearFechaEs(iso);
  if (!fecha) return "";
  const hora = iso.length >= 16 ? iso.slice(11, 16) : "";
  return hora ? `${fecha} ${hora}` : fecha;
}
