import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import { resolverDestinatarios } from "@/features/notificaciones/lib/targeting";
import { sendEmail } from "@/lib/email/send";
import { getSiteUrl } from "@/lib/site-url";
import type { Segmento } from "@/features/notificaciones/types";

/**
 * PRP-087 · Avisar antes de que caduque la conexión con Meta.
 *
 * El acceso que da Facebook dura unos 60 días y NO se puede renovar solo:
 * hay que volver a pulsar "Conectar con Facebook". Sin este aviso, un día la
 * publicidad deja de refrescarse y nadie se entera hasta que alguien mira la
 * pantalla y ve datos viejos — que es peor que no tener datos, porque parecen
 * buenos.
 *
 * Se avisa tres veces: siete días antes, dos días antes y el día que ya ha
 * caducado. Ni una más: un aviso que se repite cada hora se ignora.
 */

/** Cuántos días antes se avisa. El 0 es "ya ha caducado". */
const UMBRALES = [7, 2, 0] as const;

interface FilaEmpresa {
  empresa_id: string;
  token_expira_at: string | null;
  nombre_cuenta: string | null;
}

/**
 * Revisa todas las empresas conectadas y avisa a las que les toque.
 * Devuelve cuántos avisos ha lanzado.
 */
export async function avisarCaducidadesMeta(db: SupabaseClient): Promise<number> {
  const { data } = await db
    .from("empresa_meta_config")
    .select("empresa_id, token_expira_at, nombre_cuenta")
    .eq("activo", true)
    .not("token_expira_at", "is", null);

  let avisos = 0;

  for (const fila of (data ?? []) as FilaEmpresa[]) {
    if (!fila.token_expira_at) continue;

    const diasQueQuedan = Math.floor(
      (new Date(fila.token_expira_at).getTime() - Date.now()) / 86_400_000,
    );

    // El umbral más ajustado que ya se ha cruzado. Si quedan 5 días, toca el
    // aviso de 7; si quedan 1, el de 2. Así no se pierde ninguno aunque el
    // cron no se ejecute justo ese día.
    const umbral = UMBRALES.find((u) => diasQueQuedan <= u);
    if (umbral === undefined) continue;

    const enviado = await avisarUna(db, fila, diasQueQuedan, umbral);
    if (enviado) avisos += 1;
  }

  return avisos;
}

async function avisarUna(
  db: SupabaseClient,
  fila: FilaEmpresa,
  diasQueQuedan: number,
  umbral: number,
): Promise<boolean> {
  const { data: empresa } = await db
    .from("empresas")
    .select("nombre")
    .eq("id", fila.empresa_id)
    .maybeSingle<{ nombre: string | null }>();

  const nombreEmpresa = empresa?.nombre ?? "tu empresa";

  const titulo =
    diasQueQuedan < 0
      ? `La conexión de Meta de ${nombreEmpresa} ha caducado`
      : `La conexión de Meta de ${nombreEmpresa} caduca en ${diasQueQuedan} día(s)`;

  const mensaje =
    diasQueQuedan < 0
      ? "Los anuncios de Facebook e Instagram han dejado de actualizarse. Entra en Ajustes → Integraciones → Meta y vuelve a conectar la cuenta. Lo que esté en marcha sigue corriendo en Meta; lo que se ha parado es que el software se entere."
      : "Cuando caduque, el software dejará de traer el gasto y los resultados de los anuncios. Entra en Ajustes → Integraciones → Meta y vuelve a conectar la cuenta.";

  const segmento = await segmentoMarketing(db, fila.empresa_id);

  // Una sola vez por empresa, caducidad y umbral: si se reconecta, cambia la
  // fecha de caducidad y la clave es otra, así que el ciclo vuelve a empezar
  // solo. Si no se reconecta, no vuelve a insistir con el mismo aviso.
  const dedupeKey = `meta_caducidad:${fila.empresa_id}:${fila.token_expira_at}:${umbral}`;

  const res = await emitirNotificacion({
    empresaId: fila.empresa_id,
    system: true,
    tipo: "alerta",
    titulo,
    mensaje,
    segmento,
    dedupeKey,
    accionUrl: "/ajustes?tab=integraciones",
    accionLabel: "Reconectar",
    payload: { origen: "meta_caducidad", cuenta: fila.nombre_cuenta, dias: diasQueQuedan },
  });

  // Si no ha creado ninguna, o ya se avisó (dedupe) o no hay a quién avisar:
  // en ninguno de los dos casos hay que mandar el correo.
  if (!res.ok || res.creadas === 0) return false;

  await enviarCorreo(db, fila.empresa_id, segmento, titulo, mensaje);
  return true;
}

/**
 * A quién se avisa: al departamento de Marketing, que es quien lleva la
 * publicidad. Si esa empresa no tiene departamento de Marketing, se avisa al
 * área administrativa entera antes que dejar el aviso sin destinatario.
 */
async function segmentoMarketing(db: SupabaseClient, empresaId: string): Promise<Segmento> {
  const { data } = await db
    .from("departamentos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("nombre", "MARKETING")
    .eq("estado", "Activo")
    .maybeSingle<{ id: string }>();

  if (data?.id) return { tipo: "departamento", departamentoId: data.id };
  return { tipo: "area", area: "ADMINISTRATIVA" };
}

/** El mismo aviso por correo, a las personas que han recibido la notificación. */
async function enviarCorreo(
  db: SupabaseClient,
  empresaId: string,
  segmento: Segmento,
  titulo: string,
  mensaje: string,
): Promise<void> {
  try {
    const destinatarios = await resolverDestinatarios(db, empresaId, segmento);
    if (destinatarios.length === 0) return;

    const { data: usuarios } = await db
      .from("usuarios")
      .select("email")
      .in("id", destinatarios.map((d) => d.usuarioId));

    const correos = (usuarios ?? [])
      .map((u) => (u as { email: string | null }).email)
      .filter((e): e is string => Boolean(e && e.includes("@")));

    if (correos.length === 0) return;

    const enlace = `${getSiteUrl()}/ajustes?tab=integraciones`;
    const html = `
      <p>${mensaje}</p>
      <p><a href="${enlace}">Ir a Ajustes → Integraciones</a></p>
    `;

    // Uno a uno, nunca en copia: cada persona recibe el suyo y no ve los
    // correos de los demás.
    for (const correo of correos) {
      await sendEmail({ to: correo, subject: titulo, html, empresaId });
    }
  } catch (err) {
    // El correo es el refuerzo; la notificación ya ha entrado. Que falle el
    // envío no puede tumbar el cron entero.
    console.error("[meta] no se pudo enviar el aviso de caducidad por correo:", err);
  }
}
