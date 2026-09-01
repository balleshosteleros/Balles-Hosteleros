/**
 * Implementación de `ProveedorMensajeria` sobre Twilio.
 *
 * Se habla con su API por HTTP en vez de con su SDK: son dos llamadas y el
 * paquete pesa más que el código que lo usaría.
 *
 * Docs: https://www.twilio.com/docs/messaging/api/message-resource
 */

import type {
  CredencialesProveedor,
  MensajeAEnviar,
  ProveedorMensajeria,
  ResultadoEnvio,
} from "./proveedor";

const TWILIO_API = "https://api.twilio.com/2010-04-01";

/**
 * Códigos de Twilio en los que reintentar por otro canal tiene sentido: el
 * número no está en WhatsApp, o no acepta este tipo de mensaje. Cualquier otro
 * fallo (credenciales, plantilla sin aprobar) se repetiría igual por SMS, así
 * que no se gasta un segundo mensaje.
 *
 * https://www.twilio.com/docs/api/errors
 */
const CODIGOS_REINTENTABLES = new Set([
  "63003", // destinatario no encontrado en el canal
  "63005", // el destinatario no tiene WhatsApp
  "63016", // fuera de la ventana de 24 h sin plantilla
  "63024", // número no válido para este canal
  "21610", // el destinatario se dio de baja
]);

class TwilioProveedor implements ProveedorMensajeria {
  readonly nombre = "twilio";

  async enviar(
    credenciales: CredencialesProveedor,
    mensaje: MensajeAEnviar,
  ): Promise<ResultadoEnvio> {
    const remitente =
      mensaje.canal === "WHATSAPP"
        ? credenciales.whatsappNumero
        : credenciales.smsNumero;

    if (!remitente) {
      return {
        ok: false,
        codigo: null,
        error: `No hay número configurado para ${mensaje.canal}`,
        // Sin número no hay nada que reintentar: falta configuración.
        reintentable: false,
      };
    }

    // Twilio distingue el canal por el prefijo del número, no por un campo.
    const prefijo = mensaje.canal === "WHATSAPP" ? "whatsapp:" : "";
    const cuerpo = new URLSearchParams({
      From: `${prefijo}${remitente}`,
      To: `${prefijo}${mensaje.para}`,
    });

    if (mensaje.canal === "WHATSAPP" && mensaje.plantilla) {
      // Fuera de la ventana de 24 h Meta solo acepta plantillas aprobadas, que
      // en Twilio se envían por su identificador y sus variables numeradas.
      cuerpo.set("ContentSid", mensaje.plantilla);
      if (mensaje.variables?.length) {
        const vars: Record<string, string> = {};
        mensaje.variables.forEach((v, i) => {
          vars[String(i + 1)] = v;
        });
        cuerpo.set("ContentVariables", JSON.stringify(vars));
      }
    } else if (mensaje.texto) {
      cuerpo.set("Body", mensaje.texto);
    } else {
      return {
        ok: false,
        codigo: null,
        error: "El mensaje no lleva ni plantilla ni texto",
        reintentable: false,
      };
    }

    try {
      const auth = Buffer.from(
        `${credenciales.subcuentaId}:${credenciales.token}`,
      ).toString("base64");

      const res = await fetch(
        `${TWILIO_API}/Accounts/${credenciales.subcuentaId}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: cuerpo.toString(),
          // Un aviso de reserva que tarda más de 15 s ya no sirve: el cron
          // tiene que seguir con los demás en vez de quedarse colgado.
          signal: AbortSignal.timeout(15_000),
        },
      );

      const datos = (await res.json()) as {
        sid?: string;
        code?: number;
        message?: string;
      };

      if (!res.ok) {
        const codigo = datos.code != null ? String(datos.code) : null;
        return {
          ok: false,
          codigo,
          error: datos.message ?? `Twilio respondió ${res.status}`,
          reintentable: codigo != null && CODIGOS_REINTENTABLES.has(codigo),
        };
      }

      if (!datos.sid) {
        return {
          ok: false,
          codigo: null,
          error: "Twilio aceptó el mensaje pero no devolvió identificador",
          reintentable: false,
        };
      }

      return { ok: true, proveedorMensajeId: datos.sid };
    } catch (e) {
      // Corte de red o tiempo agotado: puede ser pasajero, así que el otro
      // canal merece el intento.
      return {
        ok: false,
        codigo: null,
        error: e instanceof Error ? e.message : "Error de red hablando con Twilio",
        reintentable: true,
      };
    }
  }
}

export const twilio: ProveedorMensajeria = new TwilioProveedor();
