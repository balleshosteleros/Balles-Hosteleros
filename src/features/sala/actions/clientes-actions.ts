"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrLinkClienteSala } from "@/features/sala/lib/cliente-link";

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

export async function listClientes() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("clientes_sala")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[clientes] listClientes:", err);
    return { ok: false, data: [] };
  }
}

export async function createCliente(input: {
  nombre: string;
  apellidos?: string;
  telefono?: string;
  email?: string;
  clasificacion?: string;
  observaciones?: string;
  preferencias?: string;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Si hay email o teléfono, usar la RPC de dedup: bloquea duplicados
    // y vincula a la ficha existente si ya existe.
    const hayContacto =
      (input.email && input.email.trim().length > 0) ||
      (input.telefono && input.telefono.trim().length > 0);
    if (hayContacto) {
      const link = await findOrLinkClienteSala(supabase as unknown as SupabaseClient, {
        empresaId,
        nombre: input.nombre,
        apellidos: input.apellidos,
        email: input.email,
        telefono: input.telefono,
      });
      if (!link.ok) return { ok: false, error: link.error };
      if (link.result.existed) {
        return {
          ok: false,
          error: "Ya existe una ficha con ese email o teléfono en esta empresa.",
          existingId: link.result.cliente.id,
        };
      }
      // Cliente nuevo creado por la RPC; aplicamos campos no-contactos si los hay.
      if (input.clasificacion || input.observaciones || input.preferencias) {
        await supabase
          .from("clientes_sala")
          .update({
            clasificacion: input.clasificacion ?? "NUEVO",
            observaciones: input.observaciones ?? null,
            preferencias: input.preferencias ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", link.result.cliente.id);
      }
      return { ok: true, id: link.result.cliente.id };
    }

    // Sin contacto: alta directa.
    const { data, error } = await supabase
      .from("clientes_sala")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        apellidos: input.apellidos ?? null,
        telefono: null,
        email: null,
        clasificacion: input.clasificacion ?? "NUEVO",
        observaciones: input.observaciones ?? null,
        preferencias: input.preferencias ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: (data?.id as string) ?? null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[clientes] createCliente:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCliente(
  id: string,
  input: {
    nombre?: string;
    apellidos?: string;
    telefono?: string;
    email?: string;
    clasificacion?: string;
    observaciones?: string;
    preferencias?: string;
    notas_internas?: string;
  }
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Si cambian email o teléfono, comprobar que no choca con otra ficha existente.
    const tocaContacto = input.email !== undefined || input.telefono !== undefined;
    if (tocaContacto) {
      const nuevoEmail = input.email?.trim() ?? null;
      const nuevoTel = input.telefono?.trim() ?? null;
      const emailN = nuevoEmail && nuevoEmail.length > 0 ? nuevoEmail.toLowerCase() : null;
      const telN = nuevoTel && nuevoTel.length > 0 ? nuevoTel.replace(/\D/g, "") : null;
      // Aplica normalización ES (móviles/fijos con +34/0034)
      const telNorm = telN
        ? /^0034[6-9]\d{8}$/.test(telN)
          ? telN.slice(4)
          : /^34[6-9]\d{8}$/.test(telN)
            ? telN.slice(2)
            : telN
        : null;

      if (emailN || telNorm) {
        const filters: string[] = [];
        if (emailN) filters.push(`email_normalizado.eq.${emailN}`);
        if (telNorm) filters.push(`telefono_normalizado.eq.${telNorm}`);
        const { data: choque } = await supabase
          .from("clientes_sala")
          .select("id")
          .eq("empresa_id", empresaId)
          .neq("id", id)
          .or(filters.join(","))
          .limit(1)
          .maybeSingle();
        if (choque?.id) {
          return {
            ok: false,
            error: "Ese email o teléfono ya está en otra ficha de cliente.",
            existingId: choque.id as string,
          };
        }
      }
    }

    const { error } = await supabase
      .from("clientes_sala")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[clientes] updateCliente:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCliente(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("clientes_sala")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[clientes] deleteCliente:", msg);
    return { ok: false, error: msg };
  }
}

export async function incrementarVisita(id: string) {
  try {
    const { supabase } = await getContext();
    // Fetch current visitas
    const { data: cliente, error: fetchErr } = await supabase
      .from("clientes_sala")
      .select("visitas")
      .eq("id", id)
      .single();
    if (fetchErr) throw fetchErr;

    const { error } = await supabase
      .from("clientes_sala")
      .update({
        visitas: (cliente?.visitas ?? 0) + 1,
        ultima_visita: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[clientes] incrementarVisita:", msg);
    return { ok: false, error: msg };
  }
}
