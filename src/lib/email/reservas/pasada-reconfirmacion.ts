/**
 * ¿Le queda a una reserva alguna pasada del cron que le pida la reconfirmación?
 *
 * La pregunta correcta NO es "cuánta antelación tiene la reserva" sino "su
 * envío programado ya ha ocurrido". Con la comparación por antelación se caían
 * clientes por el hueco: una reserva creada con 24 h y 13 min de margen —trece
 * minutos por encima del lead de 1 día— quedaba fuera del envío inmediato, y la
 * pasada que le tocaba (la del día anterior a su hora) había ocurrido cuando la
 * reserva ni existía. No la recogía nadie, nunca, y en Sala aparecía como
 * CONFIRMADA igual que las que sí habían sido preguntadas.
 *
 * El envío de una reserva es a `horaEnvio` (hora del restaurante) del día que
 * cae `diasAntes` antes de la reserva; con `diasAntes = 0` —"El mismo día", el
 * valor por defecto— es esa misma mañana. Si ese instante ya pasó, el cron no
 * la va a coger: o se le envía en el acto, o ese cliente no recibe nada.
 */
import {
  ZONA_HORARIA_FALLBACK,
  zonaLocalAUtcISO,
} from "@/features/empresa/lib/zona-horaria";

/** Hora de envío por defecto, la del restaurante. */
export const RECONFIRMACION_HORA_ENVIO_FALLBACK = "10:00";

/** Normaliza "HH:MM" de la config; cualquier basura cae al valor por defecto. */
export function normalizarHoraEnvio(valor: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec((valor ?? "").trim());
  if (!m) return RECONFIRMACION_HORA_ENVIO_FALLBACK;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return RECONFIRMACION_HORA_ENVIO_FALLBACK;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Día civil "AAAA-MM-DD" de un instante, en la zona de la empresa. */
function diaEnZona(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || ZONA_HORARIA_FALLBACK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Instante en que el cron pide la reconfirmación de esta reserva.
 *
 * `fecha`/`hora` son hora local del RESTAURANTE, no del servidor: sin la zona
 * de la empresa el cálculo se va las horas que deciden si una reserva del
 * borde entra o no.
 */
export function instanteEnvioReconfirmacion(args: {
  fecha: string;
  hora: string;
  diasAntes: number;
  horaEnvio: string | null | undefined;
  tz: string;
}): Date {
  const tz = args.tz || ZONA_HORARIA_FALLBACK;
  const tsReserva = new Date(
    zonaLocalAUtcISO(args.fecha, args.hora.slice(0, 5), tz),
  );
  const diaEnvio = new Date(
    tsReserva.getTime() - args.diasAntes * 24 * 3600 * 1000,
  );
  return new Date(
    zonaLocalAUtcISO(
      diaEnZona(diaEnvio, tz),
      normalizarHoraEnvio(args.horaEnvio),
      tz,
    ),
  );
}

/**
 * ¿Hay que enviarle la reconfirmación AHORA, en vez de esperar al cron?
 *
 * Sí cuando la reserva está aún por venir y su pasada de envío ya ocurrió.
 * Quien todavía tiene pasada por delante la recibe a su hora, como toca.
 */
export function necesitaReconfirmacionInmediata(args: {
  fecha: string;
  hora: string;
  diasAntes: number;
  horaEnvio: string | null | undefined;
  tz: string;
  ahora?: Date;
}): boolean {
  const ahora = (args.ahora ?? new Date()).getTime();
  const tz = args.tz || ZONA_HORARIA_FALLBACK;
  const tsReserva = new Date(
    zonaLocalAUtcISO(args.fecha, args.hora.slice(0, 5), tz),
  );
  if (tsReserva.getTime() <= ahora) return false;
  return instanteEnvioReconfirmacion(args).getTime() <= ahora;
}
