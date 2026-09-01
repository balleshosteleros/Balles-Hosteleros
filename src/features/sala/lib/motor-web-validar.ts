import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Validador centralizado de reservas que entran por el motor web público
 * (RWG, /reservar/[slug], etc.). NO se aplica a reservas creadas desde el
 * back office (manualmente) ni a walk-ins.
 *
 * Aplica el grid fijo de 15 minutos (00, 15, 30 y 45), el tamaño máximo por
 * reserva de Configuración → Límites (`empresa_reservas_reglas`, métrica
 * `maxpax`) y lo definido en `empresa_reservas_config`:
 *   - Cierre del motor web (horas de corte para comida y cena).
 *   - Tope de personas en la misma hora / tramo.
 *
 * Devuelve `{ ok: true }` si la reserva puede aceptarse o un mensaje legible
 * para presentar al cliente final cuando se rechaza.
 */

import { RESERVA_SLOT_MIN } from "@/features/sala/data/reservas";
import { ESTADOS_NO_OCUPANTES, horaAMinutos } from "@/features/sala/lib/reserva-conflicto";
import { rowToRegla, type ReglaRow } from "@/features/sala/reglas/data/reglas";
import { resolverValorEfectivo } from "@/features/sala/reglas/lib/resolver";

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
  // 1) Grid fijo de 15 minutos: no depende de configuración alguna.
  if (horaAMinutos(input.hora) % RESERVA_SLOT_MIN !== 0) {
    return {
      ok: false,
      error: `Solo aceptamos reservas en intervalos de ${RESERVA_SLOT_MIN} min. Elige una hora válida.`,
    };
  }

  // 2) Leer configuración de motor de la empresa.
  const { data: cfg, error } = await supabase
    .from("empresa_reservas_config")
    .select(
      "cerrar_motor_web_activo, cerrar_motor_web_comida, cerrar_motor_web_cena, max_personas_hora_activo, max_personas_hora_modo, max_personas_hora_global, max_personas_hora_reglas",
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
    }>();
  if (error) {
    console.error("[motor-web-validar] config:", error);
    return { ok: false, error: "No se pudo validar la reserva. Inténtalo de nuevo." };
  }
  // Sin fila de config: dejamos pasar (defaults seguros).
  if (!cfg) return { ok: true };

  const horaMin = horaAMinutos(input.hora);

  // 3) Cierre del motor web (solo si la reserva es para HOY).
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

  // 4) Tamaño máximo por reserva (Configuración → Límites, métrica `maxpax`).
  //
  // El desplegable del portal ya ofrece solo tamaños válidos, pero el tope
  // depende de la fecha y el turno concretos y el cliente los elige después de
  // decir cuántos son. Se comprueba aquí, que es por donde pasa toda reserva
  // online, para que no entre un grupo mayor del que la empresa acepta.
  {
    const { data: reglasRows } = await supabase
      .from("empresa_reservas_reglas")
      .select("*")
      .eq("empresa_id", input.empresaId)
      .eq("metrica", "maxpax")
      .eq("activo", true);
    const reglas = (reglasRows ?? []).map((r) => rowToRegla(r as ReglaRow));
    if (reglas.length > 0) {
      const tope = resolverValorEfectivo(reglas, input.fecha, input.turno, "maxpax");
      if (tope != null && tope > 0 && input.personas > tope) {
        return {
          ok: false,
          error: `Para grupos de más de ${tope} ${tope === 1 ? "persona" : "personas"} llámanos y lo organizamos contigo.`,
        };
      }
    }
  }

  // 5) Tope de personas en misma hora / tramo.
  if (cfg.max_personas_hora_activo) {
    const modo = (cfg.max_personas_hora_modo as string | null) ?? "mismo";
    const reglas: ReglaTramo[] = Array.isArray(cfg.max_personas_hora_reglas)
      ? (cfg.max_personas_hora_reglas as ReglaTramo[])
      : [];
    const horaSlice = input.hora.slice(0, 5);

    /**
     * Reservas activas del día. `hora` es de tipo `time` en Postgres: no se
     * puede filtrar con LIKE, así que traemos las del día y comparamos en
     * minutos (mismo criterio que el resto del motor).
     */
    async function reservasDelDia(): Promise<
      { personas: number; horaMin: number }[] | null
    > {
      const { data, error: errReservas } = await supabase
        .from("reservas")
        .select("personas, hora, estado")
        .eq("empresa_id", input.empresaId)
        .eq("fecha", input.fecha)
        .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
      if (errReservas) {
        console.error("[motor-web-validar] reservas del día:", errReservas);
        return null;
      }
      return (data ?? []).map((r) => ({
        personas: (r.personas as number) ?? 0,
        horaMin: horaAMinutos((r.hora as string) ?? "00:00"),
      }));
    }

    const reservasDia = await reservasDelDia();
    // Si no podemos contar, no aceptamos a ciegas: sería saltarse el tope.
    if (reservasDia === null) {
      return { ok: false, error: "No se pudo validar la reserva. Inténtalo de nuevo." };
    }

    /** Cuántas personas ya tienen reserva activa exactamente a esa hora. */
    function personasEnHoraExacta(hora: string): number {
      const objetivo = horaAMinutos(hora);
      return reservasDia!
        .filter((r) => r.horaMin === objetivo)
        .reduce((s, r) => s + r.personas, 0);
    }

    /** Cuántas personas ya tienen reserva activa dentro del tramo [ini, fin). */
    function personasEnTramo(iniMin: number, finMin: number): number {
      return reservasDia!
        .filter((r) => r.horaMin >= iniMin && r.horaMin < finMin)
        .reduce((s, r) => s + r.personas, 0);
    }

    if (modo === "mismo") {
      const tope = (cfg.max_personas_hora_global as number | null) ?? 0;
      if (tope > 0) {
        const ya = personasEnHoraExacta(horaSlice);
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
        const ya = personasEnHoraExacta(horaSlice);
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
          const ya = personasEnTramo(ini, fin);
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
