/**
 * Cron: envío de correos automáticos del módulo Reservas — RECORDATORIO,
 * RECONFIRMACIÓN y SOLICITUD DE VALORACIÓN.
 *
 * Se ejecuta CADA HORA y no decide nada por sí mismo: la hora de envío la pone
 * cada empresa en SU hora local, y el cron solo dispara en la pasada que cae en
 * esa hora. Así "a las 10:00" son las 10:00 en enero y en julio, sin que el
 * cambio de hora lo mueva. Por cada empresa con la opción activa:
 *
 * 1. RECORDATORIO (config: empresa_reservas_config.recordatorio_activo +
 *    recordatorio_horas_antes): busca reservas de la próxima ventana de
 *    [horas_antes, horas_antes + 1] horas que sigan vivas (no canceladas,
 *    no no-show, no completadas, no liberadas) y aún no tengan
 *    email_recordatorio_at. Las envía y marca el timestamp. Al correr cada
 *    hora, esta ventana de 1 h vuelve a ser la correcta.
 *
 * 2. RECONFIRMACIÓN (config: reconfirmacion_activa + reconfirmacion_dias_antes
 *    + reconfirmacion_hora_envio, esta última en hora LOCAL de la empresa):
 *    si la empresa tiene la reconfirmación activa, barre el DÍA ENTERO que
 *    cae a N días vista y avisa a las reservas en estado CONFIRMADA. Solo se
 *    envía si no se envió ya (idempotente vía email_reconfirmacion_at). Si la
 *    empresa tiene `reconfirmacion_activa = false`, no se envía nada.
 *    Quien reserva DESPUÉS de que pase el cron (menos de N días de antelación)
 *    no lo coge esta tirada: a ése le llega en el acto al reservar, vía
 *    `reconfirmacion_envio_inmediato` en notificar-creada.ts.
 *
 * 2b. SIN RESPUESTA → NO_RECONFIRMADA: a quien se le pidió reconfirmar y no
 *    contestó, se le marca así en cuanto pasa la hora de su reserva. Sala lo
 *    ve como "sin confirmar" en vez de mezclado con quien sí respondió. No
 *    manda correo: solo refleja el estado real.
 *
 * El mailer genérico ya implementa la idempotencia por columna de auditoría,
 * pero pre-filtramos en SQL para no tirar millones de queries en empresas con
 * muchas reservas.
 *
 * Autorización: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { notifActiva } from "@/features/notificaciones/actions/notif-interruptores-actions";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { enviarReservaEmail } from "@/lib/email/reservas/mailer";
import { enviarAvisoReserva } from "@/lib/mensajeria/reservas";
import {
  ZONA_HORARIA_FALLBACK,
  minutosDiaEnZona,
  zonaLocalAUtcISO,
} from "@/features/empresa/lib/zona-horaria";
import {
  ESTADOS_RESERVA,
  ESTADOS_NO_ASISTEN,
} from "@/features/sala/data/reservas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_POR_TIRADA = 100;

/** Zona horaria de los ajustes de la empresa (`config_operativa.zonaHoraria`). */
function tzDeEmpresa(configOperativa: unknown): string {
  const cfg = (configOperativa as Record<string, unknown> | null) ?? null;
  const tz = cfg && typeof cfg.zonaHoraria === "string" ? cfg.zonaHoraria.trim() : "";
  return tz || ZONA_HORARIA_FALLBACK;
}

/** Hora de envío de la empresa ("HH:MM") en minutos desde medianoche. */
const HORA_ENVIO_POR_DEFECTO = 10 * 60; // 10:00, hora del restaurante

function horaEnvioDeConfig(valor: string | null | undefined): number {
  const m = /^(\d{1,2}):(\d{2})/.exec((valor ?? "").trim());
  if (!m) return HORA_ENVIO_POR_DEFECTO;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return HORA_ENVIO_POR_DEFECTO;
  return h * 60 + min;
}

/**
 * ¿Es la hora de enviar de esta empresa?
 *
 * La ventana es de DOS horas, no de una: el cron pasa cada hora, así que una
 * sola pasada bastaría, pero GitHub Actions se retrasa en horas punta y un
 * retraso de más de una hora habría perdido el envío del día entero. Dos horas
 * absorben ese retraso sin llegar a convertirse en "de las 10:00 en adelante",
 * que era el problema: con `>= hora` cualquier pasada de la tarde enviaba, y una
 * reserva creada a las 20:00 para mañana recibía su correo a los minutos en vez
 * de a las 10:00 del día siguiente.
 */
const VENTANA_ENVIO_MIN = 120;

function esSuHora(minutosAhora: number, horaEnvio: number): boolean {
  return (
    minutosAhora >= horaEnvio && minutosAhora < horaEnvio + VENTANA_ENVIO_MIN
  );
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
  /** Hora local de la empresa ("HH:MM") a la que sale la reconfirmación. */
  reconfirmacion_hora_envio: string | null;
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
      "empresa_id, recordatorio_activo, recordatorio_horas_antes, reconfirmacion_activa, reconfirmacion_dias_antes, reconfirmacion_hora_envio, valoracion_email_activo, valoracion_email_horas_despues",
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
  let mensajesOk = 0;

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
    if (c.recordatorio_activo && (await notifActiva("reserva_recordatorio", c.empresa_id))) {
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

          if (await avisarPorMensajeria(r.id, "RECORDATORIO")) mensajesOk++;
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

        // La hora la manda la EMPRESA, no el reloj del servidor. El cron pasa
        // varias veces y solo dispara en la pasada que cae en la hora local
        // del restaurante (`reconfirmacion_hora_envio`, 10:00 por defecto).
        // Así el correo sale a las 10:00 de verdad en enero y en julio: si la
        // hora la fijara el cron en UTC, el cambio de hora la movería sola.
        // Antes de su hora no se envía nada: el resto de pasadas del día se
        // van de vacío y la reserva creada esta tarde espera a mañana.
        //
        // Pasada su hora sí se envía, aunque la pasada llegue tarde. Ceñirlo a
        // la ventana exacta [10:00, 11:00) parecía más limpio, pero GitHub
        // Actions se retrasa en horas punta y un retraso de 48 min habría
        // perdido el envío del día ENTERO, que es justo el fallo que veníamos
        // de arreglar. Enviar tarde es mucho mejor que no enviar, y
        // `email_reconfirmacion_at` impide que salga dos veces.
        const horaEnvio = horaEnvioDeConfig(c.reconfirmacion_hora_envio);
        if (!esSuHora(minutosDiaEnZona(ahora, tz), horaEnvio)) {
          continue;
        }

        // Día civil objetivo en la zona de la empresa, y su día entero como
        // ventana. Antes esto era una ventana de UNA HORA y por eso no salió
        // NUNCA una sola reconfirmación: solo habría acertado con reservas a
        // las 6 de la mañana. Barriendo el día completo entran todos los
        // clientes, coman a las 14:00 o cenen a las 23:00.
        //
        // Reenviar no es riesgo: `email_reconfirmacion_at` garantiza un solo
        // correo por reserva, y el filtro `is(auditCol, null)` descarta las ya
        // avisadas.
        const diaObjetivo = diaEnZona(
          new Date(ahora.getTime() + diasAntes * 24 * 3600 * 1000),
          tz,
        );
        // La ventana empieza AHORA, no en el día objetivo.
        //
        // Antes cubría solo ese día [00:00, 24:00), y una reserva que se
        // quedaba sin su petición —porque el envío inmediato murió a media
        // conexión SMTP— ya no la recuperaba nadie: al día siguiente el cron
        // miraba el día de después y la dejaba atrás para siempre. En Sala
        // aparecía como CONFIRMADA, indistinguible de las que sí habían sido
        // preguntadas, y nadie sabía que a ese cliente no se le había escrito.
        //
        // Barriendo desde ahora hasta el final del día objetivo entran también
        // las rezagadas de hoy. No se duplica nada: `is(auditCol, null)`
        // descarta las que ya tienen su correo, y el filtro por estado deja
        // fuera las que ya respondieron.
        const hastaR = new Date(
          new Date(zonaLocalAUtcISO(diaObjetivo, "00:00", tz)).getTime() +
            24 * 60 * 60 * 1000,
        );
        const desdeR = ahora;
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
          if (res.ok) {
            reconfirmacionesOk++;
            // Pedida la reconfirmación, la reserva deja de ser una CONFIRMADA
            // cualquiera: pasa a NO_RECONFIRMADA, que es "se le pidió y aún no
            // ha contestado". Sin esto, en Sala se veían igual las que estaban
            // esperando respuesta y las que ni se habían preguntado.
            //
            // Vuelve a CONFIRMADA nunca: o el cliente responde que sí
            // (RECONFIRMADA), o dice que no (CANCELADA), o se queda así.
            await supabase
              .from("reservas")
              .update({ estado: "NO_RECONFIRMADA", updated_at: new Date().toISOString() })
              .eq("id", r.id)
              // Solo si sigue CONFIRMADA: entre el envío y esto, Sala puede
              // haberla sentado o cancelado y pisarlo sería peor.
              .eq("estado", "CONFIRMADA");
          } else reconfirmacionesErr++;

          if (await avisarPorMensajeria(r.id, "RECONFIRMACION")) mensajesOk++;
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
        // Misma hora que la reconfirmación y por el mismo motivo: la fija la
        // EMPRESA en su hora local, no el reloj del servidor. Sin esto, con el
        // cron pasando cada hora, la petición salía a cualquier hora — a las
        // 3 de la madrugada al que cenó anteayer.
        const horaEnvioV = horaEnvioDeConfig(c.reconfirmacion_hora_envio);
        if (!esSuHora(minutosDiaEnZona(ahora, tz), horaEnvioV)) {
          continue;
        }

        const horasDespues = c.valoracion_email_horas_despues ?? 24;
        const hastaV = new Date(ahora.getTime() - horasDespues * 3600 * 1000);
        // Ventana de 24 h hacia atrás, no de 1 h: el envío ocurre UNA VEZ AL
        // DÍA (a la hora de la empresa), así que una ventana de una hora
        // dejaría fuera el 96% de las reservas y no se les pediría valoración
        // nunca. Reenviar no es riesgo: `email_valoracion_at` garantiza un solo
        // correo por reserva, y el filtro `is(auditCol, null)` descarta las ya
        // avisadas.
        const desdeV = new Date(hastaV.getTime() - 24 * 60 * 60 * 1000);
        const pendientesV = await buscarPendientes(supabase, {
          empresaId: c.empresa_id,
          desde: desdeV,
          hasta: hastaV,
          // A TODO el que asistió, sin mirar el tipo de reserva ni el origen:
          // el que entró sin reservar y acabó sentado comió lo mismo que el
          // que reservó por la web, y su opinión vale igual.
          //
          // La lista NO se escribe a mano: son todos los estados menos los que
          // de verdad no asisten (cancelada y no-show), que es la misma fuente
          // que usan los totales de Sala. Escrita a mano se quedaba corta y
          // cada estado nuevo nacía sin valoración sin que nadie se enterara.
          estados: ESTADOS_RESERVA.filter(
            (e) => !ESTADOS_NO_ASISTEN.includes(e),
          ),
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
    // Los mensajes van aparte del correo: aquí solo se cuentan los que
    // salieron de verdad, no los que no pudieron enviarse (sin saldo, sin
    // teléfono, canal apagado). Esos no son errores, son el caso normal.
    mensajes: { ok: mensajesOk },
  });
}

/**
 * Aviso por WhatsApp (o SMS de respaldo), además del correo.
 *
 * Va SIEMPRE detrás del correo y nunca en su lugar: el correo es la red de
 * seguridad y no depende de que la empresa tenga saldo, número o los canales
 * encendidos.
 *
 * No poder enviar aquí es el caso normal, no una avería: sin saldo, sin
 * teléfono o con el canal apagado, se devuelve `false` en silencio. Solo se
 * traza lo que de verdad se rompió, para no llenar el registro de ruido cada
 * noche.
 */
async function avisarPorMensajeria(
  reservaId: string,
  tipo: "RECORDATORIO" | "RECONFIRMACION",
): Promise<boolean> {
  try {
    const res = await enviarAvisoReserva(reservaId, tipo, {
      actor: { origen: "AUTOMATICO" },
    });
    return res.ok;
  } catch (e) {
    console.error(`[cron reservas] mensajeria ${tipo} reserva ${reservaId}:`, e);
    return false;
  }
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
