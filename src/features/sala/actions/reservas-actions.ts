"use server";

import { createClient } from "@/lib/supabase/server";
import {
  validarTelefono,
  validarEmail,
  validarNombre,
} from "@/shared/lib/validar-contacto";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  getEmpresaActivaForUser,
  getZonaHorariaEmpresa,
} from "@/features/empresa/lib/empresa-server";
import { zonaLocalAUtcISO } from "@/features/empresa/lib/zona-horaria";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrLinkClienteSala, type CampoDistinto } from "@/features/sala/lib/cliente-link";
import { asignarMesaAutomatica } from "@/features/sala/planos/lib/asignacion-mesa";
import { getMesasBloqueadas } from "@/features/sala/bloqueos/lib/mesas-bloqueadas";
import { getCamposObligatoriosReserva } from "@/features/sala/lib/reserva-campos-obligatorios";
import { turnoDeHora } from "@/features/sala/lib/dia-negocio";
import { tipoDeReserva } from "@/features/sala/lib/tipo-reserva";
import {
  buscarConflictoMesa,
  getDuracionReservaMin,
  ESTADOS_NO_OCUPANTES,
} from "@/features/sala/lib/reserva-conflicto";
import {
  esHoraEnCuarto,
  MENSAJE_HORA_CUARTO,
} from "@/features/sala/lib/reserva-cuartos";
import type { TipoMesa } from "@/features/sala/planos/data/planos";
import { RESERVA_COMENTARIO_MAX_CHARS } from "@/features/sala/data/reservas";
import { normalizarOrigen, ORIGEN_SIN_DATO } from "@/features/sala/data/origenes";
import { friendlyError } from "@/shared/lib/friendly-errors";
import {
  enviarReservaEmail,
  type ReservaEmailActor,
} from "@/lib/email/reservas/mailer";
import { enviarAvisoReserva } from "@/lib/mensajeria/reservas";
import {
  esTipoEstado,
  type ReservaEmailTipo,
} from "@/lib/seeds/reserva-email-plantillas";
import { componerTelefono } from "@/features/sala/data/prefijos-telefono";
async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { supabase, user: null, empresaId: null, nombre: null, usuarioId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);

  const { data } = await supabase

    .from("usuarios")

    .select("id, nombre, apellidos")

    .eq("user_id", user.id)

    .single();
return {
    supabase,
    user,
    empresaId,
    nombre: data ? data.nombre + " " + data.apellidos : null,
    // `usuarios.id` (no auth.users): es lo que referencia el histórico de correos.
    usuarioId: (data?.id as string | undefined) ?? null,
  };
}

/**
 * Actor para el histórico de correos: la persona con sesión abierta que está
 * usando el software ahora mismo. Todo lo que se dispara desde el back office
 * lleva su firma.
 */
function actorDeSesion(ctx: {
  usuarioId: string | null;
  nombre: string | null;
}): ReservaEmailActor {
  return {
    usuarioId: ctx.usuarioId,
    usuarioNombre: ctx.nombre,
    origen: "MANUAL",
  };
}

/**
 * Columnas que pinta la pantalla de sala. EXPLÍCITAS, no `*`: la tabla tiene 92
 * y con `*` cada día arrastraba tokens de cobro, textos de error y trazas de
 * webhooks que no se muestran en ningún sitio. Se trae también el nombre del
 * producto del ticket, para el aviso del icono, y así no hay que pedirlo fila
 * a fila desde la interfaz.
 *
 * Literal de una sola pieza (no `[].join()`) para que el cliente pueda deducir
 * el tipo de las filas: troceado, todas salen como `unknown`.
 */
const RESERVA_COLUMNAS =
  "id, fecha, hora, turno, personas, zona, mesa, estado, notas, " +
  "cliente_id, cliente_nombre, cliente_apellidos, cliente_telefono, cliente_email, " +
  "vinculacion_estado, origen, tarjeta_introducida, es_ticket, tipo_categoria, " +
  "tiene_garantia, garantia_importe, garantia_estado, garantia_tarjeta_ultimos4, " +
  "garantia_tarjeta_marca, garantia_capture_deadline, garantia_cobrada_at, " +
  "tiene_cancelacion, cancelacion_importe, cancelacion_estado, " +
  "cancelacion_tarjeta_ultimos4, cancelacion_intentos, cancelacion_error, " +
  "cancelacion_proximo_intento_at, cancelacion_cobrada_at, cobro_perdonado_at, politica_incumplida_at, " +
  "importe_pagado, pago_pendiente, " +
  "ticket_producto_id, ticket_unidades, ticket_importe, ticket_iva, ticket_codigo, " +
  "bloqueada, grupo_id, codigo_id, codigo, reconfirmada_at, " +
  "external_id, external_origen, created_at, duracion_minutos, " +
  "reserva_ticket_productos(nombre), " +
  // Cuándo pagó el ticket y cuándo lo canjeó por esta mesa. El dinero vive en
  // la COMPRA, no en la reserva: la reserva solo guarda el importe congelado.
  "reserva_ticket_compras(pagado_at, canjeado_at, codigo, importe_total, unidades)";

// OJO: este fichero es "use server". Solo puede EXPORTAR funciones async: un
// `export type` aquí rompe el módulo entero en producción con
// «A "use server" file can only export async functions». Por eso la forma de
// la fila se escribe en línea en la firma, sin exportar ningún tipo.
export async function listReservas(
  fecha?: string,
): Promise<{ ok: boolean; data: Record<string, unknown>[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("reservas")
      .select(RESERVA_COLUMNAS)
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true })
      // Las provisionales están a medio pagar: apartan la mesa, pero todavía
      // no son reservas del restaurante y no deben salir en la lista.
      .is("provisional_hasta", null);
    if (empresaId) query.eq("empresa_id", empresaId);
    if (fecha) query.eq("fecha", fecha);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: (data ?? []) as unknown as Record<string, unknown>[] };
  } catch (err) {
    console.error("[reservas] listReservas:", err);
    return { ok: false, data: [], error: friendlyError(err, "listReservas") };
  }
}

/**
 * Lista las reservas en un rango [fechaDesde, fechaHasta] (ambos YYYY-MM-DD,
 * inclusivos). Usado por la vista MES del calendario.
 */
export async function listReservasRango(fechaDesde: string, fechaHasta: string) {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("reservas")
      .select("id, fecha, turno, personas, estado, mesa, zona")
      .gte("fecha", fechaDesde)
      .lte("fecha", fechaHasta)
      // Igual que en el listado del día: una provisional aparta la mesa, pero
      // todavía no es una reserva que enseñar en el calendario.
      .is("provisional_hasta", null)
      .order("fecha", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[reservas] listReservasRango:", err);
    return { ok: false, data: [], error: friendlyError(err, "listReservasRango") };
  }
}

/**
 * Deja el comentario en el tope acordado (dos frases cortas). Es la última
 * barrera: los formularios ya limitan, pero cualquier otra vía —importación,
 * llamada directa— pasa igualmente por aquí.
 */
function recortarComentario(valor: string | null | undefined): string | null {
  const limpio = (valor ?? "").trim();
  if (!limpio) return null;
  return limpio.slice(0, RESERVA_COMENTARIO_MAX_CHARS);
}

/**
 * Texto de un campo opcional: vacío o solo espacios se convierte en NULL.
 * Sin esto, una cadena vacía viaja a la BD como dato real.
 */
function limpiar(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : null;
}

export async function createReserva(input: {
  clienteNombre: string;
  clienteApellidos?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  fecha: string;
  hora: string;
  personas: number;
  mesa?: string;
  zona?: string;
  turno?: string;
  estado?: string;
  notas?: string;
  origen?: string | null;
  // Flags acumulables (PRP-047)
  tarjetaIntroducida?: boolean;
  esTicket?: boolean;
  tipoCategoria?: import("@/features/sala/data/reservas").TipoReservaCategoria | null;
  garantiaImporte?: number | null;
  importePagado?: number | null;
  bloqueada?: boolean;
  grupoId?: string | null;
  /** Override de duración solo para ESTA reserva (min). NULL = default empresa. */
  duracionMinutos?: number | null;
  // Asignación automática de mesa (PRP-048). Si `asignarAuto=true` y la
  // reserva llega sin `mesa`, el sistema busca la primera libre del plano
  // activo del local con capacidad para los comensales. `localId` es
  // obligatorio cuando se activa.
  asignarAuto?: boolean;
  /**
   * El local ha visto el aviso de "esta mesa está bloqueada" y quiere seguir
   * igualmente. Solo lo manda la pantalla interna de sala: la web pública
   * nunca lo pone, así que online la mesa bloqueada sigue sin venderse.
   */
  forzarMesaBloqueada?: boolean;
  localId?: string | null;
  salaIdFiltro?: string | null;
  zonaIdFiltro?: string | null;
  tipoMesaFiltro?: TipoMesa | null;
  // Ticket (PRP-051): si tipoCategoria==='ticket', estos campos son obligatorios.
  ticketProductoId?: string | null;
  // Cupón (PRP-052): código de 6 chars opcional. Si viene, se valida y se
  // consume stock. NO afecta a tipo_categoria ni a importe_pagado.
  codigoCupon?: string | null;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // La hora tiene que caer en un cuarto (:00, :15, :30, :45). Es la barrera
    // de verdad: da igual por dónde entre la reserva (back-office, portal,
    // import), aquí se corta. Una hora fuera de cuadrícula no cae en ninguna
    // franja y se queda fuera de todos los cálculos de solape y aforo.
    if (!esHoraEnCuarto(input.hora)) {
      return { ok: false, error: MENSAJE_HORA_CUARTO };
    }

    // Campos obligatorios. Nombre y apellidos siempre; email y teléfono según
    // lo marcado en Ajustes → Departamentos → Sala → Reservas.
    //
    // Solo queda fuera WALK_IN: llega sin avisar y se le sienta en el momento,
    // así que no hay a quién pedirle el teléfono. LISTA_ESPERA sí lo exige: es
    // una reserva normal en otro estado —lo único que no pide es mesa—, y el
    // teléfono es justo lo que hace falta para avisar cuando se libera una.
    if (input.estado !== "WALK_IN") {
      const exige = await getCamposObligatoriosReserva(empresaId);
      if (!input.clienteNombre?.trim()) {
        return { ok: false, error: "El nombre del cliente es obligatorio." };
      }
      if (!input.clienteApellidos?.trim()) {
        return { ok: false, error: "Los apellidos del cliente son obligatorios." };
      }
      if (exige.telefono && !input.clienteTelefono?.trim()) {
        return { ok: false, error: "El teléfono es obligatorio." };
      }
      if (exige.email && !input.clienteEmail?.trim()) {
        return { ok: false, error: "El email es obligatorio." };
      }
      // Además de estar, el contacto tiene que servir: un `00000` deja la
      // reserva incontactable igual que si no hubiera teléfono.
      const vNombre = validarNombre(input.clienteNombre);
      if (!vNombre.ok) return { ok: false, error: vNombre.error };
      const vTel = validarTelefono(input.clienteTelefono, exige.telefono);
      if (!vTel.ok) return { ok: false, error: vTel.error };
      const vEmail = validarEmail(input.clienteEmail, exige.email);
      if (!vEmail.ok) return { ok: false, error: vEmail.error };
    }

    // Si hay email o teléfono, vincular/crear ficha de cliente.
    // Sin contacto (walk-in puntual), se inserta la reserva sin cliente_id.
    let clienteId: string | null = null;
    let clienteExistente = false;
    let camposDistintos: CampoDistinto[] = [];
    let nombreFinal = input.clienteNombre;
    let apellidosFinal: string | null = limpiar(input.clienteApellidos);
    // Un contacto vacío se guarda como NULL, nunca como cadena vacía: la BD
    // exige ficha de cliente en cuanto hay teléfono o email (restricción
    // `reservas_cliente_vinculado_si_contacto`), y un "" contaba como contacto.
    // Es lo que tumbaba los walk-in, que llegan sin teléfono ni correo.
    let telefonoFinal: string | null = limpiar(input.clienteTelefono);
    let emailFinal: string | null = limpiar(input.clienteEmail);

    const hayContacto = emailFinal !== null || (telefonoFinal?.length ?? 0) >= 5;
    if (!hayContacto) {
      // Sin ficha de cliente no puede quedar contacto suelto en la reserva: la
      // BD lo prohíbe. Un teléfono demasiado corto para vincular se descarta.
      telefonoFinal = null;
      emailFinal = null;
    }
    if (hayContacto) {
      const link = await findOrLinkClienteSala(supabase as unknown as SupabaseClient, {
        empresaId,
        nombre: input.clienteNombre,
        apellidos: input.clienteApellidos,
        email: input.clienteEmail,
        telefono: input.clienteTelefono,
      });
      if (!link.ok) {
        console.error("[reservas] vincular cliente:", link.error);
        return { ok: false, error: "No se pudo vincular el cliente" };
      }
      clienteId = link.result.cliente.id;
      clienteExistente = link.result.existed;
      camposDistintos = link.result.camposDistintos;
      nombreFinal = link.result.cliente.nombre;
      apellidosFinal = link.result.cliente.apellidos;
      // La ficha guarda número y prefijo por separado; la reserva lo lleva
      // entero para que todos los teléfonos del listado se lean igual.
      telefonoFinal = componerTelefono(
        link.result.cliente.telefono_prefijo,
        link.result.cliente.telefono,
      ) || null;
      emailFinal = link.result.cliente.email;
    }

    const estadoFinal = input.estado ?? "CONFIRMADA";
    // Walk-in siempre marca origen = WALKIN (el cliente no vino por canal digital).
    // Fuera de walk-in el canal es OBLIGATORIO: una reserva sin origen deja la
    // analítica coja y no se puede reconstruir después. Se normaliza aquí para
    // que no convivan "telefono" y "TELEFONO" como si fueran canales distintos.
    const origenFinal = estadoFinal === "WALK_IN"
      ? "WALKIN"
      : normalizarOrigen(input.origen);
    if (origenFinal === ORIGEN_SIN_DATO) {
      return { ok: false, error: "Indica el origen de la reserva (el canal por el que llegó el cliente)." };
    }

    // Asignación automática de mesa (PRP-048): solo si el llamador lo pide,
    // hay `localId` y la reserva llega sin mesa explícita. Regla de negocio:
    // o hay mesa libre, o no se acepta la reserva.
    let mesaFinal = input.mesa ?? null;
    let zonaFinal = input.zona ?? null;
    if (input.asignarAuto && input.localId && !mesaFinal) {
      const asign = await asignarMesaAutomatica(supabase as unknown as SupabaseClient, {
        localId: input.localId,
        empresaId,
        fecha: input.fecha,
        hora: input.hora,
        personas: input.personas,
        salaId: input.salaIdFiltro ?? null,
        zonaId: input.zonaIdFiltro ?? null,
        tipo: input.tipoMesaFiltro ?? null,
      });
      if (!asign.ok || !asign.mesa) {
        if (!asign.ok && asign.razon === "SIN_PLANO_ACTIVO") {
          return { ok: false, error: "No hay plano activo configurado para este local." };
        }
        if (!asign.ok) {
          return { ok: false, error: "No se pudo asignar mesa. Inténtalo de nuevo." };
        }
        return {
          ok: false,
          error: `No quedan mesas libres para ${input.personas} ${input.personas === 1 ? "persona" : "personas"} a las ${input.hora.slice(0, 5)}.`,
        };
      }
      mesaFinal = asign.mesa.codigo;
      zonaFinal = zonaFinal ?? asign.mesa.zonaNombre ?? null;
    }

    // Bloqueo de solape: si se asigna mesa (manual o auto), comprobar que no
    // pisa otra reserva activa de la misma mesa dentro de la ventana
    // `duracion_reserva_min` configurada por empresa. Si esta reserva llega
    // con override puntual (`duracionMinutos`), se prioriza ese valor.
    if (mesaFinal) {
      // Bloqueos manuales.
      //
      // El bloqueo vale SOLO para su turno: bloquear la comida no puede tirar
      // una cena, así que se pregunta por el turno de esta reserva y no por el
      // día entero.
      //
      // Y el bloqueo no es una prohibición para el local: impide que la mesa
      // se asigne sola o se venda por la web, pero el personal puede usarla si
      // lo ve necesario. Por eso solo se corta en seco cuando la reserva NO
      // viene con `forzarMesaBloqueada`: la pantalla de sala pone ese flag
      // después de enseñar el aviso y de que alguien lo acepte.
      if (input.localId) {
        const turnoBloqueo =
          (input.turno ?? "").toUpperCase() === "CENA" ? "CENA" : "COMIDA";
        const bloqueadas = await getMesasBloqueadas(
          supabase as unknown as SupabaseClient,
          {
            empresaId,
            localId: input.localId,
            fechaISO: input.fecha,
            turno: turnoBloqueo,
          },
        );
        if (bloqueadas.size > 0) {
          // Una unión ("M1+M2") ocupa varias mesas: basta con que una esté
          // bloqueada para que la reserva la esté pisando.
          const codigos = mesaFinal
            .split("+")
            .map((c) => c.trim())
            .filter(Boolean);
          const { data: mesaRows } = await supabase
            .from("mesas")
            .select("id, codigo")
            .eq("local_id", input.localId)
            .in("codigo", codigos);
          const chocadas = (mesaRows ?? [])
            .filter((m) => bloqueadas.has(m.id as string))
            .map((m) => m.codigo as string);
          if (chocadas.length > 0 && !input.forzarMesaBloqueada) {
            return {
              ok: false,
              mesaBloqueada: chocadas,
              error:
                chocadas.length === 1
                  ? `La mesa ${chocadas[0]} está bloqueada en este turno.`
                  : `Las mesas ${chocadas.join(", ")} están bloqueadas en este turno.`,
            };
          }
        }
      }
      const duracionDefault = await getDuracionReservaMin(
        supabase as unknown as SupabaseClient,
        empresaId,
      );
      const duracionMin = typeof input.duracionMinutos === "number" && input.duracionMinutos > 0
        ? input.duracionMinutos
        : duracionDefault;
      const conflicto = await buscarConflictoMesa(
        supabase as unknown as SupabaseClient,
        {
          empresaId,
          fecha: input.fecha,
          hora: input.hora,
          mesa: mesaFinal,
          duracionMin,
          localId: input.localId ?? null,
        },
      );
      if (conflicto) {
        const quien = conflicto.clienteNombre ? ` de ${conflicto.clienteNombre}` : "";
        return {
          ok: false,
          error: `La mesa ${mesaFinal} ya tiene una reserva${quien} a las ${conflicto.hora}. Ajusta la hora o la mesa (duración configurada: ${duracionMin} min).`,
        };
      }
    }

    // Reglas de intervalo (máx. reservas / máx. personas por franja). Se
    // valida después de la mesa porque el cómputo es global por empresa y
    // depende de fecha + hora + turno + personas.
    {
      const turnoFinal = (input.turno ?? "COMIDA").toUpperCase();
      const turnoRpc = turnoFinal === "CENA" ? "CENA" : "COMIDA";
      const { data: intervaloError, error: rpcError } = await supabase.rpc(
        "validar_intervalo_reservas",
        {
          p_empresa_id: empresaId,
          p_fecha: input.fecha,
          p_hora: input.hora,
          p_personas: input.personas,
          p_turno: turnoRpc,
          p_ignore_reserva_id: null,
        },
      );
      if (rpcError) {
        console.error("[reservas] validar_intervalo_reservas:", rpcError);
      } else if (typeof intervaloError === "string" && intervaloError.length > 0) {
        return { ok: false, error: intervaloError };
      }
    }

    // ────────────────────────────────────────────────────────────────
    // PRP-051: rama Ticket. Validar bloqueo cliente + consumir stock atómico.
    // El stock NO se devuelve nunca (regla del dueño).
    // ────────────────────────────────────────────────────────────────
    let ticketProductoIdFinal: string | null = null;
    let ticketUnidadesFinal: number | null = null;
    let ticketImporteFinal: number | null = null;
    let ticketIvaFinal: number | null = null;
    let pagoPendienteFinal = false;

    if (input.tipoCategoria === "ticket") {
      if (!input.ticketProductoId) {
        return { ok: false, error: "Selecciona un producto-ticket para esta reserva." };
      }
      if (clienteId) {
        const bloqueo = await supabase
          .from("cliente_ticket_bloqueos")
          .select("id", { head: true, count: "exact" })
          .eq("empresa_id", empresaId)
          .eq("cliente_id", clienteId)
          .is("desbloqueado_at", null);
        if (bloqueo.error) {
          console.error("[reservas] check bloqueo ticket:", bloqueo.error);
          return { ok: false, error: "No se pudo validar el cliente." };
        }
        if ((bloqueo.count ?? 0) > 0) {
          return { ok: false, error: "Este cliente tiene un bloqueo activo para reservas con ticket." };
        }
      }

      const admin = createAdminClient();
      const producto = await admin
        .from("reserva_ticket_productos")
        .select("id, precio, iva, modo_precio, activo, empresa_id")
        .eq("id", input.ticketProductoId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (producto.error || !producto.data) {
        return { ok: false, error: "Producto-ticket no encontrado." };
      }
      if (!producto.data.activo) {
        return { ok: false, error: "El producto-ticket está desactivado." };
      }
      const unidades = producto.data.modo_precio === "por_persona" ? input.personas : 1;
      const precio = Number(producto.data.precio);
      const iva = Number(producto.data.iva);

      const consumo = await admin.rpc("consumir_stock_ticket", {
        p_producto_id: input.ticketProductoId,
        p_unidades: unidades,
      });
      if (consumo.error) {
        const msg = consumo.error.message ?? "";
        if (msg.includes("AGOTADO")) {
          return { ok: false, error: "Producto agotado." };
        }
        console.error("[reservas] consumir_stock_ticket:", consumo.error);
        return { ok: false, error: "No se pudo reservar el stock." };
      }
      ticketProductoIdFinal = input.ticketProductoId;
      ticketUnidadesFinal = unidades;
      ticketImporteFinal = Number((precio * unidades).toFixed(2));
      ticketIvaFinal = iva;
      pagoPendienteFinal = true;
    }

    // PRP-052: validar y consumir cupón si viene.
    // Regla del dueño: cupón NO coexiste con `gratis` ni con `ticket`
    // (son tipos de reserva distintos). Sí coexiste con `politica`.
    let cuponIdFinal: string | null = null;
    let cuponCodigoFinal: string | null = null;
    const codigoCuponNorm = input.codigoCupon?.toUpperCase().replace(/\s+/g, "") ?? "";
    if (codigoCuponNorm) {
      if (input.tipoCategoria === "gratis") {
        return { ok: false, error: "Una reserva gratis no puede llevar cupón." };
      }
      if (input.tipoCategoria === "ticket" || input.ticketProductoId) {
        return { ok: false, error: "Una reserva con ticket no puede llevar cupón." };
      }
      const admin = createAdminClient();
      const { data: vRows, error: vErr } = await admin.rpc("validar_cupon", {
        p_empresa_id: empresaId,
        p_codigo: codigoCuponNorm,
        p_fecha: input.fecha,
        p_turno: input.turno ?? "COMIDA",
      });
      if (vErr) {
        console.error("[reservas] validar_cupon:", vErr);
        return { ok: false, error: "No se pudo validar el cupón." };
      }
      const vRow = (vRows ?? [])[0] as { ok: boolean; motivo: string | null; cupon_id: string | null } | undefined;
      if (!vRow?.ok) {
        const motivo = vRow?.motivo ?? "NO_EXISTE";
        return { ok: false, error: `Cupón no válido (${motivo}).` };
      }
      const { error: cErr } = await admin.rpc("consumir_stock_cupon", {
        p_codigo_id: vRow.cupon_id,
        p_personas: input.personas,
      });
      if (cErr) {
        const msg = cErr.message ?? "";
        if (msg.includes("AGOTADO")) return { ok: false, error: "Cupón agotado." };
        if (msg.includes("INACTIVO")) return { ok: false, error: "Cupón inactivo." };
        console.error("[reservas] consumir_stock_cupon:", cErr);
        return { ok: false, error: "No se pudo aplicar el cupón." };
      }
      cuponIdFinal = vRow.cupon_id;
      cuponCodigoFinal = codigoCuponNorm;
    }

    const { data, error } = await supabase.from("reservas").insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      cliente_nombre: nombreFinal,
      cliente_apellidos: apellidosFinal,
      cliente_telefono: telefonoFinal,
      cliente_email: emailFinal,
      fecha: input.fecha,
      hora: input.hora,
      personas: input.personas,
      mesa: mesaFinal,
      zona: zonaFinal,
      turno: input.turno ?? "COMIDA",
      estado: estadoFinal,
      // El comentario se corta aquí: da igual desde qué pantalla venga, en la
      // base de datos nunca entra uno más largo del tope.
      notas: recortarComentario(input.notas),
      origen: origenFinal,
      tarjeta_introducida: input.tarjetaIntroducida ?? false,
      es_ticket: input.esTicket ?? false,
      tipo_categoria: input.tipoCategoria ?? null,
      garantia_importe: input.tipoCategoria === "politica" ? (input.garantiaImporte ?? null) : null,
      importe_pagado: input.tipoCategoria === "cupon" ? (input.importePagado ?? null) : null,
      ticket_producto_id: ticketProductoIdFinal,
      ticket_unidades: ticketUnidadesFinal,
      ticket_importe: ticketImporteFinal,
      ticket_iva: ticketIvaFinal,
      pago_pendiente: pagoPendienteFinal,
      bloqueada: input.bloqueada ?? false,
      grupo_id: input.grupoId ?? null,
      codigo_id: cuponIdFinal,
      codigo: cuponCodigoFinal,
      duracion_minutos: typeof input.duracionMinutos === "number" && input.duracionMinutos > 0
        ? input.duracionMinutos
        : null,
      created_by: user?.id ?? null,
    }).select("id").single();
    if (error) throw error;

    if (clienteId) {
      await supabase.rpc("registrar_visita_cliente_sala", {
        p_cliente_id: clienteId,
        p_fecha: input.fecha,
      });
    }

    return {
      ok: true,
      id: (data?.id as string) ?? null,
      clienteId,
      clienteExistente,
      camposDistintos,
    };
  } catch (err: unknown) {
    // Los errores de Supabase son objetos planos, no instancias de Error: con
    // `instanceof Error` a secas todos salían como "Error desconocido" y no
    // había forma de saber qué había fallado. Ver la misma nota en updateReserva.
    const msg = mensajeDeError(err) ?? "Error al crear la reserva.";
    console.error("[reservas] createReserva:", msg, err);
    return { ok: false, error: msg };
  }
}

export async function updateReserva(
  id: string,
  updates: {
    clienteNombre?: string;
    clienteApellidos?: string;
    clienteTelefono?: string;
    clienteEmail?: string;
    fecha?: string;
    hora?: string;
    personas?: number;
    mesa?: string;
    zona?: string;
    turno?: string;
    /**
     * Local de la mesa. Solo se usa para deducir la zona al cambiar de mesa:
     * los códigos de mesa se repiten entre locales (hay una "A1" en cada uno),
     * así que sin el local la zona no se puede resolver sin ambigüedad.
     */
    localId?: string | null;
    estado?: string;
    notas?: string;
    origen?: string | null;
    // Flags acumulables (PRP-047)
    tarjetaIntroducida?: boolean;
    esTicket?: boolean;
    tipoCategoria?: import("@/features/sala/data/reservas").TipoReservaCategoria | null;
    garantiaImporte?: number | null;
    importePagado?: number | null;
    bloqueada?: boolean;
    grupoId?: string | null;
    reconfirmadaAt?: string | null;
    /** Override de duración. Pasa null para volver a la default empresa. */
    duracionMinutos?: number | null;
    /**
     * Enviar el correo al cliente por este cambio de estado (RECONFIRMADA o
     * CANCELADA). Por defecto NO se envía: cambiar de estado es criterio del
     * empleado y no debe notificar al cliente por su cuenta. La UI pregunta.
     * No se persiste: solo decide si sale el correo.
     */
    notificarCliente?: boolean;
    /**
     * Salta el bloqueo por solape de mesa. Es la decisión del local: al
     * reasignar mesas a mano desde la ficha, sala ve el aviso con QUÉ reserva
     * se pisa y hasta qué hora, y puede seguir adelante si le compensa (juntar
     * dos mesas para un grupo que ha crecido, aunque una tenga otra reserva
     * más tarde). Nunca se activa solo: la UI solo lo manda después de que
     * alguien haya confirmado el aviso.
     */
    forzarSolape?: boolean;
  }
) {
  try {
    const ctx = await getContext();
    const { supabase, empresaId } = ctx;

    // Mover una reserva tiene la misma regla que crearla: la hora cae en un
    // cuarto o no se guarda. Sin esto, la cuadrícula solo se respetaba al dar
    // el alta y cualquier edición posterior podía sacarla de ella.
    if (updates.hora !== undefined && !esHoraEnCuarto(updates.hora)) {
      return { ok: false, error: MENSAJE_HORA_CUARTO };
    }

    // Una reserva de Ticket queda congelada en lo que toca al ticket: ni el
    // tipo de reserva ni el dinero se pueden cambiar a mano. La base de datos
    // lo impide igualmente; se comprueba aquí para poder dar un mensaje que se
    // entienda en vez de un error técnico.
    if (updates.esTicket !== undefined || updates.tipoCategoria !== undefined) {
      const { data: actualTicket } = await supabase
        .from("reservas")
        .select("es_ticket")
        .eq("id", id)
        .maybeSingle();
      if (actualTicket?.es_ticket === true) {
        return {
          ok: false,
          error: "Esta reserva se hizo con un Ticket: su tipo no se puede cambiar.",
        };
      }
    }

    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Si cambia email o teléfono, re-vincular ficha (puede que ahora coincida con otra ya existente).
    // Si solo cambia nombre/apellidos pero la reserva está vinculada, ignoramos: la ficha manda.
    const tocaContacto =
      updates.clienteEmail !== undefined || updates.clienteTelefono !== undefined;
    if (tocaContacto && empresaId) {
      const { data: actual } = await supabase
        .from("reservas")
        .select("cliente_nombre, cliente_apellidos, cliente_email, cliente_telefono, cliente_id")
        .eq("id", id)
        .maybeSingle();
      const nombre = updates.clienteNombre ?? actual?.cliente_nombre ?? "Cliente";
      const apellidos =
        updates.clienteApellidos !== undefined ? updates.clienteApellidos : actual?.cliente_apellidos ?? null;
      const email =
        updates.clienteEmail !== undefined ? updates.clienteEmail : actual?.cliente_email ?? null;
      const telefono =
        updates.clienteTelefono !== undefined ? updates.clienteTelefono : actual?.cliente_telefono ?? null;

      const hayContacto =
        (email && email.trim().length > 0) || (telefono && telefono.trim().length >= 5);
      if (hayContacto) {
        const link = await findOrLinkClienteSala(supabase as unknown as SupabaseClient, {
          empresaId,
          nombre,
          apellidos,
          email,
          telefono,
        });
        if (!link.ok) {
          return { ok: false, error: "No se pudo vincular el cliente" };
        }
        dbUpdates.cliente_id = link.result.cliente.id;
        dbUpdates.cliente_nombre = link.result.cliente.nombre;
        dbUpdates.cliente_apellidos = link.result.cliente.apellidos;
        // Snapshot con prefijo: la ficha lo guarda aparte, pero en la reserva
        // va pegado al número. Si no, unas reservas salen con prefijo y otras
        // sin él, y no hay forma de llamar a los extranjeros.
        dbUpdates.cliente_telefono = componerTelefono(
          link.result.cliente.telefono_prefijo,
          link.result.cliente.telefono,
        );
        dbUpdates.cliente_email = link.result.cliente.email;
      } else {
        // Sin contacto: walk-in. Quitar vinculación y aceptar nombre tal cual.
        dbUpdates.cliente_id = null;
        if (updates.clienteNombre !== undefined) dbUpdates.cliente_nombre = updates.clienteNombre;
        if (updates.clienteApellidos !== undefined) dbUpdates.cliente_apellidos = updates.clienteApellidos;
        dbUpdates.cliente_email = null;
        dbUpdates.cliente_telefono = null;
      }
    } else {
      // No tocan email ni teléfono: nombre/apellidos solo se aplican si la reserva no está vinculada.
      const { data: actual } = await supabase
        .from("reservas")
        .select("cliente_id")
        .eq("id", id)
        .maybeSingle();
      const vinculada = !!actual?.cliente_id;
      if (!vinculada) {
        if (updates.clienteNombre !== undefined) dbUpdates.cliente_nombre = updates.clienteNombre;
        if (updates.clienteApellidos !== undefined) dbUpdates.cliente_apellidos = updates.clienteApellidos;
      }
    }
    if (updates.fecha !== undefined) dbUpdates.fecha = updates.fecha;
    if (updates.hora !== undefined) dbUpdates.hora = updates.hora;
    if (updates.personas !== undefined) dbUpdates.personas = updates.personas;
    if (updates.mesa !== undefined) dbUpdates.mesa = updates.mesa;
    if (updates.zona !== undefined) dbUpdates.zona = updates.zona;

    // Turno y zona NO se editan a mano: se deducen de la hora y de la mesa, que
    // es lo que de verdad se cambia. Si se movía una reserva de las 14:00 a las
    // 21:00 seguía marcada como COMIDA y no aparecía en el mapa de cena (y al
    // revés). Lo mismo al cambiarla de mesa: conservaba la zona de la mesa
    // anterior. Se recalculan aquí, en el único punto por el que pasan todos
    // los cambios, para que no puedan quedar descuadrados.
    if (updates.hora !== undefined && updates.turno === undefined) {
      dbUpdates.turno = turnoDeHora(updates.hora);
    }
    if (
      updates.mesa !== undefined &&
      updates.zona === undefined &&
      updates.localId
    ) {
      const codigoMesa = (updates.mesa ?? "").trim();
      if (!codigoMesa) {
        // Se ha quitado la mesa: sin mesa no hay zona que deducir.
        dbUpdates.zona = null;
      } else {
        // Una unión se graba como "M1+M2" y ese texto no es el código de
        // ninguna mesa: buscarlo tal cual no devolvía fila y la reserva se
        // quedaba con la zona de la mesa anterior. La zona se resuelve por la
        // PRIMERA mesa del conjunto, que es a la que se ancla la reserva.
        const codigoPrincipal = codigoMesa.split("+")[0]?.trim() || codigoMesa;
        const { data: mesaRow } = await supabase
          .from("mesas")
          .select("zonas(nombre)")
          .eq("local_id", updates.localId)
          .eq("codigo", codigoPrincipal)
          .maybeSingle();
        const z = mesaRow?.zonas as unknown as
          | { nombre?: string }
          | { nombre?: string }[]
          | null;
        const nombreZona = Array.isArray(z) ? z[0]?.nombre : z?.nombre;
        // Si la mesa no resuelve zona, se deja la que hubiera: es mejor
        // conservar el dato anterior que vaciarlo por un fallo de lectura.
        if (nombreZona) dbUpdates.zona = nombreZona;
      }
    }
    if (updates.turno !== undefined) dbUpdates.turno = updates.turno;
    if (updates.estado !== undefined) dbUpdates.estado = updates.estado;
    if (updates.notas !== undefined) dbUpdates.notas = recortarComentario(updates.notas);
    // Igual que en el alta: se guarda la clave normalizada y nunca vacía. Un
    // update no puede dejar sin canal una reserva que ya lo tenía.
    if (updates.origen !== undefined) {
      const norm = normalizarOrigen(updates.origen);
      if (norm === ORIGEN_SIN_DATO) {
        return { ok: false, error: "Indica el origen de la reserva (el canal por el que llegó el cliente)." };
      }
      dbUpdates.origen = norm;
    }
    // Si la reserva pasa a WALK_IN, el origen siempre es WALKIN — sobreescribe
    // cualquier valor previo o el que viniera en `updates.origen`.
    if (updates.estado === "WALK_IN") dbUpdates.origen = "WALKIN";
    if (updates.tarjetaIntroducida !== undefined) dbUpdates.tarjeta_introducida = updates.tarjetaIntroducida;
    if (updates.esTicket !== undefined) dbUpdates.es_ticket = updates.esTicket;
    // tipoCategoria gobierna política/garantía/importe pagado: al cambiar de
    // categoría limpiamos los campos que dejan de aplicar para evitar datos
    // huérfanos (p. ej. politica + garantía en una reserva GRATIS).
    if (updates.tipoCategoria !== undefined) {
      dbUpdates.tipo_categoria = updates.tipoCategoria;
      if (updates.tipoCategoria !== "politica") {
        dbUpdates.garantia_importe = null;
      }
      if (updates.tipoCategoria !== "cupon") {
        dbUpdates.importe_pagado = null;
      }
    }
    if (updates.garantiaImporte !== undefined) dbUpdates.garantia_importe = updates.garantiaImporte;
    if (updates.importePagado !== undefined) dbUpdates.importe_pagado = updates.importePagado;
    if (updates.bloqueada !== undefined) dbUpdates.bloqueada = updates.bloqueada;
    if (updates.grupoId !== undefined) dbUpdates.grupo_id = updates.grupoId;
    if (updates.duracionMinutos !== undefined) {
      dbUpdates.duracion_minutos =
        typeof updates.duracionMinutos === "number" && updates.duracionMinutos > 0
          ? updates.duracionMinutos
          : null;
    }
    if (updates.reconfirmadaAt !== undefined) {
      dbUpdates.reconfirmada_at = updates.reconfirmadaAt;
    } else if (updates.estado === "RECONFIRMADA") {
      // Al transicionar a RECONFIRMADA, marcar el timestamp si no existe.
      const { data: actual } = await supabase
        .from("reservas")
        .select("reconfirmada_at")
        .eq("id", id)
        .maybeSingle();
      if (!actual?.reconfirmada_at) {
        dbUpdates.reconfirmada_at = new Date().toISOString();
      }
    } else if (updates.estado === "CONFIRMADA" || updates.estado === "NO_RECONFIRMADA") {
      // Volver a un estado previo a la reconfirmación borra el flag — corrige
      // errores manuales sin necesidad de UI dedicada.
      dbUpdates.reconfirmada_at = null;
    }

    // Bloqueo de solape al re-asignar mesa/fecha/hora. Reutiliza la
    // `duracion_reserva_min` configurada por empresa. Solo se chequea cuando
    // el UPDATE final tendrá mesa (la reserva resultante ocupa una mesa).
    // `duracionMinutos` cuenta como cambio de slot: ampliar el tiempo de una
    // mesa alarga su hora de fin, y eso puede pisar a la reserva que ya haya
    // entrado detrás. Sin esto, alargar una mesa doblaba la siguiente reserva.
    // Revivir una reserva anulada (CANCELADA/NO_SHOW/LIBERADA → estado vivo)
    // vuelve a ocupar la mesa: mientras estuvo anulada esa mesa pudo venderse a
    // otro cliente, así que hay que revalidar el solape antes de confirmarla.
    let revive = false;
    if (updates.estado !== undefined) {
      const { data: previa } = await supabase
        .from("reservas")
        .select("estado")
        .eq("id", id)
        .maybeSingle();
      const estabaAnulada =
        previa?.estado != null &&
        (ESTADOS_NO_OCUPANTES as string[]).includes(previa.estado as string);
      const vuelveAOcupar = !(ESTADOS_NO_OCUPANTES as string[]).includes(updates.estado);
      revive = estabaAnulada && vuelveAOcupar;
    }

    const tocaSlot =
      updates.mesa !== undefined ||
      updates.fecha !== undefined ||
      updates.hora !== undefined ||
      updates.duracionMinutos !== undefined ||
      revive;
    // `forzarSolape` no salta la comprobación por comodidad: la salta porque
    // alguien de sala ya ha visto en pantalla a quién pisa y ha decidido que
    // se hace igual. Sin esa confirmación previa el bloqueo sigue en pie.
    if (tocaSlot && empresaId && !updates.forzarSolape) {
      // Las dos lecturas van en paralelo: la duración por defecto de la empresa
      // no depende de esta reserva, y encadenarlas doblaba la espera de un
      // guardado que sala hace con clientes delante.
      const [{ data: actual }, duracionDefault] = await Promise.all([
        supabase
          .from("reservas")
          .select("fecha, hora, mesa, duracion_minutos")
          .eq("id", id)
          .maybeSingle(),
        getDuracionReservaMin(supabase as unknown as SupabaseClient, empresaId),
      ]);
      const fechaFinal = (dbUpdates.fecha as string | undefined) ?? (actual?.fecha as string | undefined) ?? null;
      const horaFinal  = (dbUpdates.hora  as string | undefined) ?? (actual?.hora  as string | undefined) ?? null;
      const mesaFinal  = (dbUpdates.mesa  as string | null | undefined) !== undefined
        ? (dbUpdates.mesa as string | null)
        : ((actual?.mesa as string | null | undefined) ?? null);
      // Si esta reserva tiene un override de duración (propio o vigente),
      // se usa para el cálculo de solape. Si no, default de empresa.
      const overrideTrasUpdate = (dbUpdates.duracion_minutos as number | null | undefined) !== undefined
        ? (dbUpdates.duracion_minutos as number | null)
        : (actual?.duracion_minutos as number | null | undefined) ?? null;
      if (fechaFinal && horaFinal && mesaFinal) {
        const duracionMin = typeof overrideTrasUpdate === "number" && overrideTrasUpdate > 0
          ? overrideTrasUpdate
          : duracionDefault;
        const conflicto = await buscarConflictoMesa(
          supabase as unknown as SupabaseClient,
          {
            empresaId,
            fecha: fechaFinal,
            hora: horaFinal,
            mesa: mesaFinal,
            duracionMin,
            ignoreReservaId: id,
            localId: updates.localId ?? null,
          },
        );
        if (conflicto) {
          const quien = conflicto.clienteNombre ? ` de ${conflicto.clienteNombre}` : "";
          return {
            ok: false,
            error: `La mesa ${mesaFinal} ya tiene una reserva${quien} a las ${conflicto.hora}. Ajusta la hora o la mesa (duración configurada: ${duracionMin} min).`,
          };
        }
      }
    }

    // Reglas de intervalo: re-validar solo si cambia algo que afecte
    // (fecha, hora, personas o turno). Excluimos la propia reserva al contar.
    const tocaIntervalo =
      updates.fecha !== undefined ||
      updates.hora !== undefined ||
      updates.personas !== undefined ||
      updates.turno !== undefined;
    if (tocaIntervalo && empresaId) {
      const { data: actual } = await supabase
        .from("reservas")
        .select("fecha, hora, personas, turno")
        .eq("id", id)
        .maybeSingle();
      const fechaFinal = (dbUpdates.fecha as string | undefined) ?? (actual?.fecha as string | undefined);
      const horaFinal = (dbUpdates.hora as string | undefined) ?? (actual?.hora as string | undefined);
      const personasFinal = (dbUpdates.personas as number | undefined) ?? (actual?.personas as number | undefined) ?? 0;
      const turnoRaw = (dbUpdates.turno as string | undefined) ?? (actual?.turno as string | undefined) ?? "COMIDA";
      const turnoRpc = turnoRaw.toUpperCase() === "CENA" ? "CENA" : "COMIDA";
      if (fechaFinal && horaFinal) {
        const { data: intervaloError, error: rpcError } = await supabase.rpc(
          "validar_intervalo_reservas",
          {
            p_empresa_id: empresaId,
            p_fecha: fechaFinal,
            p_hora: horaFinal,
            p_personas: personasFinal,
            p_turno: turnoRpc,
            p_ignore_reserva_id: id,
          },
        );
        if (rpcError) {
          console.error("[reservas] validar_intervalo_reservas (update):", rpcError);
        } else if (typeof intervaloError === "string" && intervaloError.length > 0) {
          return { ok: false, error: intervaloError };
        }
      }
    }

    // El filtro por empresa es imprescindible: la RLS solo acota a las empresas
    // del usuario, no a la ACTIVA. Sin esto, un usuario de BACANAL+HABANA podía
    // modificar (incluso cancelar) una reserva de la otra empresa por su id.
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    // Foto de ANTES para la actividad: hay que leerla mientras los valores
    // viejos siguen en la tabla. Se piden solo los campos que se van a tocar.
    const camposAuditables = CAMPOS_ACTIVIDAD.filter((c) => c in dbUpdates);
    let previo: Record<string, unknown> | null = null;
    if (camposAuditables.length > 0) {
      const { data } = await supabase
        .from("reservas")
        .select(camposAuditables.join(","))
        .eq("id", id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      previo = (data as Record<string, unknown> | null) ?? null;
    }

    const { error } = await supabase
      .from("reservas")
      .update(dbUpdates)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    // Actividad: una fila por campo que REALMENTE cambia de valor. Si se
    // guarda sin tocar nada, no se inventa actividad. Nunca rompe el guardado:
    // el cambio ya está hecho y no se puede deshacer por un fallo del registro.
    if (previo) {
      const filas = camposAuditables
        .map((campo) => ({
          campo,
          anterior: normalizarValorActividad(previo?.[campo]),
          nuevo: normalizarValorActividad(dbUpdates[campo]),
        }))
        .filter((f) => f.anterior !== f.nuevo)
        .map((f) => ({
          empresa_id: empresaId,
          reserva_id: id,
          campo: f.campo,
          valor_anterior: f.anterior,
          valor_nuevo: f.nuevo,
          usuario_id: ctx.usuarioId,
          usuario_nombre: ctx.nombre,
          origen: "MANUAL",
        }));
      if (filas.length > 0) {
        const { error: errHist } = await supabase
          .from("reserva_historial")
          .insert(filas);
        if (errHist) {
          console.error("[reservas] actividad:", errHist.message);
        }
      }
    }

    // Si el cliente no asiste (cancela o no se presenta) y llevaba tarjeta, se comprueba si
    // incumplió el plazo. Solo deja la marca para que el aviso de Sala lo
    // enseñe: el cobro lo decide una persona en la ficha.
    if (updates.estado === "CANCELADA" || updates.estado === "NO_SHOW") {
      try {
        const { marcarPoliticaIncumplida } = await import(
          "@/features/sala/lib/marcar-incumplimiento"
        );
        const admin = createAdminClient();
        await marcarPoliticaIncumplida(admin, id, updates.estado);
      } catch (e) {
        console.error("[reservas] marcar incumplimiento:", e);
      }
    }

    // Correo al cliente: SOLO si quien llama lo pide expresamente.
    //
    // Cambiar el estado es una valoración del empleado (marca RECONFIRMADA
    // porque habló con el cliente, CANCELADA porque no vinieron...). Antes el
    // simple cambio de estado disparaba el correo por su cuenta y el cliente
    // recibía avisos que nadie había decidido enviar. Ahora la UI pregunta y
    // pasa `notificarCliente`. Idempotente: el mailer no reenvía si ya hay
    // timestamp en la columna de auditoría.
    //
    // Cada estado con plantilla usa el nombre del estado como tipo de correo:
    // no hace falta traducir nada. Los que no tienen plantilla los descarta
    // `esTipoEstado` solo: WALK_IN porque es un ORIGEN (el cliente entró sin
    // reservar) y no hay a quién escribirle, y SENTADA porque al cliente que
    // acabas de sentar en la mesa no se le manda un correo.
    // No await — un fallo de SMTP no debe romper el UPDATE ya confirmado.
    if (updates.notificarCliente === true && updates.estado) {
      const actor = actorDeSesion(ctx);
      const tipoCorreo = updates.estado as ReservaEmailTipo;
      if (esTipoEstado(tipoCorreo)) {
        enviarReservaEmail(id, tipoCorreo, { actor }).catch((e) =>
          console.error(`[reservas] mail ${tipoCorreo}:`, e),
        );
      }

      // Por mensajería solo sale la cancelación: es la que el cliente
      // necesita ver ya. Del resto de estados se entera al llegar, y un
      // WhatsApp por cada cambio interno quemaría el canal.
      if (updates.estado === "CANCELADA") {
        void enviarAvisoReserva(id, "CANCELACION", { actor }).catch((e) =>
          console.error("[reservas] whatsapp CANCELACION:", e),
        );
      }
    }

    return { ok: true };
  } catch (err: unknown) {
    // Los errores de Supabase NO son instancias de Error: son objetos planos
    // ({ message, details, hint, code }). Con `instanceof Error` a secas todos
    // acababan en "Error desconocido", que no dice nada ni al usuario ni a
    // quien tiene que arreglarlo. Se saca el mensaje real siempre que exista.
    const msg = mensajeDeError(err) ?? "Error al actualizar la reserva.";
    console.error("[reservas] updateReserva:", msg, err);
    return { ok: false, error: msg };
  }
}

/**
 * Campos cuyo cambio se registra en la actividad de la reserva. Son los que se
 * preguntan en sala cuando algo no cuadra ("¿quién ha movido esta mesa?").
 * Quedan fuera los que no dicen nada a una persona (tokens, sellos de correo,
 * `updated_at`): llenarían la actividad de ruido.
 */
const CAMPOS_ACTIVIDAD = [
  "estado",
  "mesa",
  "zona",
  "personas",
  "fecha",
  "hora",
  "turno",
  "duracion_minutos",
  "notas",
  "bloqueada",
] as const;

/**
 * Valor de un campo como texto para poder compararlo y guardarlo. NULL y
 * cadena vacía son lo mismo aquí (una mesa sin asignar), para que quitar algo
 * que ya estaba vacío no cuente como cambio.
 */
function normalizarValorActividad(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v.trim() : String(v);
  return s.length > 0 ? s : null;
}

/**
 * Mensaje legible de cualquier cosa que se pueda lanzar: Error, error de
 * Supabase/PostgREST (objeto plano con `message`) o string.
 */
function mensajeDeError(err: unknown): string | null {
  if (err instanceof Error) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown; details?: unknown; hint?: unknown };
    const partes = [o.message, o.details, o.hint].filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0,
    );
    if (partes.length > 0) return partes.join(" · ");
  }
  return null;
}

export async function deleteReserva(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    // Ver nota en updateReserva: la RLS no distingue la empresa ACTIVA, así que
    // sin este filtro se podía borrar una reserva de la otra empresa del usuario.
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };
    const { error } = await supabase
      .from("reservas")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas] deleteReserva:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Envía al cliente el correo de confirmación de su reserva.
 * Lo dispara el toggle "Notificar al cliente por Email" del diálogo de
 * Nueva reserva. Idempotente: no reenvía si ya hay timestamp en
 * `reservas.email_confirmacion_at`. Resuelve plantilla, logo y color de marca
 * a través del mailer genérico.
 *
 * Además, si la reserva se crea con MENOS antelación que el lead time
 * configurado (`reconfirmacion_dias_antes`, p. ej. 3 días) y la empresa tiene
 * activado `reconfirmacion_envio_inmediato`, encadena el correo de
 * RECONFIRMADA justo después (fire-and-forget). Para reservas con antelación
 * >= lead time, la reconfirmación la dispara el cron a la hora programada.
 */
export async function notificarReservaCreadaPorEmail(reservaId: string) {
  // La reserva se está creando desde el back office, así que hay una persona
  // detrás: su firma va en el histórico de este correo y en el encadenado.
  const ctxActor = await getContext();
  const actor = actorDeSesion(ctxActor);

  // Igual que en el alta desde el portal público: si la reserva se ha hecho con
  // un ticket ya pagado, su correo de bienvenida es el de Ticket, no el de
  // confirmada. Enviar los dos le diría lo mismo dos veces.
  const { data: rTicket } = await ctxActor.supabase
    .from("reservas")
    .select("es_ticket")
    .eq("id", reservaId)
    .maybeSingle();
  const tipoBienvenida =
    rTicket?.es_ticket === true ? "TICKET_RESERVA" : "CONFIRMADA";
  const res = await enviarReservaEmail(reservaId, tipoBienvenida, { actor });
  if (!res.ok) return { ok: false, error: res.error };

  // WhatsApp además del correo, no en su lugar. Sin await: el correo ya salió y
  // un fallo aquí no puede hacer que la reserva parezca no confirmada.
  void enviarAvisoReserva(reservaId, "CONFIRMACION", { actor }).catch((e) =>
    console.error("[reservas] whatsapp CONFIRMACION:", e),
  );

  // Encadenar las condiciones económicas y la reconfirmación inmediata si
  // proceden. No bloqueamos la respuesta ni dejamos que un fallo aquí rompa el
  // flujo de creación.
  try {
    const { supabase } = ctxActor;
    const { data: r } = await supabase
      .from("reservas")
      .select(
        "empresa_id, fecha, hora, es_ticket, tiene_cancelacion, cancelacion_importe, tiene_garantia, garantia_importe",
      )
      .eq("id", reservaId)
      .maybeSingle();

    // El compromiso económico va en su propio correo: el cliente tiene que
    // poder volver a leer las condiciones sin rebuscar dentro de la
    // confirmación. Solo puede haber uno, porque los tipos son excluyentes
    // (ver `lib/tipo-reserva.ts`). Si la empresa tiene la plantilla pausada,
    // el mailer corta.
    const tipoReserva = tipoDeReserva({
      esTicket: r?.es_ticket as boolean | null,
      tieneGarantia: r?.tiene_garantia as boolean | null,
      garantiaImporte: r?.garantia_importe as number | null,
      tieneCancelacion: r?.tiene_cancelacion as boolean | null,
      cancelacionImporte: r?.cancelacion_importe as number | null,
    });
    if (tipoReserva === "cancelacion") {
      enviarReservaEmail(reservaId, "POLITICA_CANCELACION", { actor }).catch((e) =>
        console.error("[reservas] mail POLITICA_CANCELACION:", e),
      );
    }
    if (tipoReserva === "garantia") {
      enviarReservaEmail(reservaId, "POLITICA_GARANTIA", { actor }).catch((e) =>
        console.error("[reservas] mail POLITICA_GARANTIA:", e),
      );
    }

    if (r?.fecha && r?.hora && r?.empresa_id) {
      const { data: cfg } = await supabase
        .from("empresa_reservas_config")
        .select(
          "reconfirmacion_activa, reconfirmacion_dias_antes, reconfirmacion_envio_inmediato",
        )
        .eq("empresa_id", r.empresa_id as string)
        .maybeSingle();
      const activa = cfg?.reconfirmacion_activa === true;
      const diasAntes = (cfg?.reconfirmacion_dias_antes as number | null) ?? 1;
      const envioInmediato = cfg?.reconfirmacion_envio_inmediato === true;
      // La hora de la reserva es local del restaurante: hay que convertirla con
      // la zona de la empresa antes de compararla con "ahora" (el servidor va
      // en UTC y desviaba el cálculo del lead 1-2 h).
      const tzEmpresa = await getZonaHorariaEmpresa(
        supabase as unknown as SupabaseClient,
        r.empresa_id as string,
      );
      const ts = new Date(
        zonaLocalAUtcISO(r.fecha as string, (r.hora as string).slice(0, 5), tzEmpresa),
      );
      const diffMs = ts.getTime() - Date.now();
      const leadMs = diasAntes * 24 * 3600 * 1000;
      const porDebajoDelLead = diffMs > 0 && diffMs < leadMs;
      if (activa && porDebajoDelLead && envioInmediato) {
        enviarReservaEmail(reservaId, "RECONFIRMADA", { actor }).catch((e) =>
          console.error("[reservas] mail RECONFIRMADA lt-lead:", e),
        );
      }
    }
  } catch (e) {
    console.error("[reservas] reconfirmacion lt-lead check:", e);
  }
  return { ok: true };
}

/**
 * Envía un correo de un tipo arbitrario para una reserva. Pensado para
 * acciones manuales desde el detalle de la reserva (p.ej. "Reenviar
 * recordatorio") y para tests.
 *
 * Admite cualquier tipo salvo TICKET_COMPRA, que no cuelga de una reserva: esa
 * compra ocurre antes de que exista, y tiene su propio emisor.
 */
export async function enviarReservaEmailManual(
  reservaId: string,
  tipo: Exclude<ReservaEmailTipo, "TICKET_COMPRA">,
) {
  // `force: true` permite reenvíos manuales aunque ya haya timestamp. Cada
  // reenvío deja su propia línea en el histórico, firmada por quien lo pide.
  const ctx = await getContext();
  const res = await enviarReservaEmail(reservaId, tipo, {
    force: true,
    actor: actorDeSesion(ctx),
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error };
}

