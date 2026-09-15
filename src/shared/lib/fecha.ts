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

/**
 * Día SIGUIENTE a una fecha de calendario ("AAAA-MM-DD" → "AAAA-MM-DD").
 *
 * Se calcula en UTC puro, sin hora, para que el +1 no dependa de la zona del
 * servidor ni del navegador. Lo usa la baja: el último día de trabajo es uno y
 * el día oficial de la baja en la Seguridad Social es el siguiente, y ese par
 * tiene que salir igual en el correo a la gestoría y en la pantalla.
 */
export function diaSiguienteIso(iso: string | null | undefined): string | null {
  if (!iso || iso.length < 10) return null;
  const t = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return null;
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}
