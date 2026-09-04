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

/**
 * Estados que devuelve Revolut para un pedido.
 *
 * ⚠️ Revolut los manda en MINÚSCULAS ("completed", "authorised"), aunque su
 * documentación los escriba en mayúsculas. Se aceptan las dos formas y se
 * comparan siempre con `estaPagada`/`estaRetenida`, nunca con `===`: una
 * comparación directa contra "COMPLETED" no casa nunca y deja el pago como no
 * confirmado aunque el cliente haya pagado.
 */
export type RevolutOrderState =
  | "PENDING"
  | "PROCESSING"
  | "AUTHORISED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "pending"
  | "processing"
  | "authorised"
  | "completed"
  | "cancelled"
  | "failed";

/**
 * Datos NO sensibles de la tarjeta: sirven para identificarla, no para cobrar.
 *
 * ⚠️ Revolut usa el prefijo `card_` en la respuesta real (`card_last_four`,
 * `card_brand`), no `last_four`/`brand`. Se leen con `tarjetaDeOrden`, que ya
 * normaliza los dos nombres; no se acceden a mano.
 */
export interface RevolutPaymentMethod {
  /** Referencia del método guardado: con ella se cobra más adelante. */
  id?: string;
  /** Cuatro últimos dígitos. */
  card_last_four?: string;
  card_brand?: string;
  card_expiry?: string;
  /** Nombres antiguos, por si alguna versión de la API los devuelve así. */
  last_four?: string;
  brand?: string;
}

/** La tarjeta ya normalizada, con los nombres que usamos nosotros. */
export interface TarjetaGuardada {
  id: string | null;
  ultimos4: string | null;
  marca: string | null;
}

export interface RevolutOrder {
  id: string;
  /** Token para el widget de pago incrustado. */
  token: string;
  state: RevolutOrderState;
  /**
   * ⚠️ `payment` (cobro) o `refund` (devolución). Una devolución también llega
   * en estado `completed`, así que sin mirar ESTE campo se cuenta como si
   * hubiera entrado dinero cuando en realidad salió. Se lee siempre con
   * `resultadoDeOrden`, nunca a ojo.
   */
  type?: string;
  /** Importe en céntimos. */
  amount?: number;
  /** Céntimos ya devueltos de esta orden: el neto real es `amount` menos esto. */
  refunded_amount?: number;
  /** Nuestra referencia, la que se mandó al crear la orden. */
  merchant_order_ext_ref?: string;
  /** Página de pago alojada por Revolut. */
  checkout_url?: string;
  /**
   * Hasta cuándo se puede capturar una autorización. Lo calcula Revolut según
   * el comercio y la tarjeta concreta, y MANDA sobre cualquier plazo teórico:
   * en un restaurante con Visa suelen ser 5 días, con Mastercard hasta 30.
   */
  capture_deadline?: string;
  /** Cliente en Revolut. Necesario para cobrar una tarjeta guardada. */
  customer?: { id?: string };
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
  /**
   * Cliente que YA existe en Revolut. Es imprescindible para cobrar una
   * tarjeta guardada: sin él Revolut no relaciona el método de pago con nadie
   * y rechaza el cobro con el código 1022.
   */
  clienteId?: string;
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

/**
 * Códigos de error de Revolut en cristiano.
 *
 * Revolut devuelve `{"code": 1022}` a secas, sin mensaje. Ese número acababa
 * tal cual en la ficha de la reserva, y quien lo leía se lo explicaba como
 * podía —normalmente "no tiene fondos"—, que casi nunca es lo que pasa. Un
 * cobro que falla obliga a decidir algo, así que tiene que decir POR QUÉ.
 */
const MENSAJES_ERROR: Record<string, string> = {
  "1000": "La tarjeta ha sido rechazada por el banco.",
  "1001": "El banco del cliente ha denegado el pago.",
  "1002": "La tarjeta no admite este tipo de cobro.",
  "1003": "Tarjeta caducada.",
  "1004": "Los datos de la tarjeta no son correctos.",
  "1005": "El banco pide que el cliente autorice el pago.",
  "1006": "El cliente no tiene saldo suficiente.",
  "1007": "Se ha superado el límite de la tarjeta.",
  "1008": "La tarjeta está bloqueada.",
  "1022": "La tarjeta guardada no se puede cobrar: falta vincularla a su cliente en Revolut.",
};

async function leerError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; code?: string | number };
    const code = body.code !== undefined ? String(body.code) : null;
    // El mensaje propio manda; el código solo traduce cuando viene solo.
    if (body.message) return code ? `${body.message} (${code})` : body.message;
    if (code) return MENSAJES_ERROR[code] ?? `Revolut rechazó el cobro (código ${code}).`;
    return `HTTP ${res.status}`;
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

  // Un cliente ya conocido se referencia por su id; uno nuevo se describe por
  // sus datos. Mandar las dos cosas a la vez haría que Revolut creara un
  // cliente duplicado y el cobro volvería a fallar.
  if (input.clienteId) {
    body.customer = { id: input.clienteId };
  } else if (input.cliente?.email) {
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
 * Busca órdenes por NUESTRA referencia (`merchant_order_ext_ref`).
 *
 * Es la pieza que convierte un "no sé si se cobró" en una respuesta. Cuando la
 * llamada de cobro se pierde a medias —timeout, corte de red— el dinero puede
 * haber salido igualmente: la única forma de saberlo con certeza es
 * preguntárselo a Revolut por la referencia que le mandamos al lanzarlo.
 *
 * Nunca se deduce un cobro. Se comprueba.
 */
export async function buscarOrdenesPorReferencia(
  secretKey: string,
  entorno: RevolutEntorno,
  referencia: string,
): Promise<{ ok: true; ordenes: RevolutOrder[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${BASE_URL[entorno]}/orders?merchant_order_ext_ref=${encodeURIComponent(referencia)}`,
      { headers: headers(secretKey), cache: "no-store" },
    );
    if (!res.ok) return { ok: false, error: await leerError(res) };
    const cuerpo = (await res.json()) as { orders?: RevolutOrder[] } | RevolutOrder[];
    // Revolut envuelve el listado en `{ orders: [...] }`, aunque algunas
    // versiones devuelven el array pelado. Se aceptan las dos formas.
    const ordenes = Array.isArray(cuerpo) ? cuerpo : (cuerpo.orders ?? []);
    return { ok: true, ordenes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    console.error("[revolut] buscarOrdenesPorReferencia:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Lista los movimientos del comercio en un periodo. Lo usa el cuadre diario.
 *
 * ⚠️ La fecha tiene que ir en ISO 8601 COMPLETO (con hora y zona). Con solo
 * "2026-09-01" Revolut responde un 400 de validación.
 */
export async function listarOrdenes(
  secretKey: string,
  entorno: RevolutEntorno,
  desdeISO: string,
): Promise<{ ok: true; ordenes: RevolutOrder[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${BASE_URL[entorno]}/orders?from_created_date=${encodeURIComponent(desdeISO)}&limit=100`,
      { headers: headers(secretKey), cache: "no-store" },
    );
    if (!res.ok) return { ok: false, error: await leerError(res) };
    const cuerpo = (await res.json()) as { orders?: RevolutOrder[] } | RevolutOrder[];
    const ordenes = Array.isArray(cuerpo) ? cuerpo : (cuerpo.orders ?? []);
    return { ok: true, ordenes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    console.error("[revolut] listarOrdenes:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Qué dice Revolut que pasó con una orden, en los términos del registro.
 *
 * ⚠️ El campo `type` es imprescindible: una devolución (`refund`) también
 * llega en estado `completed`, y contarla como cobro cuadra el doble de lo que
 * se movió en realidad.
 */
export function resultadoDeOrden(
  orden: RevolutOrder,
): "cobrado" | "fallido" | "devuelto" | "en_curso" {
  const tipo = String(orden.type ?? "payment").toLowerCase();
  const estado = normalizar(orden.state);
  if (tipo === "refund") return "devuelto";
  if (estado === "completed" || estado === "authorised") return "cobrado";
  if (estado === "failed" || estado === "cancelled") return "fallido";
  return "en_curso";
}

/**
 * Lo que se ha cobrado DE VERDAD por una orden, en euros y ya neto.
 *
 * `refunded_amount` descuenta lo devuelto: una orden de 4 € reembolsada
 * entera vale 0, no 4.
 */
export function netoCobradoDeOrden(orden: RevolutOrder): number {
  const bruto = Number(orden.amount ?? 0);
  const devuelto = Number(orden.refunded_amount ?? 0);
  return Math.max(0, bruto - devuelto) / 100;
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

/**
 * Cobra una tarjeta que el cliente dejó guardada, sin que él esté delante.
 *
 * Es lo que hace la política de cancelación cuando alguien no se presenta: no
 * había dinero retenido, así que hay que ir a por él ahora. Puede fallar —sin
 * fondos, tarjeta caducada, bloqueada— y por eso se reintenta.
 *
 * Son dos pasos: se crea la orden y después se paga con el método guardado.
 */
export async function cobrarTarjetaGuardada(input: {
  secretKey: string;
  entorno: RevolutEntorno;
  importe: number;
  referencia: string;
  descripcion: string;
  customerId: string;
  paymentMethodId: string;
}): Promise<{ ok: true; orden: RevolutOrder } | { ok: false; error: string }> {
  // ⚠️ El `clienteId` NO es opcional aquí: la tarjeta guardada pertenece a ese
  // cliente de Revolut, y sin él la orden no sabe de quién es el método de
  // pago. Faltaba, y todos los cobros de no-show morían con un 1022 seco que
  // en la ficha se leía como si el cliente no tuviera fondos.
  const orden = await crearOrden({
    secretKey: input.secretKey,
    entorno: input.entorno,
    importe: input.importe,
    referencia: input.referencia,
    descripcion: input.descripcion,
    clienteId: input.customerId,
  });
  if (!orden.ok) return orden;

  try {
    const res = await fetch(
      `${BASE_URL[input.entorno]}/orders/${orden.orden.id}/payments`,
      {
        method: "POST",
        headers: headers(input.secretKey),
        body: JSON.stringify({
          saved_payment_method: {
            type: "card",
            id: input.paymentMethodId,
            // Lo lanza el comercio, no el cliente: él no está delante.
            initiator: "merchant",
          },
        }),
        cache: "no-store",
      },
    );
    if (!res.ok) return { ok: false, error: await leerError(res) };
    const pagada = (await res.json()) as RevolutOrder;
    return { ok: true, orden: pagada };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    console.error("[revolut] cobrarTarjetaGuardada:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Los datos de la tarjeta que se pueden enseñar, si Revolut los devolvió.
 *
 * Acepta los dos juegos de nombres (`card_last_four` y `last_four`) para no
 * quedarse a ciegas si la API cambia de forma.
 */
export function tarjetaDeOrden(orden: RevolutOrder): TarjetaGuardada | null {
  const pm = orden.payments?.[0]?.payment_method;
  if (!pm) return null;
  return {
    id: pm.id ?? null,
    ultimos4: pm.card_last_four ?? pm.last_four ?? null,
    marca: pm.card_brand ?? pm.brand ?? null,
  };
}

/** Revolut manda los estados en minúsculas; se comparan siempre así. */
function normalizar(state: RevolutOrderState): string {
  return String(state).toLowerCase();
}

/** El dinero está RETENIDO, a la espera de que alguien lo capture o lo suelte. */
export function estaRetenida(state: RevolutOrderState): boolean {
  return normalizar(state) === "authorised";
}

/**
 * El pago está resuelto a favor: cobrado, o autorizado a la espera de captura.
 *
 * Una orden de 0 € (la política de cancelación, que solo guarda la tarjeta)
 * termina en `completed` aunque se pidiera en modo retención: no hay importe
 * que retener.
 */
export function estaPagada(state: RevolutOrderState): boolean {
  const s = normalizar(state);
  return s === "completed" || s === "authorised";
}

/** Aviso de pagos dado de alta en Revolut. */
export interface RevolutWebhook {
  id: string;
  url: string;
  events: string[];
  /** Secreto de firma. Revolut SOLO lo devuelve al crearlo. */
  signing_secret?: string;
}

/**
 * Sucesos a los que nos suscribimos.
 *
 * Los dos primeros confirman el cobro y disparan el envío del código; los dos
 * últimos devuelven el stock cuando alguien empieza a pagar y no termina.
 */
export const EVENTOS_WEBHOOK = [
  "ORDER_COMPLETED",
  "ORDER_AUTHORISED",
  "ORDER_CANCELLED",
  "ORDER_PAYMENT_FAILED",
] as const;

/** Webhooks ya dados de alta en la cuenta. */
export async function listarWebhooks(
  secretKey: string,
  entorno: RevolutEntorno,
): Promise<{ ok: true; webhooks: RevolutWebhook[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE_URL[entorno]}/1.0/webhooks`, {
      headers: headers(secretKey),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: await leerError(res) };
    return { ok: true, webhooks: (await res.json()) as RevolutWebhook[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    console.error("[revolut] listarWebhooks:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Da de alta el aviso de pagos.
 *
 * El panel de Revolut NO permite crear webhooks de la Merchant API a mano, así
 * que sin esto cada restaurante necesitaría a un técnico. El secreto de firma
 * solo se devuelve aquí: si se pierde, hay que renovarlo o rehacer el alta.
 */
export async function crearWebhook(
  secretKey: string,
  entorno: RevolutEntorno,
  url: string,
): Promise<{ ok: true; webhook: RevolutWebhook } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE_URL[entorno]}/1.0/webhooks`, {
      method: "POST",
      headers: headers(secretKey),
      body: JSON.stringify({ url, events: [...EVENTOS_WEBHOOK] }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: await leerError(res) };
    return { ok: true, webhook: (await res.json()) as RevolutWebhook };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    console.error("[revolut] crearWebhook:", msg);
    return { ok: false, error: msg };
  }
}

/** Da de baja un aviso. Se usa al rehacer uno que apuntaba a otra dirección. */
export async function borrarWebhook(
  secretKey: string,
  entorno: RevolutEntorno,
  webhookId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL[entorno]}/1.0/webhooks/${webhookId}`, {
      method: "DELETE",
      headers: headers(secretKey),
      cache: "no-store",
    });
    if (!res.ok && res.status !== 404) return { ok: false, error: await leerError(res) };
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    console.error("[revolut] borrarWebhook:", msg);
    return { ok: false, error: msg };
  }
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
