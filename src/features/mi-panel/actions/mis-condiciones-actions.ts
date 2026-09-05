"use server";

/**
 * Datos de contrato del empleado para «Mi Panel → Condiciones».
 *
 * Antes esta tarjeta pintaba valores inventados: la fecha de alta era el texto
 * fijo «Pendiente de configurar», el tipo de contrato siempre «Indefinido» y
 * los días restantes de vacaciones se calculaban como «total − 8». Ahora todo
 * sale de la FICHA del empleado y del saldo real de vacaciones, que es el mismo
 * número que ve RRHH.
 *
 * La fecha de baja solo existe cuando el empleado pasa a offboarding desde
 * Reclutamiento; mientras tanto se devuelve `null` y la vista pinta un guion.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { getDiasVacacionesAnio } from "@/features/rrhh/actions/calendario-config-actions";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  getHorarioDia,
  getDiasConHorarioAsignado,
} from "@/features/rrhh/utils/horario-empleado";
import {
  calcularSaldoVacaciones,
  ESTADOS_QUE_GASTAN,
  type SolicitudParaSaldo,
} from "@/features/rrhh/data/vacaciones-saldo";

export interface MisCondicionesContrato {
  /** Días de vacaciones al año de la empresa (Ajustes → Calendario). */
  vacacionesAno: number;
  /** Los que le quedan de verdad, descontando lo ya disfrutado y lo aprobado. */
  vacacionesRestantes: number;
  /** ISO (yyyy-mm-dd) o null si su ficha no la tiene todavía. */
  fechaAlta: string | null;
  /** ISO o null. Solo se rellena al pasar a offboarding. */
  fechaBaja: string | null;
  /** Tal cual figura en su ficha: "Completa", "Parcial"… null si no consta. */
  tipoJornada: string | null;
  /** Su puesto real (empleado_puestos), no el adivinado por el nombre. */
  puesto: string | null;
}

export async function getMisCondicionesContrato(): Promise<{
  ok: boolean;
  data: MisCondicionesContrato | null;
  error?: string;
}> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: false, data: null, error: "No autenticado" };

    // La ficha de ESTA empresa: un empleado puede tener ficha en las dos
    // sociedades con fechas de alta distintas (p. ej. quien se fue y volvió).
    const { data: emp } = await supabase
      .from("empleados")
      .select("id, fecha_alta, fecha_baja, tipo_jornada, puesto")
      .eq("user_id", userId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    const { dias: diasTotales } = await getDiasVacacionesAnio(empresaId);

    // Saldo real: mismo cálculo que usa RRHH, para que ambos vean lo mismo.
    const anio = new Date().getUTCFullYear();
    const { data: solicitudes } = await supabase
      .from("solicitudes_personal")
      .select("fecha_inicio, fecha_fin, estado")
      .eq("empresa_id", empresaId)
      .eq("user_id", userId)
      .eq("tipo", "ausencia")
      .eq("subtipo", "vacaciones")
      .in("estado", ESTADOS_QUE_GASTAN)
      .lt("fecha_inicio", `${anio + 1}-01-01`)
      .or(`fecha_fin.gte.${anio}-01-01,fecha_fin.is.null`);

    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    const saldo = calcularSaldoVacaciones(
      (solicitudes ?? []) as SolicitudParaSaldo[],
      diasTotales,
      anio,
      hoyEnZona(tz),
    );

    return {
      ok: true,
      data: {
        vacacionesAno: diasTotales,
        vacacionesRestantes: saldo.diasRestantes,
        fechaAlta: (emp?.fecha_alta as string | null) ?? null,
        fechaBaja: (emp?.fecha_baja as string | null) ?? null,
        tipoJornada: (emp?.tipo_jornada as string | null) ?? null,
        puesto: (emp?.puesto as string | null) ?? null,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mis-condiciones] getMisCondicionesContrato:", msg);
    return { ok: false, data: null, error: msg };
  }
}

/* ─── SALARIO Y HORARIO REALES ────────────────────────────────────────────
 *
 * Antes la vista adivinaba el puesto buscando su nombre dentro del nombre y el
 * correo del trabajador. Con los datos reales eso dejaba a 20 de 21 empleados
 * viendo "Pendiente" pese a tener la ficha completa, y acertaba solo por
 * casualidad en quien se llamaba como su puesto. Peor: alguien apellidado
 * "Sala" habría visto el salario de un puesto ajeno.
 *
 * El salario sale SIEMPRE de `empleado_condiciones`: la fila vigente de SU
 * ficha. El puesto es solo la plantilla que se copia al contratar; en cuanto
 * alguien le cambia las condiciones a mano, el puesto deja de tener nada que
 * ver. Por eso aquí no se lee `puesto_salarios` ni como respaldo: sería
 * enseñarle una cifra de catálogo que no es la suya.
 */

/** Un día del horario semanal. `tramos` vacío = libra ese día. */
export interface DiaHorario {
  /** ISO yyyy-mm-dd. */
  fecha: string;
  /** L, M, X, J, V, S, D. */
  letra: string;
  /** "17:00–00:30" o "8 h" (flexible). Vacío si libra. */
  tramos: string[];
  /** false = libra; true = le toca trabajar. */
  trabaja: boolean;
}

export interface MisCondicionesSalario {
  /** Bruto mensual en euros. null si su puesto aún no lo tiene cargado. */
  salarioBruto: number | null;
  jornadaContrato: string | null;
  horasSemanales: number | null;
  diasLibres: number | null;
  /** Puesto tal y como quedó pactado en su ficha (no el catálogo de puestos). */
  puestoNombre: string | null;
}

export interface MisCondicionesHorario {
  /** Lunes a domingo de la semana en curso. Vacío = no tiene horario asignado. */
  dias: DiaHorario[];
  /** Lunes de la semana mostrada (ISO). */
  desde: string | null;
}

/**
 * Salario pactado del empleado en la empresa activa: la fila vigente de su
 * ficha (`empleado_condiciones`). Sin fila vigente devuelve null, y la vista
 * dice que falta por publicar: "sin dato" no es 0 €.
 */
export async function getMiSalario(): Promise<{
  ok: boolean;
  data: MisCondicionesSalario | null;
  error?: string;
}> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: false, data: null, error: "No autenticado" };

    const { data: emp } = await supabase
      .from("empleados")
      .select("id")
      .eq("user_id", userId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!emp) return { ok: true, data: null };

    // ÚNICA fuente: la fila vigente de su ficha. El puesto NO entra aquí.
    const { data: cond } = await supabase
      .from("empleado_condiciones")
      .select("salario_bruto, jornada_contrato, horas_semanales, dias_libres, puesto_nombre")
      .eq("empleado_id", emp.id as string)
      .eq("empresa_id", empresaId)
      .is("vigente_hasta", null)
      .maybeSingle();
    if (!cond) return { ok: true, data: null };

    const num = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    return {
      ok: true,
      data: {
        salarioBruto: num(cond.salario_bruto),
        jornadaContrato: (cond.jornada_contrato as string | null) ?? null,
        horasSemanales: num(cond.horas_semanales),
        diasLibres: num(cond.dias_libres),
        puestoNombre: (cond.puesto_nombre as string | null) ?? null,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mis-condiciones] getMiSalario:", msg);
    return { ok: false, data: null, error: msg };
  }
}

/**
 * Horario REAL de la semana en curso, resuelto con el mismo motor que usa RRHH
 * (`getHorarioDia`): turnos directos y patrones rotativos, con su vigencia.
 * El horario teórico del puesto está vacío en toda la base, así que lo que se
 * enseña son sus turnos de verdad, no una plantilla sin rellenar.
 *
 * La semana arranca el lunes del día de HOY en la zona de la empresa, no la del
 * navegador: un empleado que abre la app de madrugada sigue viendo su semana.
 */
export async function getMiHorarioSemana(): Promise<{
  ok: boolean;
  data: MisCondicionesHorario;
  error?: string;
}> {
  const vacio: MisCondicionesHorario = { dias: [], desde: null };
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: false, data: vacio, error: "No autenticado" };

    const { data: emp } = await supabase
      .from("empleados")
      .select("id")
      .eq("user_id", userId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!emp) return { ok: true, data: vacio };
    const empleadoId = emp.id as string;

    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    const hoy = hoyEnZona(tz);

    // Lunes de esta semana. getUTCDay(): 0=domingo → el lunes queda a 6 días.
    const d = new Date(`${hoy}T00:00:00Z`);
    const desplazamiento = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - desplazamiento);
    const lunes = d.toISOString().split("T")[0];
    const fechas: string[] = [];
    for (let i = 0; i < 7; i++) {
      const x = new Date(`${lunes}T00:00:00Z`);
      x.setUTCDate(x.getUTCDate() + i);
      fechas.push(x.toISOString().split("T")[0]);
    }
    const domingo = fechas[6];

    // Días con horario ASIGNADO: distingue "libra" de "no tiene horario".
    const cubiertos = await getDiasConHorarioAsignado(
      supabase,
      empresaId,
      empleadoId,
      lunes,
      domingo,
    );
    if (cubiertos.size === 0) return { ok: true, data: { dias: [], desde: lunes } };

    const LETRAS = ["L", "M", "X", "J", "V", "S", "D"];
    const dias: DiaHorario[] = [];
    for (let i = 0; i < 7; i++) {
      const fecha = fechas[i];
      if (!cubiertos.has(fecha)) continue;
      const h = await getHorarioDia(supabase, empresaId, empleadoId, fecha);
      const tramos: string[] = [];
      let trabaja = false;
      if (h.tipo === "fijo" && h.tramos.length > 0) {
        trabaja = true;
        for (const tr of h.tramos) tramos.push(`${tr.inicio}–${tr.fin}`);
      } else if (h.tipo === "flexible" && h.objetivoHoras > 0) {
        trabaja = true;
        tramos.push(`${h.objetivoHoras} h`);
      }
      dias.push({ fecha, letra: LETRAS[i], tramos, trabaja });
    }

    return { ok: true, data: { dias, desde: lunes } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mis-condiciones] getMiHorarioSemana:", msg);
    return { ok: false, data: vacio, error: msg };
  }
}
