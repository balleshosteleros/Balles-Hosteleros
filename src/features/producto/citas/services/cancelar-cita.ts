import "server-only";

/**
 * Anular una cita del embudo (PRP-088), venga de donde venga.
 *
 * Tres caminos acaban aquí, y los tres tienen que dejar el mismo rastro:
 *   · `CLIENTE_ENLACE`      quien reservó pulsa «No puedo ir» en su correo.
 *   · `CLIENTE_CALENDARIO`  declina la invitación desde su Google Calendar.
 *   · `EQUIPO`              alguien la cancela desde la pantalla de Citas.
 *
 * Qué pasa siempre, en este orden:
 *   1. La cita queda CANCELADA, con la fecha y quién la anuló.
 *      **El hueco se libera solo**: los huecos libres y el índice de dobles
 *      reservas solo miran las CONFIRMADAS, así que la hora vuelve a ofrecerse
 *      sin tocar nada más.
 *   2. Se borra el evento de Google, si lo había.
 *   3. Al cliente le llega la anulación con un `.ics` de tipo CANCEL, que le
 *      quita la cita del calendario igual que se la puso.
 *   4. Al equipo le salta el aviso, diciendo QUIÉN la anuló.
 *
 * Es idempotente: anular dos veces no manda dos correos.
 * Nunca lanza.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, direccionRemitente } from "@/lib/email/send";
import { citaAnuladaEmail } from "@/lib/email/citas/anulada";
import { construirIcs } from "@/lib/email/citas/ics";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import { cancelarCitaEnGoogle } from "./google-calendar";
import { datosCitaParaCorreo, ciudadDeZona } from "./datos-cita";

export type QuienAnula = "CLIENTE_ENLACE" | "CLIENTE_CALENDARIO" | "EQUIPO";

const COMO_LO_CONTAMOS: Record<QuienAnula, string> = {
  CLIENTE_ENLACE: "La ha anulado el cliente desde su correo.",
  CLIENTE_CALENDARIO: "El cliente ha rechazado la invitación en su calendario.",
  EQUIPO: "La ha anulado el equipo.",
};

export async function cancelarCita(
  citaId: string,
  quien: QuienAnula,
): Promise<{ ok: boolean; yaEstaba?: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    // Solo pasa a CANCELADA si NO lo estaba ya. Así dos pulsaciones seguidas
    // del mismo enlace no mandan dos correos ni avisan dos veces al equipo.
    const { data: actualizada } = await admin
      .from("citas")
      .update({
        estado: "CANCELADA",
        cancelada_en: new Date().toISOString(),
        cancelada_por: quien,
        updated_at: new Date().toISOString(),
      })
      .eq("id", citaId)
      .neq("estado", "CANCELADA")
      .select("id")
      .maybeSingle();

    if (!actualizada) return { ok: true, yaEstaba: true };

    // El evento en Google se quita: dejarlo sería enseñarle al comercial una
    // reunión que ya no existe.
    await cancelarCitaEnGoogle(citaId).catch((e) =>
      console.error("[citas][cancelar] google:", e),
    );

    const datos = await datosCitaParaCorreo(citaId);
    if (!datos) return { ok: true };

    // ── Al cliente ──
    if (datos.emailCliente) {
      const { subject, html, text } = citaAnuladaEmail({
        empresa: datos.marca,
        calendario: datos.calendario,
        clienteNombre: datos.nombreCliente,
        fechaLarga: datos.fechaLarga,
        hora: datos.hora,
        ciudadZona: ciudadDeZona(datos.zona),
        loAnuloElCliente: quien !== "EQUIPO",
      });

      // `CANCEL` con el MISMO uid y un `SEQUENCE` mayor: así el calendario de
      // quien reservó entiende que es la misma cita y la retira. Con un uid
      // nuevo se le quedaría la cita vieja puesta para siempre.
      const ics = construirIcs({
        uid: `cita-${citaId}@balleshosteleros.com`,
        inicioISO: datos.inicioISO,
        finISO: datos.finISO,
        titulo: datos.tituloEvento,
        metodo: "CANCEL",
        secuencia: 1,
        organizador: { nombre: datos.marca.nombre || null, email: direccionRemitente() },
        asistente: { nombre: datos.nombreCliente || null, email: datos.emailCliente },
      });

      const res = await sendEmail({
        to: datos.emailCliente,
        subject,
        html,
        text,
        empresaId: datos.empresaId,
        brandHeader: false,
        icalEvent: { method: "CANCEL", filename: "cita-anulada.ics", content: ics },
      });
      if (!res.ok) {
        console.error("[citas][cancelar] correo al cliente:", "error" in res ? res.error : "sin transporte");
      }
    }

    // ── Al equipo ──
    // Tipo `alerta`: una cita que se cae hay que verla, no enterarse el día de
    // la reunión. Con `dedupeKey` no se repite si algo reintenta.
    await emitirNotificacion({
      empresaId: datos.empresaId,
      system: true,
      tipo: "alerta",
      titulo: "Cita anulada",
      mensaje:
        `${datos.nombreCliente || "Alguien"} tenía ${datos.calendario} el ` +
        `${datos.fechaLarga} a las ${datos.hora}. ${COMO_LO_CONTAMOS[quien]} ` +
        `El hueco vuelve a estar libre.`,
      segmento: { tipo: "empresa" },
      refTabla: "citas",
      refId: citaId,
      accionUrl: "/producto/citas",
      dedupeKey: `cita-anulada:${citaId}`,
    }).catch((e) => console.error("[citas][cancelar] aviso:", e));

    return { ok: true };
  } catch (err) {
    console.error("[citas][cancelar] fatal:", err);
    return { ok: false, error: "No se pudo anular la cita." };
  }
}
