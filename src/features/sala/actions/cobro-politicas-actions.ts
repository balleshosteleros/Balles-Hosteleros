"use server";

/**
 * Cobro de las políticas de tarjeta desde la ficha de reserva (PRP-082 §5.3).
 *
 * Dos caminos muy distintos:
 *
 *   · GARANTÍA — el dinero ya está retenido, así que capturarlo casi nunca
 *     falla. Es de UN SOLO disparo: Revolut no deja capturar dos veces, y lo
 *     que no se capture se libera para siempre.
 *   · CANCELACIÓN — va contra una tarjeta guardada y puede fallar por falta de
 *     fondos. Por eso lleva reintentos diarios (§5.5).
 *
 * Nada de esto se ejecuta solo cuando el restaurante marca la reserva: el
 * aviso propone y decide una persona, porque puede haber un motivo que el
 * software no conoce.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCredencialesRevolut } from "@/features/ajustes/actions/revolut-config-actions";
import { capturarOrden, liberarOrden, crearOrden } from "@/lib/revolut/merchant";
import { enviarReservaEmail } from "@/lib/email/reservas/mailer";

type Result<T = void> =
  | ({ ok: true } & (T extends void ? Record<string, never> : T))
  | { ok: false; error: string };

async function getCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, empresaId: null, usuarioId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  const { data } = await supabase
    .from("usuarios")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  return { supabase, empresaId, usuarioId: (data?.id as string | undefined) ?? null };
}

/** Columnas que necesita cualquier operación de cobro. */
const COLS =
  "id, empresa_id, cliente_nombre, tiene_garantia, garantia_importe, garantia_estado, garantia_revolut_order_id, garantia_capture_deadline, tiene_cancelacion, cancelacion_importe, cancelacion_estado, cancelacion_revolut_order_id, cancelacion_intentos, cobro_perdonado_at";

/**
 * Cobra la GARANTÍA: captura el dinero que ya estaba retenido.
 *
 * ⚠️ Irreversible desde el software. Una devolución se hace en Revolut.
 */
export async function cobrarGarantia(reservaId: string): Promise<Result> {
  try {
    const { empresaId, usuarioId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select(COLS)
      .eq("id", reservaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!r) return { ok: false, error: "Reserva no encontrada" };

    if (r.garantia_estado === "cobrada") {
      return { ok: false, error: "Esta garantía ya está cobrada." };
    }
    if (r.garantia_estado !== "retenida") {
      return { ok: false, error: "Esta reserva no tiene ningún importe retenido." };
    }
    const orderId = r.garantia_revolut_order_id as string | null;
    if (!orderId) return { ok: false, error: "No hay retención que cobrar." };

    // El plazo lo pone la tarjeta del cliente, no nosotros: si ya pasó, el
    // banco ha soltado el dinero y capturar solo daría un error críptico.
    const deadline = r.garantia_capture_deadline as string | null;
    if (deadline && Date.parse(deadline) < Date.now()) {
      await admin
        .from("reservas")
        .update({ garantia_estado: "caducada" })
        .eq("id", reservaId);
      return {
        ok: false,
        error: "La retención ha caducado: el banco ya devolvió el dinero al cliente.",
      };
    }

    const cred = await getCredencialesRevolut(empresaId);
    if (!cred) return { ok: false, error: "Revolut no está configurado." };

    const res = await capturarOrden(cred.secretKey, cred.entorno, orderId);
    if (!res.ok) {
      console.error("[cobro-politicas] capturar:", res.error);
      return { ok: false, error: `No se pudo cobrar: ${res.error}` };
    }

    await admin
      .from("reservas")
      .update({
        garantia_estado: "cobrada",
        garantia_cobrada_at: new Date().toISOString(),
        garantia_cobrada_por: usuarioId,
      })
      .eq("id", reservaId);

    // El correo sale AHORA, con el dinero ya movido: nunca antes (§5.7).
    enviarReservaEmail(reservaId, "POLITICA_GARANTIA", {
      actor: { usuarioId, origen: "MANUAL" },
    }).catch((e) => console.error("[cobro-politicas] mail garantía:", e));

    revalidatePath("/sala/reservas");
    return { ok: true } as Result;
  } catch (err) {
    console.error("[cobro-politicas] cobrarGarantia:", err);
    return { ok: false, error: "No se pudo cobrar la garantía." };
  }
}

/**
 * Suelta la retención sin cobrar: el cliente vino, o se le perdona.
 * El dinero vuelve al instante, no en los días de una devolución.
 */
export async function liberarGarantia(reservaId: string): Promise<Result> {
  try {
    const { empresaId, usuarioId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select(COLS)
      .eq("id", reservaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!r) return { ok: false, error: "Reserva no encontrada" };

    if (r.garantia_estado === "cobrada") {
      return { ok: false, error: "Ya se cobró: la devolución se hace en Revolut." };
    }
    const orderId = r.garantia_revolut_order_id as string | null;
    if (!orderId || r.garantia_estado !== "retenida") {
      return { ok: false, error: "No hay ninguna retención que liberar." };
    }

    const cred = await getCredencialesRevolut(empresaId);
    if (!cred) return { ok: false, error: "Revolut no está configurado." };

    const res = await liberarOrden(cred.secretKey, cred.entorno, orderId);
    if (!res.ok) {
      console.error("[cobro-politicas] liberar:", res.error);
      return { ok: false, error: `No se pudo liberar: ${res.error}` };
    }

    await admin
      .from("reservas")
      .update({
        garantia_estado: "liberada",
        garantia_cobrada_por: usuarioId,
        cobro_perdonado_at: new Date().toISOString(),
        cobro_perdonado_por: usuarioId,
      })
      .eq("id", reservaId);

    revalidatePath("/sala/reservas");
    return { ok: true } as Result;
  } catch (err) {
    console.error("[cobro-politicas] liberarGarantia:", err);
    return { ok: false, error: "No se pudo liberar la garantía." };
  }
}

/**
 * Cobra la CANCELACIÓN contra la tarjeta guardada.
 *
 * A diferencia de la garantía, aquí no hay dinero apartado: puede fallar por
 * falta de fondos. Si falla, se programa el siguiente intento y NO se avisa al
 * cliente (§5.7: solo se le escribe de un cobro que ocurrió de verdad).
 */
export async function cobrarCancelacion(reservaId: string): Promise<Result> {
  const { empresaId, usuarioId } = await getCtx();
  if (!empresaId) return { ok: false, error: "No autenticado" };
  return ejecutarCobroCancelacion(reservaId, empresaId, usuarioId);
}

/**
 * El intento de cobro en sí. Vive aparte porque lo usan dos sitios: el botón
 * de la ficha y el cron de reintentos, que no tiene sesión de usuario.
 */
export async function ejecutarCobroCancelacion(
  reservaId: string,
  empresaId: string,
  usuarioId: string | null,
): Promise<Result> {
  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select(COLS)
      .eq("id", reservaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!r) return { ok: false, error: "Reserva no encontrada" };

    if (r.cancelacion_estado === "cobrada") {
      return { ok: false, error: "Esta cancelación ya está cobrada." };
    }
    if (r.cancelacion_estado !== "guardada" && r.cancelacion_estado !== "fallida") {
      return { ok: false, error: "Esta reserva no tiene tarjeta guardada." };
    }

    const importe = Number(r.cancelacion_importe ?? 0);
    if (!(importe > 0)) return { ok: false, error: "No hay importe que cobrar." };

    const cred = await getCredencialesRevolut(empresaId);
    if (!cred) return { ok: false, error: "Revolut no está configurado." };

    const { data: cfg } = await admin
      .from("empresa_reservas_config")
      .select("cancelacion_reintento_activo, cancelacion_reintentos_max, cancelacion_reintento_hora")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    const intentos = Number(r.cancelacion_intentos ?? 0) + 1;
    const maxIntentos = Number(cfg?.cancelacion_reintentos_max ?? 5);
    const reintentaSolo = cfg?.cancelacion_reintento_activo !== false;

    // El cobro va contra la tarjeta que el cliente dejó guardada. Revolut la
    // reconoce por el mismo cliente de la orden original.
    const cobro = await crearOrden({
      secretKey: cred.secretKey,
      entorno: cred.entorno,
      importe,
      referencia: `cobro-cancelacion:${reservaId}:${intentos}`,
      descripcion: "Política de cancelación",
    });

    const ahora = new Date();

    if (!cobro.ok) {
      // Falló: se apunta el motivo y, si quedan intentos, cuándo es el
      // siguiente. Al cliente NO se le escribe nada.
      const quedanIntentos = reintentaSolo && intentos < maxIntentos;
      await admin
        .from("reservas")
        .update({
          cancelacion_estado: "fallida",
          cancelacion_error: cobro.error,
          cancelacion_intentos: intentos,
          cancelacion_ultimo_intento_at: ahora.toISOString(),
          cancelacion_proximo_intento_at: quedanIntentos
            ? proximoIntento(cfg?.cancelacion_reintento_hora as string | null).toISOString()
            : null,
        })
        .eq("id", reservaId);

      revalidatePath("/sala/reservas");
      return {
        ok: false,
        error: quedanIntentos
          ? `No se pudo cobrar (intento ${intentos} de ${maxIntentos}). Se volverá a intentar mañana.`
          : `No se pudo cobrar y no quedan más intentos: ${cobro.error}`,
      };
    }

    await admin
      .from("reservas")
      .update({
        cancelacion_estado: "cobrada",
        cancelacion_cobrada_at: ahora.toISOString(),
        cancelacion_cobrada_por: usuarioId,
        cancelacion_intentos: intentos,
        cancelacion_ultimo_intento_at: ahora.toISOString(),
        cancelacion_proximo_intento_at: null,
        cancelacion_error: null,
      })
      .eq("id", reservaId);

    // Ahora sí: el dinero se movió, así que se le cuenta al cliente.
    enviarReservaEmail(reservaId, "POLITICA_CANCELACION", {
      actor: { usuarioId, origen: "MANUAL" },
    }).catch((e) => console.error("[cobro-politicas] mail cancelación:", e));

    revalidatePath("/sala/reservas");
    return { ok: true } as Result;
  } catch (err) {
    console.error("[cobro-politicas] cobrarCancelacion:", err);
    return { ok: false, error: "No se pudo cobrar." };
  }
}

/**
 * Deja de intentar cobrar una cancelación. No cobra ni devuelve nada: solo
 * apaga los reintentos y deja constancia de quién lo decidió.
 */
export async function renunciarCobroCancelacion(reservaId: string): Promise<Result> {
  try {
    const { empresaId, usuarioId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const admin = createAdminClient();
    const { error } = await admin
      .from("reservas")
      .update({
        cancelacion_proximo_intento_at: null,
        cobro_perdonado_at: new Date().toISOString(),
        cobro_perdonado_por: usuarioId,
      })
      .eq("id", reservaId)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    revalidatePath("/sala/reservas");
    return { ok: true } as Result;
  } catch (err) {
    console.error("[cobro-politicas] renunciar:", err);
    return { ok: false, error: "No se pudo guardar la decisión." };
  }
}

/**
 * Alguien vio el aviso al marcar no-show o cancelada y eligió no cobrar.
 * Queda registrado: perdonar un cobro es una decisión, no un descuido.
 */
export async function perdonarCobro(reservaId: string): Promise<Result> {
  try {
    const { empresaId, usuarioId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const admin = createAdminClient();
    const { error } = await admin
      .from("reservas")
      .update({
        cobro_perdonado_at: new Date().toISOString(),
        cobro_perdonado_por: usuarioId,
        cancelacion_proximo_intento_at: null,
      })
      .eq("id", reservaId)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    revalidatePath("/sala/reservas");
    return { ok: true } as Result;
  } catch (err) {
    console.error("[cobro-politicas] perdonar:", err);
    return { ok: false, error: "No se pudo guardar la decisión." };
  }
}

/**
 * Mañana a la hora configurada, en la zona del servidor.
 *
 * La hora exacta no es crítica —lo que importa es que pase un día entre
 * intentos, para dar tiempo a que entre una nómina o un traspaso—, así que no
 * se resuelve la zona horaria de la empresa: el cron la respeta al ejecutarse.
 */
function proximoIntento(hora: string | null): Date {
  const [h, m] = (hora ?? "10:00").split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(Number.isFinite(h) ? h : 10, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}
