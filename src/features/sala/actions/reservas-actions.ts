"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrLinkClienteSala, type CampoDistinto } from "@/features/sala/lib/cliente-link";
import { asignarMesaAutomatica } from "@/features/sala/planos/lib/asignacion-mesa";
import { getMesasBloqueadas } from "@/features/sala/bloqueos/lib/mesas-bloqueadas";
import {
  buscarConflictoMesa,
  getDuracionReservaMin,
} from "@/features/sala/lib/reserva-conflicto";
import type { TipoMesa } from "@/features/sala/planos/data/planos";
import { enviarReservaEmail } from "@/lib/email/reservas/mailer";
async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, nombre: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);

  const { data } = await supabase

    .from("profiles")

    .select("nombre, apellidos")

    .eq("user_id", user.id)

    .single();
return {
    supabase,
    user,
    empresaId,
    nombre: data ? data.nombre + " " + data.apellidos : null,
  };
}

export async function listReservas(fecha?: string) {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("reservas")
      .select("*")
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    if (fecha) query.eq("fecha", fecha);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[reservas] listReservas:", err);
    return { ok: false, data: [] };
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
      .order("fecha", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[reservas] listReservasRango:", err);
    return { ok: false, data: [] };
  }
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
  tipoCategoria?: "gratis" | "politica" | "cupon" | null;
  politicaCancelacionId?: string | null;
  garantiaImporte?: number | null;
  importePagado?: number | null;
  bloqueada?: boolean;
  grupoId?: string | null;
  etiquetaId?: string | null;
  /** Override de duración solo para ESTA reserva (min). NULL = default empresa. */
  duracionMinutos?: number | null;
  // Asignación automática de mesa (PRP-048). Si `asignarAuto=true` y la
  // reserva llega sin `mesa`, el sistema busca la primera libre del plano
  // activo del local con capacidad para los comensales. `localId` es
  // obligatorio cuando se activa.
  asignarAuto?: boolean;
  localId?: string | null;
  salaIdFiltro?: string | null;
  zonaIdFiltro?: string | null;
  tipoMesaFiltro?: TipoMesa | null;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Si hay email o teléfono, vincular/crear ficha de cliente.
    // Sin contacto (walk-in puntual), se inserta la reserva sin cliente_id.
    let clienteId: string | null = null;
    let clienteExistente = false;
    let camposDistintos: CampoDistinto[] = [];
    let nombreFinal = input.clienteNombre;
    let apellidosFinal: string | null = input.clienteApellidos ?? null;
    let telefonoFinal: string | null = input.clienteTelefono ?? null;
    let emailFinal: string | null = input.clienteEmail ?? null;

    const hayContacto = (input.clienteEmail && input.clienteEmail.trim().length > 0)
      || (input.clienteTelefono && input.clienteTelefono.trim().length >= 5);
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
      telefonoFinal = link.result.cliente.telefono;
      emailFinal = link.result.cliente.email;
    }

    const estadoFinal = input.estado ?? "PENDIENTE";
    // Walk-in siempre marca origen = WALKIN (el cliente no vino por canal digital).
    const origenFinal = estadoFinal === "WALK_IN" ? "WALKIN" : (input.origen ?? null);

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
      // Bloqueos manuales: si la mesa elegida está bloqueada para la fecha,
      // rechazamos. Solo aplicable cuando conocemos el local.
      if (input.localId) {
        const bloqueadas = await getMesasBloqueadas(
          supabase as unknown as SupabaseClient,
          {
            empresaId,
            localId: input.localId,
            fechaISO: input.fecha,
          },
        );
        if (bloqueadas.size > 0) {
          const { data: mesaRow } = await supabase
            .from("mesas")
            .select("id")
            .eq("local_id", input.localId)
            .eq("codigo", mesaFinal)
            .maybeSingle();
          const mesaId = (mesaRow?.id as string | undefined) ?? null;
          if (mesaId && bloqueadas.has(mesaId)) {
            return {
              ok: false,
              error: `La mesa ${mesaFinal} está bloqueada para ese día. Quita el bloqueo desde Configuración → Bloqueos o elige otra mesa.`,
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
      notas: input.notas ?? null,
      origen: origenFinal,
      tarjeta_introducida: input.tarjetaIntroducida ?? false,
      es_ticket: input.esTicket ?? false,
      tipo_categoria: input.tipoCategoria ?? null,
      politica_cancelacion_id: input.tipoCategoria === "politica" ? (input.politicaCancelacionId ?? null) : null,
      garantia_importe: input.tipoCategoria === "politica" ? (input.garantiaImporte ?? null) : null,
      importe_pagado: input.tipoCategoria === "cupon" ? (input.importePagado ?? null) : null,
      bloqueada: input.bloqueada ?? false,
      grupo_id: input.grupoId ?? null,
      etiqueta_id: input.etiquetaId ?? null,
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
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas] createReserva:", msg);
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
    estado?: string;
    notas?: string;
    origen?: string | null;
    // Flags acumulables (PRP-047)
    tarjetaIntroducida?: boolean;
    esTicket?: boolean;
    tipoCategoria?: "gratis" | "politica" | "cupon" | null;
    politicaCancelacionId?: string | null;
    garantiaImporte?: number | null;
    importePagado?: number | null;
    bloqueada?: boolean;
    grupoId?: string | null;
    etiquetaId?: string | null;
    reconfirmadaAt?: string | null;
    /** Override de duración. Pasa null para volver a la default empresa. */
    duracionMinutos?: number | null;
  }
) {
  try {
    const { supabase, empresaId } = await getContext();
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
        dbUpdates.cliente_telefono = link.result.cliente.telefono;
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
    if (updates.turno !== undefined) dbUpdates.turno = updates.turno;
    if (updates.estado !== undefined) dbUpdates.estado = updates.estado;
    if (updates.notas !== undefined) dbUpdates.notas = updates.notas;
    if (updates.origen !== undefined) dbUpdates.origen = updates.origen;
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
        dbUpdates.politica_cancelacion_id = null;
        dbUpdates.garantia_importe = null;
      }
      if (updates.tipoCategoria !== "cupon") {
        dbUpdates.importe_pagado = null;
      }
    }
    if (updates.politicaCancelacionId !== undefined) dbUpdates.politica_cancelacion_id = updates.politicaCancelacionId;
    if (updates.garantiaImporte !== undefined) dbUpdates.garantia_importe = updates.garantiaImporte;
    if (updates.importePagado !== undefined) dbUpdates.importe_pagado = updates.importePagado;
    if (updates.bloqueada !== undefined) dbUpdates.bloqueada = updates.bloqueada;
    if (updates.grupoId !== undefined) dbUpdates.grupo_id = updates.grupoId;
    if (updates.etiquetaId !== undefined) dbUpdates.etiqueta_id = updates.etiquetaId;
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
    } else if (updates.estado === "PENDIENTE" || updates.estado === "CONFIRMADA") {
      // Volver a un estado previo a la reconfirmación borra el flag — corrige
      // errores manuales sin necesidad de UI dedicada.
      dbUpdates.reconfirmada_at = null;
    }

    // Bloqueo de solape al re-asignar mesa/fecha/hora. Reutiliza la
    // `duracion_reserva_min` configurada por empresa. Solo se chequea cuando
    // el UPDATE final tendrá mesa (la reserva resultante ocupa una mesa).
    const tocaSlot =
      updates.mesa !== undefined ||
      updates.fecha !== undefined ||
      updates.hora !== undefined;
    if (tocaSlot && empresaId) {
      const { data: actual } = await supabase
        .from("reservas")
        .select("fecha, hora, mesa, duracion_minutos")
        .eq("id", id)
        .maybeSingle();
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
        const duracionDefault = await getDuracionReservaMin(
          supabase as unknown as SupabaseClient,
          empresaId,
        );
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

    const { error } = await supabase
      .from("reservas")
      .update(dbUpdates)
      .eq("id", id);
    if (error) throw error;

    // Disparadores de correo según transición de estado. Idempotente: el mailer
    // no reenvía si ya hay timestamp en la columna de auditoría correspondiente.
    // No await — fire-and-forget para que un fallo de SMTP no rompa el UPDATE.
    if (updates.estado === "RECONFIRMADA") {
      enviarReservaEmail(id, "RECONFIRMACION").catch((e) =>
        console.error("[reservas] mail RECONFIRMACION:", e),
      );
    } else if (updates.estado === "CANCELADA") {
      enviarReservaEmail(id, "CANCELACION").catch((e) =>
        console.error("[reservas] mail CANCELACION:", e),
      );
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas] updateReserva:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteReserva(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("reservas")
      .delete()
      .eq("id", id);
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
 */
export async function notificarReservaCreadaPorEmail(reservaId: string) {
  const res = await enviarReservaEmail(reservaId, "CONFIRMACION");
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error };
}

/**
 * Envía un correo de un tipo arbitrario para una reserva. Pensado para
 * acciones manuales desde el detalle de la reserva (p.ej. "Reenviar
 * recordatorio") y para tests. Tipos válidos: CONFIRMACION, RECONFIRMACION,
 * RECORDATORIO, CANCELACION.
 */
export async function enviarReservaEmailManual(
  reservaId: string,
  tipo: "CONFIRMACION" | "RECONFIRMACION" | "RECORDATORIO" | "CANCELACION",
) {
  // `force: true` permite reenvíos manuales aunque ya haya timestamp.
  const res = await enviarReservaEmail(reservaId, tipo, { force: true });
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error };
}
