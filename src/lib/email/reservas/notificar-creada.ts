import { createAdminClient } from "@/lib/supabase/admin";
import { enviarReservaEmail } from "./mailer";

/**
 * Correo de confirmación de una reserva recién creada, sea cual sea su origen:
 * Sala (back office), formulario público o Google (RwG).
 *
 * Existe aparte de `notificarReservaCreadaPorEmail` (features/sala) porque
 * aquélla resuelve el contexto con la sesión del usuario, y ni el formulario
 * público ni el booking server de Google tienen sesión. Aquí se usa el cliente
 * admin, que funciona en los tres casos.
 *
 * Encadena RECONFIRMACION cuando la reserva entra con menos antelación que el
 * lead time configurado y la empresa tiene el envío inmediato activado; si no,
 * la dispara el cron a su hora.
 *
 * Nunca lanza: un fallo de correo no puede tumbar una reserva ya creada.
 */
export async function notificarReservaCreada(
  reservaId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await enviarReservaEmail(reservaId, "CONFIRMACION");
    if (!res.ok) {
      console.error("[reservas][notificarReservaCreada] CONFIRMACION:", res.error);
    }

    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservas")
      .select("empresa_id, fecha, hora")
      .eq("id", reservaId)
      .maybeSingle();
    if (!r?.fecha || !r?.hora || !r?.empresa_id) return { ok: res.ok };

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
      await enviarReservaEmail(reservaId, "RECONFIRMACION").catch((e) =>
        console.error("[reservas][notificarReservaCreada] RECONFIRMACION:", e),
      );
    }
    return { ok: res.ok };
  } catch (err) {
    console.error("[reservas][notificarReservaCreada] fatal:", err);
    return { ok: false, error: "No se pudo enviar el correo de confirmación." };
  }
}
