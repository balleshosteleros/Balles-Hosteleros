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
      .select("nombre")
      .eq("id", r.empresa_id as string)
      .maybeSingle();

    const estado = r.estado as string;
    const yaCancelada = (ESTADOS_NO_OCUPANTES as string[]).includes(estado);
    const pasada = esPasada(r.fecha as string, r.hora as string);

    return {
      ok: true,
      data: {
        estado,
        fecha: r.fecha as string,
        hora: (r.hora as string).slice(0, 5),
        personas: (r.personas as number) ?? 1,
        clienteNombre: (r.cliente_nombre as string | null) ?? null,
        empresaNombre: (emp?.nombre as string | undefined) ?? "el restaurante",
        bloqueada: yaCancelada || pasada,
        motivoBloqueo: yaCancelada
          ? "Esta reserva ya estaba cancelada."
          : pasada
            ? "Esta reserva ya ha pasado. Si necesitas algo, llama al restaurante."
            : null,
        avisoPolitica: calcularAvisoPolitica(
          r.politica_cancelacion_snapshot as Record<string, unknown> | null,
          r.fecha as string,
          r.hora as string,
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
    if ((ESTADOS_NO_OCUPANTES as string[]).includes(estado)) {
      // Ya estaba cancelada: no es un error para el cliente.
      return { ok: true, data: { cancelada: true } };
    }
    if (esPasada(r.fecha as string, r.hora as string)) {
      return {
        ok: false,
        error: "Esta reserva ya ha pasado y no se puede cancelar online.",
      };
    }

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

/** Fecha civil del restaurante: se compara sin zona horaria. */
function esPasada(fecha: string, hora: string): boolean {
  const ts = new Date(`${fecha}T${hora.slice(0, 5)}:00`);
  return ts.getTime() < Date.now();
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
): { horas: number; importe: number } | null {
  if (!snapshot) return null;
  const horas = Number(snapshot.horas_antes ?? snapshot.cancelacion_horas_antes ?? 0);
  const importe = Number(snapshot.importe_eur ?? snapshot.cancelacion_importe_eur ?? 0);
  if (!(horas > 0) || !(importe > 0)) return null;

  const ts = new Date(`${fecha}T${hora.slice(0, 5)}:00`).getTime();
  const faltanHoras = (ts - Date.now()) / 3_600_000;
  return faltanHoras < horas ? { horas, importe } : null;
}
