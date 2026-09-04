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
import {
  capturarOrden,
  liberarOrden,
  cobrarTarjetaGuardada,
} from "@/lib/revolut/merchant";

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
  "id, empresa_id, cliente_nombre, tiene_garantia, garantia_importe, garantia_estado, garantia_revolut_order_id, garantia_capture_deadline, tiene_cancelacion, cancelacion_importe, cancelacion_estado, cancelacion_revolut_order_id, cancelacion_customer_id, cancelacion_payment_method_id, cancelacion_intentos, cobro_perdonado_at";

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

    // Sin correo: las condiciones ya se le dieron por escrito en la
    // confirmación de la reserva, y el aviso de que no se presentó o de que
    // canceló salió en su correo de estado. Mandar aquí la plantilla de
    // condiciones le repetía por tercera vez lo mismo, y encima después de
    // haberle cobrado.

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

    if (r.cancelacion_estado === "desconocida") {
      return {
        ok: false,
        error:
          "Hay un cobro lanzado del que no sabemos el resultado. Se está comprobando con Revolut: no se cobra otra vez hasta saberlo.",
      };
    }

    const importe = Number(r.cancelacion_importe ?? 0);
    if (!(importe > 0)) return { ok: false, error: "No hay importe que cobrar." };

    // ── Tope duro ────────────────────────────────────────────────────
    //
    // Lo que ya se movió por esta reserva, contando devoluciones. Nunca se
    // cobra por encima del importe de la política: sin esto, cada llamada era
    // un cargo nuevo y se podía cobrar al cliente tantas veces como se
    // pulsara el botón.
    const { data: previos } = await admin
      .from("reserva_cobros")
      .select("importe, estado")
      .eq("reserva_id", reservaId)
      .eq("concepto", "cancelacion")
      .in("estado", ["cobrado", "lanzado", "desconocido", "devuelto"]);

    const yaMovido = (previos ?? []).reduce(
      (suma, c) => suma + Number(c.importe ?? 0),
      0,
    );
    if (yaMovido >= importe) {
      return {
        ok: false,
        error: `Ya se ha cobrado ${yaMovido.toFixed(2).replace(".", ",")} € de los ${importe.toFixed(2).replace(".", ",")} € de la política. No se cobra de más.`,
      };
    }
    const aCobrar = Math.min(importe - yaMovido, importe);

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

    // Aquí NO hay dinero retenido: la política de cancelación solo guardó la
    // tarjeta. Así que se cobra ahora, sin el cliente delante, contra el
    // método de pago que dejó guardado.
    const customerId = r.cancelacion_customer_id as string | null;
    const paymentMethodId = r.cancelacion_payment_method_id as string | null;
    if (!customerId || !paymentMethodId) {
      return {
        ok: false,
        error: "Esta reserva no tiene tarjeta guardada: pídesela al cliente.",
      };
    }

    // ── Cerrojo + registro ANTES de mover un céntimo ──────────────────
    //
    // El doble cobro nacía de aquí: entre comprobar el estado y escribirlo
    // pasaban varios segundos —los que tarda Revolut—, y en ese hueco una
    // segunda pulsación encontraba la reserva intacta y volvía a cobrar.
    //
    // Ahora la fila se escribe PRIMERO. El índice único deja pasar solo una
    // por reserva mientras haya un cobro vivo, así que la segunda pulsación
    // choca contra la base de datos y no llega a Revolut. Y si el proceso
    // muere justo después, la fila queda como testigo de que se lanzó algo.
    const referencia = `cobro-cancelacion:${reservaId}:${intentos}`;
    const { data: registro, error: errRegistro } = await admin
      .from("reserva_cobros")
      .insert({
        empresa_id: empresaId,
        reserva_id: reservaId,
        concepto: "cancelacion",
        importe: aCobrar,
        estado: "lanzado",
        referencia,
        usuario_id: usuarioId,
      })
      .select("id")
      .single();

    if (errRegistro || !registro) {
      // Violación del índice único: ya hay un cobro en vuelo o cobrado.
      const duplicado = (errRegistro?.code ?? "") === "23505";
      if (duplicado) {
        return {
          ok: false,
          error: "Ya hay un cobro en marcha para esta reserva. Espera a que termine.",
        };
      }
      console.error("[cobro-politicas] registro:", errRegistro);
      return { ok: false, error: "No se pudo registrar el cobro; no se ha cobrado nada." };
    }

    const cobroId = registro.id as string;

    const cobro = await cobrarTarjetaGuardada({
      secretKey: cred.secretKey,
      entorno: cred.entorno,
      importe: aCobrar,
      referencia,
      descripcion: "Política de cancelación",
      customerId,
      paymentMethodId,
    });

    const ahora = new Date();

    if (!cobro.ok) {
      // ⚠️ Un error de RED no es un cobro fallido: la orden puede haber salido
      // igualmente y el dinero estar ya fuera de la tarjeta del cliente. Darlo
      // por fallido es lo que hacía que el cron lo reintentara y cobrara dos
      // veces. Se marca `desconocido` y lo resuelve el cuadre preguntando a
      // Revolut por la referencia.
      const esDeRed = /Error de red|fetch|timeout|ECONN|network/i.test(cobro.error);
      if (esDeRed) {
        await admin
          .from("reserva_cobros")
          .update({ estado: "desconocido", error: cobro.error, updated_at: ahora.toISOString() })
          .eq("id", cobroId);
        await admin
          .from("reservas")
          .update({
            cancelacion_estado: "desconocida",
            cancelacion_error: "No se pudo confirmar el cobro. Se está comprobando con Revolut.",
            cancelacion_intentos: intentos,
            cancelacion_ultimo_intento_at: ahora.toISOString(),
            cancelacion_proximo_intento_at: null,
          })
          .eq("id", reservaId);
        revalidatePath("/sala/reservas");
        return {
          ok: false,
          error:
            "No se pudo confirmar si el cobro salió. Se comprobará con Revolut antes de volver a intentarlo.",
        };
      }

      // Rechazo explícito de Revolut: aquí sí sabemos que no se cobró.
      await admin
        .from("reserva_cobros")
        .update({ estado: "fallido", error: cobro.error, updated_at: ahora.toISOString() })
        .eq("id", cobroId);
    }

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

    // Revolut confirmó el movimiento: queda escrito en el registro con su id
    // de orden, que es lo que permite comprobarlo más tarde y cuadrarlo.
    await admin
      .from("reserva_cobros")
      .update({
        estado: "cobrado",
        revolut_order_id: cobro.orden.id,
        revolut_estado: String(cobro.orden.state),
        comprobado_at: ahora.toISOString(),
        updated_at: ahora.toISOString(),
      })
      .eq("id", cobroId);

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

    // Sin correo, por lo mismo que en la garantía: las condiciones viven en la
    // confirmación de la reserva.

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
