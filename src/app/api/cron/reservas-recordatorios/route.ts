/**
 * Cron: envío de correos automáticos del módulo Reservas — RECORDATORIO,
 * RECONFIRMACIÓN y SOLICITUD DE VALORACIÓN.
 *
 * Se ejecuta cada hora (vercel.json) y por cada empresa con la opción activa:
 *
 * 1. RECORDATORIO (config: empresa_reservas_config.recordatorio_activo +
 *    recordatorio_horas_antes): busca reservas de la próxima ventana de
 *    [horas_antes, horas_antes + 1] horas que sigan vivas (no canceladas,
 *    no no-show, no completadas, no liberadas) y aún no tengan
 *    email_recordatorio_at. Las envía y marca el timestamp.
 *
 * 2. RECONFIRMACIÓN (config: reconfirmacion_activa + reconfirmacion_dias_antes):
 *    si la empresa tiene la reconfirmación activa, busca reservas a
 *    [N días, N días + 1 hora] de la actual en estado CONFIRMADA. Solo se
 *    envía si no se envió ya (idempotente vía email_reconfirmacion_at). Si la
 *    empresa tiene `reconfirmacion_activa = false`, no se envía nada.
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
import {
  ZONA_HORARIA_FALLBACK,
  zonaLocalAUtcISO,
} from "@/features/empresa/lib/zona-horaria";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_POR_TIRADA = 100;

/** Zona horaria de los ajustes de la empresa (`config_operativa.zonaHoraria`). */
function tzDeEmpresa(configOperativa: unknown): string {
  const cfg = (configOperativa as Record<string, unknown> | null) ?? null;
  const tz = cfg && typeof cfg.zonaHoraria === "string" ? cfg.zonaHoraria.trim() : "";
  return tz || ZONA_HORARIA_FALLBACK;
}

/** Día civil "AAAA-MM-DD" de un instante, en la zona de la empresa. */
function diaEnZona(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || ZONA_HORARIA_FALLBACK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

interface ConfigEmpresa {
  empresa_id: string;
  recordatorio_activo: boolean;
  recordatorio_horas_antes: number;
  reconfirmacion_activa: boolean;
  reconfirmacion_dias_antes: number;
  valoracion_email_activo: boolean;
  valoracion_email_horas_despues: number;
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
      "empresa_id, recordatorio_activo, recordatorio_horas_antes, reconfirmacion_activa, reconfirmacion_dias_antes, valoracion_email_activo, valoracion_email_horas_despues",
    );
  if (errCfg) {
    return NextResponse.json({ ok: false, error: errCfg.message }, { status: 500 });
  }

  const ahora = new Date();

  let recordatoriosOk = 0;
  let recordatoriosErr = 0;
  let reconfirmacionesOk = 0;
  let reconfirmacionesErr = 0;
  let valoracionesOk = 0;
  let valoracionesErr = 0;

  for (const c of (configs ?? []) as ConfigEmpresa[]) {
    // Zona horaria de los ajustes de ESTA empresa: las columnas `fecha`/`hora`
    // de una reserva son hora local del restaurante, no UTC.
    const { data: empRow } = await supabase
      .from("empresas")
      .select("config_operativa")
      .eq("id", c.empresa_id)
      .maybeSingle();
    const tz = tzDeEmpresa(empRow?.config_operativa);

    // ── RECORDATORIO ──────────────────────────────────────────────────────
    // Cada bloque va aislado: un fallo de BD en una empresa no debe impedir que
    // el resto reciba sus correos, pero sí tiene que quedar contado como error.
    if (c.recordatorio_activo) {
      try {
        const horas = c.recordatorio_horas_antes ?? 3;
        const desde = new Date(ahora.getTime() + horas * 3600 * 1000);
        const hasta = new Date(desde.getTime() + 60 * 60 * 1000);
        const pendientes = await buscarPendientes(supabase, {
          empresaId: c.empresa_id,
          desde,
          hasta,
          estados: [
            "CONFIRMADA",
            "RECONFIRMADA",
            "NO_RECONFIRMADA",
            "TERMINANDO",
          ],
          auditCol: "email_recordatorio_at",
          tz,
        });
        for (const r of pendientes) {
          // Sin persona detrás: lo dispara el reloj, no un empleado.
          const res = await enviarReservaEmail(r.id, "RECORDATORIO", {
            actor: { origen: "AUTOMATICO" },
          });
          if (res.ok) recordatoriosOk++;
          else recordatoriosErr++;
        }
      } catch (e) {
        recordatoriosErr++;
        console.error(`[cron reservas] recordatorio empresa ${c.empresa_id}:`, e);
      }
    }

    // ── RECONFIRMACIÓN ────────────────────────────────────────────────────
    if (c.reconfirmacion_activa) {
      try {
        const diasAntes = c.reconfirmacion_dias_antes ?? 1;
        const desdeR = new Date(ahora.getTime() + diasAntes * 24 * 3600 * 1000);
        const hastaR = new Date(desdeR.getTime() + 60 * 60 * 1000);
        const pendientesR = await buscarPendientes(supabase, {
          empresaId: c.empresa_id,
          desde: desdeR,
          hasta: hastaR,
          estados: ["CONFIRMADA"],
          auditCol: "email_reconfirmacion_at",
          tz,
        });
        for (const r of pendientesR) {
          const res = await enviarReservaEmail(r.id, "RECONFIRMADA", {
            actor: { origen: "AUTOMATICO" },
          });
          if (res.ok) reconfirmacionesOk++;
          else reconfirmacionesErr++;
        }
      } catch (e) {
        reconfirmacionesErr++;
        console.error(`[cron reservas] reconfirmacion empresa ${c.empresa_id}:`, e);
      }
    }

    // ── SOLICITUD DE VALORACIÓN ───────────────────────────────────────────
    // Al revés que los otros dos: la ventana mira HACIA ATRÁS, porque la
    // visita ya ocurrió. El plazo lo fija la empresa en Comunicaciones y rige
    // para todas sus reservas por igual.
    if (c.valoracion_email_activo) {
      try {
        const horasDespues = c.valoracion_email_horas_despues ?? 24;
        const hastaV = new Date(ahora.getTime() - horasDespues * 3600 * 1000);
        // Ventana de 24 h hacia atrás, no de 1 h: este cron corre UNA VEZ AL
        // DÍA (vercel.json), así que una ventana de una hora dejaría fuera el
        // 96% de las reservas y no se les pediría valoración nunca. Reenviar
        // no es riesgo: `email_valoracion_at` garantiza un solo correo por
        // reserva, y el filtro `is(auditCol, null)` descarta las ya avisadas.
        const desdeV = new Date(hastaV.getTime() - 24 * 60 * 60 * 1000);
        const pendientesV = await buscarPendientes(supabase, {
          empresaId: c.empresa_id,
          desde: desdeV,
          hasta: hastaV,
          // Solo a quien vino. Cancelada, no-show y lista de espera quedan
          // fuera: preguntar "¿qué tal fue?" a quien no se sentó es peor que
          // no preguntar nada.
          estados: [
            "CONFIRMADA",
            "RECONFIRMADA",
            "NO_RECONFIRMADA",
            "TERMINANDO",
            "LIBERADA",
            "WALK_IN",
          ],
          auditCol: "email_valoracion_at",
          tz,
        });
        for (const r of pendientesV) {
          const res = await enviarReservaEmail(r.id, "SOLICITUD_VALORACION", {
            actor: { origen: "AUTOMATICO" },
          });
          if (res.ok) valoracionesOk++;
          else valoracionesErr++;
        }
      } catch (e) {
        valoracionesErr++;
        console.error(`[cron reservas] valoracion empresa ${c.empresa_id}:`, e);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    recordatorios: { ok: recordatoriosOk, err: recordatoriosErr },
    reconfirmaciones: { ok: reconfirmacionesOk, err: reconfirmacionesErr },
    valoraciones: { ok: valoracionesOk, err: valoracionesErr },
  });
}

async function buscarPendientes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  args: {
    empresaId: string;
    desde: Date;
    hasta: Date;
    estados: string[];
    auditCol:
      | "email_recordatorio_at"
      | "email_reconfirmacion_at"
      | "email_valoracion_at";
    /** Zona horaria de los ajustes de la empresa (config_operativa.zonaHoraria). */
    tz: string;
  },
): Promise<ReservaPendiente[]> {
  // Construimos una condición sobre `fecha + hora` aproximando con `fecha`
  // y filtramos en JS por hora exacta, ya que `fecha` y `hora` son columnas
  // separadas. Aceptamos pequeño sobrebusqueda — el filtro de auditoría y
  // estados garantiza que solo se envíe lo que toca.
  //
  // El rango se ensancha un día por lado a propósito: `fecha` es el día CIVIL
  // del restaurante, y la ventana viene en instantes UTC. Sin ese margen, una
  // reserva de madrugada (p.ej. 01:00) caía en el día UTC anterior, quedaba
  // fuera del `gte/lte` y NUNCA recibía recordatorio (el envío marca la columna
  // de auditoría, así que tampoco se recuperaba en tiradas posteriores).
  const DIA_MS = 86_400_000;
  const fechaDesde = diaEnZona(new Date(args.desde.getTime() - DIA_MS), args.tz);
  const fechaHasta = diaEnZona(new Date(args.hasta.getTime() + DIA_MS), args.tz);

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
  // Un fallo de BD no es "no hay nada que enviar": propagamos para que la
  // respuesta del cron no diga `ok` habiendo perdido la tirada entera.
  if (error) throw error;

  const dentroVentana: ReservaPendiente[] = [];
  for (const r of data ?? []) {
    const fecha = r.fecha as string;
    const hora = (r.hora as string).slice(0, 5);
    // `fecha`/`hora` son hora local del restaurante → a UTC con SU zona.
    const ts = new Date(zonaLocalAUtcISO(fecha, hora, args.tz));
    if (ts.getTime() >= args.desde.getTime() && ts.getTime() < args.hasta.getTime()) {
      dentroVentana.push({
        id: r.id as string,
        empresa_id: r.empresa_id as string,
      });
    }
  }
  return dentroVentana;
}
