"use server";

/**
 * Disponibilidad real del motor web para una fecha concreta.
 *
 * Sustituye al iframe de CoverManager: en vez de que el cliente escriba una
 * hora a ciegas y se la rechacemos al enviar, aquí calculamos QUÉ horas puede
 * pulsar. Misma jerarquía de horarios que el back office
 * (`HorariosAperturaPanel`): excepción por fecha → día de semana → general.
 *
 * Un slot se marca `disponible: false` (y no se oculta) cuando el motivo es de
 * ocupación, para que el cliente vea que ese pase existe pero está lleno —
 * igual que hace CoverManager al tachar las horas.
 */

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ESTADOS_NO_OCUPANTES, horaAMinutos } from "@/features/sala/lib/reserva-conflicto";
import { vigenciaAplicaEnFecha, type ReservaBloqueo } from "@/features/sala/bloqueos/data/bloqueos";
import {
  getCamposObligatoriosReserva,
  type CamposObligatoriosReserva,
} from "@/features/sala/lib/reserva-campos-obligatorios";
import { turnoDeHora } from "@/features/sala/lib/dia-negocio";
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import {
  RESERVA_SLOT_MIN,
  MAX_COMENSALES_ENTRADA,
} from "@/features/sala/data/reservas";

const inputSchema = z.object({
  empresaSlug: z.string().min(1).max(120),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  personas: z.number().int().min(1).max(MAX_COMENSALES_ENTRADA),
});

export type ListarDisponibilidadInput = z.infer<typeof inputSchema>;

export interface SlotPublico {
  /** HH:MM */
  hora: string;
  turno: "COMIDA" | "CENA";
  disponible: boolean;
  /** Motivo legible cuando `disponible` es false. */
  motivo: string | null;
}

/**
 * Campos que la empresa exige además de los fijos (nombre, apellidos, fecha,
 * hora y personas, siempre obligatorios). El portal los usa para marcar el
 * asterisco y bloquear el envío.
 *
 * Es el mismo tipo que usa el back office: se reexporta en vez de duplicarlo
 * para que ambos lados no puedan divergir.
 */
export type CamposObligatoriosPublico = CamposObligatoriosReserva;

export type ListarDisponibilidadResult =
  | {
      ok: true;
      slots: SlotPublico[];
      cerrado: boolean;
      mensaje: string | null;
      obligatorios: CamposObligatoriosPublico;
    }
  | { ok: false; error: string };

const MIN_POR_DIA = 1440;
const DIA_KEY = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"] as const;

type Turno = "comida" | "cena";
interface Ventana {
  cerrado: boolean;
  inicio: string;
  fin: string;
}

function aMinutos(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

function intervaloMinutos(inicio: string, fin: string): [number, number] {
  const s = aMinutos(inicio);
  let e = aMinutos(fin);
  if (e <= s) e += MIN_POR_DIA; // cena que cruza medianoche (20:00 → 02:00)
  return [s, e];
}

function minutosAHora(m: number): string {
  const n = ((m % MIN_POR_DIA) + MIN_POR_DIA) % MIN_POR_DIA;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

/**
 * Ventana efectiva del turno. Mismos defaults que el back office cuando la
 * empresa no ha configurado horarios: comida 13:00–16:00, cena 20:00–02:00.
 */
function ventanaEfectiva(cfg: Record<string, unknown>, dia: string, t: Turno): Ventana {
  if (cfg[`${dia}_cerrado_${t}`] === true) return { cerrado: true, inicio: "", fin: "" };
  const diaIni = cfg[`${dia}_inicio_${t}`] as string | null;
  const diaFin = cfg[`${dia}_fin_${t}`] as string | null;
  if (diaIni && diaFin) return { cerrado: false, inicio: diaIni, fin: diaFin };

  if (t === "comida") {
    if (cfg.general_cerrado_comida === true) return { cerrado: true, inicio: "", fin: "" };
    const gi = cfg.general_inicio_comida as string | null;
    const gf = cfg.general_fin_comida as string | null;
    if (gi && gf) return { cerrado: false, inicio: gi, fin: gf };
    return { cerrado: false, inicio: "13:00", fin: "16:00" };
  }
  if (cfg.general_cerrado_cena === true) return { cerrado: true, inicio: "", fin: "" };
  const gi = cfg.general_inicio_cena as string | null;
  const gf = cfg.general_fin_cena as string | null;
  if (gi && gf) return { cerrado: false, inicio: gi, fin: gf };
  return { cerrado: false, inicio: "20:00", fin: "02:00" };
}

/** Excepción puntual (fecha suelta, rango o lista) que pisa al horario semanal. */
function excepcionParaFecha(
  excepciones: Record<string, unknown>[],
  fecha: string,
  t: Turno,
): Ventana | null {
  for (const e of excepciones) {
    if ((e.turno as string) !== t) continue;
    const ambito = e.ambito as string;
    let aplica = false;
    if (ambito === "fecha") aplica = e.fecha === fecha;
    else if (ambito === "rango") {
      aplica = Boolean(e.fecha_inicio && e.fecha_fin && fecha >= (e.fecha_inicio as string) && fecha <= (e.fecha_fin as string));
    } else if (ambito === "dias_especificos") {
      aplica = Array.isArray(e.fechas) && (e.fechas as string[]).includes(fecha);
    }
    if (!aplica) continue;
    if (e.cerrado === true) return { cerrado: true, inicio: "", fin: "" };
    if (e.inicio && e.fin) return { cerrado: false, inicio: e.inicio as string, fin: e.fin as string };
  }
  return null;
}

export async function listarDisponibilidadPublicaAction(
  input: ListarDisponibilidadInput,
): Promise<ListarDisponibilidadResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const { empresaSlug, fecha, personas } = parsed.data;

  const admin = createAdminClient();

  const { data: empresa } = await admin
    .from("empresas")
    .select("id")
    .eq("slug", empresaSlug)
    .maybeSingle();
  if (!empresa) return { ok: false, error: "Restaurante no encontrado" };
  const empresaId = empresa.id as string;

  const { data: cfgRow } = await admin
    .from("empresa_reservas_config")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const cfg = (cfgRow ?? {}) as Record<string, unknown>;

  // Los marca la empresa en Ajustes → Departamentos → Sala → Reservas. Se
  // resuelven en servidor por `empresa_id` porque el portal no tiene sesión.
  const obligatorios: CamposObligatoriosPublico =
    await getCamposObligatoriosReserva(empresaId);

  // Antelación máxima: no dejamos reservar más allá del horizonte configurado.
  //
  // "Hoy" y "ahora" son los del RESTAURANTE, no los del servidor: en producción
  // el proceso va en UTC, así que a las 00:30 de Madrid su reloj marca todavía
  // el día anterior y se ofrecerían horas ya pasadas.
  const maxDias = (cfg.antelacion_max_dias as number | null) ?? 90;
  const tz = await getZonaHorariaEmpresa(admin, empresaId);
  const { fecha: hoyISO, minutos: minAhora } = ahoraEnZona(tz);
  if (fecha < hoyISO) {
    return { ok: true, slots: [], cerrado: true, mensaje: "Esa fecha ya ha pasado.", obligatorios };
  }
  const limite = new Date(`${hoyISO}T00:00:00`);
  limite.setDate(limite.getDate() + maxDias);
  if (fecha > limite.toISOString().slice(0, 10)) {
    return {
      ok: true,
      slots: [],
      cerrado: true,
      mensaje: `Solo aceptamos reservas con ${maxDias} días de antelación.`,
      obligatorios,
    };
  }

  const { data: excRows } = await admin
    .from("empresa_reservas_horarios_excepciones")
    .select("*")
    .eq("empresa_id", empresaId);
  const excepciones = (excRows ?? []) as Record<string, unknown>[];

  const dia = DIA_KEY[new Date(`${fecha}T00:00:00`).getDay()];

  // Reservas ya existentes en ese SERVICIO, para descontar aforo.
  //
  // Un solo día: `reservas.fecha` es el DÍA DE NEGOCIO, así que la cena de las
  // 21:00 y la madrugada de las 00:30 de esa misma noche comparten fecha. Se
  // pedían DOS días de calendario porque el portal guardaba la madrugada con
  // la fecha civil (un día por delante); corregido eso, el segundo día solo
  // traía reservas de la noche SIGUIENTE, que se descartaban después.
  const { data: reservasRows } = await admin
    .from("reservas")
    .select("personas, hora, estado, fecha")
    .eq("empresa_id", empresaId)
    .eq("fecha", fecha)
    .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
  const reservas = (reservasRows ?? []) as {
    personas: number;
    hora: string;
    fecha: string;
  }[];

  // Bloqueos de sala vigentes esa fecha (cierres puntuales, privatizaciones).
  // Solo cierran el turno cuando bloquean el local ENTERO: un bloqueo de mesas
  // o zonas concretas reduce aforo, pero no impide reservar a esa hora.
  const { data: bloqueoRows } = await admin
    .from("empresa_reservas_bloqueos")
    .select("modo_vigencia, fecha_desde, fecha_hasta, dias_semana, fechas_extra, turno, zona_ids, mesa_ids")
    .eq("empresa_id", empresaId);

  const bloqueosVigentes = ((bloqueoRows ?? []) as Record<string, unknown>[]).filter((b) => {
    const spec = {
      modoVigencia: b.modo_vigencia,
      fechaDesde: b.fecha_desde ?? null,
      fechaHasta: b.fecha_hasta ?? null,
      diasSemana: (b.dias_semana as number[] | null) ?? null,
      fechasExtra: (b.fechas_extra as string[] | null) ?? null,
    } as ReservaBloqueo;
    return vigenciaAplicaEnFecha(spec, fecha);
  });

  const turnoBloqueado = (t: Turno): boolean =>
    bloqueosVigentes.some((b) => {
      const bt = (b.turno as string | null)?.toUpperCase() ?? null;
      const turnoUp = t === "comida" ? "COMIDA" : "CENA";
      if (bt && bt !== turnoUp && bt !== "AMBOS") return false;
      const zonas = (b.zona_ids as string[] | null) ?? [];
      const mesas = (b.mesa_ids as string[] | null) ?? [];
      return zonas.length === 0 && mesas.length === 0;
    });

  const esHoy = fecha === hoyISO;
  /**
   * Días entre hoy y la fecha pedida. Sirve para llevar todos los pases a una
   * misma referencia (minutos desde las 00:00 de HOY) y poder compararlos con
   * el reloj, incluidos los de la cena que se mete en la madrugada siguiente.
   */
  const diasHastaFecha = Math.round(
    (Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoyISO}T00:00:00Z`)) /
      86_400_000,
  );
  const antelacionMin = (cfg.antelacion_min_minutos as number | null) ?? 0;

  // Cupo del TURNO (tope total de comensales). Se comprueba aquí y no solo al
  // guardar: si no, el cliente elige hora, rellena todos sus datos y solo al
  // pulsar Reservar descubre que el turno está lleno — y encima probaría otra
  // hora, que estará igual de llena porque el tope es del turno entero.
  // Se usa la MISMA función de BD que decide en el alta, para que lo que ve
  // coincida con lo que puede hacer.
  const cupoTurnoLleno: Record<Turno, boolean> = { comida: false, cena: false };
  for (const t of ["comida", "cena"] as Turno[]) {
    const turnoUp = t === "comida" ? "COMIDA" : "CENA";
    const { data: cupo } = await admin.rpc("cupo_efectivo", {
      p_empresa_id: empresaId,
      p_fecha: fecha,
      p_turno: turnoUp,
    });
    if (typeof cupo !== "number" || cupo <= 0) continue; // sin tope configurado
    const ocupadasTurno = reservas
      .filter((r) => turnoDeHora(r.hora ?? "") === turnoUp)
      .reduce((s, r) => s + (r.personas ?? 0), 0);
    cupoTurnoLleno[t] = ocupadasTurno + personas > cupo;
  }

  const maxActivo = cfg.max_personas_hora_activo === true;
  const maxModo = (cfg.max_personas_hora_modo as string | null) ?? "mismo";
  const maxGlobal = (cfg.max_personas_hora_global as number | null) ?? 0;
  const maxReglas = Array.isArray(cfg.max_personas_hora_reglas)
    ? (cfg.max_personas_hora_reglas as { inicio: string; fin: string; max: number }[])
    : [];

  const slots: SlotPublico[] = [];

  for (const t of ["comida", "cena"] as Turno[]) {
    const ventana = excepcionParaFecha(excepciones, fecha, t) ?? ventanaEfectiva(cfg, dia, t);
    if (ventana.cerrado) continue;
    if (turnoBloqueado(t)) continue;

    const slotsInactivos = new Set(
      (Array.isArray(cfg[`general_slots_inactivos_${t}`])
        ? (cfg[`general_slots_inactivos_${t}`] as string[])
        : []
      ).map((s) => s.slice(0, 5)),
    );

    const [ini, fin] = intervaloMinutos(ventana.inicio, ventana.fin);
    // Los huecos van siempre en 00, 15, 30 y 45: si la apertura cae a media
    // hora rara (p. ej. 13:05) el primer pase se sube al siguiente cuarto.
    const primero = Math.ceil(ini / RESERVA_SLOT_MIN) * RESERVA_SLOT_MIN;
    // Último pase = fin de servicio. No ofrecemos una hora a la que ya se cierra.
    for (let m = primero; m < fin; m += RESERVA_SLOT_MIN) {
      const hora = minutosAHora(m);
      if (slotsInactivos.has(hora)) continue;

      const turnoUp: "COMIDA" | "CENA" = t === "comida" ? "COMIDA" : "CENA";
      let disponible = true;
      let motivo: string | null = null;

      // Hora ya pasada (o dentro de la antelación mínima).
      //
      // `m` puede pasar de 1440 en la cena que cruza medianoche (20:00→02:00):
      // esos pases son de MAÑANA, así que se les suma el día para compararlos
      // con el reloj de hoy. Sin esto, las 01:00 valían 1500 y nunca salían
      // como pasadas, y la madrugada seguía ofreciéndose ya vencida.
      const minutosDesdeHoy = m + diasHastaFecha * MIN_POR_DIA;
      if (minutosDesdeHoy < minAhora + antelacionMin) {
        continue;
      }

      // Turno lleno por cupo: afecta a TODAS las horas del turno por igual.
      if (disponible && cupoTurnoLleno[t]) {
        disponible = false;
        motivo = "Completo";
      }

      // Cierre del motor web para el turno (solo afecta al día de hoy).
      if (disponible && cfg.cerrar_motor_web_activo === true && esHoy) {
        const corte = t === "comida"
          ? (cfg.cerrar_motor_web_comida as string | null)
          : (cfg.cerrar_motor_web_cena as string | null);
        if (corte && minAhora >= aMinutos(corte)) {
          disponible = false;
          motivo = "Reservas online cerradas";
        }
      }

      // Aforo por hora / tramo.
      if (disponible && maxActivo) {
        const ocupadasEnHora = reservas
          .filter((r) => (r.hora ?? "").slice(0, 5) === hora)
          .reduce((s, r) => s + (r.personas ?? 0), 0);

        if (maxModo === "mismo" && maxGlobal > 0) {
          if (ocupadasEnHora + personas > maxGlobal) {
            disponible = false;
            motivo = "Completo";
          }
        } else if (maxModo === "diferente_hora") {
          const regla = maxReglas.find((x) => x.inicio === hora);
          if (regla && regla.max > 0 && ocupadasEnHora + personas > regla.max) {
            disponible = false;
            motivo = "Completo";
          }
        } else if (maxModo === "diferente_tramo") {
          for (const r of maxReglas) {
            const ri = aMinutos(r.inicio);
            const rf = aMinutos(r.fin);
            const mNorm = m % MIN_POR_DIA;
            if (mNorm >= ri && mNorm < rf && r.max > 0) {
              const ocupadasTramo = reservas.reduce((s, x) => {
                const xm = horaAMinutos(x.hora ?? "00:00");
                return xm >= ri && xm < rf ? s + (x.personas ?? 0) : s;
              }, 0);
              if (ocupadasTramo + personas > r.max) {
                disponible = false;
                motivo = "Completo";
              }
              break;
            }
          }
        }
      }

      slots.push({ hora, turno: turnoUp, disponible, motivo });
    }
  }

  if (slots.length === 0) {
    return {
      ok: true,
      slots: [],
      cerrado: true,
      mensaje: "No hay horarios disponibles para este día.",
      obligatorios,
    };
  }

  return { ok: true, slots, cerrado: false, mensaje: null, obligatorios };
}
