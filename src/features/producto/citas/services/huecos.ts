/**
 * Huecos libres de un calendario (PRP-088).
 *
 * Reglas, en orden:
 *   1. Solo dentro de las franjas configuradas, y en la hora de la EMPRESA.
 *   2. La reunión tiene que caber entera dentro de su franja.
 *   3. Nada por debajo de la antelación mínima ni más allá de los días de vista.
 *   4. Fuera lo que ya está cogido.
 *
 * Se ejecuta en el servidor con cliente de servicio: quien reserva desde la web
 * es anónimo y no puede leer las tablas por RLS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { zonaLocalAUtcISO } from "@/features/empresa/lib/zona-horaria";

export interface HuecosDeDia {
  /** "AAAA-MM-DD" en la zona de la empresa. */
  fecha: string;
  /** Horas "HH:MM" de la empresa, ya libres. */
  horas: string[];
}

interface CalendarioParaHuecos {
  id: string;
  empresa_id: string;
  duracion_min: number;
  paso_min: number;
  antelacion_min_horas: number;
  dias_vista: number;
  activo: boolean;
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** 1 = lunes … 7 = domingo. El mediodía evita que la zona mueva el día. */
function diaSemana(fecha: string): number {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

function aHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

export async function huecosLibres(
  supabase: SupabaseClient,
  calendarioId: string,
  zonaHoraria: string,
  hoy: string,
): Promise<{ ok: true; calendario: CalendarioParaHuecos; dias: HuecosDeDia[] } | { ok: false; error: string }> {
  const { data: cal, error: errCal } = await supabase
    .from("citas_calendarios")
    .select("id, empresa_id, duracion_min, paso_min, antelacion_min_horas, dias_vista, activo")
    .eq("id", calendarioId)
    .maybeSingle();

  if (errCal || !cal) return { ok: false, error: "Calendario no encontrado." };
  const calendario = cal as CalendarioParaHuecos;
  if (!calendario.activo) return { ok: false, error: "Este calendario no admite reservas." };

  const { data: franjas } = await supabase
    .from("citas_disponibilidad")
    .select("dia_semana, hora_inicio, hora_fin")
    .eq("calendario_id", calendarioId);

  const porDiaSemana = new Map<number, { inicio: number; fin: number }[]>();
  for (const f of (franjas ?? []) as { dia_semana: number; hora_inicio: string; hora_fin: string }[]) {
    const lista = porDiaSemana.get(f.dia_semana) ?? [];
    lista.push({ inicio: aMinutos(f.hora_inicio.slice(0, 5)), fin: aMinutos(f.hora_fin.slice(0, 5)) });
    porDiaSemana.set(f.dia_semana, lista);
  }
  if (porDiaSemana.size === 0) return { ok: true, calendario, dias: [] };

  const ultimoDia = sumarDias(hoy, calendario.dias_vista);
  const { data: ocupadas } = await supabase
    .from("citas")
    .select("inicio, fin")
    .eq("calendario_id", calendarioId)
    .eq("estado", "CONFIRMADA")
    .gte("inicio", `${hoy}T00:00:00.000Z`)
    .lte("inicio", `${ultimoDia}T23:59:59.999Z`);

  // Se comparan instantes, no textos: así da igual la zona con que se guardaron.
  const ocupados = new Set(
    ((ocupadas ?? []) as { inicio: string }[]).map((c) => new Date(c.inicio).getTime()),
  );

  const noAntesDe = Date.now() + calendario.antelacion_min_horas * 3600_000;
  const dias: HuecosDeDia[] = [];

  for (let i = 0; i <= calendario.dias_vista; i++) {
    const fecha = sumarDias(hoy, i);
    const franjasDelDia = porDiaSemana.get(diaSemana(fecha));
    if (!franjasDelDia) continue;

    const horas: string[] = [];
    for (const franja of franjasDelDia) {
      for (let m = franja.inicio; m + calendario.duracion_min <= franja.fin; m += calendario.paso_min) {
        const hora = aHora(m);
        const instante = new Date(zonaLocalAUtcISO(fecha, hora, zonaHoraria)).getTime();
        if (instante < noAntesDe) continue;
        if (ocupados.has(instante)) continue;
        horas.push(hora);
      }
    }
    if (horas.length > 0) dias.push({ fecha, horas });
  }

  return { ok: true, calendario, dias };
}
