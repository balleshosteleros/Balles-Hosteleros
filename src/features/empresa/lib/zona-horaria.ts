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
  // Admite ausencia: la empresa activa puede no estar resuelta en el primer
  // render. `tzSegura` ya cae al valor por defecto, así que exigirla aquí solo
  // servía para reventar la pantalla en ese instante.
  tz: string | null | undefined,
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
 * Clave de día "AAAA-MM-DD" de un ISO en la zona dada. Estable para agrupar
 * mensajes por día (chat estilo WhatsApp). Devuelve "" si la fecha no es válida.
 */
export function claveDiaEnZona(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA da formato AAAA-MM-DD directamente.
  return d.toLocaleDateString("en-CA", { timeZone: tzSegura(tz) });
}

/**
 * Etiqueta amigable del separador de día en un chat: "Hoy", "Ayer" o fecha
 * larga ("lunes, 4 de agosto de 2026"), todo calculado en la zona de la empresa.
 */
export function etiquetaDiaChat(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  const clave = claveDiaEnZona(iso, tz);
  if (!clave) return "";
  const ahora = new Date();
  const hoy = claveDiaEnZona(ahora.toISOString(), tz);
  const ayer = claveDiaEnZona(new Date(ahora.getTime() - 86_400_000).toISOString(), tz);
  if (clave === hoy) return "Hoy";
  if (clave === ayer) return "Ayer";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    timeZone: tzSegura(tz),
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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

/**
 * INVERSO de las anteriores: una fecha y hora LOCALES de la empresa
 * ("2026-08-06", "09:00") → el instante real en UTC, listo para guardar.
 *
 * Necesario en servidor: `new Date("2026-08-06T09:00")` usa la zona del proceso
 * (Vercel = UTC), así que interpretaría las 09:00 como UTC y guardaría un
 * instante desplazado — en Madrid se leería luego como las 11:00 en verano.
 *
 * Cómo funciona: se parte de la lectura ingenua en UTC y se corrige con el
 * desfase real de esa zona en ese instante (que ya contempla el horario de
 * verano). Se aplica dos veces porque el propio desfase puede cambiar justo en
 * el salto horario; la segunda pasada estabiliza el resultado.
 */
export function zonaLocalAUtcISO(fecha: string, hora: string, tz: string): string {
  const zona = tzSegura(tz);
  const base = Date.parse(`${fecha}T${hora}:00Z`);
  if (Number.isNaN(base)) return new Date(`${fecha}T${hora}:00Z`).toISOString();

  const desfaseMs = (utcMs: number): number => {
    const p = new Intl.DateTimeFormat("en-GB", {
      timeZone: zona,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utcMs));
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? "0");
    const comoUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
    return comoUtc - utcMs;
  };

  let ts = base - desfaseMs(base);
  ts = base - desfaseMs(ts);
  return new Date(ts).toISOString();
}
