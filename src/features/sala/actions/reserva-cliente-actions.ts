"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, user, empresaId };
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
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    const nombre = datos.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
    const apellidos = datos.apellidos.trim() || null;
    const email = datos.email.trim() || null;
    const telefono = datos.telefono.trim() || null;

    // El filtro por empresa es imprescindible: la RLS acota a las empresas del
    // usuario, no a la ACTIVA (mismo motivo que en el resto de reservas).
    const { data: reserva, error: errR } = await supabase
      .from("reservas")
      .select("cliente_id")
      .eq("id", reservaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (errR) throw errR;
    if (!reserva) return { ok: false, error: "Reserva no encontrada." };

    const clienteId = (reserva.cliente_id as string | null) ?? null;

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

    return { ok: true, clienteId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas] guardarDatosClienteReserva:", msg);
    return { ok: false, error: msg };
  }
}
