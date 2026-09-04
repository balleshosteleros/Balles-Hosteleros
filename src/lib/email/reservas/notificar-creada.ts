import { createAdminClient } from "@/lib/supabase/admin";
import {
  ZONA_HORARIA_FALLBACK,
  zonaLocalAUtcISO,
} from "@/features/empresa/lib/zona-horaria";
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
        "empresa_id, fecha, hora, es_ticket",
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

    // Las condiciones económicas NO van en correo aparte: el plazo y el importe
    // ya salen dentro de la confirmación, que es el correo que el cliente
    // guarda. Un segundo correo repetía lo mismo al mismo cliente y hacía que
    // una sola reserva llegara a la bandeja dos veces.

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

    // `fecha`/`hora` son hora local del RESTAURANTE, no del servidor: sin la
    // zona de la empresa, `new Date("...T21:00:00")` se interpretaba en la del
    // proceso (UTC en Vercel) y el cálculo se iba dos horas, justo las que
    // deciden si una reserva del borde entra o no en el envío inmediato.
    const { data: emp } = await admin
      .from("empresas")
      .select("config_operativa")
      .eq("id", r.empresa_id as string)
      .maybeSingle();
    const cfgOp = (emp?.config_operativa as Record<string, unknown> | null) ?? null;
    const tzEmpresa =
      cfgOp && typeof cfgOp.zonaHoraria === "string" && cfgOp.zonaHoraria.trim()
        ? cfgOp.zonaHoraria.trim()
        : ZONA_HORARIA_FALLBACK;

    const ts = new Date(
      zonaLocalAUtcISO(
        r.fecha as string,
        (r.hora as string).slice(0, 5),
        tzEmpresa,
      ),
    );
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
