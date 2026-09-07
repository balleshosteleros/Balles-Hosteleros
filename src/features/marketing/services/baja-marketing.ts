/**
 * Baja de los correos comerciales.
 *
 * ── Por qué el token se firma en vez de guardarse ──────────────────────────
 * Un correo mensual a nueve mil personas necesita nueve mil enlaces de baja
 * distintos, y guardarlos supondría una tabla que crece con cada envío para algo
 * que se usa una vez. El token lleva dentro a quién da de baja y una firma que
 * solo puede haber hecho el servidor: se verifica sin consultar nada.
 *
 * La baja afecta SOLO al correo: es de donde sale el enlace. Y deja fecha, que
 * es lo que separa a quien dijo que no de quien nunca fue preguntado.
 *
 * ── Por qué la baja no pide confirmación ───────────────────────────────────
 * El cliente que pulsa "darme de baja" ya ha decidido. Una pantalla de "¿seguro?"
 * no le retiene, le enfada, y el siguiente correo lo marca como spam — que es
 * mucho más caro que perder una dirección: arrastra la reputación del dominio y
 * acaba mandando a no deseados también las confirmaciones de reserva.
 *
 * El pepper se comparte con las firmas (`FIRMA_TOKEN_PEPPER`), pero el mensaje
 * va prefijado por su uso, así que un token de baja nunca vale como token de
 * firma ni al revés.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const PEPPER_ENV = "FIRMA_TOKEN_PEPPER";
/** Distingue este uso de cualquier otro que firme con el mismo pepper. */
const DOMINIO_FIRMA = "baja-marketing:v1:";

function pepper(): string {
  const v = process.env[PEPPER_ENV];
  if (!v || v.length < 16) {
    throw new Error(
      `[baja-marketing] Falta env ${PEPPER_ENV} (mínimo 16 caracteres). Configúralo en .env.local y en Vercel.`,
    );
  }
  return v;
}

function firmar(clienteId: string): string {
  return createHmac("sha256", pepper())
    .update(DOMINIO_FIRMA + clienteId)
    .digest("base64url")
    .slice(0, 32);
}

/** Token que va en el enlace del correo: identifica al cliente y va firmado. */
export function tokenDeBaja(clienteId: string): string {
  return `${clienteId}~${firmar(clienteId)}`;
}

/** Devuelve el cliente si la firma cuadra; `null` si el enlace está manipulado. */
export function clienteDeToken(token: string): string | null {
  const [clienteId, firma] = token.split("~");
  if (!clienteId || !firma) return null;
  const esperada = Buffer.from(firmar(clienteId));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length) return null;
  return timingSafeEqual(esperada, recibida) ? clienteId : null;
}

export interface ResultadoBaja {
  ok: boolean;
  /** Nombre de la empresa de la que se ha dado de baja, para la pantalla. */
  empresaNombre?: string;
  /** Slug de esa empresa, para llevar al cliente a SU pantalla de baja. */
  empresaSlug?: string;
  color?: string | null;
  isotipoUrl?: string | null;
  yaEstaba?: boolean;
}

/**
 * Da de baja. Solo apaga el permiso de marketing: el cliente sigue existiendo,
 * con sus reservas y su histórico, y sigue recibiendo la confirmación de la mesa
 * que reserve — eso no es publicidad, es el resguardo de su reserva.
 */
export async function darDeBaja(token: string): Promise<ResultadoBaja> {
  const clienteId = clienteDeToken(token);
  if (!clienteId) return { ok: false };

  const admin = createAdminClient();
  const { data: cliente } = await admin
    .from("clientes_sala")
    .select("id, empresa_id, marketing_baja_email_at")
    .eq("id", clienteId)
    .maybeSingle();
  if (!cliente) return { ok: false };

  const yaEstaba = !!cliente.marketing_baja_email_at;

  if (!yaEstaba) {
    // Se apaga el permiso Y se deja la fecha. La fecha es lo que distingue a
    // quien dijo que no de quien nunca fue preguntado, y es lo que hay que poder
    // enseñar si algún día reclama.
    //
    // Solo el correo: este enlace sale de un correo y dice "no recibir más
    // correos". Cortarle también el WhatsApp sería decidir por él en un canal
    // del que no ha dicho nada.
    await admin
      .from("clientes_sala")
      .update({
        acepta_marketing_email: false,
        marketing_baja_email_at: new Date().toISOString(),
      })
      .eq("id", clienteId);
  }

  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre, slug, color, isotipo_url, logo_url")
    .eq("id", cliente.empresa_id)
    .maybeSingle();

  return {
    ok: true,
    yaEstaba,
    empresaNombre: (empresa?.nombre as string) ?? "",
    empresaSlug: (empresa?.slug as string) ?? "",
    color: (empresa?.color as string | null) ?? null,
    isotipoUrl:
      ((empresa?.isotipo_url as string | null) || (empresa?.logo_url as string | null)) ?? null,
  };
}
