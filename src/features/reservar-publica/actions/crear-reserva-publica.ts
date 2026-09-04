"use server";

import { z } from "zod";
import {
  validarTelefono,
  validarEmail,
  validarNombre,
} from "@/shared/lib/validar-contacto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  completarFichaCliente,
  construirDatosDeclarados,
  deducirMotivoVinculacion,
  findOrLinkClienteSala,
  type CampoDistinto,
} from "@/features/sala/lib/cliente-link";
import { asignarMesaAutomatica } from "@/features/sala/planos/lib/asignacion-mesa";
import { validarMotorWebReserva } from "@/features/sala/lib/motor-web-validar";
import { getCamposObligatoriosReserva } from "@/features/sala/lib/reserva-campos-obligatorios";
import { notificarReservaCreada } from "@/lib/email/reservas/notificar-creada";
import { enviarReservaEmail } from "@/lib/email/reservas/mailer";
import { turnoDeHora } from "@/features/sala/lib/dia-negocio";
import {
  validarCanjeTicket,
  TICKET_MOTIVO_LABELS,
} from "@/features/sala/lib/validar-ticket-canje";
import {
  calcularPolitica,
  politicaDesdeRow,
  POLITICA_COLUMNAS_SELECT,
} from "@/features/sala/lib/politicas-tarjeta";
import {
  RESERVA_NOMBRE_MAX_CHARS,
  RESERVA_COMENTARIO_MAX_CHARS,
  RESERVA_APELLIDOS_MAX_CHARS,
  MAX_COMENSALES_ENTRADA,
  type DiaSemanaKey,
} from "@/features/sala/data/reservas";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cuánto se le guarda la mesa al cliente mientras introduce su tarjeta.
 *
 * Quince minutos: sobra para pagar sin prisa, y no bloquea la mesa toda la
 * tarde si abandona a mitad. Pasado el plazo, la reserva provisional se borra
 * sola y la mesa vuelve al cupo.
 */
const MINUTOS_PARA_PAGAR = 15;

const inputSchema = z.object({
  empresaSlug: z.string().min(1).max(120),
  origen: z.string().regex(/^[A-Z0-9_]+$/).max(32).nullable().optional(),
  // Nombre y apellidos son siempre obligatorios. El teléfono y el email se
  // exigen o no según la configuración de cada empresa, así que aquí solo se
  // valida el formato; la obligatoriedad se comprueba abajo, con la config.
  // El formulario ya valida, pero la action es pública: sin esto, cualquiera
  // que la llame por fuera puede crear fichas con teléfonos inventados, que es
  // como se llenó la base de `00000` y `666` en CoverManager.
  nombre: z
    .string()
    .min(1)
    .max(RESERVA_NOMBRE_MAX_CHARS)
    .refine((v) => validarNombre(v).ok, "Escribe un nombre real."),
  apellidos: z.string().min(1).max(RESERVA_APELLIDOS_MAX_CHARS),
  telefono: z
    .string()
    .max(40)
    .optional()
    .nullable()
    .refine((v) => validarTelefono(v, false).ok, "Ese teléfono no es válido."),
  email: z
    .string()
    .email()
    .max(160)
    .optional()
    .nullable()
    .refine((v) => validarEmail(v, false).ok, "Ese correo no es válido."),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  personas: z.number().int().min(1).max(MAX_COMENSALES_ENTRADA),
  // Mismo tope que en el back-office: un comentario es un aviso corto, no un
  // texto libre. Si alguien llama a la action por fuera del formulario, el
  // servidor lo corta igual.
  notas: z.string().max(RESERVA_COMENTARIO_MAX_CHARS).optional().nullable(),
  codigo: z.string().min(1).max(64).optional().nullable(),
  ticketProductoId: z.string().guid().optional().nullable(),
  /** Código de un Ticket comprado antes. Se canjea al confirmar la reserva. */
  ticketCodigo: z.string().regex(/^[A-Z0-9]{6}$/).optional().nullable(),
  ticketOnly: z.boolean().optional(),
  /**
   * Grupo de zonas elegido por el cliente ("Sala", "Terraza Exterior"). La
   * mesa se asigna solo entre las zonas internas de ese grupo. Obligatorio o
   * no según `exigir_zona_cliente` de la empresa.
   */
  grupoZonaId: z.string().guid().optional().nullable(),
  /** Datos que enriquecen la ficha del cliente. Ninguno bloquea la reserva. */
  fechaNacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  /** Consentimiento para comunicaciones comerciales (RGPD: nunca premarcado). */
  aceptaMarketing: z.boolean().optional(),
});

export type CrearReservaPublicaInput = z.infer<typeof inputSchema>;

export type CrearReservaPublicaResult =
  | {
      ok: true;
      clienteExistente: boolean;
      camposDistintos: CampoDistinto[];
      datosCliente: {
        nombre: string;
        apellidos: string | null;
        email: string | null;
        telefono: string | null;
      };
      /** PRP-052: si se aplicó un cupón, código + título visible al cliente. */
      cuponAplicado: { codigo: string; tituloCliente: string } | null;
      /**
       * PRP-082: la reserva exige tarjeta. El formulario lleva al cliente al
       * enlace en vez de darle la reserva por cerrada. `null` = no hace falta.
       */
      tarjetaPendiente: {
        token: string | null;
        importe: number;
        /** true = se retiene el importe (garantía); false = solo se guarda. */
        retiene: boolean;
      } | null;
    }
  | { ok: false; error: string };

export async function crearReservaPublicaAction(
  input: CrearReservaPublicaInput,
): Promise<CrearReservaPublicaResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos" };
  }
  const data = parsed.data;
  const admin = createAdminClient();

  const { data: empresa, error: errEmpresa } = await admin
    .from("empresas")
    .select("id, nombre")
    .eq("slug", data.empresaSlug)
    .maybeSingle();
  if (errEmpresa || !empresa) {
    return { ok: false, error: "Restaurante no encontrado" };
  }

  // Campos obligatorios configurables por empresa (email / teléfono), marcados
  // en Ajustes → Departamentos → Sala → Reservas. Se comprueba en servidor: el
  // navegador puede saltarse el `required` del formulario.
  const { email: exigeEmail, telefono: exigeTelefono } =
    await getCamposObligatoriosReserva(empresa.id as string);
  if (exigeTelefono && (data.telefono ?? "").trim().length < 5) {
    return { ok: false, error: "El teléfono es obligatorio." };
  }
  if (exigeEmail && !(data.email ?? "").trim()) {
    return { ok: false, error: "El email es obligatorio." };
  }
  // Sin teléfono ni email no hay forma de avisar al cliente ni de vincular su
  // ficha (la BD exige cliente_id cuando hay contacto), así que pedimos uno.
  if (!(data.telefono ?? "").trim() && !(data.email ?? "").trim()) {
    return { ok: false, error: "Indica un teléfono o un email de contacto." };
  }

  // Motor web: grid de 15 min, cierre del día actual y tope de personas por
  // hora. Aplicar antes que cualquier otro side-effect.
  const turno = turnoDeHora(data.hora);
  const motor = await validarMotorWebReserva(admin, {
    empresaId: empresa.id as string,
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
    turno,
  });
  if (!motor.ok) {
    return { ok: false, error: motor.error };
  }

  // PRP-052: validar cupón y consumir stock atómicamente. Si falla, abortamos
  // sin crear reserva. Regla del dueño: cupón NO coexiste con ticket.
  let codigoId: string | null = null;
  let codigoTexto: string | null = null;
  let cuponTituloCliente: string | null = null;
  if (data.codigo) {
    if (data.ticketProductoId) {
      return { ok: false, error: "Una reserva con ticket no puede llevar cupón." };
    }
    const norm = data.codigo.toUpperCase().replace(/\s+/g, "");
    const { data: vRows, error: vErr } = await admin.rpc("validar_cupon", {
      p_empresa_id: empresa.id,
      p_codigo: norm,
      p_fecha: data.fecha,
      p_turno: turno,
    });
    if (vErr) {
      console.error("[reservar-publica] validar_cupon:", vErr);
      return { ok: false, error: "No se pudo validar el cupón." };
    }
    const row = (vRows ?? [])[0] as {
      ok: boolean;
      motivo: string | null;
      cupon_id: string | null;
      titulo_cliente_efectivo: string | null;
    } | undefined;
    if (!row?.ok) {
      const motivo = row?.motivo ?? "NO_EXISTE";
      const labelMap: Record<string, string> = {
        NO_EXISTE: "Cupón no válido.",
        INACTIVO: "Cupón inactivo.",
        CADUCADO: "Cupón caducado.",
        AGOTADO: "Cupón agotado.",
        DIA_NO_PERMITIDO: "El cupón no es válido este día.",
        TURNO_NO_PERMITIDO: "El cupón no es válido para este turno.",
      };
      return { ok: false, error: labelMap[motivo] ?? "Cupón no válido." };
    }
    const { error: cErr } = await admin.rpc("consumir_stock_cupon", {
      p_codigo_id: row.cupon_id,
      p_personas: data.personas,
    });
    if (cErr) {
      const msg = cErr.message ?? "";
      if (msg.includes("AGOTADO")) return { ok: false, error: "Cupón agotado." };
      console.error("[reservar-publica] consumir_stock_cupon:", cErr);
      return { ok: false, error: "No se pudo aplicar el cupón." };
    }
    codigoId = row.cupon_id;
    codigoTexto = norm;
    cuponTituloCliente = row.titulo_cliente_efectivo;
  }

  // Vincular o crear ficha de cliente (match por email O teléfono normalizado dentro de la empresa).
  const link = await findOrLinkClienteSala(admin, {
    empresaId: empresa.id,
    nombre: data.nombre,
    apellidos: data.apellidos,
    email: data.email,
    telefono: data.telefono,
  });
  if (!link.ok) {
    console.error("[reservar-publica] vincular cliente:", link.error);
    return { ok: false, error: "No pudimos vincular tu ficha de cliente" };
  }
  const cliente = link.result.cliente;

  // Datos extra de la ficha: rellenan huecos, nunca pisan lo que ya hubiera.
  await completarFichaCliente(admin as unknown as SupabaseClient, cliente.id, {
    fechaNacimiento: data.fechaNacimiento ?? null,
    aceptaMarketing: data.aceptaMarketing ?? false,
    origen: data.origen ?? "RESERVA_WEB",
  });

  // ────────────────────────────────────────────────────────────────
  // PRP-051: rama Ticket. Validar bloqueo + consumir stock atómico.
  // En enlaces "solo ticket" (`ticketOnly`) el producto es obligatorio.
  // Defensa: re-leemos `vende_tickets` desde BD usando el origen (= palabra
  // clave del link). Así, aunque el cliente envíe `ticketOnly=false`, si el
  // enlace está marcado como dedicado a ticket NO permitimos reserva sin producto.
  // ────────────────────────────────────────────────────────────────
  let ticketProductoIdFinal: string | null = null;
  let ticketUnidadesFinal: number | null = null;
  let ticketImporteFinal: number | null = null;
  let ticketIvaFinal: number | null = null;
  let tipoCategoriaFinal: string | null = null;
  let pagoPendienteFinal = false;
  /** Compra a canjear cuando el cliente llega con un código ya pagado. */
  let ticketCompraId: string | null = null;
  let ticketCodigoFinal: string | null = null;

  let linkRequiereTicket = false;
  if (data.origen) {
    const { data: linkRow } = await admin
      .from("reserva_links")
      .select("vende_tickets")
      .eq("empresa_id", empresa.id)
      .eq("palabra_clave", data.origen)
      .eq("activo", true)
      .maybeSingle();
    linkRequiereTicket = Boolean(linkRow?.vende_tickets);
  }
  const ticketObligatorio = data.ticketOnly || linkRequiereTicket;

  // ── Canje de un código comprado antes ──────────────────────────
  //
  // Aquí el cliente YA pagó: no se cobra nada ni se consume stock (se consumió
  // al comprar). Solo se valida que el código sirve para lo que está eligiendo
  // y se marca como usado. Se comprueba todo otra vez en el servidor aunque el
  // formulario ya lo hiciera: el navegador no es de fiar.
  if (data.ticketCodigo) {
    const codigo = data.ticketCodigo.trim().toUpperCase();
    const { data: compraRow } = await admin
      .from("reserva_ticket_compras")
      .select("id, producto_id, estado, canje_hasta, unidades, importe_total, iva")
      .eq("empresa_id", empresa.id)
      .eq("codigo", codigo)
      .maybeSingle();
    if (!compraRow) {
      return { ok: false, error: "No encontramos ningún código así. Revísalo y vuelve a intentarlo." };
    }

    const { data: prodCond } = await admin
      .from("reserva_ticket_productos")
      .select("dias_semana, dias_excluidos, turnos, hora_desde, hora_hasta, horas_excluidas, grupo_zona_ids")
      .eq("id", compraRow.producto_id as string)
      .maybeSingle();

    const validez = validarCanjeTicket(
      {
        estado: compraRow.estado as string,
        canjeHasta: (compraRow.canje_hasta as string | null) ?? null,
        unidades: Number(compraRow.unidades),
      },
      {
        diasSemana: (prodCond?.dias_semana as DiaSemanaKey[] | null) ?? [],
        diasExcluidos: (prodCond?.dias_excluidos as string[] | null) ?? [],
        turnos: (prodCond?.turnos as ("COMIDA" | "CENA")[] | null) ?? [],
        horaDesde: (prodCond?.hora_desde as string | null) ?? null,
        horaHasta: (prodCond?.hora_hasta as string | null) ?? null,
        horasExcluidas: (prodCond?.horas_excluidas as string[] | null) ?? [],
        grupoZonaIds: (prodCond?.grupo_zona_ids as string[] | null) ?? [],
      },
      { fecha: data.fecha, hora: data.hora.slice(0, 5), grupoZonaId: data.grupoZonaId ?? null },
    );
    if (!validez.ok) {
      return { ok: false, error: TICKET_MOTIVO_LABELS[validez.motivo] };
    }

    // El ticket manda sobre el número de comensales: se pagó por N personas y
    // se reserva para N. Si no, entrarían cuatro pagando dos.
    ticketCompraId = compraRow.id as string;
    ticketCodigoFinal = codigo;
    ticketProductoIdFinal = compraRow.producto_id as string;
    ticketUnidadesFinal = Number(compraRow.unidades);
    ticketImporteFinal = Number(compraRow.importe_total);
    ticketIvaFinal = Number(compraRow.iva ?? 0);
    tipoCategoriaFinal = "ticket";
    // Ya está cobrado: esta reserva no debe figurar como pendiente de pago.
    pagoPendienteFinal = false;
  }

  if (ticketObligatorio && !data.ticketProductoId && !ticketCompraId) {
    return { ok: false, error: "Este enlace solo acepta reservas con ticket y no quedan plazas disponibles. Contacta con el restaurante." };
  }
  if (data.ticketProductoId && !ticketCompraId) {
    const bloqueo = await admin
      .from("cliente_ticket_bloqueos")
      .select("id", { head: true, count: "exact" })
      .eq("empresa_id", empresa.id)
      .eq("cliente_id", cliente.id)
      .is("desbloqueado_at", null);
    if (bloqueo.error) {
      console.error("[reservar-publica] check bloqueo:", bloqueo.error);
      return { ok: false, error: "No pudimos validar tu cuenta." };
    }
    if ((bloqueo.count ?? 0) > 0) {
      return {
        ok: false,
        error: "Tu cuenta tiene un bloqueo por inasistencia previa. Contacta con el restaurante.",
      };
    }
    const producto = await admin
      .from("reserva_ticket_productos")
      .select("id, precio, iva, modo_precio, activo, empresa_id")
      .eq("id", data.ticketProductoId)
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    if (producto.error || !producto.data) {
      return { ok: false, error: "Producto no disponible." };
    }
    if (!producto.data.activo) {
      return { ok: false, error: "Este producto ya no está disponible." };
    }
    const unidades = producto.data.modo_precio === "por_persona" ? data.personas : 1;
    const precio = Number(producto.data.precio);
    const iva = Number(producto.data.iva);
    const consumo = await admin.rpc("consumir_stock_ticket", {
      p_producto_id: data.ticketProductoId,
      p_unidades: unidades,
    });
    if (consumo.error) {
      const msg = consumo.error.message ?? "";
      if (msg.includes("AGOTADO")) {
        return { ok: false, error: "Producto agotado." };
      }
      console.error("[reservar-publica] consumir_stock_ticket:", consumo.error);
      return { ok: false, error: "No pudimos reservar el stock." };
    }
    ticketProductoIdFinal = data.ticketProductoId;
    ticketUnidadesFinal = unidades;
    ticketImporteFinal = Number((precio * unidades).toFixed(2));
    ticketIvaFinal = iva;
    tipoCategoriaFinal = "ticket";
    pagoPendienteFinal = true;
  }

  // Asignación automática de mesa OBLIGATORIA (regla de negocio):
  // o hay mesa libre, o NO se acepta la reserva. Coge el primer local de
  // la empresa (las empresas hoy tienen 1 local; cuando aparezcan
  // multi-local habrá que añadir selector en el form público).
  const { data: local } = await admin
    .from("locales")
    .select("id")
    .eq("empresa_id", empresa.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!local) {
    console.error("[reservar-publica] sin local para empresa", empresa.id);
    return { ok: false, error: "No podemos aceptar reservas online ahora mismo. Inténtalo más tarde." };
  }
  // CUPO DEL TURNO (manda sobre las mesas).
  // Si la empresa tiene tope de comensales, ese límite va PRIMERO: aunque
  // queden mesas, si el turno está al tope no se acepta. Si no hay tope,
  // `try_reservar_slot` concede siempre y el límite real son las mesas.
  //
  // Se reserva ANTES de la mesa y con el mismo candado que usa Google, para
  // que ambos canales cuenten sobre el mismo saldo y no se vendan dos veces
  // las mismas plazas.
  const { data: cupoOk, error: errCupo } = await admin.rpc("try_reservar_slot", {
    p_empresa_id: empresa.id,
    p_fecha: data.fecha,
    p_turno: turno,
    p_personas: data.personas,
  });
  if (errCupo) {
    console.error("[reservar-publica] try_reservar_slot:", errCupo);
    return { ok: false, error: "No pudimos procesar la reserva. Inténtalo de nuevo en unos minutos." };
  }
  if (cupoOk !== true) {
    // El tope es del TURNO completo: no se sugiere otra hora porque todas las
    // del turno están igual de llenas.
    return {
      ok: false,
      error: `Lo sentimos, ya no quedan mesas libres para ${turno === "COMIDA" ? "la comida" : "la cena"} del ${data.fecha}.`,
    };
  }

  /** El cupo ya está apartado: hay que devolverlo si la reserva no llega a crearse. */
  const liberarCupo = async () => {
    try {
      await admin.rpc("liberar_slot_manual", {
        p_empresa_id: empresa.id,
        p_fecha: data.fecha,
        p_turno: turno,
        p_personas: data.personas,
      });
    } catch (e) {
      console.error("[reservar-publica] liberar_slot_manual:", e);
    }
  };

  // Grupo de zonas: el cliente eligió "Sala" o "Terraza", que agrupa varias
  // zonas internas. La mesa debe salir de ahí y solo de ahí.
  let zonaIdsPermitidas: string[] | null = null;
  let grupoZonaIdFinal: string | null = null;
  {
    const { data: cfgZona } = await admin
      .from("empresa_reservas_config")
      .select("exigir_zona_cliente")
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    const exigeZona = (cfgZona?.exigir_zona_cliente as boolean) ?? false;

    if (data.grupoZonaId) {
      // El grupo debe ser de ESTE local y estar activo: si no, un id manipulado
      // podría colar mesas de otro sitio.
      const { data: grupo } = await admin
        .from("grupos_zonas")
        .select("id, local_id, activa")
        .eq("id", data.grupoZonaId)
        .maybeSingle();
      if (!grupo || grupo.local_id !== local.id || !grupo.activa) {
        await liberarCupo();
        return { ok: false, error: "La zona elegida ya no está disponible. Vuelve a elegir." };
      }
      const { data: rel } = await admin
        .from("grupo_zona_zonas")
        .select("zona_id")
        .eq("grupo_zona_id", data.grupoZonaId);
      const ids = (rel ?? []).map((r) => r.zona_id as string);
      if (ids.length === 0) {
        await liberarCupo();
        return { ok: false, error: "La zona elegida no tiene mesas configuradas." };
      }
      zonaIdsPermitidas = ids;
      grupoZonaIdFinal = data.grupoZonaId;
    } else if (exigeZona) {
      await liberarCupo();
      return { ok: false, error: "Elige una zona para completar la reserva." };
    }
  }

  const asign = await asignarMesaAutomatica(admin as unknown as SupabaseClient, {
    localId: local.id as string,
    empresaId: empresa.id,
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
    zonaIds: zonaIdsPermitidas,
  });
  if (!asign.ok || !asign.mesa) {
    await liberarCupo();
    // Diferenciamos config rota vs. lleno para que se vea en logs.
    if (!asign.ok && asign.razon === "SIN_PLANO_ACTIVO") {
      console.error("[reservar-publica] sin plano activo en local", local.id);
      return { ok: false, error: "No podemos aceptar reservas online ahora mismo. Inténtalo más tarde." };
    }
    if (!asign.ok) {
      console.error("[reservar-publica] error asignando mesa:", asign.detalle);
      return { ok: false, error: "No pudimos procesar la reserva. Inténtalo de nuevo en unos minutos." };
    }
    // mesa=null: SIN_CANDIDATAS o SIN_MESAS_LIBRES → local lleno para esa
    // combinación de fecha, hora y comensales.
    return {
      ok: false,
      // Aquí sí es de ESA hora concreta (faltan mesas, no cupo), así que probar
      // otra hora es un consejo útil.
      error: `Lo sentimos, no quedan mesas libres para ${data.personas} ${data.personas === 1 ? "persona" : "personas"} el ${data.fecha} a las ${data.hora.slice(0, 5)}. Prueba con otra hora.`,
    };
  }
  const mesaFinal: string = asign.mesa.codigo;
  const zonaFinal: string | null = asign.mesa.zonaNombre || null;

  // ────────────────────────────────────────────────────────────────
  // Políticas de tarjeta (PRP-082 fase 1).
  //
  // Se resuelven AQUÍ, con la mesa y la zona ya decididas, porque las
  // condiciones pueden depender de ellas (un reservado que siempre exige
  // garantía). El importe se congela en la reserva: si mañana cambia la
  // configuración, esta reserva conserva lo que se le dijo al cliente.
  //
  // Esta fase solo marca y calcula. La tarjeta llega en la fase 2.
  // ────────────────────────────────────────────────────────────────
  const { data: cfgPoliticas } = await admin
    .from("empresa_reservas_config")
    .select(`${POLITICA_COLUMNAS_SELECT}, garantia_dias_antes`)
    .eq("empresa_id", empresa.id)
    .maybeSingle();

  // Ventana de la solicitud diferida: por debajo de estos días, la tarjeta se
  // pide en el momento; por encima, unos días antes de la reserva (§5.4).
  const diasAntesGarantia = Number(
    (cfgPoliticas as Record<string, unknown> | null)?.garantia_dias_antes ?? 4,
  );

  const datosPolitica = {
    personas: data.personas,
    fecha: data.fecha,
    hora: data.hora,
    turno,
    grupoZonaId: grupoZonaIdFinal,
    mesaId: asign.mesa.id,
  };
  const cfgRow = cfgPoliticas as Record<string, unknown> | null;

  // Sin pasarela no se puede pedir tarjeta, así que tampoco se marca la
  // reserva: si se marcara, el cliente acabaría en una pantalla de pago que
  // no puede completar y perdería la reserva por algo que no es culpa suya.
  //
  // Mientras Revolut no esté configurado, las políticas siguen existiendo como
  // texto en el correo —que es lo que hacían antes— pero no exigen nada.
  const { data: revolut } = await admin
    .from("empresa_revolut_config")
    .select("activo")
    .eq("empresa_id", empresa.id)
    .maybeSingle();
  const puedeCobrar = revolut?.activo === true;

  // Una reserva es UNA de estas cosas, nunca dos (ver `lib/tipo-reserva.ts`):
  //
  //   · TICKET apaga las dos políticas: el cliente ya ha pagado por adelantado,
  //     así que no se le puede pedir además una tarjeta. Sin esto, quien compra
  //     su ticket acababa en la pantalla de pago pidiéndole la tarjeta encima.
  //   · Si las condiciones de garantía y cancelación se solapan, gana la
  //     GARANTÍA: es la más estricta y es lo que el cliente acaba pagando, así
  //     el correo de condiciones nunca contradice al cobro. Antes se guardaban
  //     las dos y el cliente recibía dos correos con condiciones distintas.
  const yaPagado = ticketProductoIdFinal !== null;
  const puedePedirTarjeta = puedeCobrar && !yaPagado;

  const garantia = puedePedirTarjeta
    ? calcularPolitica(politicaDesdeRow(cfgRow, "garantia"), datosPolitica)
    : { aplica: false, importe: 0 };
  const cancelacionBruta = puedePedirTarjeta
    ? calcularPolitica(politicaDesdeRow(cfgRow, "cancelacion"), datosPolitica)
    : { aplica: false, importe: 0 };
  const cancelacion = garantia.aplica
    ? { aplica: false, importe: 0 }
    : cancelacionBruta;

  const exigeTarjeta = garantia.aplica || cancelacion.aplica;

  // Ventana de la solicitud diferida: por debajo de estos días la tarjeta se
  // pide ahora; por encima, unos días antes de la reserva (§5.4).
  const diasHastaReserva = Math.floor(
    (Date.parse(`${data.fecha}T00:00:00Z`) - Date.now()) / 86_400_000,
  );
  // Solo la GARANTÍA se pide en diferido: la cancelación guarda la tarjeta sin
  // retener nada, y eso no caduca.
  const garantiaEnDiferido =
    garantia.aplica && !cancelacion.aplica && diasHastaReserva > diasAntesGarantia;

  // La reserva nace provisional solo si el cliente tiene que pagar AHORA. En
  // diferido queda firme desde el primer momento: la tarjeta llegará después.
  const exigeTarjetaAlReservar = exigeTarjeta && !garantiaEnDiferido;

  // ────────────────────────────────────────────────────────────────
  // Vinculación pendiente de revisión.
  //
  // La reserva ha enganchado con una ficha que ya existía (por email o por
  // teléfono, nunca por nombre) pero el resto de datos no coinciden. Puede ser
  // la misma persona con otro nombre, o alguien distinto usando el móvil de un
  // familiar. Eso no lo puede decidir el sistema: se conserva lo que escribió
  // y lo resuelve el restaurante desde la ficha de la reserva.
  // ────────────────────────────────────────────────────────────────
  const camposDistintos = link.result.camposDistintos;
  const hayQueRevisar = link.result.existed && camposDistintos.length > 0;
  const datosDeclarados = hayQueRevisar
    ? construirDatosDeclarados(camposDistintos, {
        nombre: data.nombre,
        apellidos: data.apellidos,
        email: data.email,
        telefono: data.telefono,
      })
    : null;
  const motivoVinculacion = hayQueRevisar
    ? deducirMotivoVinculacion(camposDistintos, data.email)
    : null;

  // Id generado en código para poder disparar el correo sin releer la fila.
  const reservaId = crypto.randomUUID();
  const { data: filaCreada, error } = await admin.from("reservas").insert({
    id: reservaId,
    empresa_id: empresa.id,
    cliente_id: cliente.id,
    // Snapshot de la reserva = datos canónicos de la ficha (los originales mandan).
    cliente_nombre: cliente.nombre,
    cliente_apellidos: cliente.apellidos,
    cliente_telefono: cliente.telefono,
    // Excepción: el correo de confirmación tiene que llegarle a QUIEN ha
    // reservado, no al titular de la ficha. Si enganchó por teléfono y aportó
    // otro email, ése es su buzón; mandarlo al de la ficha avisaría a alguien
    // que no ha reservado (y le revelaría datos de un tercero).
    cliente_email: datosDeclarados?.email ?? cliente.email,
    datos_declarados: datosDeclarados,
    vinculacion_motivo: motivoVinculacion,
    vinculacion_estado: hayQueRevisar ? "PENDIENTE" : null,
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
    mesa: mesaFinal,
    // `zona` = zona interna real (la que ve el staff en el listado).
    // `grupo_zona_id` = lo que eligió el cliente (lo que lee en el correo).
    zona: zonaFinal,
    grupo_zona_id: grupoZonaIdFinal,
    notas: data.notas ?? null,
    // Esta reserva ENTRA por el motor de la web: aunque no venga con la palabra
    // clave de un enlace de campaña, su origen es la web y así debe constar.
    // Con `null` el listado la daba por "Manual", que es justo lo contrario:
    // parecía que la había metido alguien del restaurante a mano.
    origen: data.origen ?? "RESERVA_WEB",
    estado: "CONFIRMADA",
    turno,
    codigo_id: codigoId,
    codigo: codigoTexto,
    tipo_categoria: tipoCategoriaFinal,
    // Sin tarjeta no hay reserva: mientras el cliente paga, la fila aparta la
    // mesa pero NO cuenta como reserva del restaurante (no sale en la lista ni
    // dispara correos). Si no paga, se borra sola y la mesa vuelve al cupo.
    provisional_hasta: exigeTarjetaAlReservar
      ? new Date(Date.now() + MINUTOS_PARA_PAGAR * 60_000).toISOString()
      : null,
    tiene_garantia: garantia.aplica,
    garantia_importe: garantia.aplica ? garantia.importe : null,
    tiene_cancelacion: cancelacion.aplica,
    cancelacion_importe: cancelacion.aplica ? cancelacion.importe : null,
    // Marca la reserva como de Ticket. De esto depende que se envíe el correo
    // propio de Ticket y que salga el distintivo en el listado del salón.
    es_ticket: ticketProductoIdFinal !== null,
    ticket_producto_id: ticketProductoIdFinal,
    ticket_unidades: ticketUnidadesFinal,
    ticket_importe: ticketImporteFinal,
    ticket_iva: ticketIvaFinal,
    ticket_compra_id: ticketCompraId,
    ticket_codigo: ticketCodigoFinal,
    pago_pendiente: pagoPendienteFinal,
  }).select("garantia_token").single();
  if (error) {
    // Sin fila de reserva, el trigger de cancelación nunca devolvería el cupo:
    // hay que soltarlo a mano o el turno quedaría ocupado por una reserva
    // que no existe.
    await liberarCupo();
    console.error("[reservar-publica] insert error:", error);
    return { ok: false, error: "No pudimos crear la reserva" };
  }

  // ── Marcar el código como USADO ────────────────────────────────
  //
  // Va después del insert porque la compra guarda a qué reserva se canjeó. La
  // función bloquea la fila, así que dos personas usando el mismo código a la
  // vez no pueden canjearlo las dos: una gana y la otra recibe "ya utilizado".
  //
  // Si el canje falla, se deshace la reserva. Dejarla viva significaría regalar
  // una mesa pagada dos veces.
  if (ticketCompraId) {
    const canje = await admin.rpc("canjear_ticket_compra", {
      p_compra_id: ticketCompraId,
      p_reserva_id: reservaId,
    });
    if (canje.error) {
      await admin.from("reservas").delete().eq("id", reservaId);
      await liberarCupo();
      const msg = canje.error.message ?? "";
      console.error("[reservar-publica] canjear_ticket_compra:", canje.error);
      if (msg.includes("YA_UTILIZADO")) {
        return { ok: false, error: "Este código ya se usó en otra reserva." };
      }
      if (msg.includes("CADUCADO")) {
        return { ok: false, error: "Este código ha caducado." };
      }
      return { ok: false, error: "No pudimos validar tu código. Inténtalo de nuevo." };
    }
  }

  await admin.rpc("registrar_visita_cliente_sala", {
    p_cliente_id: cliente.id,
    p_fecha: data.fecha,
  });

  // Correo de confirmación. La reserva web se acepta al momento (o se rechaza
  // por falta de mesa), así que el cliente debe recibir su confirmación igual
  // que si la hubiéramos dado de alta desde Sala.
  //
  // Fire-and-forget A PROPÓSITO: la reserva YA está creada y es válida. Si el
  // correo falla (SMTP caído, plantilla desactivada), no se puede deshacer la
  // reserva ni tiene sentido mostrarle un error al cliente: se registra en log
  // y el restaurante la ve igualmente en Sala.
  // ── Correos según lo que le toque hacer al cliente ──────────────────
  //
  // Sin tarjeta      → confirmación normal, como siempre.
  // Tarjeta AHORA    → no se le escribe todavía: diría "confirmada" mientras
  //                    aún le queda pagar. El correo sale cuando la ponga.
  // Tarjeta DESPUÉS  → la reserva está firme y la tarjeta se pedirá unos días
  //                    antes (§5.4), así que se le confirma avisándole de eso.
  if (!exigeTarjeta) {
    notificarReservaCreada(reservaId).catch((e) =>
      console.error("[reservar-publica] mail CONFIRMACION:", e),
    );
  } else if (garantiaEnDiferido) {
    enviarReservaEmail(reservaId, "GARANTIA_PENDIENTE", {
      actor: { origen: "PORTAL_PUBLICO" },
    }).catch((e) => console.error("[reservar-publica] mail GARANTIA_PENDIENTE:", e));
  }

  return {
    ok: true,
    clienteExistente: link.result.existed,
    camposDistintos: link.result.camposDistintos,
    datosCliente: {
      nombre: cliente.nombre,
      apellidos: cliente.apellidos,
      email: cliente.email,
      telefono: cliente.telefono,
    },
    cuponAplicado: codigoTexto && cuponTituloCliente
      ? { codigo: codigoTexto, tituloCliente: cuponTituloCliente }
      : null,
    /**
     * Enlace al paso de tarjeta (PRP-082). Relleno solo cuando alguna política
     * lo exige: el formulario lleva ahí al cliente en vez de darle la reserva
     * por cerrada.
     */
    tarjetaPendiente: exigeTarjeta && !garantiaEnDiferido
      ? {
          token: (filaCreada?.garantia_token as string | null) ?? null,
          importe: garantia.aplica ? garantia.importe : cancelacion.importe,
          retiene: garantia.aplica,
        }
      : null,
  };
}
