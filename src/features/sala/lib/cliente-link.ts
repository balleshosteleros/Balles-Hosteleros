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
