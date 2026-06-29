/**
 * Utilidades de fecha/hora regidas por la zona horaria de la EMPRESA.
 *
 * Regla del proyecto (PRP-069): toda hora que el sistema MUESTRA o CALCULA debe
 * formatearse con la zona horaria configurada de la empresa
 * (`empresas.config_operativa.zonaHoraria`, leída en servidor con
 * `getZonaHorariaEmpresa()`), nunca con la zona del servidor (UTC en producción)
 * ni con "Europe/Madrid" escrito a mano.
 *
 * La BD NO se toca: los instantes se guardan en UTC. Estas funciones solo cambian
 * cómo se PRESENTA o cómo se calcula el "ahora" local. Se usa el NOMBRE de zona
 * (IANA, p. ej. "Europe/Madrid", "Atlantic/Canary"), no un desfase fijo: así el
 * horario de verano/invierno se aplica solo según la fecha del propio instante y
 * cada registro conserva para siempre la hora real que tuvo.
 *
 * Son utilidades PURAS (sin acceso a BD ni `server-only`): valen en cliente y en
 * servidor. En cliente, la `tz` debe llegar ya resuelta desde el server en el
 * mismo payload donde van las fechas; nunca se consulta la BD desde el cliente.
 */

/** Fallback cuando no hay zona de empresa (coincide con `ZONA_HORARIA_DEFAULT`). */
export const ZONA_HORARIA_FALLBACK = "Europe/Madrid";

function tzSegura(tz: string | null | undefined): string {
  const t = typeof tz === "string" ? tz.trim() : "";
  return t || ZONA_HORARIA_FALLBACK;
}

/**
 * Formatea un instante UTC (ISO) como fecha+hora "dd/mm/aaaa, hh:mm" en la zona
 * dada. Devuelve "" si la fecha no es válida.
 */
export function formatFechaHoraEnZona(
  iso: string | null | undefined,
  tz: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-ES", {
    timeZone: tzSegura(tz),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  });
}

/**
 * Solo fecha "dd/mm/aaaa" en la zona dada. Devuelve "" si la fecha no es válida.
 */
export function formatFechaEnZona(
  iso: string | null | undefined,
  tz: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", {
    timeZone: tzSegura(tz),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...opts,
  });
}

/**
 * Solo hora "hh:mm" en la zona dada. Devuelve "" si la fecha no es válida.
 */
export function formatHoraEnZona(
  iso: string | null | undefined,
  tz: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-ES", {
    timeZone: tzSegura(tz),
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  });
}

/**
 * Minutos del día (0–1439) de un `Date` concreto, en la zona dada. Útil para
 * comparar contra ventanas de horario/fichaje. Reemplaza a `minutosMadridDe`.
 */
export function minutosDiaEnZona(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tzSegura(tz),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return Number(get("hour")) * 60 + Number(get("minute"));
}

/**
 * "Hoy" como fecha "YYYY-MM-DD" en la zona dada (PRP-069). Para fechar registros
 * (pedidos, inventarios, precios) en el DÍA local de la empresa, no en UTC del
 * servidor: cerca de medianoche el día UTC puede ir uno por delante/detrás.
 */
export function hoyEnZona(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tzSegura(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * "Ahora" en la zona dada: fecha "YYYY-MM-DD" y minutos del día (0–1439).
 * Reemplaza a `ahoraEnMadrid()` parametrizando la zona.
 */
export function ahoraEnZona(tz: string): { fecha: string; minutos: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tzSegura(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const fecha = `${get("year")}-${get("month")}-${get("day")}`;
  const minutos = Number(get("hour")) * 60 + Number(get("minute"));
  return { fecha, minutos };
}
