/**
 * reglas-runner.service.ts — Motor de devengo de TOQUES (PRP-033).
 *
 * Ejecutable desde un Route Handler con service-role.
 * Cada evaluador es idempotente: el índice único `uniq_toques_mov_regla_diaria`
 * garantiza que volver a correr el mismo día no duplica.
 *
 * Reglas con activa=false en BD se saltan automáticamente.
 * Reglas cuya fuente de datos no exista se saltan con un warning.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

export type ReglaCodigo =
  | "puntualidad_elite"
  | "cumplidor_dia"
  | "cero_olvidos_fichaje"
  | "sin_vacaciones_trimestre"
  | "comunicado_leido_primero"
  | "asistencia_perfecta_semanal"
  | "velocidad_chat"
  | "appcc_al_dia"
  | "resolucion_incidencias"
  | "caja_cuadrada"
  | "cero_mermas_cocina";

export interface ReglaActiva {
  id: string;
  empresaId: string;
  codigo: string;
  nombre: string;
  toques: number;
  periodicidad: "diario" | "semanal" | "trimestral";
}

export interface Candidato {
  empresaId: string;
  userId: string;
  empleadoNombre: string;
  reglaId: string;
  toques: number;
  fecha: string;
  contexto: Record<string, unknown>;
  motivo: string;
}

interface PerfilAntiguedad {
  userId: string;
  empleadoNombre: string;
  empresaId: string;
  fechaAlta: string;
}

export interface RunnerReport {
  fecha: string;
  empresas: number;
  reglas_evaluadas: number;
  reglas_skipped: string[];
  candidatos: number;
  inserted: number;
  by_regla: Record<string, number>;
  errores: string[];
}

// ─── Utilidades de fecha ─────────────────────────────────────
function getDayOfWeek(fechaIso: string): number {
  // 0=domingo .. 6=sábado
  return new Date(`${fechaIso}T12:00:00Z`).getUTCDay();
}

function isUltimoDiaTrimestre(fechaIso: string): boolean {
  const d = new Date(`${fechaIso}T12:00:00Z`);
  const month = d.getUTCMonth(); // 0..11
  const day = d.getUTCDate();
  // Marzo (2)→31, Junio (5)→30, Septiembre (8)→30, Diciembre (11)→31
  if (month === 2 && day === 31) return true;
  if (month === 5 && day === 30) return true;
  if (month === 8 && day === 30) return true;
  if (month === 11 && day === 31) return true;
  return false;
}

function inicioTrimestreDe(fechaIso: string): string {
  const d = new Date(`${fechaIso}T12:00:00Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const qStart = Math.floor(m / 3) * 3;
  return new Date(Date.UTC(y, qStart, 1)).toISOString().slice(0, 10);
}

function inicioSemanaDe(fechaIso: string): string {
  const d = new Date(`${fechaIso}T12:00:00Z`);
  const day = d.getUTCDay() || 7; // 1..7 (lunes=1)
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  return monday.toISOString().slice(0, 10);
}

// ─── Evaluadores ─────────────────────────────────────────────
type Evaluator = (
  supabase: SupabaseClient,
  empresaId: string,
  fecha: string
) => Promise<Array<{ userId: string; empleadoNombre: string; contexto: Record<string, unknown> }>>;

/** Primer empleado en fichar entrada del día (per empresa). */
const evalPuntualidadElite: Evaluator = async (sb, empresaId, fecha) => {
  const { data, error } = await sb
    .from("fichajes")
    .select("empleado_id, empleado_nombre, hora_entrada")
    .eq("empresa_id", empresaId)
    .eq("fecha", fecha)
    .not("hora_entrada", "is", null)
    .order("hora_entrada", { ascending: true })
    .limit(1);
  if (error) throw new Error(`puntualidad_elite: ${error.message}`);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];
  const r = rows[0];
  return [
    {
      userId: String(r.empleado_id),
      empleadoNombre: String(r.empleado_nombre ?? ""),
      contexto: { hora_entrada: r.hora_entrada },
    },
  ];
};

/** Empleados con TODAS sus tareas del día en hecha=true (al menos 1). */
const evalCumplidorDia: Evaluator = async (sb, empresaId, fecha) => {
  const { data, error } = await sb
    .from("tareas")
    .select("user_id, hecha")
    .eq("empresa_id", empresaId)
    .eq("fecha", fecha)
    .not("user_id", "is", null);
  if (error) {
    // Tabla puede no existir en algunos entornos
    console.warn(`[runner] cumplidor_dia skip: ${error.message}`);
    return [];
  }
  const byUser: Record<string, { total: number; hechas: number }> = {};
  for (const r of (data ?? []) as Row[]) {
    const uid = String(r.user_id ?? "");
    if (!uid) continue;
    if (!byUser[uid]) byUser[uid] = { total: 0, hechas: 0 };
    byUser[uid].total += 1;
    if (r.hecha) byUser[uid].hechas += 1;
  }
  const candidatos = Object.entries(byUser)
    .filter(([, v]) => v.total > 0 && v.hechas === v.total)
    .map(([userId, v]) => ({ userId, empleadoNombre: "", contexto: { tareas: v.total } }));
  return await fillEmpleadoNombre(sb, candidatos);
};

/** Empleados con fichaje completo (entrada y salida ambas no nulas). */
const evalCeroOlvidosFichaje: Evaluator = async (sb, empresaId, fecha) => {
  const { data, error } = await sb
    .from("fichajes")
    .select("empleado_id, empleado_nombre, hora_entrada, hora_salida")
    .eq("empresa_id", empresaId)
    .eq("fecha", fecha)
    .not("hora_entrada", "is", null)
    .not("hora_salida", "is", null);
  if (error) throw new Error(`cero_olvidos_fichaje: ${error.message}`);
  return (data ?? []).map((r) => ({
    userId: String((r as Row).empleado_id),
    empleadoNombre: String((r as Row).empleado_nombre ?? ""),
    contexto: {
      hora_entrada: (r as Row).hora_entrada,
      hora_salida: (r as Row).hora_salida,
    },
  }));
};

/** Empleados con asistencia perfecta en la semana (lunes-domingo). Solo se evalúa el domingo. */
const evalAsistenciaPerfectaSemanal: Evaluator = async (sb, empresaId, fecha) => {
  if (getDayOfWeek(fecha) !== 0) return []; // solo domingo
  const inicio = inicioSemanaDe(fecha);
  const { data, error } = await sb
    .from("fichajes")
    .select("empleado_id, empleado_nombre, fecha, hora_entrada, hora_salida")
    .eq("empresa_id", empresaId)
    .gte("fecha", inicio)
    .lte("fecha", fecha);
  if (error) throw new Error(`asistencia_perfecta_semanal: ${error.message}`);
  // Empleados con >=5 días con entrada y salida no nulas y SIN días con incidencia/null
  const byUser: Record<string, { nombre: string; ok: number; fail: number }> = {};
  for (const r of (data ?? []) as Row[]) {
    const uid = String(r.empleado_id ?? "");
    if (!uid) continue;
    if (!byUser[uid]) byUser[uid] = { nombre: String(r.empleado_nombre ?? ""), ok: 0, fail: 0 };
    if (r.hora_entrada && r.hora_salida) byUser[uid].ok += 1;
    else byUser[uid].fail += 1;
  }
  return Object.entries(byUser)
    .filter(([, v]) => v.ok >= 5 && v.fail === 0)
    .map(([userId, v]) => ({
      userId,
      empleadoNombre: v.nombre,
      contexto: { dias_completos: v.ok, periodo_inicio: inicio, periodo_fin: fecha },
    }));
};

/** Empleados sin solicitudes de vacaciones aprobadas en el trimestre. Solo último día de trimestre. */
const evalSinVacacionesTrimestre: Evaluator = async (sb, empresaId, fecha) => {
  if (!isUltimoDiaTrimestre(fecha)) return [];
  const trimInicio = inicioTrimestreDe(fecha);
  // Todos los profiles activos de la empresa
  const { data: profs, error: errP } = await sb
    .from("usuarios")
    .select("user_id, full_name, nombre")
    .eq("empresa_id", empresaId);
  if (errP) throw new Error(`sin_vacaciones_trimestre/profiles: ${errP.message}`);
  const usuarios = (profs ?? []) as Row[];
  if (!usuarios.length) return [];

  // Quienes SÍ pidieron vacaciones aprobadas este trimestre
  const { data: vac, error: errV } = await sb
    .from("solicitudes_personal")
    .select("user_id")
    .eq("empresa_id", empresaId)
    .eq("subtipo", "vacaciones")
    .eq("estado", "aprobada")
    .gte("fecha_inicio", trimInicio)
    .lte("fecha_inicio", fecha);
  if (errV) {
    console.warn(`[runner] sin_vacaciones_trimestre skip: ${errV.message}`);
    return [];
  }
  const conVac = new Set(((vac ?? []) as Row[]).map((r) => String(r.user_id)));
  return usuarios
    .filter((u) => !conVac.has(String(u.user_id)))
    .map((u) => ({
      userId: String(u.user_id),
      empleadoNombre: String(u.full_name ?? u.nombre ?? ""),
      contexto: { trimestre_inicio: trimInicio, trimestre_fin: fecha },
    }));
};

const EVALUATORS: Partial<Record<ReglaCodigo, Evaluator>> = {
  puntualidad_elite: evalPuntualidadElite,
  cumplidor_dia: evalCumplidorDia,
  cero_olvidos_fichaje: evalCeroOlvidosFichaje,
  asistencia_perfecta_semanal: evalAsistenciaPerfectaSemanal,
  sin_vacaciones_trimestre: evalSinVacacionesTrimestre,
  // velocidad_chat, appcc_al_dia, resolucion_incidencias, comunicado_leido_primero,
  // caja_cuadrada, cero_mermas_cocina → sin fuente de datos definida; activa=false en seed.
};

async function fillEmpleadoNombre(
  sb: SupabaseClient,
  cands: Array<{ userId: string; empleadoNombre: string; contexto: Record<string, unknown> }>
) {
  const sinNombre = cands.filter((c) => !c.empleadoNombre).map((c) => c.userId);
  if (!sinNombre.length) return cands;
  const { data } = await sb
    .from("usuarios")
    .select("user_id, full_name, nombre")
    .in("user_id", sinNombre);
  const map = new Map<string, string>();
  for (const r of ((data ?? []) as Row[])) {
    map.set(String(r.user_id), String(r.full_name ?? r.nombre ?? ""));
  }
  return cands.map((c) => ({ ...c, empleadoNombre: c.empleadoNombre || map.get(c.userId) || "" }));
}

// ─── Evaluador de antigüedad ────────────────────────────────
// Calcula meses completos desde fechaAlta hasta hasta (inclusive).
function mesesEntre(fechaAlta: string, hasta: string): number {
  const a = new Date(`${fechaAlta}T12:00:00Z`);
  const h = new Date(`${hasta}T12:00:00Z`);
  let meses = (h.getUTCFullYear() - a.getUTCFullYear()) * 12 + (h.getUTCMonth() - a.getUTCMonth());
  if (h.getUTCDate() < a.getUTCDate()) meses -= 1;
  return Math.max(0, meses);
}

// Devuelve la fecha del aniversario mensual número N (N=1 → primer aniversario mensual)
function fechaAniversarioMensual(fechaAlta: string, n: number): string {
  const a = new Date(`${fechaAlta}T12:00:00Z`);
  const target = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + n, a.getUTCDate()));
  return target.toISOString().slice(0, 10);
}

async function cargarPerfiles(admin: SupabaseClient, empresaId: string): Promise<PerfilAntiguedad[]> {
  const { data, error } = await admin
    .from("usuarios")
    .select("user_id, empresa_id, full_name, nombre, fecha_alta, created_at")
    .eq("empresa_id", empresaId);
  if (error) throw new Error(`profiles: ${error.message}`);
  return ((data ?? []) as Row[])
    .filter((r) => r.user_id)
    .map((r) => ({
      userId: String(r.user_id),
      empleadoNombre: String(r.full_name ?? r.nombre ?? ""),
      empresaId: String(r.empresa_id),
      fechaAlta: String(r.fecha_alta ?? (r.created_at ? String(r.created_at).slice(0, 10) : "")),
    }))
    .filter((p) => p.fechaAlta);
}

/**
 * Evalúa reglas de antigüedad para una empresa hasta `fecha`.
 * Para regla mensual: genera un candidato por cada aniversario mensual cumplido (1..N meses).
 * Para reglas hito: un candidato si la antigüedad alcanza el umbral (6m / 12m / 24m / 60m / 120m).
 * Idempotencia: cada candidato lleva su propia fecha (la fecha del aniversario), y el insert
 * usa el unique index uniq_toques_mov_regla_diaria(user_id, regla_id, fecha).
 */
async function evalAntiguedad(
  admin: SupabaseClient,
  empresaId: string,
  fecha: string,
  reglasAntiguedad: ReglaActiva[]
): Promise<Candidato[]> {
  if (!reglasAntiguedad.length) return [];
  const perfiles = await cargarPerfiles(admin, empresaId);
  if (!perfiles.length) return [];

  const reglaMensual = reglasAntiguedad.find((r) => r.codigo === "aniversario_mensual");
  const HITOS: Array<{ codigo: string; meses: number }> = [
    { codigo: "aniversario_6_meses", meses: 6 },
    { codigo: "aniversario_1_ano", meses: 12 },
    { codigo: "aniversario_2_anos", meses: 24 },
    { codigo: "aniversario_5_anos", meses: 60 },
    { codigo: "aniversario_10_anos", meses: 120 },
  ];
  const reglasPorCodigo = new Map(reglasAntiguedad.map((r) => [r.codigo, r]));

  const candidatos: Candidato[] = [];
  for (const p of perfiles) {
    const meses = mesesEntre(p.fechaAlta, fecha);
    if (meses <= 0) continue;

    // Aniversario mensual: 1..meses
    if (reglaMensual) {
      for (let n = 1; n <= meses; n++) {
        const fechaAniv = fechaAniversarioMensual(p.fechaAlta, n);
        if (fechaAniv > fecha) break;
        candidatos.push({
          empresaId,
          userId: p.userId,
          empleadoNombre: p.empleadoNombre,
          reglaId: reglaMensual.id,
          toques: reglaMensual.toques,
          fecha: fechaAniv,
          motivo: `Aniversario ${n} mes${n === 1 ? "" : "es"} en la empresa`,
          contexto: { meses_cumplidos: n, fecha_alta: p.fechaAlta },
        });
      }
    }

    // Hitos
    for (const h of HITOS) {
      if (meses < h.meses) continue;
      const regla = reglasPorCodigo.get(h.codigo);
      if (!regla) continue;
      const fechaHito = fechaAniversarioMensual(p.fechaAlta, h.meses);
      if (fechaHito > fecha) continue;
      candidatos.push({
        empresaId,
        userId: p.userId,
        empleadoNombre: p.empleadoNombre,
        reglaId: regla.id,
        toques: regla.toques,
        fecha: fechaHito,
        motivo: regla.nombre,
        contexto: { meses: h.meses, fecha_alta: p.fechaAlta },
      });
    }
  }
  return candidatos;
}

// ─── Runner principal ────────────────────────────────────────
export async function ejecutarReglasDelDia(
  admin: SupabaseClient,
  fecha: string
): Promise<RunnerReport> {
  const report: RunnerReport = {
    fecha,
    empresas: 0,
    reglas_evaluadas: 0,
    reglas_skipped: [],
    candidatos: 0,
    inserted: 0,
    by_regla: {},
    errores: [],
  };

  const dow = getDayOfWeek(fecha); // 0=domingo
  const isUltTrim = isUltimoDiaTrimestre(fecha);

  // Reglas activas (multi-empresa)
  const { data: reglasData, error: errR } = await admin
    .from("toques_reglas")
    .select("id, empresa_id, codigo, nombre, toques, periodicidad, categoria")
    .eq("activa", true);
  if (errR) {
    report.errores.push(`reglas_load: ${errR.message}`);
    return report;
  }
  const reglas = ((reglasData ?? []) as Row[]).map<ReglaActiva>((r) => ({
    id: String(r.id),
    empresaId: String(r.empresa_id),
    codigo: String(r.codigo),
    nombre: String(r.nombre),
    toques: Number(r.toques),
    periodicidad: (String(r.periodicidad) as ReglaActiva["periodicidad"]) || "diario",
  }));
  report.empresas = new Set(reglas.map((r) => r.empresaId)).size;

  // Mapear cuáles son de antigüedad (codigo prefix)
  const reglasAntiguedadPorEmpresa = new Map<string, ReglaActiva[]>();
  const reglasNormales: ReglaActiva[] = [];
  for (const r of reglas) {
    if (r.codigo.startsWith("aniversario_") || r.codigo === "cumpleanos_propio" || r.codigo === "san_valentin_balles") {
      const list = reglasAntiguedadPorEmpresa.get(r.empresaId) ?? [];
      list.push(r);
      reglasAntiguedadPorEmpresa.set(r.empresaId, list);
    } else {
      reglasNormales.push(r);
    }
  }

  const candidatos: Candidato[] = [];

  // Reglas estándar (con evaluador asociado al código)
  for (const regla of reglasNormales) {
    if (regla.periodicidad === "semanal" && dow !== 0) continue;
    if (regla.periodicidad === "trimestral" && !isUltTrim) continue;

    const evaluator = EVALUATORS[regla.codigo as ReglaCodigo];
    if (!evaluator) {
      report.reglas_skipped.push(`${regla.codigo}@${regla.empresaId}`);
      continue;
    }
    report.reglas_evaluadas += 1;
    try {
      const cands = await evaluator(admin, regla.empresaId, fecha);
      for (const c of cands) {
        candidatos.push({
          empresaId: regla.empresaId,
          userId: c.userId,
          empleadoNombre: c.empleadoNombre,
          reglaId: regla.id,
          toques: regla.toques,
          fecha,
          contexto: c.contexto,
          motivo: regla.nombre,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      report.errores.push(`${regla.codigo}@${regla.empresaId}: ${msg}`);
    }
  }

  // Reglas de antigüedad (procesadas en bloque por empresa)
  for (const [empresaId, reglasAnt] of reglasAntiguedadPorEmpresa) {
    report.reglas_evaluadas += reglasAnt.length;
    try {
      const cands = await evalAntiguedad(admin, empresaId, fecha, reglasAnt);
      candidatos.push(...cands);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      report.errores.push(`antiguedad@${empresaId}: ${msg}`);
    }
  }

  report.candidatos = candidatos.length;
  if (!candidatos.length) return report;

  // Insert en batch — el índice único uniq_toques_mov_regla_diaria garantiza idempotencia.
  // Postgres rechaza el conflicto en lugar de actualizar (no usamos upsert).
  // Insertamos una a una para contabilizar inserts vs duplicados sin abortar.
  for (const c of candidatos) {
    const { error } = await admin.from("toques_movimientos").insert({
      empresa_id: c.empresaId,
      user_id: c.userId,
      empleado_nombre: c.empleadoNombre,
      toques: c.toques,
      origen: "regla",
      regla_id: c.reglaId,
      fecha: c.fecha,
      motivo: c.motivo,
      contexto: c.contexto,
    });
    if (!error) {
      report.inserted += 1;
      const k = c.reglaId;
      report.by_regla[k] = (report.by_regla[k] ?? 0) + 1;
    } else if (error.code === "23505") {
      // unique violation → ya estaba otorgado, idempotencia OK
      continue;
    } else {
      report.errores.push(`insert@${c.userId}/${c.reglaId}: ${error.message}`);
    }
  }

  return report;
}
