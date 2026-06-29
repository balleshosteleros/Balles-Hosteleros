/**
 * Cron: alertas de TAREAS de cronograma del día (PRP-065 Fase 4).
 *
 * Cada mañana, para las empresas con `notif_cronogramas_activo`, recorre las
 * tareas de `cronogramas_operativos` cuya recurrencia cae hoy y emite una
 * notificación a sus destinatarios: empleados asignados si los hay, en su defecto
 * todo el departamento de la tarea. Idempotente vía
 * `dedupe_key = cronograma:<id>:<YYYY-MM-DD>` (una alerta por tarea y día).
 *
 * Recurrencia soportada (formato real de la tabla): DIARIO; SEMANAL (dia_semana =
 * ISO 1..7); MENSUAL (dia_mes); TRIMESTRAL (meses_trimestrales + dia_mes). OTRO y
 * anual se omiten (modelo en rediseño). Autorización: `Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TareaRow {
  id: string;
  empresa_id: string;
  tarea: string | null;
  frecuencia: string | null;
  dia_semana: number[] | null;
  dia_mes: number | null;
  meses_trimestrales: number[] | null;
  empleados_asignados: string[] | null;
  departamento: string | null;
  fecha_inicio: string | null;
  termina_tipo: string | null;
  termina_fecha: string | null;
}

function uniq(arr: (string | null)[]): string[] {
  return Array.from(new Set(arr.filter((x): x is string => !!x)));
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as unknown as SupabaseClient;

  // Alerta diaria de tareas de cronograma (día de calendario): un único "hoy"
  // de referencia basta (Europe/Madrid). Ver nota en vencimientos-alertas.
  const { fecha: hoy } = ahoraEnZona("Europe/Madrid");
  const [y, m, d] = hoy.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const jsDow = dt.getUTCDay(); // 0=domingo … 6=sábado
  const isoDow = jsDow === 0 ? 7 : jsDow; // 1=lunes … 7=domingo
  const dayOfMonth = d;
  const month = m;

  function venceHoy(t: TareaRow): boolean {
    if (t.fecha_inicio && t.fecha_inicio > hoy) return false;
    if (t.termina_tipo === "fecha" && t.termina_fecha && t.termina_fecha < hoy) return false;
    switch ((t.frecuencia ?? "").toUpperCase()) {
      case "DIARIO":
        return true;
      case "SEMANAL":
        return Array.isArray(t.dia_semana) && t.dia_semana.includes(isoDow);
      case "MENSUAL":
        return t.dia_mes === dayOfMonth;
      case "TRIMESTRAL":
        return (
          Array.isArray(t.meses_trimestrales) &&
          t.meses_trimestrales.includes(month) &&
          t.dia_mes === dayOfMonth
        );
      default:
        return false; // OTRO / anual: ambiguo, se omite en v1
    }
  }

  async function destinatarios(t: TareaRow): Promise<string[]> {
    if (t.empleados_asignados && t.empleados_asignados.length > 0) {
      const { data } = await supabase
        .from("empleados")
        .select("user_id")
        .in("id", t.empleados_asignados);
      return uniq((data ?? []).map((r) => r.user_id as string | null));
    }
    if (t.departamento) {
      const { data } = await supabase
        .from("usuarios")
        .select("user_id")
        .eq("empresa_id", t.empresa_id)
        .eq("departamento", t.departamento);
      return uniq((data ?? []).map((r) => r.user_id as string | null));
    }
    return [];
  }

  const { data: tareas, error } = await supabase
    .from("cronogramas_operativos")
    .select(
      "id, empresa_id, tarea, frecuencia, dia_semana, dia_mes, meses_trimestrales, empleados_asignados, departamento, fecha_inicio, termina_tipo, termina_fecha",
    );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const toggleCache = new Map<string, boolean>();
  async function empresaActiva(empresaId: string): Promise<boolean> {
    if (toggleCache.has(empresaId)) return toggleCache.get(empresaId)!;
    const { data } = await supabase
      .from("empresas")
      .select("notif_cronogramas_activo")
      .eq("id", empresaId)
      .maybeSingle();
    const activo = !data || data.notif_cronogramas_activo !== false;
    toggleCache.set(empresaId, activo);
    return activo;
  }

  let tareasHoy = 0;
  let emitidas = 0;
  for (const raw of (tareas ?? []) as TareaRow[]) {
    if (!venceHoy(raw)) continue;
    if (!raw.empresa_id) continue;
    if (!(await empresaActiva(raw.empresa_id))) continue;
    tareasHoy++;

    const userIds = await destinatarios(raw);
    if (userIds.length === 0) continue;

    const res = await emitirNotificacion({
      empresaId: raw.empresa_id,
      system: true,
      tipo: "cronograma",
      titulo: `Tarea de hoy: ${(raw.tarea ?? "tarea pendiente").slice(0, 80)}`,
      mensaje: raw.departamento ? `Departamento: ${raw.departamento}` : "",
      segmento: { tipo: "usuarios", usuarioIds: userIds },
      refTabla: "cronogramas_operativos",
      refId: raw.id,
      accionUrl: "/direccion/cronogramas",
      dedupeKey: `cronograma:${raw.id}:${hoy}`,
    });
    if (res.creadas > 0) emitidas += res.creadas;
  }

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    tareasRevisadas: tareas?.length ?? 0,
    tareasHoy,
    notificacionesEmitidas: emitidas,
  });
}
