import { createAdminClient } from "@/lib/supabase/admin";
import { enviarReservaEmail, type ReservaEmailActor } from "./mailer";

/**
 * Correo de confirmación de una reserva recién creada, sea cual sea su origen:
 * Sala (back office), formulario público o Google (RwG).
 *
 * Existe aparte de `notificarReservaCreadaPorEmail` (features/sala) porque
 * aquélla resuelve el contexto con la sesión del usuario, y ni el formulario
 * público ni el booking server de Google tienen sesión. Aquí se usa el cliente
 * admin, que funciona en los tres casos.
 *
 * Encadena además, en este orden:
 *   · POLITICA_CANCELACION / POLITICA_GARANTIA si la reserva queda sujeta a
 *     ellas. Van en correo aparte porque son un compromiso económico: el
 *     cliente tiene que poder encontrarlas después sin rebuscar dentro de la
 *     confirmación.
 *   · RECONFIRMADA cuando la reserva entra con menos antelación que el lead
 *     time configurado y la empresa tiene el envío inmediato activado; si no,
 *     la dispara el cron a su hora.
 *
 * Nunca lanza: un fallo de correo no puede tumbar una reserva ya creada.
 *
 * `origen` marca de dónde vino la reserva en el histórico de correos: aquí no
 * hay ninguna persona del software detrás, así que no hay firma que poner.
 */
export async function notificarReservaCreada(
  reservaId: string,
  origen: ReservaEmailActor["origen"] = "PORTAL_PUBLICO",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor: ReservaEmailActor = { origen };
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select(
        "empresa_id, fecha, hora, tipo_categoria, tiene_garantia, garantia_importe, es_ticket",
      )
      .eq("id", reservaId)
      .maybeSingle();

    // Una reserva hecha con un ticket ya pagado no es una confirmación
    // cualquiera: el cliente necesita ver que su compra está aplicada a ESTA
    // fecha. Por eso tiene su propia plantilla y sustituye a la de confirmada;
    // mandar las dos sería decirle lo mismo dos veces.
    const tipoBienvenida = r?.es_ticket === true ? "TICKET_RESERVA" : "CONFIRMADA";
    const res = await enviarReservaEmail(reservaId, tipoBienvenida, { actor });
    if (!res.ok) {
      console.error(`[reservas][notificarReservaCreada] ${tipoBienvenida}:`, res.error);
    }

    if (!r?.fecha || !r?.hora || !r?.empresa_id) return { ok: res.ok };

    // Condiciones económicas, cada una en su correo. Si la plantilla está
    // pausada por la empresa, el mailer lo corta solo: aquí no hay que
    // comprobar nada más que si la reserva queda sujeta a ellas.
    if (r.tipo_categoria === "politica") {
      await enviarReservaEmail(reservaId, "POLITICA_CANCELACION", { actor }).catch(
        (e) => console.error("[reservas][notificarReservaCreada] POLITICA_CANCELACION:", e),
      );
    }
    if (r.tiene_garantia === true && Number(r.garantia_importe ?? 0) > 0) {
      await enviarReservaEmail(reservaId, "POLITICA_GARANTIA", { actor }).catch(
        (e) => console.error("[reservas][notificarReservaCreada] POLITICA_GARANTIA:", e),
      );
    }

    const { data: cfg } = await admin
      .from("empresa_reservas_config")
      .select(
        "reconfirmacion_activa, reconfirmacion_dias_antes, reconfirmacion_envio_inmediato",
      )
      .eq("empresa_id", r.empresa_id as string)
      .maybeSingle();

    const activa = cfg?.reconfirmacion_activa === true;
    const envioInmediato = cfg?.reconfirmacion_envio_inmediato === true;
    if (!activa || !envioInmediato) return { ok: res.ok };

    const diasAntes = (cfg?.reconfirmacion_dias_antes as number | null) ?? 1;
    const ts = new Date(`${r.fecha as string}T${(r.hora as string).slice(0, 5)}:00`);
    const diffMs = ts.getTime() - Date.now();
    const leadMs = diasAntes * 24 * 3600 * 1000;
    if (diffMs > 0 && diffMs < leadMs) {
      await enviarReservaEmail(reservaId, "RECONFIRMADA", { actor }).catch((e) =>
        console.error("[reservas][notificarReservaCreada] RECONFIRMADA:", e),
      );
    }
    return { ok: res.ok };
  } catch (err) {
    console.error("[reservas][notificarReservaCreada] fatal:", err);
    return { ok: false, error: "No se pudo enviar el correo de confirmación." };
  }
}
