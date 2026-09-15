import "server-only";

/**
 * Correo de confirmación de una cita del embudo (PRP-088).
 *
 * Lo manda el SOFTWARE, con la marca de la empresa. Antes el único aviso que
 * recibía quien reservaba era el que Google envía al invitarle al evento: si
 * Google fallaba —o si el calendario no tiene cuenta designada— la persona se
 * quedaba sin nada aunque su cita estuviera guardada. Google es el espejo,
 * nunca la fuente.
 *
 * Va DESPUÉS de crear el evento en Google, para poder meter el enlace de la
 * videollamada en el correo. Si el evento no llegó a crearse, el correo sale
 * igual: sin enlace, diciendo que se enviará después.
 *
 * Nunca lanza: un fallo de correo no puede tumbar una cita ya reservada.
 */
import { sendEmail, direccionRemitente } from "@/lib/email/send";
import { citaConfirmacionEmail } from "@/lib/email/citas/confirmacion";
import { construirIcs } from "@/lib/email/citas/ics";
import { getSiteUrl } from "@/lib/site-url";
import { datosCitaParaCorreo, ciudadDeZona } from "./datos-cita";

export async function notificarCitaConfirmada(
  citaId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const datos = await datosCitaParaCorreo(citaId);
    if (!datos) return { ok: false, error: "Cita no encontrada." };

    // Sin correo no hay a quién escribir, y no es un error: una cita puede
    // haberse apuntado desde dentro sin dirección.
    if (!datos.emailCliente) return { ok: true };

    // Enlace propio de esta cita: es por donde la persona puede anularla sin
    // tener que escribir a nadie (el buzón que firma no se lee).
    const urlGestion = datos.tokenGestion
      ? `${getSiteUrl()}/cita/${datos.tokenGestion}`
      : null;

    const { subject, html, text } = citaConfirmacionEmail({
      empresa: datos.marca,
      calendario: datos.calendario,
      clienteNombre: datos.nombreCliente,
      fechaLarga: datos.fechaLarga,
      hora: datos.hora,
      duracionMin: datos.duracionMin,
      ciudadZona: ciudadDeZona(datos.zona),
      conQuien: datos.conQuien,
      meetUrl: datos.meetUrl,
      urlGestion,
    });

    // `REQUEST` (no `PUBLISH`) y dentro del correo (no como adjunto): es lo que
    // hace que la cita entre sola en el calendario de quien reserva. Como
    // adjunto llegaba un archivo inerte que había que abrir a mano.
    const ics = construirIcs({
      uid: `cita-${citaId}@balleshosteleros.com`,
      inicioISO: datos.inicioISO,
      finISO: datos.finISO,
      titulo: datos.tituloEvento,
      descripcion: datos.meetUrl,
      url: datos.meetUrl,
      metodo: "REQUEST",
      organizador: { nombre: datos.marca.nombre || null, email: direccionRemitente() },
      asistente: { nombre: datos.nombreCliente || null, email: datos.emailCliente },
    });

    const res = await sendEmail({
      to: datos.emailCliente,
      subject,
      html,
      text,
      empresaId: datos.empresaId,
      // El correo pinta su propia cabecera de marca, como los de Sala.
      brandHeader: false,
      icalEvent: { method: "REQUEST", filename: "cita.ics", content: ics },
    });

    if (!res.ok) {
      const motivo = "error" in res ? res.error : "transporte de correo sin configurar";
      console.error("[citas][notificar] no enviado:", motivo);
      return { ok: false, error: motivo };
    }
    return { ok: true };
  } catch (err) {
    console.error("[citas][notificar] fatal:", err);
    return { ok: false, error: "No se pudo enviar la confirmación." };
  }
}
