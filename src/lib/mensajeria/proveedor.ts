/**
 * Contrato del proveedor de mensajería.
 *
 * Todo el resto del módulo habla con ESTA interfaz, nunca con Twilio
 * directamente. Es lo que permite cambiar de proveedor tocando un archivo en
 * lugar del módulo entero: si mañana compensa ir directos a Meta, se escribe
 * otra implementación y se cambia la línea que elige cuál se usa.
 */

import type { CanalMensajeria } from "@/features/mensajeria/data/monedero";

/** Credenciales de la subcuenta de una empresa, ya descifradas. */
export interface CredencialesProveedor {
  subcuentaId: string;
  token: string;
  /** Remitente de WhatsApp, en E.164 (+34…). */
  whatsappNumero: string | null;
  /** Remitente de SMS. Puede ser distinto del de WhatsApp. */
  smsNumero: string | null;
}

/**
 * Un WhatsApp de empresa fuera de la ventana de 24 h solo puede ir como
 * plantilla aprobada por Meta: `plantilla` es su nombre y `variables` los
 * huecos que rellena, en orden.
 *
 * El SMS no tiene esa restricción y usa `texto`.
 */
export interface MensajeAEnviar {
  canal: CanalMensajeria;
  /** Destinatario en E.164. */
  para: string;
  /** Solo WhatsApp: nombre de la plantilla aprobada. */
  plantilla?: string;
  /** Solo WhatsApp: valores de la plantilla, en orden. */
  variables?: string[];
  /** Solo SMS: el texto tal cual sale. */
  texto?: string;
}

export type ResultadoEnvio =
  | { ok: true; proveedorMensajeId: string }
  | {
      ok: false;
      /** Código del proveedor, para poder distinguir causas después. */
      codigo: string | null;
      error: string;
      /**
       * true si reintentar por otro canal tiene sentido (el número no tiene
       * WhatsApp, por ejemplo). false si el problema es nuestro —
       * credenciales mal, plantilla sin aprobar— y el SMS fallaría igual.
       */
      reintentable: boolean;
    };

export interface ProveedorMensajeria {
  /** Nombre corto, para poder trazar quién envió qué. */
  readonly nombre: string;
  enviar(
    credenciales: CredencialesProveedor,
    mensaje: MensajeAEnviar,
  ): Promise<ResultadoEnvio>;
}

/**
 * Normaliza un teléfono a E.164 (+34…), que es lo único que aceptan los
 * proveedores. Devuelve null si no hay forma de interpretarlo.
 *
 * Los teléfonos de las reservas los teclea gente con prisa: llegan con
 * espacios, guiones y unas veces con prefijo y otras sin él.
 */
export function normalizarTelefono(
  bruto: string | null | undefined,
  prefijoPais = "34",
): string | null {
  if (!bruto) return null;

  // Fuera todo lo que no sea dígito, salvo un '+' inicial que sí significa algo.
  const limpio = bruto.trim().replace(/[^\d+]/g, "");
  if (!limpio) return null;

  if (limpio.startsWith("+")) {
    const digitos = limpio.slice(1);
    return digitos.length >= 8 && digitos.length <= 15 ? `+${digitos}` : null;
  }

  // "0034…" y "34…" son la misma forma de escribir el prefijo sin el '+'.
  if (limpio.startsWith("00")) {
    const digitos = limpio.slice(2);
    return digitos.length >= 8 && digitos.length <= 15 ? `+${digitos}` : null;
  }

  // Nacional de 9 dígitos: se le antepone el prefijo del país.
  if (limpio.length === 9) return `+${prefijoPais}${limpio}`;

  // Ya trae el prefijo pegado (34 + 9 dígitos).
  if (limpio.length === 11 && limpio.startsWith(prefijoPais)) return `+${limpio}`;

  return null;
}
