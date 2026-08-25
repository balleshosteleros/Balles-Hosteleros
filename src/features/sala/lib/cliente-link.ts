import type { SupabaseClient } from "@supabase/supabase-js";

export interface ClienteSalaRow {
  id: string;
  empresa_id: string;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  email_normalizado: string | null;
  telefono_normalizado: string | null;
  clasificacion: string;
  visitas: number;
  ultima_visita: string | null;
}

export type CampoDistinto = "nombre" | "apellidos" | "email" | "telefono";

export interface FindOrLinkClienteResult {
  cliente: ClienteSalaRow;
  existed: boolean;
  camposDistintos: CampoDistinto[];
}

interface FindOrLinkInput {
  empresaId: string;
  nombre: string;
  apellidos?: string | null;
  email?: string | null;
  telefono?: string | null;
}

/**
 * Llama a la RPC atómica `find_or_link_cliente_sala`:
 * - Si existe un cliente con mismo email o teléfono normalizado en la empresa, lo devuelve.
 * - Si no, lo crea.
 * - Nunca sobrescribe datos del cliente vigente; devuelve qué campos del input difieren.
 */
export async function findOrLinkClienteSala(
  supabase: SupabaseClient,
  input: FindOrLinkInput,
): Promise<{ ok: true; result: FindOrLinkClienteResult } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("find_or_link_cliente_sala", {
    p_empresa_id: input.empresaId,
    p_nombre: input.nombre,
    p_apellidos: input.apellidos ?? null,
    p_email: input.email ?? null,
    p_telefono: input.telefono ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  const r = data as {
    cliente: ClienteSalaRow;
    existed: boolean;
    camposDistintos: CampoDistinto[];
  } | null;
  if (!r?.cliente?.id) {
    return { ok: false, error: "No se pudo vincular el cliente" };
  }
  return { ok: true, result: r };
}

/**
 * Completa la ficha con los datos que el cliente acaba de dar al reservar.
 *
 * Solo RELLENA HUECOS: si la ficha ya tiene fecha de nacimiento o prefijo, se
 * respetan (mismo criterio que la RPC de vinculación, que nunca pisa datos del
 * cliente vigente). El consentimiento comercial sí se actualiza siempre que
 * venga marcado, porque es un acto voluntario del cliente en ese momento; y
 * nunca se retira desde aquí: un "no marcado" en el formulario no es lo mismo
 * que revocar un consentimiento dado antes.
 */
export async function completarFichaCliente(
  supabase: SupabaseClient,
  clienteId: string,
  datos: {
    fechaNacimiento?: string | null;
    telefonoPrefijo?: string | null;
    aceptaMarketing?: boolean;
    origen?: string | null;
  },
): Promise<void> {
  try {
    const { data: actual } = await supabase
      .from("clientes_sala")
      .select("fecha_nacimiento, telefono_prefijo, acepta_marketing_email")
      .eq("id", clienteId)
      .maybeSingle();

    const patch: Record<string, unknown> = {};

    if (datos.fechaNacimiento && !actual?.fecha_nacimiento) {
      patch.fecha_nacimiento = datos.fechaNacimiento;
    }
    // El prefijo nace con "+34" por defecto, así que "tiene valor" no significa
    // que el cliente lo haya elegido: si sigue siendo el de fábrica, se pisa
    // con el que acaba de indicar. Un cliente portugués no puede quedarse con
    // un prefijo español.
    const prefijoEsDefault = !actual?.telefono_prefijo || actual.telefono_prefijo === "+34";
    if (datos.telefonoPrefijo && prefijoEsDefault) {
      patch.telefono_prefijo = datos.telefonoPrefijo;
    }
    if (datos.aceptaMarketing && !actual?.acepta_marketing_email) {
      patch.acepta_marketing_email = true;
      patch.acepta_marketing_sms = true;
      patch.marketing_optin_origen = datos.origen ?? "RESERVA_WEB";
      patch.marketing_optin_at = new Date().toISOString();
    }

    if (Object.keys(patch).length === 0) return;
    patch.updated_at = new Date().toISOString();
    await supabase.from("clientes_sala").update(patch).eq("id", clienteId);
  } catch (err) {
    // Completar la ficha no debe tumbar una reserva ya aceptada.
    console.error("[cliente-link] completarFicha:", err);
  }
}

export async function registrarVisitaCliente(
  supabase: SupabaseClient,
  clienteId: string,
  fechaIso: string,
): Promise<void> {
  await supabase.rpc("registrar_visita_cliente_sala", {
    p_cliente_id: clienteId,
    p_fecha: fechaIso,
  });
}
