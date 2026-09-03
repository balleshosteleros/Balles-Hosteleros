"use server";

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError } from "@/shared/lib/friendly-errors";

/**
 * Listado analítico de la pantalla Sala (debajo de las gráficas).
 *
 * Devuelve UNA FILA POR RESERVA con todo lo que el sistema sabe de ella: sus
 * propios campos más lo que cuelga de las tablas relacionadas (ficha del
 * cliente, producto-ticket, compra de ticket canjeada y etiquetas). No agrupa
 * por cliente a propósito: dos reservas del mismo cliente son dos líneas,
 * porque aquí se analizan reservas, no clientes.
 *
 * Además puede añadir las COMPRAS DE TICKET todavía sin canjear
 * (`reserva_ticket_compras` en estado `pagada`, sin `reserva_id`). Esas filas
 * NO son reservas: viajan marcadas con `esCompraTicket` para que la vista las
 * distinga y para que nunca entren en los totales de reservas.
 */

/** Qué es cada fila del listado. Una compra sin canjear no es una reserva. */
export type ListadoTipoFila = "RESERVA" | "COMPRA_TICKET";

export interface ListadoReservaRow {
  /** `true` si la fila es una compra de ticket sin canjear, no una reserva. */
  esCompraTicket: boolean;
  tipoFila: ListadoTipoFila;

  // --- Identidad ---
  id: string;
  /** Nombre completo tal y como se muestra. */
  cliente: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;

  // --- Cuándo y cuántos ---
  fecha: string;
  hora: string;
  turno: string;
  comensales: number | null;
  duracionMinutos: number | null;

  // --- Dónde ---
  zona: string;
  mesa: string;

  // --- Situación ---
  estado: string;
  origen: string;
  observaciones: string;

  // --- Dinero y compromiso ---
  tipoCategoria: string;
  tarjetaIntroducida: boolean;
  importePagado: number | null;
  pagoPendiente: boolean;

  // --- Garantía (dinero retenido en la tarjeta antes de venir) ---
  tieneGarantia: boolean;
  garantiaImporte: number | null;
  /** "pendiente" | "retenida" | "cobrada" | "liberada" | "caducada" | … */
  garantiaEstado: string;
  garantiaTarjeta: string;
  garantiaSolicitadaAt: string;
  garantiaRetenidaAt: string;
  garantiaCobradaAt: string;
  /** Último día que el banco deja capturar la retención. */
  garantiaCaptureDeadline: string;
  garantiaLimiteAt: string;

  // --- Política de cancelación (cobro contra tarjeta guardada) ---
  tieneCancelacion: boolean;
  cancelacionImporte: number | null;
  /** "pendiente" | "guardada" | "cobrada" | "fallida" | "perdonada" | … */
  cancelacionEstado: string;
  cancelacionTarjeta: string;
  cancelacionGuardadaAt: string;
  cancelacionCobradaAt: string;
  cancelacionIntentos: number | null;
  cancelacionUltimoIntentoAt: string;
  cancelacionProximoIntentoAt: string;
  cancelacionError: string;

  // --- Decisión humana sobre el cobro ---
  cobroMotivo: string;
  cobroPerdonadoAt: string;
  /** Cuándo el cliente incumplió la política (canceló tarde o no vino). */
  politicaIncumplidaAt: string;
  /**
   * `true` si hay dinero que cobrar y NADIE ha decidido todavía: el cliente
   * incumplió, la tarjeta está guardada y ni se ha cobrado ni se ha perdonado.
   * Es la única fila que reclama una acción humana.
   */
  cobroSinDecidir: boolean;

  // --- Ticket ---
  esTicket: boolean;
  ticketProducto: string;
  ticketUnidades: number | null;
  ticketImporte: number | null;
  ticketIva: number | null;
  ticketCodigo: string;
  /** Solo compras: "pagada" (pendiente de canjear), "canjeada", … */
  ticketEstadoCompra: string;
  /** Solo compras: último día para canjear el código. */
  ticketCanjeHasta: string;
  ticketPagadoAt: string;

  // --- Cupón ---
  cupon: string;
  cuponTitulo: string;

  // --- Ficha del cliente ---
  clienteId: string | null;
  clienteClasificacion: string;
  clienteVisitas: number | null;
  clienteUltimaVisita: string;

  // --- Etiquetas ---
  etiquetas: string[];

  // --- Trazabilidad ---
  bloqueada: boolean;
  vinculacionEstado: string;
  externalOrigen: string;
  externalId: string;
  reconfirmadaAt: string;
  emailConfirmacionAt: string;
  emailReconfirmacionAt: string;
  emailRecordatorioAt: string;
  emailCancelacionAt: string;
  emailValoracionAt: string;
  createdAt: string;
}

export interface ListadoReservasResult {
  ok: boolean;
  /** Reservas del rango. Nunca incluye compras sin canjear. */
  reservas: ListadoReservaRow[];
  /** Compras de ticket pagadas y todavía sin reserva. */
  comprasTicket: ListadoReservaRow[];
  error?: string;
}

/** Texto vacío en vez de null: la tabla y la exportación quieren strings. */
function s(v: unknown): string {
  return v == null ? "" : String(v);
}

/** "VISA ·6688" — la tarjeta como la reconoce el cliente, sin exponer nada más. */
function tarjeta(marca: unknown, ultimos4: unknown): string {
  const m = s(marca).toUpperCase();
  const u = s(ultimos4);
  if (!m && !u) return "";
  return [m, u ? `\u00b7${u}` : ""].filter(Boolean).join(" ");
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Fila vacía: cada listado rellena solo lo que le aplica. */
function filaBase(): ListadoReservaRow {
  return {
    esCompraTicket: false,
    tipoFila: "RESERVA",
    id: "",
    cliente: "",
    nombre: "",
    apellidos: "",
    telefono: "",
    email: "",
    fecha: "",
    hora: "",
    turno: "",
    comensales: null,
    duracionMinutos: null,
    zona: "",
    mesa: "",
    estado: "",
    origen: "",
    observaciones: "",
    tipoCategoria: "",
    tarjetaIntroducida: false,
    importePagado: null,
    pagoPendiente: false,
    tieneGarantia: false,
    garantiaImporte: null,
    garantiaEstado: "",
    garantiaTarjeta: "",
    garantiaSolicitadaAt: "",
    garantiaRetenidaAt: "",
    garantiaCobradaAt: "",
    garantiaCaptureDeadline: "",
    garantiaLimiteAt: "",
    tieneCancelacion: false,
    cancelacionImporte: null,
    cancelacionEstado: "",
    cancelacionTarjeta: "",
    cancelacionGuardadaAt: "",
    cancelacionCobradaAt: "",
    cancelacionIntentos: null,
    cancelacionUltimoIntentoAt: "",
    cancelacionProximoIntentoAt: "",
    cancelacionError: "",
    cobroMotivo: "",
    cobroPerdonadoAt: "",
    politicaIncumplidaAt: "",
    cobroSinDecidir: false,
    esTicket: false,
    ticketProducto: "",
    ticketUnidades: null,
    ticketImporte: null,
    ticketIva: null,
    ticketCodigo: "",
    ticketEstadoCompra: "",
    ticketCanjeHasta: "",
    ticketPagadoAt: "",
    cupon: "",
    cuponTitulo: "",
    clienteId: null,
    clienteClasificacion: "",
    clienteVisitas: null,
    clienteUltimaVisita: "",
    etiquetas: [],
    bloqueada: false,
    vinculacionEstado: "",
    externalOrigen: "",
    externalId: "",
    reconfirmadaAt: "",
    emailConfirmacionAt: "",
    emailReconfirmacionAt: "",
    emailRecordatorioAt: "",
    emailCancelacionAt: "",
    emailValoracionAt: "",
    createdAt: "",
  };
}

/**
 * Trae las reservas de un rango de fechas con todo lo relacionado, y aparte las
 * compras de ticket todavía sin canjear.
 *
 * `campoFecha` decide contra qué columna se recorta el rango, igual que las
 * gráficas de arriba: por el día en que se sienta el cliente (`fecha`) o por el
 * día en que se hizo la reserva (`created_at`). Así el listado y las gráficas
 * hablan del mismo conjunto de reservas.
 *
 * Las compras sin canjear se recortan siempre por su fecha de compra: no tienen
 * día reservado —ése es justo el dato que les falta—, así que filtrarlas por
 * `fecha` las dejaría fuera siempre.
 */
export async function getListadoReservas(params: {
  desde: string;
  hasta: string;
  campoFecha?: "fecha" | "created_at";
  /** Si es `false` no se consultan las compras (la vista no las pide). */
  incluirComprasTicket?: boolean;
}): Promise<ListadoReservasResult> {
  const vacio: ListadoReservasResult = { ok: false, reservas: [], comprasTicket: [] };
  try {
    const supabase = await createClient();
    const user = await getUsuarioActual();
    if (!user) return { ...vacio, error: "Sin sesión" };

    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ...vacio, error: "Sin empresa activa" };

    const columna = params.campoFecha === "created_at" ? "created_at" : "fecha";
    const desdeFiltro =
      columna === "created_at" ? `${params.desde}T00:00:00Z` : params.desde;
    const hastaFiltro =
      columna === "created_at" ? `${params.hasta}T23:59:59Z` : params.hasta;

    const { data, error } = await supabase
      .from("reservas")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte(columna, desdeFiltro)
      .lte(columna, hastaFiltro)
      .order("fecha", { ascending: false })
      .order("hora", { ascending: true });
    if (error) throw error;

    const filas = (data ?? []) as Record<string, unknown>[];

    // Compras de ticket pagadas y sin reserva: son las que el usuario puede
    // querer ver junto al listado. Se piden siempre por fecha de compra.
    const comprasPromise = params.incluirComprasTicket
      ? supabase
          .from("reserva_ticket_compras")
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("estado", "pagada")
          .is("reserva_id", null)
          .gte("created_at", `${params.desde}T00:00:00Z`)
          .lte("created_at", `${params.hasta}T23:59:59Z`)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] });

    // Catálogos relacionados: se piden enteros de una vez (son tablas cortas)
    // en lugar de un join por fila, que multiplicaría las consultas.
    const clienteIds = [
      ...new Set(filas.map((r) => s(r.cliente_id)).filter(Boolean)),
    ];
    const reservaIds = filas.map((r) => s(r.id));

    const [
      clientesRes,
      ticketsRes,
      cuponesRes,
      etiqRes,
      etiqClienteRes,
      catalogoRes,
      comprasRes,
    ] = await Promise.all([
      clienteIds.length
        ? supabase
            .from("clientes_sala")
            .select("id, clasificacion, visitas, ultima_visita")
            .in("id", clienteIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      supabase
        .from("reserva_ticket_productos")
        .select("id, nombre")
        .eq("empresa_id", empresaId),
      supabase
        .from("reserva_codigos")
        .select("id, titulo_interno")
        .eq("empresa_id", empresaId),
      reservaIds.length
        ? supabase
            .from("sala_reserva_etiquetas")
            .select("reserva_id, etiqueta_id")
            .in("reserva_id", reservaIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      clienteIds.length
        ? supabase
            .from("sala_cliente_etiquetas")
            .select("cliente_id, etiqueta_id")
            .in("cliente_id", clienteIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      supabase.from("sala_etiquetas").select("id, nombre").eq("empresa_id", empresaId),
      comprasPromise,
    ]);

    const clientesMap = new Map<string, Record<string, unknown>>();
    for (const c of (clientesRes.data ?? []) as Record<string, unknown>[]) {
      clientesMap.set(s(c.id), c);
    }
    const ticketsMap = new Map<string, string>();
    for (const t of (ticketsRes.data ?? []) as Record<string, unknown>[]) {
      ticketsMap.set(s(t.id), s(t.nombre));
    }
    const cuponesMap = new Map<string, string>();
    for (const c of (cuponesRes.data ?? []) as Record<string, unknown>[]) {
      cuponesMap.set(s(c.id), s(c.titulo_interno));
    }
    const etiquetaNombre = new Map<string, string>();
    for (const e of (catalogoRes.data ?? []) as Record<string, unknown>[]) {
      etiquetaNombre.set(s(e.id), s(e.nombre));
    }

    // Etiquetas efectivas: las propias de la reserva MÁS las heredadas de la
    // ficha del cliente, igual que en la ficha de la reserva. Sin duplicados.
    const etiquetasPorReserva = new Map<string, Set<string>>();
    for (const row of (etiqRes.data ?? []) as Record<string, unknown>[]) {
      const rid = s(row.reserva_id);
      const nombre = etiquetaNombre.get(s(row.etiqueta_id));
      if (!nombre) continue;
      if (!etiquetasPorReserva.has(rid)) etiquetasPorReserva.set(rid, new Set());
      etiquetasPorReserva.get(rid)!.add(nombre);
    }
    const etiquetasPorCliente = new Map<string, Set<string>>();
    for (const row of (etiqClienteRes.data ?? []) as Record<string, unknown>[]) {
      const cid = s(row.cliente_id);
      const nombre = etiquetaNombre.get(s(row.etiqueta_id));
      if (!nombre) continue;
      if (!etiquetasPorCliente.has(cid)) etiquetasPorCliente.set(cid, new Set());
      etiquetasPorCliente.get(cid)!.add(nombre);
    }

    const reservas: ListadoReservaRow[] = filas.map((r) => {
      const id = s(r.id);
      const clienteId = s(r.cliente_id) || null;
      const ficha = clienteId ? clientesMap.get(clienteId) : undefined;

      const nombre = s(r.cliente_nombre);
      const apellidos = s(r.cliente_apellidos);

      const etiquetas = new Set<string>(etiquetasPorReserva.get(id) ?? []);
      if (clienteId) {
        for (const e of etiquetasPorCliente.get(clienteId) ?? []) etiquetas.add(e);
      }

      return {
        ...filaBase(),
        esCompraTicket: false,
        tipoFila: "RESERVA",
        id,
        cliente: [nombre, apellidos].filter(Boolean).join(" ").trim(),
        nombre,
        apellidos,
        telefono: s(r.cliente_telefono),
        email: s(r.cliente_email),

        fecha: s(r.fecha),
        // La BD guarda `time` con segundos ("21:00:00"); en pantalla sobran.
        hora: s(r.hora).slice(0, 5),
        turno: s(r.turno),
        comensales: num(r.personas),
        duracionMinutos: num(r.duracion_minutos),

        zona: s(r.zona),
        mesa: s(r.mesa),

        estado: s(r.estado),
        origen: s(r.origen),
        observaciones: s(r.notas),

        tipoCategoria: s(r.tipo_categoria),
        tarjetaIntroducida: Boolean(r.tarjeta_introducida),
        importePagado: num(r.importe_pagado),
        pagoPendiente: Boolean(r.pago_pendiente),

        tieneGarantia: Boolean(r.tiene_garantia),
        garantiaImporte: num(r.garantia_importe),
        garantiaEstado: s(r.garantia_estado),
        garantiaTarjeta: tarjeta(r.garantia_tarjeta_marca, r.garantia_tarjeta_ultimos4),
        garantiaSolicitadaAt: s(r.garantia_solicitada_at),
        garantiaRetenidaAt: s(r.garantia_retenida_at),
        garantiaCobradaAt: s(r.garantia_cobrada_at),
        garantiaCaptureDeadline: s(r.garantia_capture_deadline),
        garantiaLimiteAt: s(r.garantia_limite_at),

        tieneCancelacion: Boolean(r.tiene_cancelacion),
        cancelacionImporte: num(r.cancelacion_importe),
        cancelacionEstado: s(r.cancelacion_estado),
        cancelacionTarjeta: tarjeta(r.cancelacion_tarjeta_marca, r.cancelacion_tarjeta_ultimos4),
        cancelacionGuardadaAt: s(r.cancelacion_guardada_at),
        cancelacionCobradaAt: s(r.cancelacion_cobrada_at),
        cancelacionIntentos: num(r.cancelacion_intentos),
        cancelacionUltimoIntentoAt: s(r.cancelacion_ultimo_intento_at),
        cancelacionProximoIntentoAt: s(r.cancelacion_proximo_intento_at),
        cancelacionError: s(r.cancelacion_error),

        cobroMotivo: s(r.cobro_motivo),
        cobroPerdonadoAt: s(r.cobro_perdonado_at),
        politicaIncumplidaAt: s(r.politica_incumplida_at),
        // Mismo criterio que el aviso de la barra (PRP-082 §5.6): incumplió,
        // hay tarjeta guardada y nadie ha cobrado ni perdonado todavía.
        cobroSinDecidir:
          Boolean(r.politica_incumplida_at) &&
          !r.cobro_perdonado_at &&
          (r.cancelacion_estado === "guardada" || r.garantia_estado === "retenida"),

        esTicket: Boolean(r.es_ticket),
        ticketProducto: ticketsMap.get(s(r.ticket_producto_id)) ?? "",
        ticketUnidades: num(r.ticket_unidades),
        ticketImporte: num(r.ticket_importe),
        ticketIva: num(r.ticket_iva),
        ticketCodigo: s(r.ticket_codigo),

        cupon: s(r.codigo),
        cuponTitulo: cuponesMap.get(s(r.codigo_id)) ?? "",

        clienteId,
        clienteClasificacion: s(ficha?.clasificacion),
        clienteVisitas: num(ficha?.visitas),
        clienteUltimaVisita: s(ficha?.ultima_visita),

        etiquetas: [...etiquetas].sort((a, b) => a.localeCompare(b, "es")),

        bloqueada: Boolean(r.bloqueada),
        vinculacionEstado: s(r.vinculacion_estado),
        externalOrigen: s(r.external_origen),
        externalId: s(r.external_id),
        reconfirmadaAt: s(r.reconfirmada_at),
        emailConfirmacionAt: s(r.email_confirmacion_at),
        emailReconfirmacionAt: s(r.email_reconfirmacion_at),
        emailRecordatorioAt: s(r.email_recordatorio_at),
        emailCancelacionAt: s(r.email_cancelacion_at),
        emailValoracionAt: s(r.email_valoracion_at),
        createdAt: s(r.created_at),
      };
    });

    // Compras sin canjear. Se intenta enganchar cada compra con su ficha de
    // cliente por email o teléfono, para que al pulsar el nombre se abra la
    // ficha igual que en una reserva. Quien compra un ticket puede no tener
    // ficha todavía: entonces la fila se queda sin `clienteId` y el nombre no
    // navega a ninguna parte.
    const comprasRaw = (comprasRes.data ?? []) as Record<string, unknown>[];
    let comprasTicket: ListadoReservaRow[] = [];

    if (comprasRaw.length > 0) {
      const emails = [
        ...new Set(
          comprasRaw
            .map((c) => s(c.comprador_email).trim().toLowerCase())
            .filter(Boolean),
        ),
      ];
      const fichasPorEmail = new Map<string, Record<string, unknown>>();
      if (emails.length) {
        const { data: fichas } = await supabase
          .from("clientes_sala")
          .select("id, email_normalizado, clasificacion, visitas, ultima_visita")
          .eq("empresa_id", empresaId)
          .in("email_normalizado", emails);
        for (const f of (fichas ?? []) as Record<string, unknown>[]) {
          fichasPorEmail.set(s(f.email_normalizado), f);
        }
      }

      comprasTicket = comprasRaw.map((c) => {
        const emailNorm = s(c.comprador_email).trim().toLowerCase();
        const ficha = fichasPorEmail.get(emailNorm);
        const nombreCompleto = s(c.comprador_nombre).trim();
        // El formulario de compra pide un solo campo de nombre; se parte para
        // que las columnas Nombre y Apellidos del listado no queden vacías.
        const partes = nombreCompleto.split(/\s+/);
        return {
          ...filaBase(),
          esCompraTicket: true,
          tipoFila: "COMPRA_TICKET",
          id: s(c.id),
          cliente: nombreCompleto,
          nombre: partes[0] ?? "",
          apellidos: partes.slice(1).join(" "),
          telefono: s(c.comprador_telefono),
          email: s(c.comprador_email),

          // Una compra sin canjear no tiene día ni hora reservados: ése es
          // justo el dato que falta. Se deja en blanco a propósito para que
          // nadie la confunda con una reserva puesta en el calendario.
          fecha: "",
          hora: "",
          turno: "",

          estado: "",
          origen: "Compra ticket",

          esTicket: true,
          ticketProducto: ticketsMap.get(s(c.producto_id)) ?? "",
          ticketUnidades: num(c.unidades),
          ticketImporte: num(c.importe_total),
          ticketIva: num(c.iva),
          ticketCodigo: s(c.codigo),
          ticketEstadoCompra: s(c.estado),
          ticketCanjeHasta: s(c.canje_hasta),
          ticketPagadoAt: s(c.pagado_at),

          importePagado: num(c.importe_total),

          clienteId: ficha ? s(ficha.id) : null,
          clienteClasificacion: s(ficha?.clasificacion),
          clienteVisitas: num(ficha?.visitas),
          clienteUltimaVisita: s(ficha?.ultima_visita),

          createdAt: s(c.created_at),
        };
      });
    }

    return { ok: true, reservas, comprasTicket };
  } catch (err) {
    console.error("[listado-reservas] getListadoReservas:", err);
    return { ...vacio, error: friendlyError(err, "getListadoReservas") };
  }
}
