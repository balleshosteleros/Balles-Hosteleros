"use server";

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import {
  getEmpresaActivaForUser,
  getZonaHorariaEmpresa,
} from "@/features/empresa/lib/empresa-server";
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
 * Además puede añadir las COMPRAS DE TICKET sin canjear (`reserva_ticket_compras`
 * sin `reserva_id`): tanto las pagadas —dinero cobrado que nadie ha consumido—
 * como las que se quedaron a medias, que son clientes con nombre y teléfono que
 * quisieron comprar y no llegaron a pagar. Esas filas NO son reservas: viajan
 * marcadas con `esCompraTicket` para que la vista las distinga y para que nunca
 * entren en los totales de reservas.
 */

/** Instante ISO → "AAAA-MM-DD" en la zona del restaurante. */
function fechaEnZona(iso: string, tz: string): string {
  if (!iso) return "";
  try {
    // `en-CA` da directamente AAAA-MM-DD, que es el formato con el que
    // trabajan el resto de fechas del listado (ordenar y filtrar dependen de
    // ello). Lo que se ve por pantalla se formatea después.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** Instante ISO → "HH:MM" en la zona del restaurante. */
function horaEnZona(iso: string, tz: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/**
 * Cómo se lee cada estado de compra en la columna Estado.
 *
 * ⚠️ Sin esto la fila salía con el estado en blanco y una compra a medias
 * parecía una venta buena: mismo importe, misma pinta, sin nada que dijera que
 * ese dinero nunca entró.
 */
const ESTADO_COMPRA_TEXTO: Record<string, string> = {
  // Ninguna de estas filas tiene mesa, y la columna Fecha enseña el día del
  // REGISTRO: sin decirlo, la fila se lee como una reserva del calendario que
  // no existe. El estado lo desmiente de una vez, corto y en su sitio.
  //
  // El matiz de por qué no la tiene (pagó y no ha elegido día, no puso
  // tarjeta, se la rechazaron) va en la columna Ticket, que es donde está el
  // dinero y hay espacio para decirlo.
  // Sin tarjeta NO puede haber reserva: es el paso de antes. Quien no llegó a
  // pagar se queda en "Sin tarjeta"; quien pagó y aún no ha elegido día, en
  // "Sin reserva". Así el estado dice en qué escalón se paró cada uno.
  pagada: "Sin reserva",
  pendiente: "Sin tarjeta",
  caducada: "Sin tarjeta",
  fallida: "Sin tarjeta",
  cancelada: "Sin tarjeta",
};

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
  /** Devuelto al cliente (positivo). 0 = no se le ha devuelto nada. */
  importeDevuelto: number;
  /** Se intentó devolver y el banco lo rechazó: el cliente NO tiene su dinero. */
  devolucionFallida: boolean;
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
    importeDevuelto: 0,
    devolucionFallida: false,
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
 *
 * Con `soloConDinero` se deja fuera todo lo que no lleve dinero aparejado. Es
 * lo que pide la vista de cobros: una reserva gratis, sin garantía ni política
 * ni ticket, no pinta nada en una pantalla de cobros.
 */
export async function getListadoReservas(params: {
  desde: string;
  hasta: string;
  campoFecha?: "fecha" | "created_at";
  /** Si es `false` no se consultan las compras (la vista no las pide). */
  incluirComprasTicket?: boolean;
  /** Solo reservas con garantía, política de cancelación o ticket. */
  soloConDinero?: boolean;
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

    let query = supabase
      .from("reservas")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte(columna, desdeFiltro)
      .lte(columna, hastaFiltro);

    // Vista de cobros: solo lo que lleva dinero aparejado. Se filtra en la base
    // de datos y no en memoria porque Supabase corta a 1000 filas: filtrando
    // después, las reservas gratis se comerían el cupo y las de dinero —que son
    // las únicas que importan aquí— se quedarían fuera del listado.
    if (params.soloConDinero) {
      query = query.or(
        "tiene_garantia.eq.true,tiene_cancelacion.eq.true,es_ticket.eq.true",
      );
    }

    const { data, error } = await query
      .order("fecha", { ascending: false })
      .order("hora", { ascending: true });
    if (error) throw error;

    const filas = (data ?? []) as Record<string, unknown>[];

    // Las horas se fechan en la zona del RESTAURANTE, no en la del navegador:
    // quien mira los cobros desde fuera de España vería otro día.
    const tz = await getZonaHorariaEmpresa(
      supabase as unknown as SupabaseClient,
      empresaId,
    );

    // Compras de ticket pagadas y sin reserva: son las que el usuario puede
    // querer ver junto al listado. Se piden siempre por fecha de compra.
    const comprasPromise = params.incluirComprasTicket
      ? supabase
          .from("reserva_ticket_compras")
          .select("*")
          .eq("empresa_id", empresaId)
          // Pagadas sin canjear (dinero cobrado que nadie ha consumido) y
          // también las que se quedaron a medias: son clientes con nombre,
          // correo y teléfono que quisieron comprar y no terminaron. Sin
          // ellas no aparecían en ninguna pantalla del software.
          .in("estado", ["pagada", "pendiente", "caducada", "fallida", "cancelada"])
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
      comprasCanjeadasRes,
      devolucionesRes,
    ] = await Promise.all([
      clienteIds.length
        ? supabase
            .from("clientes_sala")
            .select("id, clasificacion, visitas, ultima_visita")
            .in("id", clienteIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      supabase
        .from("reserva_ticket_productos")
        .select("id, nombre, clave")
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
      // Cuándo se pagó el ticket de una reserva YA canjeada. El dato vive en
      // la compra, no en la reserva: sin esto la columna "Pagado el" salía
      // vacía justo en las reservas que sí tienen dinero detrás.
      reservaIds.length
        ? supabase
            .from("reserva_ticket_compras")
            .select("reserva_id, pagado_at, unidades")
            .in("reserva_id", reservaIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      // Devoluciones: sin esto la pantalla enseña como cobrado un dinero que
      // ya volvió a la tarjeta del cliente, y el total no cuadra con el banco.
      supabase
        .from("reserva_cobros")
        .select("reserva_id, compra_id, importe, estado")
        .eq("empresa_id", empresaId)
        // También los rechazados: una devolución que el banco tumba deja al
        // cliente sin su dinero y a nadie avisado. Tiene que verse.
        .in("estado", ["devuelto", "fallido", "lanzado"])
        .lt("importe", 0),
    ]);

    const clientesMap = new Map<string, Record<string, unknown>>();
    for (const c of (clientesRes.data ?? []) as Record<string, unknown>[]) {
      clientesMap.set(s(c.id), c);
    }
    // La columna Ticket enseña la PALABRA CLAVE del producto, no su nombre
    // comercial: "EXPERIENCIA" identifica de un vistazo lo que una frase de
    // ocho palabras hacía ilegible. El nombre completo sigue disponible para
    // quien abra la ficha.
    const pagadoPorReserva = new Map<string, string>();
    for (const c of (comprasCanjeadasRes.data ?? []) as Record<string, unknown>[]) {
      const rid = s(c.reserva_id);
      if (rid && c.pagado_at) pagadoPorReserva.set(rid, s(c.pagado_at));
    }

    // Lo devuelto por reserva y por compra. Los importes se guardan en
    // negativo (salieron), aquí se suman en positivo para poder restarlos.
    const devueltoPorReserva = new Map<string, number>();
    const devueltoPorCompra = new Map<string, number>();
    // Devoluciones que el banco RECHAZÓ o que siguen sin respuesta: el cliente
    // no tiene su dinero y hay que hacer algo.
    const falloPorReserva = new Set<string>();
    const falloPorCompra = new Set<string>();
    for (const d of (devolucionesRes.data ?? []) as Record<string, unknown>[]) {
      const importe = Math.abs(Number(d.importe ?? 0));
      const rid = s(d.reserva_id);
      const cid = s(d.compra_id);
      if (s(d.estado) === "devuelto") {
        if (rid) devueltoPorReserva.set(rid, (devueltoPorReserva.get(rid) ?? 0) + importe);
        if (cid) devueltoPorCompra.set(cid, (devueltoPorCompra.get(cid) ?? 0) + importe);
      } else {
        if (rid) falloPorReserva.add(rid);
        if (cid) falloPorCompra.add(cid);
      }
    }

    const ticketsMap = new Map<string, string>();
    for (const t of (ticketsRes.data ?? []) as Record<string, unknown>[]) {
      ticketsMap.set(s(t.id), s(t.clave) || s(t.nombre));
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
        // Una reserva de ticket se pagó al COMPRARLO, no al reservar: su
        // `importe_pagado` viene vacío y la columna salía en blanco aunque el
        // cliente hubiera pagado. Se cae al importe del ticket.
        importePagado: num(r.importe_pagado) || num(r.ticket_importe),
        importeDevuelto: devueltoPorReserva.get(s(r.id)) ?? 0,
        ticketPagadoAt: pagadoPorReserva.get(s(r.id)) ?? "",
        devolucionFallida: falloPorReserva.has(s(r.id)),
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
        const estadoCompra = s(c.estado);
        const pagada = estadoCompra === "pagada" || estadoCompra === "canjeada";
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

          // Una compra sin canjear no tiene día RESERVADO —ése es justo el
          // dato que falta—, así que estas dos columnas enseñan cuándo se
          // registró la compra. Vacías no decían nada y la fila parecía rota.
          // Van en la zona del restaurante: quien mira desde fuera de España
          // vería otro día.
          fecha: fechaEnZona(s(c.created_at), tz),
          hora: horaEnZona(s(c.created_at), tz),
          turno: "",

          // Para cuánta gente pagó. Es el mismo dato que los comensales de una
          // reserva: se guarda al comprar, para poder sentarlos después.
          comensales: num(c.unidades),

          // El TIPO es el mismo que el de una reserva canjeada —las dos son
          // de ticket—, así que se rotula igual. Lo que las diferencia es el
          // estado (con mesa o sin ella), no la clase de producto. Poner aquí
          // "Compra de ticket" creaba dos nombres para lo mismo, y encima
          // repetía lo que ya dice la columna Origen.
          tipoCategoria: "Ticket",

          // El estado de la compra se enseña tal cual: quien mira la lista
          // tiene que distinguir de un vistazo lo cobrado de lo que se quedó
          // a medias.
          estado: ESTADO_COMPRA_TEXTO[estadoCompra] ?? estadoCompra,
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

          // Solo cuenta como dinero lo que Revolut confirmó. Una compra a
          // medias lleva su importe en `ticketImporte` para saber qué iba a
          // comprar, pero aquí un 0: nunca entró en caja.
          importePagado: pagada ? num(c.importe_total) : 0,
          importeDevuelto: devueltoPorCompra.get(s(c.id)) ?? 0,
          devolucionFallida: falloPorCompra.has(s(c.id)),

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
