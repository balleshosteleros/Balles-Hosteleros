/**
 * Mailer genérico del módulo de Reservas.
 *
 * Único punto de entrada para TODO correo al cliente de una reserva, sea de la
 * familia que sea:
 *
 *   ESTADO   → uno por cada estado real de la reserva (confirmada, cancelada,
 *              no presentado, lista de espera…). Walk-in no está: es un origen,
 *              no un estado, y no hay a quién escribir.
 *   POLITICA → procesos que no son un cambio de estado: ticket comprado, reserva
 *              con ticket, condiciones de cancelación, condiciones de garantía,
 *              y los dos envíos por reloj (recordatorio y valoración).
 *
 * Todos comparten el MISMO marco visual —cabecera de marca, tarjeta de datos,
 * pie— y se diferencian solo en el distintivo, el titular y el cuerpo. Así el
 * cliente reconoce de un vistazo que el correo es del restaurante, y el texto
 * le dice exactamente por qué le ha llegado.
 *
 * En el cuerpo NO va ningún teléfono ni ninguna dirección de correo: el canal
 * de vuelta es siempre el enlace de gestión de la reserva.
 *
 * Server-only: usa la admin client para leer datos.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getSiteUrl } from "@/lib/site-url";
import { tipoDeReserva } from "@/features/sala/lib/tipo-reserva";
import {
  getReservaEmailPlantillaSeed,
  RESERVA_EMAIL_TIPO_LABELS,
  type ReservaEmailTipo,
} from "@/lib/seeds/reserva-email-plantillas";
import {
  AVISO_NO_REPLY,
  colorContraste,
  envolverEmail,
  escapeAttr,
  escapeHtml,
  fila,
  formatearFecha,
  formatearImporte,
  nl2br,
  primerNombre,
  sanitizarHex,
  sustituir,
  withAlpha,
} from "@/lib/email/reservas/estilo";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Columna de `reservas` donde se sella el envío. Da la idempotencia: sin ella,
 * cada vez que alguien vuelva a guardar la reserva en el mismo estado el
 * cliente recibiría otra vez el mismo aviso.
 *
 * TICKET_COMPRA no tiene: ocurre ANTES de que exista la reserva, y su sello
 * vive en `reserva_ticket_compras.email_compra_at`.
 */
const AUDIT_COL: Record<ReservaEmailTipo, string | null> = {
  // Por estado
  CONFIRMADA: "email_confirmacion_at",
  RECONFIRMADA: "email_reconfirmacion_at",
  NO_RECONFIRMADA: "email_no_reconfirmada_at",
  LISTA_ESPERA: "email_lista_espera_at",
  LIBERADA: "email_liberada_at",
  TERMINANDO: "email_terminando_at",
  NO_SHOW: "email_no_show_at",
  CANCELADA: "email_cancelacion_at",
  // Por política o proceso
  TICKET_COMPRA: null,
  TICKET_RESERVA: "email_ticket_reserva_at",
  POLITICA_CANCELACION: "email_politica_cancelacion_at",
  POLITICA_GARANTIA: "email_politica_garantia_at",
  GARANTIA_PENDIENTE: "email_garantia_pendiente_at",
  GARANTIA_SOLICITUD: "email_garantia_solicitud_at",
  GARANTIA_CADUCADA: "email_garantia_caducada_at",
  RECORDATORIO: "email_recordatorio_at",
  SOLICITUD_VALORACION: "email_valoracion_at",
};

/** Titular grande del correo: lo primero que se lee. */
const HEADLINE_POR_TIPO: Record<ReservaEmailTipo, string> = {
  CONFIRMADA: "Reserva confirmada",
  RECONFIRMADA: "Reserva reconfirmada",
  NO_RECONFIRMADA: "Tu reserva está pendiente de confirmar",
  LISTA_ESPERA: "Estás en lista de espera",
  LIBERADA: "Tu reserva se ha cerrado",
  TERMINANDO: "Tu reserva está terminando",
  NO_SHOW: "No llegaste a venir",
  CANCELADA: "Reserva cancelada",
  TICKET_COMPRA: "Compra confirmada",
  TICKET_RESERVA: "Reserva confirmada",
  POLITICA_CANCELACION: "Condiciones de cancelación",
  POLITICA_GARANTIA: "Garantía de tu reserva",
  GARANTIA_PENDIENTE: "Reserva confirmada",
  GARANTIA_SOLICITUD: "Necesitamos tu tarjeta",
  GARANTIA_CADUCADA: "Reserva cancelada",
  RECORDATORIO: "Recordatorio de tu reserva",
  SOLICITUD_VALORACION: "¿Qué tal fue?",
};

/**
 * Distintivo (píldora) sobre el titular. Dice en dos palabras QUÉ es este
 * correo, que es justo lo que el cliente busca al abrirlo entre otros diez.
 */
const BADGE_POR_TIPO: Record<ReservaEmailTipo, string> = {
  CONFIRMADA: "Reserva confirmada",
  RECONFIRMADA: "Reconfirmada",
  NO_RECONFIRMADA: "Pendiente de confirmar",
  LISTA_ESPERA: "Lista de espera",
  LIBERADA: "Reserva cerrada",
  TERMINANDO: "Terminando",
  NO_SHOW: "No presentado",
  CANCELADA: "Cancelada",
  TICKET_COMPRA: "Compra confirmada",
  // El cliente no distingue "tipos de reserva": ha reservado y su mesa está
  // confirmada, igual que cualquier otra. El ticket es asunto interno.
  TICKET_RESERVA: "Reserva confirmada",
  POLITICA_CANCELACION: "Política de cancelación",
  POLITICA_GARANTIA: "Política de garantía",
  GARANTIA_PENDIENTE: "Reserva confirmada",
  GARANTIA_SOLICITUD: "Falta tu tarjeta",
  GARANTIA_CADUCADA: "Cancelada",
  RECORDATORIO: "Recordatorio",
  SOLICITUD_VALORACION: "Tu opinión",
};

type EmpresaRow = {
  nombre: string;
  logo_url: string | null;
  isotipo_url: string | null;
  color: string | null;
  color_secundario: string | null;
  /**
   * Fijo del restaurante (Ajustes → Empresa → `telefonoPrincipal`). Cada
   * empresa tiene el suyo: el cliente de BACANAL no puede acabar llamando a
   * HABANA.
   */
  telefono?: string | null;
};

type ReservaRow = {
  cliente_nombre: string | null;
  cliente_email: string | null;
  fecha: string;
  hora: string;
  personas: number;
  zona: string | null;
  notas: string | null;
  tipo_categoria: string | null;
  tiene_garantia: boolean | null;
  garantia_importe: number | null;
  tiene_cancelacion: boolean | null;
  cancelacion_importe: number | null;
  importe_pagado: number | null;
  codigo: string | null;
  codigo_id: string | null;
  es_ticket: boolean | null;
  ticket_codigo: string | null;
  ticket_producto_id: string | null;
  ticket_unidades: number | null;
  ticket_importe: number | null;
};

type ConfigRow = {
  cancelacion_horas_antes: number | null;
  cancelacion_importe_eur: number | null;
  cancelacion_personalizar_mensaje: boolean | null;
  cancelacion_mensaje_personalizado: string | null;
};

type PlantillaRow = {
  activa: boolean;
  asunto_personalizado: string | null;
  mensaje_personalizado: string | null;
};

export type EnviarReservaEmailResult =
  | { ok: true; transport: string; idempotente?: false }
  | { ok: true; idempotente: true } // ya enviado, no se reenvía
  | { ok: false; error: string };

/**
 * Quién provoca el envío. El mailer trabaja con service role y no ve la sesión,
 * así que el actor tiene que venir de quien llama — que sí la tiene.
 *
 * `usuarioId`/`usuarioNombre` van vacíos cuando NO hay una persona detrás: el
 * cron nocturno, el formulario público del cliente y el booking server de
 * Google. En esos casos lo que identifica el envío es `origen`.
 */
export interface ReservaEmailActor {
  usuarioId?: string | null;
  usuarioNombre?: string | null;
  origen: "MANUAL" | "AUTOMATICO" | "PORTAL_PUBLICO" | "GOOGLE_RWG";
}

/**
 * Lee plantilla + reserva + empresa y envía el correo del tipo solicitado.
 *
 * - Idempotencia: si `force=false` y la columna de auditoría ya tiene timestamp,
 *   NO reenvía y devuelve `{ ok: true, idempotente: true }`.
 * - Si la plantilla está marcada como inactiva por la empresa, devuelve
 *   `{ ok: false, error: "plantilla inactiva" }`.
 * - TICKET_COMPRA no se envía por aquí: ocurre antes de que exista la reserva y
 *   tiene su propio emisor (`lib/email/tickets/enviar-compra`).
 * - Cada envío efectivo deja una fila en `reserva_email_envios` con el actor
 *   (`options.actor`). Solo se registra lo que SALE: si el correo no llega a
 *   enviarse, no se anota nada.
 */
export async function enviarReservaEmail(
  reservaId: string,
  tipo: ReservaEmailTipo,
  options: { force?: boolean; actor?: ReservaEmailActor } = {},
): Promise<EnviarReservaEmailResult> {
  if (tipo === "TICKET_COMPRA") {
    return {
      ok: false,
      error:
        "La compra de un ticket ocurre antes de la reserva: se envía desde el emisor de compras, no desde aquí.",
    };
  }

  const admin = createAdminClient();
  const { data: reservaData, error: errR } = await admin
    .from("reservas")
    .select(
      "empresa_id, cliente_nombre, cliente_apellidos, cliente_email, fecha, hora, personas, zona, grupo_zona_id, notas, estado, tipo_categoria, tiene_garantia, garantia_importe, tiene_cancelacion, cancelacion_importe, importe_pagado, codigo, codigo_id, cancelacion_token, garantia_token, garantia_limite_at, valoracion_token, vinculacion_estado, vinculacion_motivo, datos_declarados, email_confirmacion_at, email_reconfirmacion_at, email_no_reconfirmada_at, email_lista_espera_at, email_liberada_at, email_terminando_at, email_no_show_at, email_politica_cancelacion_at, email_politica_garantia_at, email_recordatorio_at, email_cancelacion_at, email_valoracion_at, email_ticket_reserva_at, es_ticket, ticket_codigo, ticket_producto_id, ticket_unidades, ticket_importe, grupos_zonas(nombre)",
    )
    .eq("id", reservaId)
    .maybeSingle();
  if (errR) return { ok: false, error: errR.message };
  if (!reservaData) return { ok: false, error: "Reserva no encontrada" };

  const empresaId = reservaData.empresa_id as string;
  const reserva: ReservaRow = {
    cliente_nombre: (reservaData.cliente_nombre as string | null) ?? null,
    cliente_email: (reservaData.cliente_email as string | null) ?? null,
    fecha: reservaData.fecha as string,
    hora: reservaData.hora as string,
    personas: reservaData.personas as number,
    // El cliente eligió un GRUPO ("Sala"); la zona interna ("Cristalera") no
    // le dice nada y podría hacerle pensar que le han cambiado el sitio. Se
    // lee el nombre ACTUAL del grupo: si se renombra, los correos que se
    // envíen a partir de entonces usan el nombre nuevo.
    zona: (() => {
      const g = reservaData.grupos_zonas as unknown as
        | { nombre?: string }
        | { nombre?: string }[]
        | null;
      const nombreGrupo = Array.isArray(g) ? g[0]?.nombre : g?.nombre;
      return nombreGrupo ?? ((reservaData.zona as string | null) ?? null);
    })(),
    notas: (reservaData.notas as string | null) ?? null,
    tipo_categoria: (reservaData.tipo_categoria as string | null) ?? null,
    tiene_garantia: (reservaData.tiene_garantia as boolean | null) ?? null,
    garantia_importe: (reservaData.garantia_importe as number | null) ?? null,
    tiene_cancelacion: (reservaData.tiene_cancelacion as boolean | null) ?? null,
    cancelacion_importe: (reservaData.cancelacion_importe as number | null) ?? null,
    importe_pagado: (reservaData.importe_pagado as number | null) ?? null,
    codigo: (reservaData.codigo as string | null) ?? null,
    codigo_id: (reservaData.codigo_id as string | null) ?? null,
    es_ticket: (reservaData.es_ticket as boolean | null) ?? null,
    ticket_codigo: (reservaData.ticket_codigo as string | null) ?? null,
    ticket_producto_id: (reservaData.ticket_producto_id as string | null) ?? null,
    ticket_unidades: (reservaData.ticket_unidades as number | null) ?? null,
    ticket_importe: (reservaData.ticket_importe as number | null) ?? null,
  };

  const email = (reserva.cliente_email ?? "").trim();
  if (!email) return { ok: false, error: "El cliente no tiene email" };

  // Enlace de cancelación: solo en correos de reserva VIVA. En el de
  // cancelación no tiene sentido ofrecer cancelar otra vez, y en el de
  // valoración tampoco: la visita ya ha ocurrido.
  //
  // Fuera de los correos en los que cancelar ya no significa nada: la reserva
  // se canceló, no se presentó, se cerró tras la visita, o se está pidiendo
  // opinión de algo que ya ocurrió.
  const SIN_ENLACE_CANCELAR: ReservaEmailTipo[] = [
    "CANCELADA",
    "NO_SHOW",
    "LIBERADA",
    "TERMINANDO",
    "SOLICITUD_VALORACION",
  ];
  // Enlace donde el cliente pone su tarjeta (PRP-082). Solo se manda en los
  // correos que se lo piden: en el resto no hay nada que pagar.
  const tokenGarantia = (reservaData.garantia_token as string | null) ?? null;
  const urlTarjeta =
    tokenGarantia && (tipo === "GARANTIA_SOLICITUD" || tipo === "GARANTIA_PENDIENTE")
      ? `${getSiteUrl()}/reserva/tarjeta/${tokenGarantia}`
      : null;

  const tokenCancelar = (reservaData.cancelacion_token as string | null) ?? null;
  const urlCancelar =
    tokenCancelar && !SIN_ENLACE_CANCELAR.includes(tipo)
      ? `${getSiteUrl()}/cancelar/${tokenCancelar}`
      : null;

  // Enlace de valoración: cada reserva estrena token la primera vez que se le
  // pide opinión. Es lo que identifica al cliente en la landing pública, así
  // que la reseña queda enlazada a SU ficha (y no a un email suelto).
  let urlValoracion: string | null = null;
  if (tipo === "SOLICITUD_VALORACION") {
    // Pedir opinión de algo que aún no ha pasado —o que no llegó a pasar— es
    // absurdo para quien lo recibe. Se comprueba aquí y no en quien llama
    // porque el envío manual usa `force` y se saltaría cualquier guarda previa.
    const estado = (reservaData.estado as string | null) ?? "";
    if (["CANCELADA", "NO_SHOW", "LIBERADA"].includes(estado)) {
      return {
        ok: false,
        error: "No se pide valoración de una reserva cancelada o no presentada.",
      };
    }
    const hoy = new Date().toISOString().slice(0, 10);
    if ((reserva.fecha ?? "") > hoy) {
      return {
        ok: false,
        error: "La reserva aún no ha ocurrido: no se puede pedir valoración.",
      };
    }

    let token = (reservaData.valoracion_token as string | null) ?? null;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "");
      const { error: errTok } = await admin
        .from("reservas")
        .update({ valoracion_token: token })
        .eq("id", reservaId);
      if (errTok) return { ok: false, error: errTok.message };
    }
    urlValoracion = `${getSiteUrl()}/r/${token}`;
  }

  // Idempotencia: si ya hay timestamp en la columna del tipo, no reenviar.
  const auditCol = AUDIT_COL[tipo];
  if (auditCol && !options.force) {
    const yaEnviado = reservaData[auditCol as keyof typeof reservaData] as
      | string
      | null;
    if (yaEnviado) {
      // El correo salió, pero puede no constar en el histórico: el sello de
      // `reservas` y la fila de `reserva_email_envios` no se escriben juntos, y
      // los envíos anteriores a que existiera el histórico solo dejaron sello.
      // Sin esto, un correo enviado de verdad no aparecía en Comunicaciones
      // (le pasaba al de confirmación mientras el de cancelación sí salía).
      // Se rellena con el sello como fecha de envío, que es cuando ocurrió.
      const { count } = await admin
        .from("reserva_email_envios")
        .select("id", { count: "exact", head: true })
        .eq("reserva_id", reservaId)
        .eq("tipo", tipo);
      if ((count ?? 0) === 0) {
        const actorPrevio = options.actor;
        const { error: errBackfill } = await admin
          .from("reserva_email_envios")
          .insert({
            reserva_id: reservaId,
            empresa_id: empresaId,
            tipo,
            destinatario: email,
            asunto: null,
            // No se puede saber quién lo mandó en su momento: se deja sin
            // firma en vez de atribuirlo a quien pasa por aquí ahora.
            usuario_id: null,
            usuario_nombre: null,
            origen: actorPrevio?.origen ?? "AUTOMATICO",
            enviado_at: yaEnviado,
          });
        if (errBackfill) {
          console.error(
            "[reservas][mailer] histórico (recuperar envío previo):",
            errBackfill.message,
          );
        }
      }
      return { ok: true, idempotente: true };
    }
  }

  const [{ data: empresaData }, { data: configData }, { data: plantillaData }] =
    await Promise.all([
      admin
        .from("empresas")
        .select("nombre, logo_url, isotipo_url, color, color_secundario, datos_generales")
        .eq("id", empresaId)
        .maybeSingle(),
      admin
        .from("empresa_reservas_config")
        .select(
          "cancelacion_horas_antes, cancelacion_importe_eur, cancelacion_personalizar_mensaje, cancelacion_mensaje_personalizado",
        )
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      admin
        .from("reserva_email_plantillas")
        .select("activa, asunto_personalizado, mensaje_personalizado")
        .eq("empresa_id", empresaId)
        .eq("tipo", tipo)
        .maybeSingle(),
    ]);

  const empresa: EmpresaRow = {
    nombre: (empresaData?.nombre as string | undefined) ?? "",
    logo_url: (empresaData?.logo_url as string | null | undefined) ?? null,
    isotipo_url: (empresaData?.isotipo_url as string | null | undefined) ?? null,
    color: (empresaData?.color as string | null | undefined) ?? null,
    color_secundario:
      (empresaData?.color_secundario as string | null | undefined) ?? null,
    // Fijo del restaurante, de Ajustes → Empresa. Va en el pie para que el
    // cliente tenga a quién llamar: el correo no admite respuestas.
    telefono: (() => {
      const generales = empresaData?.datos_generales as
        | Record<string, unknown>
        | null
        | undefined;
      const tel = generales?.telefonoPrincipal;
      return typeof tel === "string" && tel.trim() ? tel.trim() : null;
    })(),
  };

  const config: ConfigRow = {
    cancelacion_horas_antes:
      (configData?.cancelacion_horas_antes as number | null | undefined) ??
      null,
    cancelacion_importe_eur:
      (configData?.cancelacion_importe_eur as number | null | undefined) ??
      null,
    cancelacion_personalizar_mensaje:
      (configData?.cancelacion_personalizar_mensaje as
        | boolean
        | null
        | undefined) ?? null,
    cancelacion_mensaje_personalizado:
      (configData?.cancelacion_mensaje_personalizado as
        | string
        | null
        | undefined) ?? null,
  };

  const plantilla: PlantillaRow = {
    activa: (plantillaData?.activa as boolean | undefined) ?? true,
    asunto_personalizado:
      (plantillaData?.asunto_personalizado as string | null | undefined) ??
      null,
    mensaje_personalizado:
      (plantillaData?.mensaje_personalizado as string | null | undefined) ??
      null,
  };

  if (!plantilla.activa) {
    return { ok: false, error: "Plantilla desactivada por la empresa" };
  }

  // ---- Sustitución de placeholders --------------------------------------------------
  const fechaLegible = formatearFecha(reserva.fecha);
  const horaLegible = (reserva.hora ?? "").slice(0, 5);
  const personasTxt = `${reserva.personas} ${reserva.personas === 1 ? "persona" : "personas"}`;
  const placeholders: Record<string, string> = {
    nombre: primerNombre(reserva.cliente_nombre) || "",
    nombre_completo: reserva.cliente_nombre || "",
    empresa: empresa.nombre,
    fecha: fechaLegible,
    hora: horaLegible,
    personas: String(reserva.personas),
    zona: reserva.zona ? capitalizar(reserva.zona) : "",
  };

  const seed = getReservaEmailPlantillaSeed(tipo);
  const asuntoBase =
    plantilla.asunto_personalizado ?? seed?.asunto_default ?? "";
  const mensajeBase =
    plantilla.mensaje_personalizado ?? seed?.mensaje_default ?? "";
  const subject = sustituir(asuntoBase, placeholders) || HEADLINE_POR_TIPO[tipo];
  const mensajeLibre = sustituir(mensajeBase, placeholders);

  // ---- Bloques económicos ----------------------------------------------------------
  //
  // Cada uno aparece SOLO donde aporta algo:
  //
  //   · Las condiciones de cancelación y las de garantía tienen ahora correo
  //     propio (POLITICA_CANCELACION / POLITICA_GARANTIA), que es donde se
  //     explican enteras. Se repiten como recordatorio en la confirmación y en
  //     el recordatorio de la visita, que es cuando al cliente todavía le da
  //     tiempo a actuar. En una cancelación o un no-show ya no cambian nada.
  //
  //   · El ticket se enseña en la confirmación y en su propio correo: el
  //     cliente pagó por adelantado y necesita ver que su dinero está aplicado
  //     a ESTA reserva.
  let politicaBloque: { horas: number; importe: number; mensajeExtra: string } | null = null;
  let garantiaBloque: { importe: number; mensajeExtra: string } | null = null;
  let cuponCanjeadoBloque: { codigo: string; tituloCliente: string } | null = null;
  let ticketBloque:
    | { codigo: string; producto: string; unidades: number; importe: number; porPersona: boolean }
    | null = null;

  /**
   * Correos que llevan el compromiso económico, por dos motivos distintos:
   *
   *   · Antes de la visita (confirmada, reconfirmada, recordatorio) el cliente
   *     todavía está a tiempo de evitarlo, así que tiene que verlo.
   *   · Al cancelar o no presentarse es justo cuando se decide si se le cobra.
   *     Callarlo ahí dejaba al cliente sin saber a qué atenerse en el único
   *     momento en que el importe pasa de ser una advertencia a un cargo.
   */
  const RECUERDA_CONDICIONES: ReservaEmailTipo[] = [
    "CONFIRMADA",
    "RECONFIRMADA",
    "RECORDATORIO",
    "TICKET_RESERVA",
    "GARANTIA_PENDIENTE",
    "CANCELADA",
    "NO_SHOW",
  ];
  const mostrarCondiciones =
    RECUERDA_CONDICIONES.includes(tipo) ||
    tipo === "POLITICA_CANCELACION" ||
    tipo === "POLITICA_GARANTIA";

  /**
   * Texto extra que la empresa haya escrito para una política. En su correo
   * propio el texto ya va en el cuerpo, así que no se repite dentro del bloque.
   */
  async function textoExtraPolitica(
    tipoPol: "POLITICA_CANCELACION" | "POLITICA_GARANTIA",
  ): Promise<string> {
    if (tipo === tipoPol) return "";
    const { data: tpl } = await admin
      .from("reserva_email_plantillas")
      .select("mensaje_personalizado")
      .eq("empresa_id", empresaId)
      .eq("tipo", tipoPol)
      .maybeSingle();
    const seedPol = getReservaEmailPlantillaSeed(tipoPol);
    return sustituir(
      (tpl?.mensaje_personalizado as string | null) ?? seedPol?.mensaje_default ?? "",
      placeholders,
    );
  }

  if (mostrarCondiciones) {
    // El tipo de la reserva decide qué bloque se pinta, y solo puede ser uno:
    // cancelación y garantía son excluyentes (ver `lib/tipo-reserva.ts`).
    const tipoReserva = tipoDeReserva({
      esTicket: reserva.es_ticket,
      tieneGarantia: reserva.tiene_garantia,
      garantiaImporte: reserva.garantia_importe,
      tieneCancelacion: reserva.tiene_cancelacion,
      cancelacionImporte: reserva.cancelacion_importe,
    });

    // En el correo dedicado el bloque se pinta siempre: es su razón de ser.
    if (tipoReserva === "cancelacion" || tipo === "POLITICA_CANCELACION") {
      politicaBloque = {
        horas: config.cancelacion_horas_antes ?? 0,
        // El importe sale de la RESERVA, no de la configuración actual: es el
        // que el cliente aceptó. Si mañana cambia la tarifa, su correo no puede
        // decirle una cifra distinta de la que se le prometió.
        importe:
          Number(reserva.cancelacion_importe ?? 0) ||
          Number(config.cancelacion_importe_eur ?? 0),
        mensajeExtra: await textoExtraPolitica("POLITICA_CANCELACION"),
      };
    }

    if (tipoReserva === "garantia" || tipo === "POLITICA_GARANTIA") {
      garantiaBloque = {
        importe: Number(reserva.garantia_importe ?? 0),
        mensajeExtra: await textoExtraPolitica("POLITICA_GARANTIA"),
      };
    }
  }

  // Cupón de descuento canjeado: nada que ver con el pago por adelantado, es un
  // código promocional aplicado. Solo en el correo que estrena la reserva.
  if (tipo === "CONFIRMADA" && reserva.codigo_id && reserva.codigo) {
    const { data: cuponRow } = await admin
      .from("reserva_codigos")
      .select("titulo_interno, titulo_cliente")
      .eq("id", reserva.codigo_id)
      .maybeSingle();
    const titulo =
      (cuponRow?.titulo_cliente as string | null) ??
      (cuponRow?.titulo_interno as string | null) ??
      "";
    cuponCanjeadoBloque = { codigo: reserva.codigo, tituloCliente: titulo };
  }

  // ---- Bloque del Ticket canjeado ---------------------------------------------------
  //
  // El cliente ya pagó por adelantado: el correo tiene que enseñarle qué compró
  // y cuánto pagó, o no sabrá si su dinero está aplicado a esta reserva.
  if (
    (tipo === "CONFIRMADA" || tipo === "TICKET_RESERVA") &&
    reserva.es_ticket &&
    reserva.ticket_producto_id
  ) {
    const { data: prodRow } = await admin
      .from("reserva_ticket_productos")
      .select("nombre, modo_precio")
      .eq("id", reserva.ticket_producto_id)
      .maybeSingle();
    ticketBloque = {
      codigo: (reserva.ticket_codigo as string | null) ?? "",
      producto: (prodRow?.nombre as string | null) ?? "Ticket",
      unidades: Number(reserva.ticket_unidades ?? reserva.personas ?? 1),
      importe: Number(reserva.ticket_importe ?? 0),
      porPersona: prodRow?.modo_precio === "por_persona",
    };
  }

  // ---- Aviso de vinculación pendiente ----------------------------------------------
  //
  // Sólo en el correo de CONFIRMACIÓN: es el momento en que el cliente puede
  // corregirlo. Repetirlo en recordatorios sería alarmar sin motivo, y si el
  // restaurante ya resolvió la revisión (`vinculacion_estado` deja de ser
  // PENDIENTE) el aviso desaparece solo.
  //
  // El apellido va abreviado a su inicial a propósito: identifica lo justo para
  // que el cliente reconozca si es él o no, sin que este correo sirva para
  // averiguar quién hay detrás de un teléfono ajeno.
  const vinculacionAviso: { motivo: "email" | "telefono"; nombreFicha: string } | null =
    tipo === "CONFIRMADA" && reservaData.vinculacion_estado === "PENDIENTE"
      ? {
          motivo:
            (reservaData.vinculacion_motivo as "email" | "telefono" | null) ?? "telefono",
          nombreFicha: (() => {
            const nombre = ((reservaData.cliente_nombre as string | null) ?? "").trim();
            const apellidos = ((reservaData.cliente_apellidos as string | null) ?? "").trim();
            const inicial = apellidos ? ` ${apellidos.charAt(0).toUpperCase()}.` : "";
            return `${nombre}${inicial}`;
          })(),
        }
      : null;

  // ---- Render HTML / texto ---------------------------------------------------------
  const html = renderHtml({
    vinculacionAviso,
    tipo,
    empresa,
    cliente: placeholders.nombre,
    fechaLegible,
    horaLegible,
    personasTxt,
    zona: reserva.zona ? capitalizar(reserva.zona) : null,
    observaciones: reserva.notas,
    mensajeLibre,
    politicaBloque,
    garantiaBloque,
    cuponCanjeadoBloque,
    ticketBloque,
    urlCancelar,
    urlTarjeta,
    urlValoracion,
  });
  const text = renderText({
    vinculacionAviso,
    tipo,
    empresa: empresa.nombre,
    telefono: empresa.telefono,
    cliente: placeholders.nombre,
    fechaLegible,
    horaLegible,
    personasTxt,
    zona: reserva.zona ? capitalizar(reserva.zona) : null,
    observaciones: reserva.notas,
    mensajeLibre,
    politicaBloque,
    garantiaBloque,
    cuponCanjeadoBloque,
    ticketBloque,
    urlCancelar,
    urlTarjeta,
    urlValoracion,
  });

  const res = await sendEmail({
    to: email,
    subject,
    html,
    text,
    // `brandHeader: false` porque este correo YA pinta su propia cabecera con el
    // isotipo. Pasamos `empresaId` igualmente para dos cosas: que el remitente
    // salga con el nombre de la empresa y que el isotipo se INCRUSTE (cid:), que
    // si no Gmail lo bloquea y el cliente ve un hueco.
    empresaId,
    brandHeader: false,
  });

  if (!res.ok) {
    if (!res.configured) {
      return { ok: false, error: "SMTP no configurado" };
    }
    return { ok: false, error: res.error };
  }

  // Auditoría: el timestamp en `reservas` da la idempotencia (que el cron no
  // reenvíe) y el histórico guarda la traza completa con su autor. El
  // timestamp se machaca en cada reenvío; el histórico, no.
  const enviadoAt = new Date().toISOString();
  if (auditCol) {
    await admin
      .from("reservas")
      .update({ [auditCol]: enviadoAt })
      .eq("id", reservaId);
  }

  // El correo YA salió: si el registro falla, no se puede deshacer el envío ni
  // tiene sentido devolver error. Se traza y se sigue.
  const actor = options.actor;
  const { error: errHist } = await admin.from("reserva_email_envios").insert({
    reserva_id: reservaId,
    empresa_id: empresaId,
    tipo,
    destinatario: email,
    asunto: subject,
    usuario_id: actor?.usuarioId ?? null,
    usuario_nombre: actor?.usuarioNombre ?? null,
    origen: actor?.origen ?? "AUTOMATICO",
    enviado_at: enviadoAt,
  });
  if (errHist) {
    console.error("[reservas][mailer] histórico de envío:", errHist.message);
  }

  return { ok: true, transport: res.transport };
}

// ────────────────────────────────────────────────────────────────────────────
// Render HTML
// ────────────────────────────────────────────────────────────────────────────

interface RenderInput {
  tipo: ReservaEmailTipo;
  empresa: EmpresaRow;
  cliente: string;
  fechaLegible: string;
  horaLegible: string;
  personasTxt: string;
  zona: string | null;
  observaciones: string | null;
  mensajeLibre: string;
  politicaBloque: { horas: number; importe: number; mensajeExtra: string } | null;
  /**
   * La reserva enganchó con una ficha existente y los datos no coinciden.
   * `nombreFicha` va abreviado (nombre + inicial del apellido): nunca se
   * exponen el email ni el teléfono del titular.
   */
  vinculacionAviso: { motivo: "email" | "telefono"; nombreFicha: string } | null;
  /** Importe retenido en garantía y el texto que la empresa haya añadido. */
  garantiaBloque: { importe: number; mensajeExtra: string } | null;
  cuponCanjeadoBloque: { codigo: string; tituloCliente: string } | null;
  ticketBloque:
    | { codigo: string; producto: string; unidades: number; importe: number; porPersona: boolean }
    | null;
  /**
   * Enlace para que el cliente cancele solo. Requisito de Google (E2E exige
   * cancelación online) y del restaurante: si cancelar cuesta una llamada, el
   * cliente no avisa y la mesa se pierde sin poder revenderse.
   * Solo en correos de reserva viva; en CANCELACION no tiene sentido.
   */
  urlCancelar: string | null;
  /** Enlace para poner la tarjeta (PRP-082). Solo en los correos que la piden. */
  urlTarjeta?: string | null;
  /**
   * Enlace para puntuar la visita (una estrella = un clic). Solo en
   * SOLICITUD_VALORACION.
   */
  urlValoracion: string | null;
}

function renderHtml(input: RenderInput): string {
  // El color de marca lo necesita el CUERPO (bordes, fondos suaves, la hora en
  // grande). La cabecera con el degradado y el logo la monta `envolverEmail`.
  const primario = sanitizarHex(input.empresa.color) ?? "#0f172a";
  const textoSobrePrimario = colorContraste(primario);
  const empresaNombre = input.empresa.nombre || "";

  const filas: string[] = [
    fila("Fecha", input.fechaLegible),
    fila("Hora", input.horaLegible),
    fila("Comensales", input.personasTxt),
  ];
  if (input.zona) filas.push(fila("Zona", input.zona));

  // El saludo cambia según el momento. "Te esperamos" solo tiene sentido cuando
  // la visita todavía va a ocurrir: en una cancelación, un no-show o un aviso
  // de cambio de estado sería sarcasmo involuntario, y en la valoración —que va
  // DESPUÉS de venir— directamente un error.
  const nombreCliente = input.cliente ? escapeHtml(input.cliente) : "";
  const SALUDO_NEUTRO: ReservaEmailTipo[] = [
    // La compra de un ticket todavía no tiene fecha: no hay visita que esperar.
    "TICKET_COMPRA",
    "CANCELADA",
    "NO_SHOW",
    "NO_RECONFIRMADA",
    "LISTA_ESPERA",
    "LIBERADA",
    "TERMINANDO",
    "POLITICA_CANCELACION",
    "POLITICA_GARANTIA",
  ];
  const greeting = (() => {
    if (input.tipo === "SOLICITUD_VALORACION") {
      return nombreCliente ? `¡Gracias por venir, ${nombreCliente}!` : "¡Gracias por venir!";
    }
    if (SALUDO_NEUTRO.includes(input.tipo)) {
      return nombreCliente ? `Hola, ${nombreCliente}` : "Hola,";
    }
    return nombreCliente ? `¡Te esperamos, ${nombreCliente}!` : "¡Te esperamos!";
  })();

  // Aviso de vinculación: el dato de contacto que indicó ya estaba registrado
  // con otros datos, así que la reserva figura a nombre de la ficha existente.
  //
  // Se le da el nombre y la INICIAL del apellido, y nada más: es lo mínimo para
  // que entienda a nombre de quién está y pueda corregirlo al llegar. Poner el
  // email o el teléfono del titular convertiría este correo en una vía para
  // averiguar los datos de otro cliente probando teléfonos ajenos.
  const bloqueVinculacion = input.vinculacionAviso
    ? `<div style="margin-top:14px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#78350f;line-height:1.6;">
        <div style="font-weight:700;margin-bottom:4px;">&#9888; Comprueba tus datos</div>
        El ${input.vinculacionAviso.motivo === "email" ? "correo" : "teléfono"} que has indicado ya estaba registrado con otros datos de contacto, así que tu reserva figura a nombre de <strong>${escapeHtml(input.vinculacionAviso.nombreFicha)}</strong>.
        <div style="margin-top:6px;">Si no es correcto, avísanos al llegar y lo corregimos.</div>
      </div>`
    : "";

  const bloquePolitica = input.politicaBloque
    ? `<div style="margin-top:14px;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:13px;color:#7c2d12;line-height:1.6;">
        <div style="font-weight:700;margin-bottom:4px;">Política de cancelación</div>
        Cancelaciones con menos de <strong>${input.politicaBloque.horas} h</strong> de antelación o no presentación: se cobrará <strong>${formatearImporte(input.politicaBloque.importe)} €</strong>.
        ${input.politicaBloque.mensajeExtra ? `<div style="margin-top:6px;">${nl2br(escapeHtml(input.politicaBloque.mensajeExtra))}</div>` : ""}
      </div>`
    : "";

  // Garantía: el importe está RETENIDO, no cobrado. La diferencia es lo único
  // que le importa al cliente, así que se dice con esas palabras.
  const bloqueGarantia = input.garantiaBloque
    ? `<div style="margin-top:14px;padding:14px 16px;background:#fefce8;border:1px solid #fde047;border-radius:8px;font-size:13px;color:#713f12;line-height:1.6;">
        <div style="font-weight:700;margin-bottom:4px;">Política de garantía</div>
        Para asegurar tu mesa hemos retenido <strong>${formatearImporte(input.garantiaBloque.importe)} €</strong>. Es una retención, no un cobro: si vienes, se libera.
        ${input.garantiaBloque.mensajeExtra ? `<div style="margin-top:6px;">${nl2br(escapeHtml(input.garantiaBloque.mensajeExtra))}</div>` : ""}
      </div>`
    : "";

  // Cancelar en un clic. Va al final y en tono discreto: no queremos empujar a
  // cancelar, pero sí que sea trivial avisar — una mesa liberada a tiempo se
  // revende; un "no show" no.
  // Con un Ticket ya pagado NO va ningún bloque: el enlace de cancelar en un
  // clic haría creer al cliente que recupera el dinero, y ofrecerle cambiar la
  // fecha comprometería al restaurante a algo que no hace. Aquí, silencio.
  // La tarjeta es LA acción de este correo: va como botón, no como enlace
  // escondido en el pie.
  const bloqueTarjeta = input.urlTarjeta
    ? `<div style="margin:22px 0 4px;text-align:center;">
        <a href="${input.urlTarjeta}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 28px;border-radius:10px;">
          Introducir tarjeta
        </a>
      </div>`
    : "";

  const bloqueCancelar = input.ticketBloque
    ? ""
    : input.urlCancelar
    ? `<div style="margin-top:18px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
        ${
          // En lista de espera todavía no hay mesa asignada: prometer que "la
          // liberamos" sería hablarle de algo que no tiene.
          input.tipo === "LISTA_ESPERA"
            ? "¿Ya no te interesa? Puedes darte de baja de la lista"
            : "¿No puedes venir? Avísanos y liberamos tu mesa"
        }:
        <a href="${input.urlCancelar}" style="color:#64748b;text-decoration:underline;">${
          input.tipo === "LISTA_ESPERA" ? "salir de la lista de espera" : "cancelar mi reserva"
        }</a>.
      </div>`
    : "";

  // Valoración en el propio correo. Tres claves —comida, servicio y ambiente—
  // porque una nota global no dice QUÉ arreglar: un 3 puede ser gran cocina con
  // servicio lento, o al revés, y son departamentos distintos.
  //
  // Diseño pensado para que conteste el máximo de gente: las estrellas de
  // COMIDA son enlaces directos, así que el primer clic ya deja la nota
  // guardada aunque el cliente no haga nada más. Servicio, ambiente y el
  // comentario se completan luego en la página, y son opcionales. Pedirlo todo
  // dentro del correo no es viable: los gestores de correo no ejecutan
  // formularios interactivos.
  //
  // Se pinta con tablas y la entidad &#9733; porque SVG, iconos web y flexbox
  // no se renderizan de forma fiable en Outlook ni en Gmail.
  const bloqueValoracion = input.urlValoracion
    ? `<div style="margin-top:8px;padding:22px 10px;background:${withAlpha(primario, 0.04)};border:1px solid #e2e8f0;border-radius:12px;text-align:center;">
        <div style="font-size:16px;font-weight:600;color:#0f172a;line-height:1.5;">¿Qué tal estuvo la experiencia?</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Solo te llevará 15 segundos</div>
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:16px auto 0 auto;border-collapse:separate;">
          <tr>
            ${[1, 2, 3, 4, 5]
              .map(
                (n) =>
                  `<td style="padding:0 3px;">
                    <a href="${escapeAttr(`${input.urlValoracion}?rating=${n}`)}" style="display:block;width:40px;padding:8px 0 6px 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;text-align:center;">
                      <span style="display:block;font-size:24px;line-height:1;color:#f59e0b;">&#9733;</span>
                      <span style="display:block;margin-top:2px;font-size:11px;font-weight:600;color:#94a3b8;">${n}</span>
                    </a>
                  </td>`,
              )
              .join("")}
          </tr>
        </table>
        <div style="margin-top:6px;font-size:11px;color:#cbd5e1;">
          <span style="float:left;">Muy malo</span><span style="float:right;">Excelente</span>
          <span style="display:block;clear:both;"></span>
        </div>
        <div style="margin-top:16px;">
          <a href="${escapeAttr(input.urlValoracion)}" style="display:inline-block;padding:12px 26px;background:${primario};color:${textoSobrePrimario};border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Valorar mi visita</a>
        </div>
      </div>`
    : "";

  const bloqueCuponCanjeado = input.cuponCanjeadoBloque
    ? `<div style="margin-top:14px;padding:14px 16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:13px;color:#78350f;line-height:1.6;">
        <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.6px;color:#92400e;font-weight:700;">Cupón aplicado</div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:700;color:#7c2d12;margin-top:4px;">${escapeHtml(input.cuponCanjeadoBloque.codigo)}</div>
        <div style="margin-top:2px;">${escapeHtml(input.cuponCanjeadoBloque.tituloCliente)}</div>
      </div>`
    : "";

  // Bloque del Ticket. Va justo debajo de los datos de la reserva porque es la
  // pregunta que el cliente se hace nada más abrir: "¿está aplicado mi pago?".
  const bloqueTicket = input.ticketBloque
    ? `<div style="margin-top:14px;padding:16px 18px;background:${withAlpha(primario, 0.05)};border:1px solid ${withAlpha(primario, 0.25)};border-radius:10px;">
        <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.6px;color:#64748b;font-weight:700;">Reserva con Ticket</div>
        <div style="margin-top:6px;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(input.ticketBloque.producto)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px;">
          ${input.ticketBloque.porPersona
            ? fila(
                "Importe",
                `${input.ticketBloque.unidades} ${input.ticketBloque.unidades === 1 ? "persona" : "personas"} × ${formatearImporte(input.ticketBloque.importe / Math.max(1, input.ticketBloque.unidades))} € = ${formatearImporte(input.ticketBloque.importe)} €`,
              )
            : fila("Importe pagado", `${formatearImporte(input.ticketBloque.importe)} €`)}
          ${input.ticketBloque.codigo ? fila("Código", input.ticketBloque.codigo) : ""}
        </table>
        <div style="margin-top:8px;font-size:12px;color:#64748b;line-height:1.6;">Ya está pagado. No tienes que abonar nada más por este concepto.</div>
      </div>`
    : "";

  // En la valoración la visita YA pasó: la hora en grande no aporta y quita
  // protagonismo a lo único que se pide, que son las estrellas. Se deja una
  // línea discreta que sirva de recordatorio de qué visita se está valorando.
  const tarjetaReserva =
    // En la compra de un ticket todavía no hay reserva: pintar fecha, hora y
    // zona sería inventarle al cliente una mesa que aún no ha elegido.
    input.tipo === "TICKET_COMPRA"
      ? ""
      : input.tipo === "SOLICITUD_VALORACION"
      ? `<div style="text-align:center;font-size:13px;color:#94a3b8;line-height:1.6;">
          Tu visita del <strong style="color:#64748b;">${escapeHtml(input.fechaLegible)}</strong>${
            input.horaLegible ? ` a las <strong style="color:#64748b;">${escapeHtml(input.horaLegible)}</strong>` : ""
          }
        </div>`
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:18px 20px;background:${withAlpha(primario, 0.04)};text-align:center;border-bottom:1px solid #e2e8f0;">
              <div style="font-size:11px;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;font-weight:600;">${escapeHtml(input.fechaLegible)}</div>
              <div style="margin-top:4px;font-size:34px;font-weight:700;color:${primario};line-height:1;letter-spacing:-0.5px;">${escapeHtml(input.horaLegible)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 20px 10px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${filas.join("\n")}
              </table>
            </td>
          </tr>
        </table>`;

  // El marco (cabecera de marca, distintivo, titular, pie y aviso de buzón no
  // atendido) sale de `envolverEmail`, el mismo que usan los correos de compra
  // de Ticket. Es lo que hace que las dos familias se lean como del mismo
  // restaurante: si el marco se duplicara aquí, tarde o temprano una se
  // quedaría atrás.
  return envolverEmail({
    empresa: {
      nombre: empresaNombre,
      logo_url: input.empresa.logo_url,
      isotipo_url: input.empresa.isotipo_url,
      color: input.empresa.color,
    },
    telefono: input.empresa.telefono,
    badge: BADGE_POR_TIPO[input.tipo],
    titular: greeting,
    subtitulo: subtitulo(input.tipo),
    pie: footerSegunTipo(input.tipo, !!input.urlCancelar),
    contenido: `
      ${tarjetaReserva}
      ${
        input.observaciones
          ? `<div style="margin-top:14px;padding:12px 14px;background:#ffffff;border-left:3px solid ${primario};border-radius:6px;">
              <div style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;margin-bottom:4px;">Comentarios</div>
              <div style="font-size:13px;color:#334155;line-height:1.55;">${escapeHtml(input.observaciones)}</div>
            </div>`
          : ""
      }
      ${
        input.mensajeLibre
          ? `<div style="margin-top:14px;padding:14px 16px;background:${withAlpha(primario, 0.06)};border-radius:8px;font-size:13px;color:#334155;line-height:1.6;">${nl2br(escapeHtml(input.mensajeLibre))}</div>`
          : ""
      }
      ${bloqueValoracion}
      ${bloqueVinculacion}
      ${bloquePolitica}
      ${bloqueGarantia}
      ${bloqueCuponCanjeado}
      ${bloqueTicket}
      ${bloqueTarjeta}
      ${bloqueCancelar}
    `,
  });
}

function renderText(
  input: Omit<RenderInput, "empresa"> & { empresa: string; telefono?: string | null },
): string {
  const lineas = [
    `${HEADLINE_POR_TIPO[input.tipo]} · ${input.empresa}`,
    ``,
    `${input.cliente ? `Hola ${input.cliente},` : "Hola,"}`,
  ];
  // Igual que en el HTML: en la compra de un ticket todavía no hay reserva, así
  // que no hay fecha ni mesa que listar.
  if (input.tipo !== "TICKET_COMPRA") {
    lineas.push(
      `- Fecha: ${input.fechaLegible}`,
      `- Hora: ${input.horaLegible}`,
      `- Comensales: ${input.personasTxt}`,
    );
    if (input.zona) lineas.push(`- Zona: ${input.zona}`);
  }
  if (input.observaciones) lineas.push(``, `Comentarios: ${input.observaciones}`);
  if (input.mensajeLibre) lineas.push(``, input.mensajeLibre);
  if (input.vinculacionAviso) {
    lineas.push(
      ``,
      `[!] Comprueba tus datos: el ${input.vinculacionAviso.motivo === "email" ? "correo" : "teléfono"} que has indicado ya estaba registrado con otros datos de contacto, así que tu reserva figura a nombre de ${input.vinculacionAviso.nombreFicha}.`,
      `Si no es correcto, avísanos al llegar y lo corregimos.`,
    );
  }
  if (input.politicaBloque) {
    lineas.push(
      ``,
      `Política de cancelación: ${input.politicaBloque.horas} h de antelación, ${formatearImporte(input.politicaBloque.importe)} € si no.`,
    );
    if (input.politicaBloque.mensajeExtra) lineas.push(input.politicaBloque.mensajeExtra);
  }
  if (input.garantiaBloque) {
    lineas.push(
      ``,
      `Política de garantía: hemos retenido ${formatearImporte(input.garantiaBloque.importe)} € para asegurar tu mesa. Es una retención, no un cobro: si vienes, se libera.`,
    );
    if (input.garantiaBloque.mensajeExtra) lineas.push(input.garantiaBloque.mensajeExtra);
  }
  // La tarjeta primero: es la acción que le pide el correo.
  if (input.urlTarjeta) {
    lineas.push(``, `Introduce tu tarjeta aquí: ${input.urlTarjeta}`);
  }
  if (input.urlCancelar) {
    lineas.push(
      ``,
      input.tipo === "LISTA_ESPERA"
        ? `¿Ya no te interesa? Sal de la lista de espera aquí: ${input.urlCancelar}`
        : `¿No puedes venir? Cancela tu reserva aquí: ${input.urlCancelar}`,
    );
  }
  if (input.urlValoracion) {
    lineas.push(
      ``,
      `¿Qué tal estuvo la experiencia? Solo te llevará 15 segundos:`,
      ...[1, 2, 3, 4, 5].map((n) => `  ${n} → ${input.urlValoracion}?rating=${n}`),
    );
  }
  if (input.ticketBloque) {
    const t = input.ticketBloque;
    lineas.push(
      ``,
      `Reserva con Ticket: ${t.producto}`,
      t.porPersona
        ? `${t.unidades} ${t.unidades === 1 ? "persona" : "personas"} x ${formatearImporte(t.importe / Math.max(1, t.unidades))} EUR = ${formatearImporte(t.importe)} EUR`
        : `Importe pagado: ${formatearImporte(t.importe)} EUR`,
      t.codigo ? `Código: ${t.codigo}` : "",
      `Ya está pagado. No tienes que abonar nada más por este concepto.`,
    );
  }

  if (input.cuponCanjeadoBloque) {
    lineas.push(
      ``,
      `Cupón aplicado: ${input.cuponCanjeadoBloque.codigo} - ${input.cuponCanjeadoBloque.tituloCliente}`,
    );
  }
  const coletilla = footerSegunTipo(input.tipo, !!input.urlCancelar);
  if (coletilla) lineas.push(``, coletilla);
  lineas.push(
    ``,
    input.telefono
      ? `${AVISO_NO_REPLY} Si necesitas algo, llámanos al ${input.telefono}.`
      : AVISO_NO_REPLY,
  );
  return lineas.join("\n");
}

/**
 * Línea bajo el titular: dice en una frase POR QUÉ ha llegado este correo.
 * Es lo que diferencia un aviso de otro cuando el marco visual es el mismo.
 */
function subtitulo(t: ReservaEmailTipo): string {
  switch (t) {
    // ── Estados con sustancia ──────────────────────────────────────────────
    case "CONFIRMADA":
      return "Gracias por reservar con nosotros.";
    case "RECONFIRMADA":
      return "Nos has confirmado que vienes.";
    case "NO_SHOW":
      return "No pudimos darte la mesa que teníamos guardada.";
    case "CANCELADA":
      return "Tu reserva ha sido cancelada.";

    // ── Estados transitorios ───────────────────────────────────────────────
    //
    // No piden nada al cliente: solo le dicen que su reserva ha cambiado de
    // estado. Todos comparten la misma frase a propósito, para que se lean como
    // lo que son —un aviso de seguimiento— y no como una instrucción.
    case "NO_RECONFIRMADA":
    case "LISTA_ESPERA":
    case "LIBERADA":
    case "TERMINANDO":
      return "El estado de tu reserva ha cambiado.";

    // ── Políticas y procesos ───────────────────────────────────────────────
    case "TICKET_COMPRA":
      return "Hemos recibido tu pago.";
    case "TICKET_RESERVA":
      return "Tu ticket ya está canjeado.";
    case "POLITICA_CANCELACION":
      return "Estas son las condiciones que se aplican a tu reserva.";
    case "POLITICA_GARANTIA":
      return "Estas son las condiciones de la garantía de tu reserva.";
    case "RECORDATORIO":
      return "Te esperamos pronto.";
    case "SOLICITUD_VALORACION":
      return "";
    default:
      return "";
  }
}

/**
 * Coletilla del pie.
 *
 * Sin teléfonos ni direcciones de correo: estos envíos salen desde un buzón que
 * nadie lee, y publicar un contacto aquí manda al cliente a hablar con la pared.
 * La única vía de vuelta que se ofrece es el enlace de gestión de la reserva,
 * que ya va en su propio bloque — por eso la coletilla solo aparece cuando ese
 * enlace existe, y solo dice para qué sirve.
 */
function footerSegunTipo(t: ReservaEmailTipo, hayEnlaceGestion: boolean): string {
  if (!hayEnlaceGestion) return "";
  switch (t) {
    case "CONFIRMADA":
    case "RECONFIRMADA":
    case "TICKET_RESERVA":
    case "POLITICA_CANCELACION":
    case "POLITICA_GARANTIA":
      return "Puedes gestionar tu reserva desde el enlace de arriba.";
    case "RECORDATORIO":
      return "Si finalmente no puedes venir, avísanos desde el enlace de arriba.";
    case "NO_RECONFIRMADA":
    case "LISTA_ESPERA":
      return "Puedes gestionar tu reserva desde el enlace de arriba.";
    default:
      // Cancelada, no presentado, liberada, terminando y valoración: la reserva
      // ya no admite gestión, así que cualquier coletilla sobraría.
      return "";
  }
}

/**
 * Aviso de buzón no monitorizado. Va en TODOS los correos de reserva, incluida
 * la solicitud de valoración: el cliente debe saber que si contesta no le va a
 * leer nadie, ANTES de escribir, no después de esperar respuesta.
 */

// ────────────────────────────────────────────────────────────────────────────
// Helpers visuales y de texto
// ────────────────────────────────────────────────────────────────────────────

function capitalizar(s: string): string {
  if (!s) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// ────────────────────────────────────────────────────────────────────────────
// Preview público (usado por la UI de Comunicaciones para el editor en vivo).
// No envía nada — solo devuelve el HTML que vería el cliente con datos de
// ejemplo. Por eso no toca BD.
// ────────────────────────────────────────────────────────────────────────────

export interface PreviewInput {
  tipo: ReservaEmailTipo;
  empresaNombre: string;
  logoUrl: string | null;
  isotipoUrl?: string | null;
  colorPrimario: string | null;
  /** Segundo color de Imagen de marca: si falta, la previa no se ve como el real. */
  colorSecundario?: string | null;
  /** Fijo del restaurante: sale en el pie, así que la previa tiene que enseñarlo. */
  telefono?: string | null;
  asuntoOverride: string | null;
  mensajeOverride: string | null;
  config: {
    cancelacionHorasAntes?: number | null;
    cancelacionImporteEur?: number | null;
    garantiaImporteEur?: number | null;
  };
  /**
   * Tipo de reserva que se quiere previsualizar. El mismo correo cambia de
   * contenido según a qué esté sujeta la reserva: "Reserva confirmada" lleva
   * el plazo y el importe si hay política, y no lleva nada si es gratis.
   * Por defecto "gratis", que es el caso mayoritario.
   */
  tipoReserva?: "gratis" | "cancelacion" | "garantia" | "ticket";
}

export function previewReservaEmail(input: PreviewInput): {
  subject: string;
  html: string;
} {
  const placeholders: Record<string, string> = {
    nombre: "María",
    nombre_completo: "María García",
    empresa: input.empresaNombre || "Tu restaurante",
    fecha: formatearFecha("2026-06-15"),
    hora: "21:00",
    personas: "4",
    zona: "Terraza",
  };
  const seed = getReservaEmailPlantillaSeed(input.tipo);
  const asunto = sustituir(
    input.asuntoOverride ?? seed?.asunto_default ?? "",
    placeholders,
  );
  const mensajeLibre = sustituir(
    input.mensajeOverride ?? seed?.mensaje_default ?? "",
    placeholders,
  );

  // La vista previa enseña cada bloque económico donde de verdad va a salir, no
  // en todos: si se pintaran siempre, quien configura las plantillas creería
  // que sus clientes reciben las condiciones de garantía en el correo de
  // cancelación.
  //
  // "Confirmada" NO lleva bloque: la reciben los cuatro tipos de reserva y la
  // mayoría son gratis. Pintarlo aquí hacía creer que todos los clientes ven
  // unas condiciones que solo ve una parte.
  // Los mismos correos que en el envío real: los que el cliente puede recibir
  // sujeto a una política llevan su bloque, y el resto no.
  const LLEVA_CONDICIONES: ReservaEmailTipo[] = [
    "CONFIRMADA",
    "RECONFIRMADA",
    "RECORDATORIO",
    "TICKET_RESERVA",
    "GARANTIA_PENDIENTE",
    "CANCELADA",
    "NO_SHOW",
  ];
  const tipoReserva = input.tipoReserva ?? "gratis";
  const conCondiciones = LLEVA_CONDICIONES.includes(input.tipo);

  const politicaBloque =
    input.tipo === "POLITICA_CANCELACION" ||
    (conCondiciones && tipoReserva === "cancelacion")
      ? {
          horas: input.config.cancelacionHorasAntes ?? 24,
          importe: Number(input.config.cancelacionImporteEur ?? 15),
          mensajeExtra: "",
        }
      : null;

  const garantiaBloque =
    input.tipo === "POLITICA_GARANTIA" ||
    (conCondiciones && tipoReserva === "garantia")
      ? { importe: Number(input.config.garantiaImporteEur ?? 20), mensajeExtra: "" }
      : null;

  const html = renderHtml({
    // El aviso de vinculación no se configura ni se personaliza: lo decide el
    // sistema cuando una reserva concreta engancha con una ficha existente. En
    // la vista previa de la plantilla no pinta nada.
    vinculacionAviso: null,
    tipo: input.tipo,
    empresa: {
      nombre: input.empresaNombre || "Tu restaurante",
      logo_url: input.logoUrl,
      isotipo_url: input.isotipoUrl ?? null,
      color: input.colorPrimario,
      color_secundario: input.colorSecundario ?? null,
      telefono: input.telefono ?? null,
    },
    cliente: placeholders.nombre,
    fechaLegible: placeholders.fecha,
    horaLegible: placeholders.hora,
    personasTxt: `${placeholders.personas} personas`,
    zona: placeholders.zona,
    observaciones: null,
    mensajeLibre,
    politicaBloque,
    garantiaBloque,
    cuponCanjeadoBloque: null,
    // En la vista previa de los correos de Ticket se enseña un ticket de
    // ejemplo para que se vea cómo queda el desglose del importe pagado.
    ticketBloque:
      input.tipo === "TICKET_RESERVA" || input.tipo === "TICKET_COMPRA"
        ? { codigo: "AB3K9P", producto: "Cena degustación", unidades: 2, importe: 98, porPersona: true }
        : null,
    // Mismo criterio que en el envío real: el enlace de gestión solo aparece
    // mientras la reserva sigue viva.
    urlCancelar: [
      "CANCELADA",
      "NO_SHOW",
      "LIBERADA",
      "TERMINANDO",
      "SOLICITUD_VALORACION",
      "TICKET_COMPRA",
    ].includes(input.tipo)
      ? null
      : `${getSiteUrl()}/cancelar/ejemplo`,
    urlValoracion:
      input.tipo === "SOLICITUD_VALORACION"
        ? `${getSiteUrl()}/r/ejemplo`
        : null,
  });
  return { subject: asunto || RESERVA_EMAIL_TIPO_LABELS[input.tipo], html };
}

// Re-export para que el sync seed pueda hacer un check sin importar dos veces.
export type _Admin = Admin;
