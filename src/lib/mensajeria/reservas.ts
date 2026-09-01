/**
 * Avisos de reserva por WhatsApp y SMS.
 *
 * Hermano de `src/lib/email/reservas/mailer.ts`: mismo trabajo, otro canal.
 * Carga la reserva, arma el texto y se lo pasa al orquestador, que decide
 * canal, cobra el saldo y registra lo enviado.
 *
 * Aquí NO se decide si hay saldo ni por qué canal sale: eso es de `enviar.ts`.
 * Aquí solo se decide QUÉ se dice.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { formatearFecha } from "@/lib/email/reservas/estilo";
import { enviarMensaje, type ActorMensaje, type ResultadoMensaje } from "./enviar";

/**
 * Los cuatro avisos que salen por mensajería.
 *
 * La petición de valoración NO está: pedir opinión por WhatsApp molesta y hace
 * que la gente bloquee el número. Para eso el correo ya funciona.
 */
export type AvisoReserva =
  | "CONFIRMACION"
  | "RECONFIRMACION"
  | "RECORDATORIO"
  | "CANCELACION";

/**
 * Identificador de la plantilla aprobada por Meta, por tipo de aviso.
 *
 * Fuera de las 24 h desde el último mensaje del cliente, Meta solo acepta
 * plantillas que ha revisado una a una. Se registran en el entorno y no en el
 * código porque cada empresa puede acabar teniendo las suyas.
 */
function plantillaDe(tipo: AvisoReserva): string | undefined {
  const variables: Record<AvisoReserva, string | undefined> = {
    CONFIRMACION: process.env.WHATSAPP_PLANTILLA_CONFIRMACION,
    RECONFIRMACION: process.env.WHATSAPP_PLANTILLA_RECONFIRMACION,
    RECORDATORIO: process.env.WHATSAPP_PLANTILLA_RECORDATORIO,
    CANCELACION: process.env.WHATSAPP_PLANTILLA_CANCELACION,
  };
  return variables[tipo]?.trim() || undefined;
}

/**
 * En la cancelación no se ofrece cancelar otra vez: la reserva ya no existe.
 * Misma regla que en el correo.
 */
const SIN_ENLACE_CANCELAR: AvisoReserva[] = ["CANCELACION"];

interface ReservaRow {
  empresa_id: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  fecha: string;
  hora: string;
  personas: number;
  cancelacion_token: string | null;
}

/**
 * Envía un aviso de reserva por WhatsApp (o SMS de respaldo).
 *
 * Nunca lanza: un fallo aquí no puede tumbar el cron ni impedir que se cree
 * una reserva. Quien llama decide qué hacer con el resultado — normalmente,
 * seguir adelante porque el correo ya salió.
 */
export async function enviarAvisoReserva(
  reservaId: string,
  tipo: AvisoReserva,
  options: { actor?: ActorMensaje } = {},
): Promise<ResultadoMensaje> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservas")
    .select("empresa_id, cliente_nombre, cliente_telefono, fecha, hora, personas, cancelacion_token")
    .eq("id", reservaId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, motivo: "No se encontró la reserva", caerACorreo: true };
  }

  const reserva = data as unknown as ReservaRow;

  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", reserva.empresa_id)
    .maybeSingle();

  const nombreEmpresa = (empresa?.nombre as string | null) ?? "el restaurante";

  // Solo el nombre de pila: en un mensaje corto el apellido sobra y ocupa.
  const nombreCliente = (reserva.cliente_nombre ?? "").trim().split(/\s+/)[0] || "Hola";

  const fechaLegible = formatearFecha(reserva.fecha);
  // La hora viene como "21:00:00"; al cliente le sobran los segundos.
  const horaLegible = reserva.hora.slice(0, 5);
  const personas = `${reserva.personas} ${reserva.personas === 1 ? "persona" : "personas"}`;

  // Enlace corto: el largo lleva un UUID de 36 caracteres y deja el SMS por
  // encima de 160, que es donde el precio se dobla. El código se genera la
  // primera vez y luego es siempre el mismo, para que un aviso no invalide el
  // enlace del anterior.
  let urlCancelar: string | null = null;
  if (reserva.cancelacion_token && !SIN_ENLACE_CANCELAR.includes(tipo)) {
    const { data: codigo } = await admin.rpc("codigo_cancelacion_reserva", {
      p_reserva_id: reservaId,
    });
    urlCancelar = codigo
      ? `${getSiteUrl()}/c/${codigo as string}`
      // Si el código no se pudo generar, el enlace largo sigue funcionando:
      // vale más un SMS de dos partes que un aviso sin forma de cancelar.
      : `${getSiteUrl()}/cancelar/${reserva.cancelacion_token}`;
  }

  return enviarMensaje({
    empresaId: reserva.empresa_id,
    tipo,
    telefono: reserva.cliente_telefono,
    plantillaWhatsapp: plantillaDe(tipo),
    // El orden de las variables tiene que coincidir con el de la plantilla
    // aprobada en Meta: allí son huecos numerados, no nombres.
    variables: [
      nombreCliente,
      nombreEmpresa,
      fechaLegible,
      horaLegible,
      personas,
      urlCancelar ?? "",
    ],
    textoSms: textoSms({
      tipo,
      nombreCliente,
      nombreEmpresa,
      fechaLegible,
      horaLegible,
      personas,
      urlCancelar,
    }),
    reservaId,
    actor: options.actor,
  });
}

/**
 * Texto del SMS.
 *
 * Un SMS se corta a los 160 caracteres y a partir de ahí se cobra doble, así
 * que va al grano: qué reserva, cuándo, y el enlace para cancelar.
 */
function textoSms(args: {
  tipo: AvisoReserva;
  nombreCliente: string;
  nombreEmpresa: string;
  fechaLegible: string;
  horaLegible: string;
  personas: string;
  urlCancelar: string | null;
}): string {
  const { tipo, nombreCliente, nombreEmpresa, fechaLegible, horaLegible, personas, urlCancelar } =
    args;

  // La fecha larga ("lunes, 15 de junio de 2026") no cabe en un SMS.
  const fechaCorta = fechaLegible.replace(/,? de \d{4}$/, "").replace(/^\w+,\s*/, "");

  // Un nombre de restaurante muy largo se come el margen y empuja el mensaje
  // por encima de los 160 caracteres, donde pasa a costar el doble. Se recorta
  // por palabras para que siga leyéndose como un nombre y no como un truncado.
  const empresaCorta =
    nombreEmpresa.length <= 24
      ? nombreEmpresa
      : nombreEmpresa.split(/\s+/).reduce((acc, palabra) => {
          const tentativa = acc ? `${acc} ${palabra}` : palabra;
          return tentativa.length <= 24 ? tentativa : acc;
        }, "") || nombreEmpresa.slice(0, 24);

  const cabecera: Record<AvisoReserva, string> = {
    CONFIRMACION: `${nombreCliente}, reserva confirmada en ${empresaCorta}`,
    RECONFIRMACION: `${nombreCliente}, ¿confirmas tu reserva en ${empresaCorta}?`,
    RECORDATORIO: `${nombreCliente}, te esperamos hoy en ${empresaCorta}`,
    CANCELACION: `${nombreCliente}, tu reserva en ${empresaCorta} queda cancelada`,
  };

  const partes = [`${cabecera[tipo]}: ${fechaCorta} a las ${horaLegible}, ${personas}.`];

  if (urlCancelar) {
    // "Cancelar:" a secas en todos: cada palabra de más acerca el mensaje a
    // los 160 caracteres donde el SMS pasa a costar el doble.
    partes.push(`Cancelar: ${urlCancelar}`);
  }

  return partes.join(" ");
}
