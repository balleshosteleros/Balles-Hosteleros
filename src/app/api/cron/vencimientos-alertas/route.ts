/**
 * Cron: alertas de VENCIMIENTOS próximos (PRP-065 Fase 4).
 *
 * Cada día, para las empresas con `notif_vencimientos_activo`, busca vencimientos
 * cuya `fecha_vencimiento` cae dentro de los próximos DIAS_AVISO días y emite una
 * notificación al área ADMINISTRATIVA (los vencimientos no tienen responsable
 * vinculado a un usuario; los gestiona administración). Idempotente vía
 * `dedupe_key = vencimiento:<id>:<fecha_vencimiento>` (una alerta por vencimiento
 * y fecha objetivo, aunque el cron corra varios días seguidos).
 *
 * Autorización: header `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ahoraEnMadrid } from "@/features/rrhh/utils/horario-empleado";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIAS_AVISO = 7;

function fmtFecha(iso: string): string {
  try {
    return new Date(iso + "T12:00:00Z").toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
    });
  } catch {
    return iso;
  }
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
  );

  const { fecha: hoy } = ahoraEnMadrid();
  const limite = new Date(hoy + "T12:00:00Z");
  limite.setUTCDate(limite.getUTCDate() + DIAS_AVISO);
  const hasta = limite.toISOString().slice(0, 10);

  // Vencimientos próximos (todas las empresas), sin los ya inactivos.
  const { data: venc, error } = await supabase
    .from("vencimientos")
    .select("id, empresa_id, nombre, categoria, fecha_vencimiento, responsable, estado")
    .gte("fecha_vencimiento", hoy)
    .lte("fecha_vencimiento", hasta)
    .neq("estado", "Inactivo");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Toggle por empresa (cache).
  const toggleCache = new Map<string, boolean>();
  async function empresaActiva(empresaId: string): Promise<boolean> {
    if (toggleCache.has(empresaId)) return toggleCache.get(empresaId)!;
    const { data } = await supabase
      .from("empresas")
      .select("notif_vencimientos_activo")
      .eq("id", empresaId)
      .maybeSingle();
    const activo = !data || data.notif_vencimientos_activo !== false;
    toggleCache.set(empresaId, activo);
    return activo;
  }

  let emitidas = 0;
  for (const v of venc ?? []) {
    const empresaId = v.empresa_id as string;
    if (!empresaId) continue;
    if (!(await empresaActiva(empresaId))) continue;

    const fecha = v.fecha_vencimiento as string;
    const res = await emitirNotificacion({
      empresaId,
      system: true,
      tipo: "vencimiento",
      titulo: `Vence pronto: ${(v.nombre as string) ?? "vencimiento"}`,
      mensaje: `Fecha límite ${fmtFecha(fecha)}${v.categoria ? ` · ${v.categoria}` : ""}${
        v.responsable ? ` · Responsable: ${v.responsable}` : ""
      }`,
      segmento: { tipo: "area", area: "ADMINISTRATIVA" },
      refTabla: "vencimientos",
      refId: v.id as string,
      accionUrl: "/gerencia/vencimientos",
      dedupeKey: `vencimiento:${v.id}:${fecha}`,
    });
    if (res.creadas > 0) emitidas += res.creadas;
  }

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    vencimientosRevisados: venc?.length ?? 0,
    notificacionesEmitidas: emitidas,
  });
}
