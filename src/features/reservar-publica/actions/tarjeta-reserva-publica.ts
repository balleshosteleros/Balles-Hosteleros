"use server";

/**
 * Paso de tarjeta del portal de reservas (PRP-082 fase 2).
 *
 * Cuando una reserva cumple las condiciones de alguna política, el cliente
 * pasa por el formulario de Revolut antes de que la reserva quede en firme.
 *
 * ⚠️ Los números de la tarjeta NUNCA llegan aquí: el formulario lo pinta
 * Revolut en su propio dominio y nos devuelve un identificador. Con él se
 * cobra desde el software; sin él no se puede hacer nada.
 *
 * El acceso va por `garantia_token`, un secreto por reserva: con el id de la
 * reserva no basta, así nadie puede pagar (ni mirar) reservas ajenas.
 */

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { getCredencialesRevolut } from "@/features/ajustes/actions/revolut-config-actions";
import {
  crearOrden,
  obtenerOrden,
  estaRetenida,
  estaPagada,
  tarjetaDeOrden,
} from "@/lib/revolut/merchant";
import { notificarReservaCreada } from "@/lib/email/reservas/notificar-creada";

const tokenSchema = z.string().guid();

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface TarjetaPendiente {
  reservaId: string;
  empresaNombre: string;
  empresaId: string;
  fecha: string;
  hora: string;
  personas: number;
  clienteNombre: string | null;
  /** Qué política la exige, con su importe. Puede haber las dos. */
  /**
   * Cada política con lo que el cliente necesita saber para decidir: cuánto,
   * con cuánta antelación puede cancelar sin pagar, y si el importe es por
   * reserva o por comensal (para poder enseñarle la cuenta hecha).
   */
  garantia: { importe: number; horasAntes: number; porComensal: boolean } | null;
  cancelacion: { importe: number; horasAntes: number; porComensal: boolean } | null;
  /** true cuando ya no hay nada que hacer: la tarjeta ya está puesta. */
  resuelta: boolean;
}

/**
 * Datos para pintar la pantalla de "necesitamos tu tarjeta".
 *
 * Devuelve solo lo justo para explicar el cargo: ni el correo del cliente ni
 * su teléfono, que no hacen falta para decidir si se paga.
 */
export async function obtenerTarjetaPendiente(
  token: string,
): Promise<Result<TarjetaPendiente>> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Enlace no válido." };

  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select(
        "id, empresa_id, estado, fecha, hora, personas, cliente_nombre, tiene_garantia, garantia_importe, garantia_estado, tiene_cancelacion, cancelacion_importe, cancelacion_estado",
      )
      .eq("garantia_token", parsed.data)
      .maybeSingle();
    if (!r) return { ok: false, error: "No encontramos esa reserva." };

    if (r.estado === "CANCELADA") {
      return { ok: false, error: "Esta reserva ya está cancelada." };
    }

    const { data: emp } = await admin
      .from("empresas")
      .select("nombre")
      .eq("id", r.empresa_id as string)
      .maybeSingle();

    const { data: cfg } = await admin
      .from("empresa_reservas_config")
      .select("cancelacion_horas_antes, cancelacion_modo, garantia_horas_antes, garantia_modo")
      .eq("empresa_id", r.empresa_id as string)
      .maybeSingle();

    const garantiaHecha = r.garantia_estado === "retenida" || r.garantia_estado === "cobrada";
    const cancelacionHecha =
      r.cancelacion_estado === "guardada" || r.cancelacion_estado === "cobrada";

    const pideGarantia = Boolean(r.tiene_garantia) && !garantiaHecha;
    const pideCancelacion = Boolean(r.tiene_cancelacion) && !cancelacionHecha;

    return {
      ok: true,
      data: {
        reservaId: r.id as string,
        empresaId: r.empresa_id as string,
        empresaNombre: (emp?.nombre as string | undefined) ?? "el restaurante",
        fecha: r.fecha as string,
        hora: (r.hora as string).slice(0, 5),
        personas: (r.personas as number) ?? 1,
        clienteNombre: (r.cliente_nombre as string | null) ?? null,
        garantia: pideGarantia
          ? {
              importe: Number(r.garantia_importe ?? 0),
              horasAntes: Number(cfg?.garantia_horas_antes ?? 24),
              porComensal: cfg?.garantia_modo === "comensal",
            }
          : null,
        cancelacion: pideCancelacion
          ? {
              importe: Number(r.cancelacion_importe ?? 0),
              horasAntes: Number(cfg?.cancelacion_horas_antes ?? 24),
              porComensal: cfg?.cancelacion_modo === "comensal",
            }
          : null,
        resuelta: !pideGarantia && !pideCancelacion,
      },
    };
  } catch (err) {
    console.error("[tarjeta-reserva][obtener]", err);
    return { ok: false, error: "No pudimos cargar la reserva." };
  }
}

/**
 * Abre el pago en Revolut y devuelve la URL donde el cliente mete su tarjeta.
 *
 * La GARANTÍA retiene el importe (`retener: true`): el dinero queda bloqueado
 * y solo se mueve si el restaurante lo captura. La CANCELACIÓN no retiene
 * nada: guarda la tarjeta para poder cobrar más adelante.
 *
 * Cuando la reserva lleva las dos, manda la garantía: es la más estricta, y
 * pedir dos tarjetas seguidas al mismo cliente sería absurdo.
 */
export async function iniciarPagoTarjeta(token: string): Promise<
  Result<{ tokenPago: string; entorno: "produccion" | "pruebas" }>
> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Enlace no válido." };

  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select(
        "id, empresa_id, estado, cliente_nombre, cliente_apellidos, cliente_email, cliente_telefono, fecha, hora, tiene_garantia, garantia_importe, garantia_estado, tiene_cancelacion, cancelacion_importe, cancelacion_estado",
      )
      .eq("garantia_token", parsed.data)
      .maybeSingle();
    if (!r) return { ok: false, error: "No encontramos esa reserva." };
    if (r.estado === "CANCELADA") {
      return { ok: false, error: "Esta reserva ya está cancelada." };
    }

    const retiene =
      Boolean(r.tiene_garantia) &&
      r.garantia_estado !== "retenida" &&
      r.garantia_estado !== "cobrada";
    const guarda =
      Boolean(r.tiene_cancelacion) &&
      r.cancelacion_estado !== "guardada" &&
      r.cancelacion_estado !== "cobrada";

    if (!retiene && !guarda) {
      return { ok: false, error: "Esta reserva ya tiene la tarjeta puesta." };
    }

    const importe = retiene
      ? Number(r.garantia_importe ?? 0)
      : Number(r.cancelacion_importe ?? 0);
    if (!(importe > 0)) {
      return { ok: false, error: "Esta reserva no tiene importe que cobrar." };
    }

    const cred = await getCredencialesRevolut(r.empresa_id as string);
    if (!cred) {
      // Sin pasarela no se puede pedir la tarjeta. La reserva sigue en pie: el
      // restaurante la pedirá por teléfono.
      return {
        ok: false,
        error: "El pago con tarjeta no está disponible ahora mismo.",
      };
    }

    const { data: emp } = await admin
      .from("empresas")
      .select("nombre")
      .eq("id", r.empresa_id as string)
      .maybeSingle();
    const nombreEmpresa = (emp?.nombre as string | undefined) ?? "Reserva";

    const orden = await crearOrden({
      secretKey: cred.secretKey,
      entorno: cred.entorno,
      importe,
      // La referencia identifica QUÉ política se está pagando: el webhook la
      // usa para saber qué columnas actualizar.
      referencia: `${retiene ? "garantia" : "cancelacion"}:${r.id as string}`,
      // Lo que el cliente lee en la pasarela: no está pagando una compra, está
      // dejando su tarjeta para una reserva.
      descripcion: retiene
        ? `Garantía de reserva · ${nombreEmpresa}`
        : `Tarjeta de la reserva · ${nombreEmpresa}`,
      cliente: {
        email: (r.cliente_email as string | null) ?? undefined,
        nombre: [r.cliente_nombre, r.cliente_apellidos].filter(Boolean).join(" ") || undefined,
        telefono: (r.cliente_telefono as string | null) ?? undefined,
      },
      redirectUrl: `${getSiteUrl()}/reserva/tarjeta/${parsed.data}?estado=vuelta`,
      // SIEMPRE retener, nunca cobrar. Ninguna de las dos políticas cobra al
      // reservar: la garantía retiene el importe, y la cancelación solo quiere
      // quedarse con la tarjeta para poder cobrar si el cliente no aparece.
      //
      // Sin esto, la cancelación creaba una orden de cobro inmediato y al
      // cliente le salía "Pagar 1 €" — cobrándole de verdad por reservar.
      retener: true,
    });

    if (!orden.ok) {
      console.error("[tarjeta-reserva] revolut:", orden.error);
      return { ok: false, error: "No se pudo iniciar el pago. Inténtalo de nuevo." };
    }

    // El widget se monta con el TOKEN de la orden, no con su página alojada:
    // así el formulario de tarjeta se pinta en nuestra pantalla, sin el
    // "Pagar X €" de Revolut ni sus botones de Revolut Pay.
    const tokenPago = orden.orden.token;
    if (!tokenPago) {
      return { ok: false, error: "Revolut no devolvió el pago." };
    }

    const prefijo = retiene ? "garantia" : "cancelacion";
    await admin
      .from("reservas")
      .update({
        [`${prefijo}_revolut_order_id`]: orden.orden.id,
        [`${prefijo}_estado`]: "pendiente",
        ...(retiene && orden.orden.capture_deadline
          ? { garantia_capture_deadline: orden.orden.capture_deadline }
          : {}),
      })
      .eq("id", r.id as string);

    return { ok: true, data: { tokenPago, entorno: cred.entorno } };
  } catch (err) {
    console.error("[tarjeta-reserva][iniciar]", err);
    return { ok: false, error: "No pudimos iniciar el pago." };
  }
}

/**
 * Confirma el resultado al volver el cliente de Revolut.
 *
 * No basta con el webhook: si tarda o se pierde, el cliente vería "pendiente"
 * después de haber pagado. Aquí se le pregunta directamente a Revolut.
 */
export async function confirmarPagoTarjeta(token: string): Promise<
  Result<{ confirmada: boolean }>
> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Enlace no válido." };

  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select(
        "id, empresa_id, garantia_revolut_order_id, garantia_estado, cancelacion_revolut_order_id, cancelacion_estado",
      )
      .eq("garantia_token", parsed.data)
      .maybeSingle();
    if (!r) return { ok: false, error: "No encontramos esa reserva." };

    const cred = await getCredencialesRevolut(r.empresa_id as string);
    if (!cred) return { ok: false, error: "No pudimos comprobar el pago." };

    let confirmada = false;

    for (const prefijo of ["garantia", "cancelacion"] as const) {
      const orderId = r[`${prefijo}_revolut_order_id`] as string | null;
      const estado = r[`${prefijo}_estado`] as string | null;
      if (!orderId || estado === "cobrada") continue;
      // Ya resuelto por el webhook: no hay nada que preguntar.
      if (estado === "retenida" || estado === "guardada") {
        confirmada = true;
        continue;
      }

      const res = await obtenerOrden(cred.secretKey, cred.entorno, orderId);
      if (!res.ok) continue;

      // La garantía se queda RETENIDA (autorizada sin capturar); la
      // cancelación cobra 0 € y lo que importa es que la tarjeta quedó
      // guardada, así que cualquiera de los dos estados vale.
      const vale =
        prefijo === "garantia"
          ? estaRetenida(res.orden.state)
          : estaRetenida(res.orden.state) || estaPagada(res.orden.state);
      if (!vale) continue;

      const tarjeta = tarjetaDeOrden(res.orden);
      await admin
        .from("reservas")
        .update({
          [`${prefijo}_estado`]: prefijo === "garantia" ? "retenida" : "guardada",
          [`${prefijo}_${prefijo === "garantia" ? "retenida" : "guardada"}_at`]:
            new Date().toISOString(),
          [`${prefijo}_tarjeta_ultimos4`]: tarjeta?.last_four ?? null,
          [`${prefijo}_tarjeta_marca`]: tarjeta?.brand ?? null,
          ...(prefijo === "garantia" && res.orden.capture_deadline
            ? { garantia_capture_deadline: res.orden.capture_deadline }
            : {}),
        })
        .eq("id", r.id as string);
      confirmada = true;
    }

    // Pagada: deja de ser provisional y pasa a ser una reserva de verdad.
    // Hasta aquí solo apartaba la mesa; ahora ya sale en la lista de Sala.
    if (confirmada) {
      await admin
        .from("reservas")
        .update({ provisional_hasta: null })
        .eq("id", r.id as string);
    }

    // Ahora sí: la reserva está completa, así que sale su confirmación. El
    // alta la retuvo a propósito para no decir "confirmada" mientras al
    // cliente aún le quedaba pagar.
    if (confirmada) {
      notificarReservaCreada(r.id as string).catch((e) =>
        console.error("[tarjeta-reserva] mail CONFIRMACION:", e),
      );
    }

    return { ok: true, data: { confirmada } };
  } catch (err) {
    console.error("[tarjeta-reserva][confirmar]", err);
    return { ok: false, error: "No pudimos comprobar el pago." };
  }
}
