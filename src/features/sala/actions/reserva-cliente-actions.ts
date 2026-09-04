"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { registrarCambioDatosCliente } from "@/features/sala/lib/cliente-actividad";
import type { SupabaseClient } from "@supabase/supabase-js";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, usuarioId: null, nombre: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  // Quién firma el cambio en la actividad: sin esto la línea saldría como
  // "Sin registrar" y no serviría para saber a quién preguntar.
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nombre, apellidos")
    .eq("user_id", user.id)
    .maybeSingle();
  const nombre = usuario
    ? [usuario.nombre, usuario.apellidos].filter(Boolean).join(" ").trim() || null
    : null;
  return {
    supabase,
    user,
    empresaId,
    usuarioId: (usuario?.id as string | null) ?? null,
    nombre,
  };
}

export interface DatosClienteReserva {
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;
}

/**
 * Guarda los datos del cliente editados desde una reserva y los propaga a
 * TODAS partes: su ficha en `clientes_sala` y cada una de sus reservas.
 *
 * POR QUÉ propagar: los datos del cliente viven duplicados en cada reserva
 * (`reservas.cliente_nombre`, `cliente_telefono`…) además de en su ficha. Si al
 * corregir un teléfono solo se tocara la reserva abierta, el mismo cliente
 * quedaría con dos números distintos según dónde se le mire, y el correo o la
 * llamada saldrían al viejo. Un cliente, un dato.
 *
 * La propagación se hace por `cliente_id`, así que solo alcanza a las reservas
 * de ESTE cliente en ESTA empresa. Las reservas sin vincular (walk-ins sin
 * contacto) no se tocan.
 */
export async function guardarDatosClienteReserva(
  reservaId: string,
  datos: DatosClienteReserva,
) {
  try {
    const ctx = await getCtx();
    const { supabase, empresaId } = ctx;
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    const nombre = datos.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
    const apellidos = datos.apellidos.trim() || null;
    const email = datos.email.trim() || null;
    // El teléfono va entero, con el prefijo dentro: es un solo campo, aquí y
    // en la ficha del cliente.
    const telefono = datos.telefono.trim() || null;

    // El filtro por empresa es imprescindible: la RLS acota a las empresas del
    // usuario, no a la ACTIVA (mismo motivo que en el resto de reservas).
    // Se leen también los datos ANTERIORES: son la mitad de la línea de
    // actividad y hay que capturarlos antes de sobrescribirlos.
    const { data: reserva, error: errR } = await supabase
      .from("reservas")
      .select("cliente_id, cliente_nombre, cliente_apellidos, cliente_email, cliente_telefono")
      .eq("id", reservaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (errR) throw errR;
    if (!reserva) return { ok: false, error: "Reserva no encontrada." };

    const clienteId = (reserva.cliente_id as string | null) ?? null;
    const antes = {
      cliente_nombre: (reserva.cliente_nombre as string | null) ?? null,
      cliente_apellidos: (reserva.cliente_apellidos as string | null) ?? null,
      cliente_email: (reserva.cliente_email as string | null) ?? null,
      cliente_telefono: (reserva.cliente_telefono as string | null) ?? null,
    };

    // 1) La ficha del cliente es la fuente de verdad: se actualiza primero.
    //    Los campos `*_normalizado` son columnas generadas, se recalculan solas.
    if (clienteId) {
      const { error } = await supabase
        .from("clientes_sala")
        .update({ nombre, apellidos, email, telefono })
        .eq("id", clienteId)
        .eq("empresa_id", empresaId);
      if (error) throw error;
    }

    // 2) Las reservas que llevan copia de esos datos.
    const camposReserva = {
      cliente_nombre: nombre,
      cliente_apellidos: apellidos,
      cliente_email: email,
      cliente_telefono: telefono,
      updated_at: new Date().toISOString(),
    };

    if (clienteId) {
      // Cliente con ficha: todas sus reservas, pasadas y futuras.
      const { error } = await supabase
        .from("reservas")
        .update(camposReserva)
        .eq("cliente_id", clienteId)
        .eq("empresa_id", empresaId);
      if (error) throw error;
    } else {
      // Walk-in sin ficha: solo puede tocarse la reserva abierta, no hay nada
      // que la enlace con otras.
      const { error } = await supabase
        .from("reservas")
        .update(camposReserva)
        .eq("id", reservaId)
        .eq("empresa_id", empresaId);
      if (error) throw error;
    }

    // 3) Actividad DEL CLIENTE, no de la reserva. Cambiar un email no le pasa a
    //    esta reserva: le pasa a la persona, y hay que poder verlo desde su
    //    ficha aunque se haya editado desde aquí. La actividad de la reserva
    //    queda solo para lo suyo (mesa, hora, estado…).
    //
    //    Un walk-in sin ficha no tiene dónde registrarlo: sus datos no son de
    //    ningún cliente, viven solo en esa reserva.
    if (clienteId) {
      await registrarCambioDatosCliente(supabase as unknown as SupabaseClient, {
        empresaId,
        clienteId,
        antes: {
          nombre: antes.cliente_nombre,
          apellidos: antes.cliente_apellidos,
          email: antes.cliente_email,
          telefono: antes.cliente_telefono,
        },
        despues: { nombre, apellidos, email, telefono },
        usuarioId: ctx.usuarioId,
        usuarioNombre: ctx.nombre,
      });
    }

    return { ok: true, clienteId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas] guardarDatosClienteReserva:", msg);
    return { ok: false, error: msg };
  }
}
