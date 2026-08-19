"use server";

/**
 * Cancelación de una reserva por el propio cliente, desde el enlace del correo.
 *
 * Requisito de Google (Reservations E2E: "Partners must support online
 * cancellation") y necesidad del restaurante: si cancelar cuesta una llamada,
 * el cliente no avisa y la mesa se pierde sin poder revenderse.
 *
 * El acceso va por `cancelacion_token`, un secreto por reserva: con el id no
 * basta, así nadie puede cancelar reservas ajenas probando identificadores.
 */

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ESTADOS_NO_OCUPANTES } from "@/features/sala/lib/reserva-conflicto";
import {
  ZONA_HORARIA_FALLBACK,
  zonaLocalAUtcISO,
} from "@/features/empresa/lib/zona-horaria";

/**
 * Zona horaria configurada en los ajustes de la empresa
 * (`empresas.config_operativa.zonaHoraria`). Aquí no podemos usar
 * `getZonaHorariaEmpresa()` porque esta acción es pública y va con el cliente
 * admin, así que leemos el mismo campo desde la fila ya cargada.
 */
function tzDeEmpresa(configOperativa: unknown): string {
  const cfg = (configOperativa as Record<string, unknown> | null) ?? null;
  const tz = cfg && typeof cfg.zonaHoraria === "string" ? cfg.zonaHoraria.trim() : "";
  return tz || ZONA_HORARIA_FALLBACK;
}

const tokenSchema = z.string().guid();

export interface ReservaCancelable {
  estado: string;
  fecha: string;
  hora: string;
  personas: number;
  clienteNombre: string | null;
  empresaNombre: string;
  /** true si ya no se puede cancelar (ya pasó, o ya estaba cancelada). */
  bloqueada: boolean;
  motivoBloqueo: string | null;
  /** Aviso de cargo si cancela fuera del plazo de la política. */
  avisoPolitica: { horas: number; importe: number } | null;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Datos de la reserva para pintar la pantalla de confirmación. */
export async function obtenerReservaPorToken(
  token: string,
): Promise<Result<ReservaCancelable>> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Enlace no válido." };

  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select(
        "id, empresa_id, estado, fecha, hora, personas, cliente_nombre, politica_cancelacion_snapshot",
      )
      .eq("cancelacion_token", parsed.data)
      .maybeSingle();
    if (!r) return { ok: false, error: "No encontramos esa reserva." };

    const { data: emp } = await admin
      .from("empresas")
      .select("nombre, config_operativa")
      .eq("id", r.empresa_id as string)
      .maybeSingle();

    // Zona horaria de los ajustes de la empresa: toda comparación de "ya pasó"
    // debe hacerse en la hora real del restaurante, no en la del servidor.
    const tz = tzDeEmpresa(emp?.config_operativa);

    const estado = r.estado as string;
    const motivo = motivoNoCancelable(
      estado,
      r.fecha as string,
      r.hora as string,
      tz,
    );

    return {
      ok: true,
      data: {
        estado,
        fecha: r.fecha as string,
        hora: (r.hora as string).slice(0, 5),
        personas: (r.personas as number) ?? 1,
        clienteNombre: (r.cliente_nombre as string | null) ?? null,
        empresaNombre: (emp?.nombre as string | undefined) ?? "el restaurante",
        bloqueada: motivo !== null,
        motivoBloqueo: motivo,
        avisoPolitica: calcularAvisoPolitica(
          r.politica_cancelacion_snapshot as Record<string, unknown> | null,
          r.fecha as string,
          r.hora as string,
          tz,
        ),
      },
    };
  } catch (err) {
    console.error("[cancelar-publica][obtener]", err);
    return { ok: false, error: "No pudimos cargar la reserva." };
  }
}

export async function cancelarReservaPorToken(
  token: string,
): Promise<Result<{ cancelada: true }>> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Enlace no válido." };

  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select("id, empresa_id, estado, fecha, hora, personas, turno, external_origen")
      .eq("cancelacion_token", parsed.data)
      .maybeSingle();
    if (!r) return { ok: false, error: "No encontramos esa reserva." };

    const estado = r.estado as string;
    if (estado === "CANCELADA") {
      // Ya estaba cancelada: para el cliente no es un error, es lo que quería.
      return { ok: true, data: { cancelada: true } };
    }

    const { data: empTz } = await admin
      .from("empresas")
      .select("config_operativa")
      .eq("id", r.empresa_id as string)
      .maybeSingle();

    // Se revalida en servidor con el MISMO criterio que la pantalla: entre que
    // el cliente abre el enlace y pulsa el botón, la mesa puede haberse sentado
    // o marcado como no presentada.
    const motivo = motivoNoCancelable(
      estado,
      r.fecha as string,
      r.hora as string,
      tzDeEmpresa(empTz?.config_operativa),
    );
    if (motivo) return { ok: false, error: motivo };

    // El UPDATE libera la mesa (deja de ocupar) y dispara los triggers:
    // `liberar_slot_on_cancel` devuelve el cupo del turno — así la plaza vuelve
    // a estar a la venta en la web Y en Google — y `enfilar_google_notif`
    // encola el aviso al canal si la reserva vino de ahí.
    const { error } = await admin
      .from("reservas")
      .update({ estado: "CANCELADA", updated_at: new Date().toISOString() })
      .eq("id", r.id as string);
    if (error) {
      console.error("[cancelar-publica][update]", error);
      return { ok: false, error: "No pudimos cancelar la reserva." };
    }

    // Correo de cancelación. Va DENTRO de su propio try: la reserva ya está
    // cancelada y la mesa liberada, así que un fallo aquí no puede acabar
    // diciéndole al cliente que no se canceló — volvería a intentarlo o
    // llamaría al restaurante para algo que ya está hecho.
    try {
      const { enviarReservaEmail } = await import("@/lib/email/reservas/mailer");
      void enviarReservaEmail(r.id as string, "CANCELACION").catch((e) =>
        console.error("[cancelar-publica] mail CANCELACION:", e),
      );
    } catch (e) {
      console.error("[cancelar-publica] no se pudo cargar el mailer:", e);
    }

    return { ok: true, data: { cancelada: true } };
  } catch (err) {
    console.error("[cancelar-publica][cancelar]", err);
    return { ok: false, error: "No pudimos cancelar la reserva." };
  }
}

/**
 * ¿La reserva ya pasó, en la hora REAL del restaurante?
 *
 * `fecha`/`hora` son hora local de la empresa. `new Date("2026-08-19T21:00")`
 * las interpretaría en la zona del proceso (UTC en Vercel), desplazando la
 * comparación 1-2 h: en la franja de madrugada el cliente recibía "esta reserva
 * ya ha pasado" para una reserva que todavía no había ocurrido, y perdía la
 * mesa como no-show. Convertimos a UTC con la zona de la empresa.
 */
function esPasada(fecha: string, hora: string, tz: string): boolean {
  const ts = Date.parse(zonaLocalAUtcISO(fecha, hora.slice(0, 5), tz));
  if (Number.isNaN(ts)) return false;
  return ts < Date.now();
}

/**
 * Por qué NO se puede cancelar, con el motivo CONCRETO. Un "no se puede"
 * genérico deja al cliente sin saber si ha fallado la web o pasa algo con su
 * reserva, y acaba llamando igualmente al restaurante.
 *
 * El ORDEN importa: el estado manda sobre la hora. Si la mesa ya está sentada
 * o se marcó como no presentada, eso es lo que hay que decirle — no que "ya ha
 * empezado", que sería cierto pero no explica nada.
 *
 * Devuelve null si la reserva SÍ se puede cancelar.
 */
function motivoNoCancelable(
  estado: string,
  fecha: string,
  hora: string,
  tz: string,
): string | null {
  switch (estado) {
    case "CANCELADA":
      return "Esta reserva ya está cancelada. No tienes que hacer nada más.";
    case "NO_SHOW":
      return "Esta reserva no se puede cancelar porque se ha marcado como no presentada. Si crees que es un error, llama al restaurante.";
    case "WALK_IN":
    case "TERMINANDO":
      return "Esta reserva no se puede cancelar porque la mesa ya está sentada.";
    case "LIBERADA":
      return "Esta reserva ya no está activa. Si necesitas algo, llama al restaurante.";
  }
  // Ha llegado su hora: la mesa está guardada y el servicio en marcha.
  if (esPasada(fecha, hora, tz)) {
    return "Tu reserva ya está en curso y no se puede cancelar online. Si no puedes venir, llama al restaurante.";
  }
  return null;
}

/**
 * Si la reserva tiene política y se cancela dentro de la ventana de cargo,
 * se avisa ANTES de confirmar. No cobramos aquí: solo informamos, que es lo
 * que el cliente aceptó al reservar.
 */
function calcularAvisoPolitica(
  snapshot: Record<string, unknown> | null,
  fecha: string,
  hora: string,
  tz: string,
): { horas: number; importe: number } | null {
  if (!snapshot) return null;
  const horas = Number(snapshot.horas_antes ?? snapshot.cancelacion_horas_antes ?? 0);
  const importe = Number(snapshot.importe_eur ?? snapshot.cancelacion_importe_eur ?? 0);
  if (!(horas > 0) || !(importe > 0)) return null;

  // Misma corrección que en `esPasada`: con la zona del servidor el cálculo se
  // desviaba 1-2 h y el aviso de cargo se mostraba (o se omitía) cuando no tocaba.
  const ts = Date.parse(zonaLocalAUtcISO(fecha, hora.slice(0, 5), tz));
  if (Number.isNaN(ts)) return null;
  const faltanHoras = (ts - Date.now()) / 3_600_000;
  return faltanHoras < horas ? { horas, importe } : null;
}
