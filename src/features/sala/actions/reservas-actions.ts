"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrLinkClienteSala, type CampoDistinto } from "@/features/sala/lib/cliente-link";
import { asignarMesaAutomatica } from "@/features/sala/planos/lib/asignacion-mesa";
import type { TipoMesa } from "@/features/sala/planos/data/planos";
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
  politicaCancelacionId?: string | null;
  garantiaImporte?: number | null;
  bloqueada?: boolean;
  grupoId?: string | null;
  etiquetaId?: string | null;
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
      politica_cancelacion_id: input.politicaCancelacionId ?? null,
      garantia_importe: input.garantiaImporte ?? null,
      bloqueada: input.bloqueada ?? false,
      grupo_id: input.grupoId ?? null,
      etiqueta_id: input.etiquetaId ?? null,
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
    politicaCancelacionId?: string | null;
    garantiaImporte?: number | null;
    bloqueada?: boolean;
    grupoId?: string | null;
    etiquetaId?: string | null;
    reconfirmadaAt?: string | null;
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
    if (updates.politicaCancelacionId !== undefined) dbUpdates.politica_cancelacion_id = updates.politicaCancelacionId;
    if (updates.garantiaImporte !== undefined) dbUpdates.garantia_importe = updates.garantiaImporte;
    if (updates.bloqueada !== undefined) dbUpdates.bloqueada = updates.bloqueada;
    if (updates.grupoId !== undefined) dbUpdates.grupo_id = updates.grupoId;
    if (updates.etiquetaId !== undefined) dbUpdates.etiqueta_id = updates.etiquetaId;
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

    const { error } = await supabase
      .from("reservas")
      .update(dbUpdates)
      .eq("id", id);
    if (error) throw error;
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
