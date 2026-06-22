"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

// ─── Tipos públicos (los consume la UI de KPIs) ──────────────────────────────
export type KpiFormato = "entero" | "decimal" | "porcentaje" | "horas" | "euro";

export interface KpiTrendPoint {
  periodo: string; // 'YYYY-MM'
  valor: number;
}

export interface KpiMetric {
  key: string;
  label: string;
  valor: number | null; // null = sin dato este mes
  valorPrevio: number | null;
  mejorEsMas: boolean; // para colorear la variación
  formato: KpiFormato;
}

export interface KpiBloque {
  key: "productividad" | "plantilla" | "horas";
  titulo: string;
  disponible: boolean; // hay datos en el mes actual
  metricas: KpiMetric[];
  trend: KpiTrendPoint[];
  trendLabel: string;
  desglose?: { label: string; valor: number; color: string }[];
}

export interface AuditoriaKpis {
  periodo: string;
  bloques: KpiBloque[];
}

type Err = { ok: false; error: string };
type Res<T> = { ok: true; data: T } | Err;

// ─── Helpers de periodo ──────────────────────────────────────────────────────
/** Devuelve los últimos `n` periodos 'YYYY-MM' terminando en `periodo` (incl). */
function ventanaPeriodos(periodo: string, n: number): string[] {
  const [y, m] = periodo.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** Primer día del mes y primer día del mes siguiente (límites [ini, fin)). */
function limitesMes(periodo: string): { ini: string; finExcl: string } {
  const [y, m] = periodo.split("-").map(Number);
  const ini = new Date(y, m - 1, 1);
  const fin = new Date(y, m, 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { ini: fmt(ini), finExcl: fmt(fin) };
}

function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

/** Normaliza nombre de departamento para cruzar con la productividad de cronogramas. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}
const ALIAS_DEPTO: Record<string, string[]> = {
  "RECURSOS HUMANOS": ["RRHH"],
  RRHH: ["RECURSOS HUMANOS"],
};

async function ctx() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sin sesión" };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };
  return { ok: true as const, supabase, empresaId };
}

// ─── Acción principal ────────────────────────────────────────────────────────
export async function getAuditoriaKpis(
  departamentoId: string,
  periodo: string
): Promise<Res<AuditoriaKpis>> {
  try {
    const c = await ctx();
    if (!c.ok) return c;
    const { supabase, empresaId } = c;

    const periodos = ventanaPeriodos(periodo, 6);
    const ventanaIni = limitesMes(periodos[0]).ini;
    const ventanaFin = limitesMes(periodo).finExcl;
    const periodoAnterior = periodos[periodos.length - 2] ?? null;

    // Departamento auditado.
    const { data: dep } = await supabase
      .from("departamentos")
      .select("id, nombre")
      .eq("id", departamentoId)
      .maybeSingle();
    const depNombre = (dep?.nombre as string) ?? "";

    const bloques: KpiBloque[] = [];

    // ── 1) Productividad (cronogramas) ──────────────────────────────────────
    {
      const objetivos = new Set([norm(depNombre), ...(ALIAS_DEPTO[norm(depNombre)] ?? []).map(norm)]);
      const { data: prod } = await supabase
        .from("v_cronograma_productividad")
        .select("departamento, fecha_programada, total, hechas, pendientes, omitidas")
        .eq("empresa_id", empresaId)
        .gte("fecha_programada", ventanaIni)
        .lt("fecha_programada", ventanaFin);

      const porMes = new Map<string, { total: number; hechas: number; pendientes: number; omitidas: number }>();
      for (const r of prod ?? []) {
        if (!objetivos.has(norm((r.departamento as string) ?? ""))) continue;
        const mes = mesDe(r.fecha_programada as string);
        const acc = porMes.get(mes) ?? { total: 0, hechas: 0, pendientes: 0, omitidas: 0 };
        acc.total += Number(r.total ?? 0);
        acc.hechas += Number(r.hechas ?? 0);
        acc.pendientes += Number(r.pendientes ?? 0);
        acc.omitidas += Number(r.omitidas ?? 0);
        porMes.set(mes, acc);
      }
      const pct = (m?: { total: number; hechas: number }) =>
        m && m.total > 0 ? Math.round((100 * m.hechas) / m.total) : null;
      const actual = porMes.get(periodo);
      const previo = periodoAnterior ? porMes.get(periodoAnterior) : undefined;

      bloques.push({
        key: "productividad",
        titulo: "Productividad operativa",
        disponible: !!actual,
        metricas: [
          {
            key: "cumplimiento",
            label: "Cumplimiento",
            valor: pct(actual),
            valorPrevio: pct(previo),
            mejorEsMas: true,
            formato: "porcentaje",
          },
          {
            key: "hechas",
            label: "Tareas hechas",
            valor: actual ? actual.hechas : null,
            valorPrevio: previo ? previo.hechas : null,
            mejorEsMas: true,
            formato: "entero",
          },
          {
            key: "pendientes",
            label: "Pendientes",
            valor: actual ? actual.pendientes : null,
            valorPrevio: previo ? previo.pendientes : null,
            mejorEsMas: false,
            formato: "entero",
          },
        ],
        trend: periodos.map((p) => ({ periodo: p, valor: pct(porMes.get(p)) ?? 0 })),
        trendLabel: "% cumplimiento",
        desglose: actual
          ? [
              { label: "Hechas", valor: actual.hechas, color: "#10b981" },
              { label: "Pendientes", valor: actual.pendientes, color: "#f59e0b" },
              { label: "Omitidas", valor: actual.omitidas, color: "#f43f5e" },
            ]
          : undefined,
      });
    }

    // ── 2) Plantilla (empleados) ────────────────────────────────────────────
    {
      const { data: emps } = await supabase
        .from("empleados")
        .select("id, estado, fecha_alta, fecha_baja")
        .eq("empresa_id", empresaId)
        .eq("departamento_id", departamentoId);
      const lista = emps ?? [];

      // Headcount a fin de cada mes (point-in-time).
      const headcount = (p: string): number => {
        const finExcl = limitesMes(p).finExcl;
        return lista.filter((e) => {
          const alta = (e.fecha_alta as string) ?? null;
          const baja = (e.fecha_baja as string) ?? null;
          if (alta && alta >= finExcl) return false; // aún no había entrado
          if (baja && baja < finExcl) return false; // ya se había ido
          return true;
        }).length;
      };
      const enMes = (campo: "fecha_alta" | "fecha_baja", p: string): number => {
        const { ini, finExcl } = limitesMes(p);
        return lista.filter((e) => {
          const v = (e[campo] as string) ?? null;
          return v && v >= ini && v < finExcl;
        }).length;
      };

      bloques.push({
        key: "plantilla",
        titulo: "Plantilla",
        disponible: lista.length > 0,
        metricas: [
          {
            key: "activos",
            label: "Activos",
            valor: headcount(periodo),
            valorPrevio: periodoAnterior ? headcount(periodoAnterior) : null,
            mejorEsMas: true,
            formato: "entero",
          },
          {
            key: "altas",
            label: "Altas del mes",
            valor: enMes("fecha_alta", periodo),
            valorPrevio: periodoAnterior ? enMes("fecha_alta", periodoAnterior) : null,
            mejorEsMas: true,
            formato: "entero",
          },
          {
            key: "bajas",
            label: "Bajas del mes",
            valor: enMes("fecha_baja", periodo),
            valorPrevio: periodoAnterior ? enMes("fecha_baja", periodoAnterior) : null,
            mejorEsMas: false,
            formato: "entero",
          },
        ],
        trend: periodos.map((p) => ({ periodo: p, valor: headcount(p) })),
        trendLabel: "Plantilla activa",
      });
    }

    // ── 3) Horas trabajadas (fichajes) ──────────────────────────────────────
    {
      const { data: empIdsRows } = await supabase
        .from("empleados")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("departamento_id", departamentoId);
      const empIds = (empIdsRows ?? []).map((e) => e.id as string);

      const porMes = new Map<string, { horas: number; fichajes: number; revision: number }>();
      if (empIds.length > 0) {
        const { data: fich } = await supabase
          .from("fichajes")
          .select("fecha, horas_totales, requiere_revision")
          .eq("empresa_id", empresaId)
          .in("empleado_id", empIds)
          .gte("fecha", ventanaIni)
          .lt("fecha", ventanaFin);
        for (const f of fich ?? []) {
          const mes = mesDe(f.fecha as string);
          const acc = porMes.get(mes) ?? { horas: 0, fichajes: 0, revision: 0 };
          acc.horas += Number(f.horas_totales ?? 0);
          acc.fichajes += 1;
          if (f.requiere_revision) acc.revision += 1;
          porMes.set(mes, acc);
        }
      }
      const actual = porMes.get(periodo);
      const previo = periodoAnterior ? porMes.get(periodoAnterior) : undefined;

      bloques.push({
        key: "horas",
        titulo: "Horas trabajadas",
        disponible: !!actual,
        metricas: [
          {
            key: "horas",
            label: "Horas del mes",
            valor: actual ? Math.round(actual.horas * 10) / 10 : null,
            valorPrevio: previo ? Math.round(previo.horas * 10) / 10 : null,
            mejorEsMas: true,
            formato: "horas",
          },
          {
            key: "fichajes",
            label: "Fichajes",
            valor: actual ? actual.fichajes : null,
            valorPrevio: previo ? previo.fichajes : null,
            mejorEsMas: true,
            formato: "entero",
          },
          {
            key: "revision",
            label: "Con revisión",
            valor: actual ? actual.revision : null,
            valorPrevio: previo ? previo.revision : null,
            mejorEsMas: false,
            formato: "entero",
          },
        ],
        trend: periodos.map((p) => ({
          periodo: p,
          valor: Math.round((porMes.get(p)?.horas ?? 0) * 10) / 10,
        })),
        trendLabel: "Horas",
      });
    }

    return { ok: true, data: { periodo, bloques } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
