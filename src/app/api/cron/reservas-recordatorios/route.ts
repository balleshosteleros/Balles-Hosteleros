/**
 * Cron: envío de correos de RECORDATORIO y RECONFIRMACIÓN del módulo Reservas.
 *
 * Se ejecuta cada hora (vercel.json) y por cada empresa con la opción activa:
 *
 * 1. RECORDATORIO (config: empresa_reservas_config.recordatorio_activo +
 *    recordatorio_horas_antes): busca reservas de la próxima ventana de
 *    [horas_antes, horas_antes + 1] horas que sigan vivas (no canceladas,
 *    no no-show, no completadas, no liberadas) y aún no tengan
 *    email_recordatorio_at. Las envía y marca el timestamp.
 *
 * 2. RECONFIRMACIÓN (config: reconfirmacion_dias_antes): igual que arriba pero
 *    para reservas a [N días, N días + 1 hora] de la actual y estado en
 *    PENDIENTE/CONFIRMADA. Solo se envía si no se envió ya (idempotente vía
 *    email_reconfirmacion_at).
 *
 * El mailer genérico ya implementa la idempotencia por columna de auditoría,
 * pero pre-filtramos en SQL para no tirar millones de queries en empresas con
 * muchas reservas.
 *
 * Autorización: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { enviarReservaEmail } from "@/lib/email/reservas/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_POR_TIRADA = 100;

interface ConfigEmpresa {
  empresa_id: string;
  recordatorio_activo: boolean;
  recordatorio_horas_antes: number;
  reconfirmacion_dias_antes: number;
}

interface ReservaPendiente {
  id: string;
  empresa_id: string;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado" },
      { status: 503 },
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1) Configs de todas las empresas con reservas activas.
  const { data: configs, error: errCfg } = await supabase
    .from("empresa_reservas_config")
    .select(
      "empresa_id, recordatorio_activo, recordatorio_horas_antes, reconfirmacion_dias_antes",
    );
  if (errCfg) {
    return NextResponse.json({ ok: false, error: errCfg.message }, { status: 500 });
  }

  const ahora = new Date();

  let recordatoriosOk = 0;
  let recordatoriosErr = 0;
  let reconfirmacionesOk = 0;
  let reconfirmacionesErr = 0;

  for (const c of (configs ?? []) as ConfigEmpresa[]) {
    // ── RECORDATORIO ──────────────────────────────────────────────────────
    if (c.recordatorio_activo) {
      const horas = c.recordatorio_horas_antes ?? 3;
      const desde = new Date(ahora.getTime() + horas * 3600 * 1000);
      const hasta = new Date(desde.getTime() + 60 * 60 * 1000);
      const pendientes = await buscarPendientes(supabase, {
        empresaId: c.empresa_id,
        desde,
        hasta,
        estados: [
          "PENDIENTE",
          "CONFIRMADA",
          "RECONFIRMADA",
          "LLEGADA",
          "SENTADA",
        ],
        auditCol: "email_recordatorio_at",
      });
      for (const r of pendientes) {
        const res = await enviarReservaEmail(r.id, "RECORDATORIO");
        if (res.ok) recordatoriosOk++;
        else recordatoriosErr++;
      }
    }

    // ── RECONFIRMACIÓN ────────────────────────────────────────────────────
    const diasAntes = c.reconfirmacion_dias_antes ?? 1;
    const desdeR = new Date(ahora.getTime() + diasAntes * 24 * 3600 * 1000);
    const hastaR = new Date(desdeR.getTime() + 60 * 60 * 1000);
    const pendientesR = await buscarPendientes(supabase, {
      empresaId: c.empresa_id,
      desde: desdeR,
      hasta: hastaR,
      estados: ["PENDIENTE", "CONFIRMADA"],
      auditCol: "email_reconfirmacion_at",
    });
    for (const r of pendientesR) {
      const res = await enviarReservaEmail(r.id, "RECONFIRMACION");
      if (res.ok) reconfirmacionesOk++;
      else reconfirmacionesErr++;
    }
  }

  return NextResponse.json({
    ok: true,
    recordatorios: { ok: recordatoriosOk, err: recordatoriosErr },
    reconfirmaciones: { ok: reconfirmacionesOk, err: reconfirmacionesErr },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buscarPendientes(
  supabase: any,
  args: {
    empresaId: string;
    desde: Date;
    hasta: Date;
    estados: string[];
    auditCol: "email_recordatorio_at" | "email_reconfirmacion_at";
  },
): Promise<ReservaPendiente[]> {
  // Construimos una condición sobre `fecha + hora` aproximando con `fecha`
  // y filtramos en JS por hora exacta, ya que `fecha` y `hora` son columnas
  // separadas. Aceptamos pequeño sobrebusqueda — el filtro de auditoría y
  // estados garantiza que solo se envíe lo que toca.
  const fechaDesde = args.desde.toISOString().slice(0, 10);
  const fechaHasta = args.hasta.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("reservas")
    .select("id, empresa_id, fecha, hora, cliente_email")
    .eq("empresa_id", args.empresaId)
    .in("estado", args.estados)
    .is(args.auditCol, null)
    .gte("fecha", fechaDesde)
    .lte("fecha", fechaHasta)
    .not("cliente_email", "is", null)
    .limit(MAX_POR_TIRADA);
  if (error) return [];

  const dentroVentana: ReservaPendiente[] = [];
  for (const r of data ?? []) {
    const fecha = r.fecha as string;
    const hora = (r.hora as string).slice(0, 5);
    const ts = new Date(`${fecha}T${hora}:00`);
    if (ts.getTime() >= args.desde.getTime() && ts.getTime() < args.hasta.getTime()) {
      dentroVentana.push({
        id: r.id as string,
        empresa_id: r.empresa_id as string,
      });
    }
  }
  return dentroVentana;
}
