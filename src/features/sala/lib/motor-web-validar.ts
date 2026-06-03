import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Validador centralizado de reservas que entran por el motor web público
 * (RWG, /reservar/[slug], etc.). NO se aplica a reservas creadas desde el
 * back office (manualmente) ni a walk-ins.
 *
 * Aplica las "Preferencias del motor" definidas en `empresa_reservas_config`:
 *   - Cierre del motor web (horas de corte para comida y cena).
 *   - Tope de personas en la misma hora / tramo.
 *   - Granularidad de intervalo (rechaza horas que no caen en grid).
 *
 * Devuelve `{ ok: true }` si la reserva puede aceptarse o un mensaje legible
 * para presentar al cliente final cuando se rechaza.
 */

import { ESTADOS_NO_OCUPANTES, horaAMinutos } from "@/features/sala/lib/reserva-conflicto";

export interface MotorWebInput {
  empresaId: string;
  /** YYYY-MM-DD */
  fecha: string;
  /** HH:MM o HH:MM:SS */
  hora: string;
  /** Comensales solicitados. */
  personas: number;
  /** Turno de la reserva (necesario para aplicar el cierre por turno). */
  turno: "COMIDA" | "CENA";
}

type ReglaTramo = { inicio: string; fin: string; max: number };

function parseHHMM(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return null;
  const hh = Math.max(0, Math.min(23, parseInt(m[1], 10) || 0));
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10) || 0));
  return hh * 60 + mm;
}

function ahoraEsHoy(fechaISO: string): boolean {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return fechaISO === `${yyyy}-${mm}-${dd}`;
}

function minutosAhora(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export async function validarMotorWebReserva(
  supabase: SupabaseClient,
  input: MotorWebInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1) Leer configuración de motor de la empresa.
  const { data: cfg, error } = await supabase
    .from("empresa_reservas_config")
    .select(
      "cerrar_motor_web_activo, cerrar_motor_web_comida, cerrar_motor_web_cena, max_personas_hora_activo, max_personas_hora_modo, max_personas_hora_global, max_personas_hora_reglas, intervalo_reserva_min",
    )
    .eq("empresa_id", input.empresaId)
    .maybeSingle<{
      cerrar_motor_web_activo: boolean | null;
      cerrar_motor_web_comida: string | null;
      cerrar_motor_web_cena: string | null;
      max_personas_hora_activo: boolean | null;
      max_personas_hora_modo: string | null;
      max_personas_hora_global: number | null;
      max_personas_hora_reglas: ReglaTramo[] | null;
      intervalo_reserva_min: number | null;
    }>();
  if (error) {
    console.error("[motor-web-validar] config:", error);
    return { ok: false, error: "No se pudo validar la reserva. Inténtalo de nuevo." };
  }
  // Sin fila de config: dejamos pasar (defaults seguros).
  if (!cfg) return { ok: true };

  const horaMin = horaAMinutos(input.hora);

  // 2) Cierre del motor web (solo si la reserva es para HOY).
  if (cfg.cerrar_motor_web_activo && ahoraEsHoy(input.fecha)) {
    const corte = input.turno === "COMIDA"
      ? parseHHMM(cfg.cerrar_motor_web_comida)
      : parseHHMM(cfg.cerrar_motor_web_cena);
    if (corte !== null && minutosAhora() >= corte) {
      return {
        ok: false,
        error:
          input.turno === "COMIDA"
            ? "Las reservas online para la comida de hoy ya están cerradas."
            : "Las reservas online para la cena de hoy ya están cerradas.",
      };
    }
  }

  // 3) Granularidad de intervalo: la hora debe caer en el grid configurado.
  const intervalo = (cfg.intervalo_reserva_min as number | null) ?? 15;
  if (intervalo > 0 && horaMin % intervalo !== 0) {
    return {
      ok: false,
      error: `Solo aceptamos reservas en intervalos de ${intervalo} min. Elige una hora válida.`,
    };
  }

  // 4) Tope de personas en misma hora / tramo.
  if (cfg.max_personas_hora_activo) {
    const modo = (cfg.max_personas_hora_modo as string | null) ?? "mismo";
    const reglas: ReglaTramo[] = Array.isArray(cfg.max_personas_hora_reglas)
      ? (cfg.max_personas_hora_reglas as ReglaTramo[])
      : [];
    const horaSlice = input.hora.slice(0, 5);

    /** Cuántas personas ya tienen reserva activa exactamente a esa hora. */
    async function personasEnHoraExacta(hora: string): Promise<number> {
      const { data } = await supabase
        .from("reservas")
        .select("personas, estado")
        .eq("empresa_id", input.empresaId)
        .eq("fecha", input.fecha)
        .like("hora", `${hora}%`)
        .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
      return (data ?? []).reduce((s, r) => s + ((r.personas as number) ?? 0), 0);
    }

    /** Cuántas personas ya tienen reserva activa dentro del tramo [ini, fin). */
    async function personasEnTramo(iniMin: number, finMin: number): Promise<number> {
      const { data } = await supabase
        .from("reservas")
        .select("personas, hora, estado")
        .eq("empresa_id", input.empresaId)
        .eq("fecha", input.fecha)
        .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
      let total = 0;
      for (const r of data ?? []) {
        const m = horaAMinutos((r.hora as string) ?? "00:00");
        if (m >= iniMin && m < finMin) total += (r.personas as number) ?? 0;
      }
      return total;
    }

    if (modo === "mismo") {
      const tope = (cfg.max_personas_hora_global as number | null) ?? 0;
      if (tope > 0) {
        const ya = await personasEnHoraExacta(horaSlice);
        if (ya + input.personas > tope) {
          return {
            ok: false,
            error: `Ya no quedan plazas para ${input.personas} ${input.personas === 1 ? "persona" : "personas"} a las ${horaSlice}. Prueba otra hora.`,
          };
        }
      }
    } else if (modo === "diferente_hora") {
      // Regla coincide cuando inicio == hora de la reserva.
      const r = reglas.find((x) => x.inicio === horaSlice);
      if (r && r.max > 0) {
        const ya = await personasEnHoraExacta(horaSlice);
        if (ya + input.personas > r.max) {
          return {
            ok: false,
            error: `Ya no quedan plazas para ${input.personas} ${input.personas === 1 ? "persona" : "personas"} a las ${horaSlice}. Prueba otra hora.`,
          };
        }
      }
    } else if (modo === "diferente_tramo") {
      // Regla coincide cuando hora ∈ [inicio, fin).
      for (const r of reglas) {
        const ini = parseHHMM(r.inicio);
        const fin = parseHHMM(r.fin);
        if (ini === null || fin === null) continue;
        if (horaMin >= ini && horaMin < fin && r.max > 0) {
          const ya = await personasEnTramo(ini, fin);
          if (ya + input.personas > r.max) {
            return {
              ok: false,
              error: `Ya no quedan plazas para ${input.personas} ${input.personas === 1 ? "persona" : "personas"} en ese tramo horario. Prueba otra hora.`,
            };
          }
          break;
        }
      }
    }
  }

  return { ok: true };
}
