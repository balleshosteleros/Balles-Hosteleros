import "server-only";

/**
 * Materializa el FICHAJE de una solicitud de trabajo aprobada.
 *
 *   • subtipo 'dia_trabajado' → fichaje NORMAL (tipo NOR)
 *   • subtipo 'horas_extras'  → fichaje EXTRA  (tipo EXT)
 *
 * El trabajador indica el TRAMO (hora entrada–salida) al solicitar; al aprobar
 * se crea el fichaje con ese tramo. Regla anti-solape: un día admite VARIOS
 * fichajes mientras NO se pisen en el tiempo. Si el tramo solicitado se solapa
 * con otro fichaje de ese empleado ese día, NO se crea y se devuelve error.
 *
 * Idempotente: el índice único `fichajes.solicitud_id` evita duplicar si se
 * reaprobara. Vincula el fichaje a la solicitud vía `solicitud_id`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** "HH:MM[:SS]" → minutos del día (0–1439). null si no válido. */
function hhmmAMin(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** ¿Se solapan [aIni,aFin) y [bIni,bFin)? (minutos, resolviendo cruce medianoche). */
function seSolapan(aIni: number, aFin: number, bIni: number, bFin: number): boolean {
  const aF = aFin <= aIni ? aFin + 1440 : aFin;
  const bF = bFin <= bIni ? bFin + 1440 : bFin;
  return aIni < bF && bIni < aF;
}

export interface SolicitudTrabajo {
  id: string;
  empresa_id: string;
  user_id: string;
  empleado_nombre: string | null;
  subtipo: string;
  fecha_inicio: string; // YYYY-MM-DD
  hora_inicio: string | null;
  hora_fin: string | null;
}

/**
 * Crea el fichaje de una solicitud de trabajo aprobada. Devuelve ok:false con
 * motivo si falta el tramo o si se solapa con otro fichaje del mismo día.
 * `admin` debe ser un cliente con permisos de escritura (service-role o el del
 * validador, que ya pasó el control de acceso en aprobarSolicitud).
 */
export async function materializarFichajeDeSolicitud(
  admin: SupabaseClient,
  sol: SolicitudTrabajo,
): Promise<{ ok: boolean; error?: string; creado?: boolean }> {
  // Solo solicitudes de trabajo con tramo.
  if (sol.subtipo !== "dia_trabajado" && sol.subtipo !== "horas_extras") {
    return { ok: true, creado: false };
  }
  const ini = hhmmAMin(sol.hora_inicio);
  const fin = hhmmAMin(sol.hora_fin);
  if (ini == null || fin == null || ini === fin) {
    return { ok: false, error: "La solicitud no tiene un tramo de horas válido." };
  }

  // Idempotencia: si ya existe el fichaje de esta solicitud, no duplicar.
  const { data: yaExiste } = await admin
    .from("fichajes")
    .select("id")
    .eq("solicitud_id", sol.id)
    .maybeSingle();
  if (yaExiste) return { ok: true, creado: false };

  // Anti-solape: fichajes de ESE empleado (user_id) ese día. Se permiten varios
  // tramos disjuntos; se rechaza si el nuevo se pisa con alguno existente.
  const { data: delDia } = await admin
    .from("fichajes")
    .select("hora_entrada, hora_salida")
    .eq("empresa_id", sol.empresa_id)
    .eq("empleado_id", sol.user_id)
    .eq("fecha", sol.fecha_inicio);
  for (const f of delDia ?? []) {
    // hora_entrada/salida son timestamptz; extraemos HH:MM de la parte de hora.
    const eIni = hhmmAMin(extraerHora(f.hora_entrada as string | null));
    const eFin = hhmmAMin(extraerHora(f.hora_salida as string | null));
    if (eIni == null || eFin == null) continue; // fichaje sin salida: no bloquea por tramo
    if (seSolapan(ini, fin, eIni, eFin)) {
      return {
        ok: false,
        error: "No es posible crear el fichaje: ya hay otro fichaje en ese tramo horario ese día.",
      };
    }
  }

  let min = fin - ini;
  if (min < 0) min += 1440;
  const horasTotales = Math.round((min / 60) * 100) / 100;
  const tipo = sol.subtipo === "horas_extras" ? "EXT" : "NOR";

  // Construir timestamptz de entrada/salida a partir de la fecha + tramo. Se usa
  // hora local naïf (sin sufijo Z) para que la fecha del fichaje coincida.
  const entradaISO = `${sol.fecha_inicio}T${normalizarHHMM(sol.hora_inicio!)}:00`;
  const cruzaMedianoche = fin <= ini;
  const fechaSalida = cruzaMedianoche ? sumarUnDia(sol.fecha_inicio) : sol.fecha_inicio;
  const salidaISO = `${fechaSalida}T${normalizarHHMM(sol.hora_fin!)}:00`;

  const { error } = await admin.from("fichajes").insert({
    empresa_id: sol.empresa_id,
    empleado_id: sol.user_id, // fichajes.empleado_id = user_id (auth)
    empleado_nombre: sol.empleado_nombre ?? "Sin nombre",
    fecha: sol.fecha_inicio,
    hora_entrada: entradaISO,
    hora_salida: salidaISO,
    horas_totales: horasTotales,
    estado: "completado",
    tipo,
    solicitud_id: sol.id,
    observaciones: sol.subtipo === "horas_extras" ? "Horas extras (solicitud aprobada)" : "Día trabajado (solicitud aprobada)",
  });
  if (error) {
    // Si chocó con el índice único (carrera de doble aprobación), no es error real.
    if (error.code === "23505") return { ok: true, creado: false };
    return { ok: false, error: error.message };
  }
  return { ok: true, creado: true };
}

/** Extrae "HH:MM" de un timestamptz/ISO ("2026-07-08T09:30:00+00" → "09:30"). */
function extraerHora(iso: string | null): string | null {
  if (!iso) return null;
  const m = /T(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : null;
}

/** "9:5" → "09:05" (asegura dos dígitos). */
function normalizarHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}

/** "YYYY-MM-DD" + 1 día (para tramos que cruzan medianoche). */
function sumarUnDia(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}
