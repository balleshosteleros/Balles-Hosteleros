/**
 * snapshots.service.ts — Cron de cierre de periodos (PRP-033).
 *
 * Cada noche evalúa qué cierres aplican (siempre día; semana si domingo;
 * mes si último día; trimestre/año si corresponde) y crea snapshot de
 * ganador en `toques_ganadores` + movimiento `bonus_periodo` con los
 * toques bonus correspondientes.
 *
 * Idempotente: el unique constraint de toques_ganadores y el unique
 * index de bonus_periodo aseguran que volver a correr no duplica.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

type Periodo = "dia" | "semana" | "mes" | "trimestre" | "ano";

const BONUS: Record<Periodo, number> = {
  dia: 5,
  semana: 15,
  mes: 50,
  trimestre: 150,
  ano: 500,
};

const TITULO: Partial<Record<Periodo, string>> = {
  mes: "Empleado del Mes",
  trimestre: "Empleado del Trimestre",
  ano: "Empleado del Año",
};

export interface SnapshotReport {
  fecha_evaluada: string;
  periodos_aplicados: Periodo[];
  ganadores_creados: number;
  bonus_aplicados: number;
  errores: string[];
  detalle: Array<{
    periodo: Periodo;
    empresa_id: string;
    user_id: string | null;
    total: number;
    bonus: number;
    insertado: boolean;
    nota: string;
  }>;
}

// ─── Utilidades fecha ────────────────────────────────────────
function parseDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function shiftDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
}
function dayOfWeek(iso: string): number {
  return parseDate(iso).getUTCDay(); // 0=domingo
}
function isUltimoDiaMes(iso: string): boolean {
  const d = parseDate(iso);
  const m = d.getUTCMonth();
  const next = new Date(d);
  next.setUTCDate(d.getUTCDate() + 1);
  return next.getUTCMonth() !== m;
}
function isUltimoDiaTrimestre(iso: string): boolean {
  const d = parseDate(iso);
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (m === 2 && day === 31) return true;
  if (m === 5 && day === 30) return true;
  if (m === 8 && day === 30) return true;
  if (m === 11 && day === 31) return true;
  return false;
}
function isUltimoDiaAno(iso: string): boolean {
  const d = parseDate(iso);
  return d.getUTCMonth() === 11 && d.getUTCDate() === 31;
}
function rangoPeriodo(periodo: Periodo, fechaCierre: string): { inicio: string; fin: string } {
  const d = parseDate(fechaCierre);
  if (periodo === "dia") return { inicio: fechaCierre, fin: fechaCierre };
  if (periodo === "semana") {
    // semana cierra el domingo (fechaCierre = domingo). Lunes = -6
    return { inicio: shiftDays(fechaCierre, -6), fin: fechaCierre };
  }
  if (periodo === "mes") {
    const inicio = fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
    return { inicio, fin: fechaCierre };
  }
  if (periodo === "trimestre") {
    const m = d.getUTCMonth();
    const qStart = Math.floor(m / 3) * 3;
    const inicio = fmt(new Date(Date.UTC(d.getUTCFullYear(), qStart, 1)));
    return { inicio, fin: fechaCierre };
  }
  // ano
  const inicio = fmt(new Date(Date.UTC(d.getUTCFullYear(), 0, 1)));
  return { inicio, fin: fechaCierre };
}

function periodosAplicables(fecha: string, force?: Periodo[]): Periodo[] {
  if (force && force.length) return force;
  const out: Periodo[] = ["dia"];
  if (dayOfWeek(fecha) === 0) out.push("semana");
  if (isUltimoDiaMes(fecha)) out.push("mes");
  if (isUltimoDiaTrimestre(fecha)) out.push("trimestre");
  if (isUltimoDiaAno(fecha)) out.push("ano");
  return out;
}

// ─── Snapshot por empresa+periodo ────────────────────────────
async function snapshotEmpresaPeriodo(
  admin: SupabaseClient,
  empresaId: string,
  periodo: Periodo,
  fechaCierre: string,
  report: SnapshotReport
): Promise<void> {
  const { inicio, fin } = rangoPeriodo(periodo, fechaCierre);
  const { data: ranking, error } = await admin.rpc("toques_ranking", {
    p_empresa_id: empresaId,
    p_inicio: inicio,
    p_fin: fin,
  });
  if (error) {
    report.errores.push(`ranking ${periodo}@${empresaId}: ${error.message}`);
    return;
  }
  const rows = (ranking ?? []) as Row[];
  if (!rows.length) {
    report.detalle.push({
      periodo,
      empresa_id: empresaId,
      user_id: null,
      total: 0,
      bonus: 0,
      insertado: false,
      nota: "ranking vacío",
    });
    return;
  }
  const top = rows[0];
  const userId = String(top.user_id ?? "");
  const total = Number(top.total ?? 0);
  if (!userId || total <= 0) {
    report.detalle.push({
      periodo,
      empresa_id: empresaId,
      user_id: userId || null,
      total,
      bonus: 0,
      insertado: false,
      nota: "ganador con 0 toques",
    });
    return;
  }
  const empleadoNombre = String(top.empleado_nombre ?? "");
  const bonus = BONUS[periodo];
  const titulo = TITULO[periodo] ?? null;

  // Insertar snapshot ganador (idempotente por unique (empresa_id, periodo, periodo_inicio))
  const { error: errG } = await admin.from("toques_ganadores").insert({
    empresa_id: empresaId,
    periodo,
    periodo_inicio: inicio,
    periodo_fin: fin,
    user_id: userId,
    empleado_nombre: empleadoNombre,
    total_toques: total,
    bonus_otorgado: bonus,
    titulo,
  });
  const insertadoGanador = !errG;
  if (errG && errG.code !== "23505") {
    report.errores.push(`ganador ${periodo}@${empresaId}: ${errG.message}`);
  }
  if (insertadoGanador) {
    report.ganadores_creados += 1;
  }

  // Insertar movimiento bonus (idempotente por unique (user_id, periodo, fecha) where origen='bonus_periodo')
  const { error: errM } = await admin.from("toques_movimientos").insert({
    empresa_id: empresaId,
    user_id: userId,
    empleado_nombre: empleadoNombre,
    toques: bonus,
    origen: "bonus_periodo",
    periodo,
    fecha: fechaCierre,
    motivo: titulo
      ? `${titulo} (${inicio} – ${fin})`
      : `Bonus ${periodo} (${inicio} – ${fin})`,
    contexto: { periodo, periodo_inicio: inicio, periodo_fin: fin, total_periodo: total },
  });
  const insertadoBonus = !errM;
  if (errM && errM.code !== "23505") {
    report.errores.push(`bonus ${periodo}@${empresaId}: ${errM.message}`);
  }
  if (insertadoBonus) {
    report.bonus_aplicados += 1;
  }

  report.detalle.push({
    periodo,
    empresa_id: empresaId,
    user_id: userId,
    total,
    bonus,
    insertado: insertadoGanador || insertadoBonus,
    nota: insertadoGanador && insertadoBonus
      ? "ok"
      : insertadoGanador
      ? "ganador nuevo, bonus ya existía"
      : insertadoBonus
      ? "ganador ya existía, bonus nuevo"
      : "ya estaba todo aplicado",
  });
}

export async function ejecutarSnapshotsPeriodos(
  admin: SupabaseClient,
  fechaCierre: string,
  forzar?: Periodo[]
): Promise<SnapshotReport> {
  const periodos = periodosAplicables(fechaCierre, forzar);
  const report: SnapshotReport = {
    fecha_evaluada: fechaCierre,
    periodos_aplicados: periodos,
    ganadores_creados: 0,
    bonus_aplicados: 0,
    errores: [],
    detalle: [],
  };

  // Empresas con actividad o con reglas activas
  const { data: empData, error: errE } = await admin.from("empresas").select("id");
  if (errE) {
    report.errores.push(`empresas_load: ${errE.message}`);
    return report;
  }
  const empresas = ((empData ?? []) as Row[]).map((r) => String(r.id));

  for (const empresaId of empresas) {
    for (const periodo of periodos) {
      try {
        await snapshotEmpresaPeriodo(admin, empresaId, periodo, fechaCierre, report);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        report.errores.push(`snapshot ${periodo}@${empresaId}: ${msg}`);
      }
    }
  }

  return report;
}
