/**
 * Cliente de la Merchant API de Revolut.
 *
 * Se usa para cobrar los productos de tipo Ticket. Cada empresa cobra con SUS
 * propias claves, así que todas las funciones reciben la clave secreta ya
 * descifrada; nunca la leen de variables de entorno.
 *
 * Doc: https://developer.revolut.com/docs/merchant/create-order
 */
import "server-only";

/** Versión de la API contra la que está escrito este cliente. */
const API_VERSION = "2024-09-01";

const BASE_URL = {
  produccion: "https://merchant.revolut.com/api",
  pruebas: "https://sandbox-merchant.revolut.com/api",
} as const;

export type RevolutEntorno = keyof typeof BASE_URL;

/** Estados que devuelve Revolut para un pedido. */
export type RevolutOrderState =
  | "PENDING"
  | "PROCESSING"
  | "AUTHORISED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

/** Datos NO sensibles de la tarjeta: sirven para identificarla, no para cobrar. */
export interface RevolutPaymentMethod {
  /** Cuatro últimos dígitos. Ojo: Revolut lo llama `last_four`, no `last4`. */
  last_four?: string;
  brand?: string;
  expiry_month?: number;
  expiry_year?: number;
}

export interface RevolutOrder {
  id: string;
  /** Token para el widget de pago incrustado. */
  token: string;
  state: RevolutOrderState;
  /** Página de pago alojada por Revolut. */
  checkout_url?: string;
  /**
   * Hasta cuándo se puede capturar una autorización. Lo calcula Revolut según
   * el comercio y la tarjeta concreta, y MANDA sobre cualquier plazo teórico:
   * en un restaurante con Visa suelen ser 5 días, con Mastercard hasta 30.
   */
  capture_deadline?: string;
  payments?: Array<{ payment_method?: RevolutPaymentMethod }>;
}

export interface CrearOrdenInput {
  secretKey: string;
  entorno: RevolutEntorno;
  /** Importe en euros (ej. 98.00). Se convierte a céntimos internamente. */
  importe: number;
  moneda?: string;
  /** Referencia nuestra para reconciliar (el id de la compra). */
  referencia: string;
  descripcion: string;
  cliente?: { email?: string; nombre?: string; telefono?: string };
  /** A dónde vuelve el cliente tras pagar. */
  redirectUrl?: string;
  /**
   * `false` (por defecto) cobra en el momento: es lo que hace un Ticket.
   *
   * `true` RETIENE sin cobrar: el dinero queda bloqueado en la cuenta del
   * cliente y solo se mueve si alguien captura después. Es lo que necesita una
   * política de garantía (PRP-082), y lo que hace un hotel al pedir la tarjeta.
   */
  retener?: boolean;
}

/**
 * Revolut trabaja en unidades menores: 98,00 € se envía como 9800.
 * Se redondea para evitar los errores de coma flotante de JavaScript
 * (98.00 * 100 puede dar 9799.999...).
 */
export function aCentimos(importe: number): number {
  return Math.round(importe * 100);
}

export function aEuros(centimos: number): number {
  return Number((centimos / 100).toFixed(2));
}

function headers(secretKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Revolut-Api-Version": API_VERSION,
  };
}

async function leerError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; code?: string };
    return body.message ?? body.code ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/**
 * Crea un pedido en Revolut y devuelve la URL donde el cliente paga.
 */
export async function crearOrden(input: CrearOrdenInput): Promise<
  { ok: true; orden: RevolutOrder } | { ok: false; error: string }
> {
  const body: Record<string, unknown> = {
    amount: aCentimos(input.importe),
    currency: input.moneda ?? "EUR",
    // "automatic" cobra al instante; "manual" solo retiene y deja el cobro
    // para más tarde (ver `retener`).
    capture_mode: input.retener ? "manual" : "automatic",
    merchant_order_ext_ref: input.referencia,
    description: input.descripcion,
  };
  if (input.retener) {
    // Una preautorización aguanta más días que una autorización normal, que es
    // justo lo que hace falta para una reserva a varios días vista.
    body.authorisation_type = "pre_authorisation";
  }

  if (input.cliente?.email) {
    body.customer = {
      email: input.cliente.email,
      ...(input.cliente.nombre ? { full_name: input.cliente.nombre } : {}),
      ...(input.cliente.telefono ? { phone: input.cliente.telefono } : {}),
    };
  }
  if (input.redirectUrl) body.redirect_url = input.redirectUrl;

  try {
    const res = await fetch(`${BASE_URL[input.entorno]}/orders`, {
      method: "POST",
      headers: headers(input.secretKey),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false, error: await leerError(res) };
    }
    const orden = (await res.json()) as RevolutOrder;
    return { ok: true, orden };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    console.error("[revolut] crearOrden:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Consulta un pedido. Se usa para confirmar el pago sin depender solo del
 * webhook: cuando el cliente vuelve de pagar, preguntamos a Revolut.
 */
export async function obtenerOrden(
  secretKey: string,
  entorno: RevolutEntorno,
  orderId: string,
): Promise<{ ok: true; orden: RevolutOrder } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE_URL[entorno]}/orders/${orderId}`, {
      headers: headers(secretKey),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: await leerError(res) };
    const orden = (await res.json()) as RevolutOrder;
    return { ok: true, orden };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    console.error("[revolut] obtenerOrden:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Cobra de verdad una retención: mueve el dinero que estaba bloqueado.
 *
 * ⚠️ Solo se puede capturar UNA vez por orden. Si se captura menos del importe
 * retenido, el resto se libera para siempre y ya no se puede cobrar. Por eso
 * aquí no se admite importe parcial: se cobra lo retenido, o no se cobra.
 */
export async function capturarOrden(
  secretKey: string,
  entorno: RevolutEntorno,
  orderId: string,
): Promise<{ ok: true; orden: RevolutOrder } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE_URL[entorno]}/orders/${orderId}/capture`, {
      method: "POST",
      headers: headers(secretKey),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: await leerError(res) };
    const orden = (await res.json()) as RevolutOrder;
    return { ok: true, orden };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    console.error("[revolut] capturarOrden:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Suelta una retención sin cobrar nada: el dinero vuelve al cliente de
 * inmediato, no en los días que tarda una devolución.
 */
export async function liberarOrden(
  secretKey: string,
  entorno: RevolutEntorno,
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE_URL[entorno]}/orders/${orderId}/cancel`, {
      method: "POST",
      headers: headers(secretKey),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: await leerError(res) };
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    console.error("[revolut] liberarOrden:", msg);
    return { ok: false, error: msg };
  }
}

/** Los datos de la tarjeta que se pueden enseñar, si Revolut los devolvió. */
export function tarjetaDeOrden(orden: RevolutOrder): RevolutPaymentMethod | null {
  return orden.payments?.[0]?.payment_method ?? null;
}

/** El dinero está RETENIDO, a la espera de que alguien lo capture o lo suelte. */
export function estaRetenida(state: RevolutOrderState): boolean {
  return state === "AUTHORISED";
}

/** El pago está cobrado de verdad. */
export function estaPagada(state: RevolutOrderState): boolean {
  return state === "COMPLETED" || state === "AUTHORISED";
}

/**
 * Comprueba la firma de un webhook de Revolut.
 *
 * Revolut firma `v1.{timestamp}.{cuerpo}` con HMAC-SHA256 y el secreto de
 * firma. Se compara en tiempo constante para no filtrar información.
 * Doc: https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/verify-the-payload-signature
 */
export async function firmaWebhookValida(params: {
  signingSecret: string;
  cabeceraSignature: string;
  cabeceraTimestamp: string;
  cuerpoCrudo: string;
}): Promise<boolean> {
  const { createHmac, timingSafeEqual } = await import("crypto");

  // Rechaza reenvíos antiguos (ventana de 5 minutos).
  const ts = Number(params.cabeceraTimestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;

  const esperada = createHmac("sha256", params.signingSecret)
    .update(`v1.${params.cabeceraTimestamp}.${params.cuerpoCrudo}`)
    .digest("hex");

  // La cabecera puede traer varias firmas separadas por comas.
  return params.cabeceraSignature.split(",").some((firma) => {
    const limpia = firma.trim().replace(/^v1=/, "");
    if (limpia.length !== esperada.length) return false;
    try {
      return timingSafeEqual(Buffer.from(limpia), Buffer.from(esperada));
    } catch {
      return false;
    }
  });
}
