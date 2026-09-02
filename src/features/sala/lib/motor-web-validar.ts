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
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { fechaCivilDe } from "@/features/sala/lib/dia-negocio";
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

/**
 * Instante REAL de una reserva, en minutos desde una época común, para poder
 * compararla con "ahora" sin ambigüedades.
 *
 * La fecha de una reserva es su DÍA DE NEGOCIO, no su fecha civil: la cena del
 * viernes a las 01:30 se guarda como viernes aunque ocurra el sábado. Si se
 * comparasen a pelo `fecha` y `hora`, esa reserva parecería estar 22 horas en
 * el pasado y se rechazaría siendo válida. Por eso se pasa antes por
 * `fechaCivilDe`, que devuelve el día en que de verdad ocurre.
 */
function instanteReservaMin(fecha: string, hora: string): number {
  const civil = fechaCivilDe(fecha, hora);
  const dias = Math.round(Date.parse(`${civil}T00:00:00Z`) / 86_400_000);
  return dias * 1440 + (parseHHMM(hora) ?? 0);
}

/**
 * Mismo cálculo para un instante ya leído del reloj de la empresa. Recibe la
 * lectura en vez de hacerla, para que "ahora" sea el MISMO valor que usa el
 * resto del validador aunque el minuto cambie a mitad de la comprobación.
 */
function instanteDeLecturaMin(fechaCivil: string, minutos: number): number {
  const dias = Math.round(Date.parse(`${fechaCivil}T00:00:00Z`) / 86_400_000);
  return dias * 1440 + minutos;
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

  // 2) Nada de reservar para un momento que ya ha pasado.
  //
  // No basta con comparar FECHAS: filtrando solo por día, el cliente podía
  // pedir a las 17:00 una mesa para la comida de las 13:30 de HOY, porque el
  // día seguía siendo hoy. Se compara el instante completo (fecha + hora), y
  // en la zona horaria de la EMPRESA: el servidor va en UTC, así que su reloj
  // no dice qué hora es en el restaurante.
  //
  // Va ANTES de leer la configuración a propósito: una empresa sin fila de
  // `empresa_reservas_config` sale por el `return { ok: true }` de abajo, y el
  // pasado tiene que estar cerrado para todas.
  const tz = await getZonaHorariaEmpresa(supabase, input.empresaId);
  const { fecha: hoyEmpresa, minutos: minAhoraEmpresa } = ahoraEnZona(tz);
  if (
    instanteReservaMin(input.fecha, input.hora) <
    instanteDeLecturaMin(hoyEmpresa, minAhoraEmpresa)
  ) {
    return {
      ok: false,
      error: "Esa hora ya ha pasado. Elige otra hora disponible.",
    };
  }

  // 3) Leer configuración de motor de la empresa.
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

  // 4) Cierre del motor web (solo si la reserva es para HOY).
  if (cfg.cerrar_motor_web_activo && input.fecha === hoyEmpresa) {
    const corte = input.turno === "COMIDA"
      ? parseHHMM(cfg.cerrar_motor_web_comida)
      : parseHHMM(cfg.cerrar_motor_web_cena);
    if (corte !== null && minAhoraEmpresa >= corte) {
      return {
        ok: false,
        error:
          input.turno === "COMIDA"
            ? "Las reservas online para la comida de hoy ya están cerradas."
            : "Las reservas online para la cena de hoy ya están cerradas.",
      };
    }
  }

  // 5) Tamaño máximo por reserva (Configuración → Límites, métrica `maxpax`).
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

  // 6) Tope de personas en misma hora / tramo.
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
