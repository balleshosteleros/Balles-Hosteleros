"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
return { supabase, user, empresaId };
}

/* ---------- Contactos contabilidad ---------- */

export async function listContactos() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("contactos_contabilidad")
      .select("*")
      .order("nombre", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[contabilidad] listContactos:", err);
    return { ok: false, data: [] };
  }
}

export async function createContacto(input: {
  nombre: string;
  nif?: string;
  tipo?: string;
  email?: string;
  telefono?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("contactos_contabilidad")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        nif: input.nif ?? null,
        tipo: input.tipo ?? null,
        email: input.email ?? null,
        telefono: input.telefono ?? null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contabilidad] createContacto:", msg);
    return { ok: false, error: msg };
  }
}

/* ---------- Facturas ---------- */

export async function listFacturas(tipo?: string) {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("facturas")
      .select("*")
      .order("fecha", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    if (tipo) query.eq("tipo", tipo);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[contabilidad] listFacturas:", err);
    return { ok: false, data: [] };
  }
}

export async function createFactura(input: {
  numero: string;
  tipo: string;
  contacto_id?: string;
  contacto_nombre: string;
  fecha: string;
  base_imponible: number;
  iva: number;
  total: number;
  notas?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("facturas")
      .insert({
        empresa_id: empresaId,
        numero: input.numero,
        tipo: input.tipo,
        contacto_id: input.contacto_id ?? null,
        contacto_nombre: input.contacto_nombre,
        fecha: input.fecha,
        base_imponible: input.base_imponible,
        iva: input.iva,
        total: input.total,
        notas: input.notas ?? null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contabilidad] createFactura:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateFactura(
  id: string,
  input: { estado?: string; notas?: string; fecha_cobro?: string }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("facturas")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contabilidad] updateFactura:", msg);
    return { ok: false, error: msg };
  }
}

/* ---------- Transacciones ---------- */

export async function listTransacciones(mes?: string) {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("transacciones")
      .select("*")
      .order("fecha", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    if (mes) query.gte("fecha", mes + "-01").lte("fecha", mes + "-31");
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[contabilidad] listTransacciones:", err);
    return { ok: false, data: [] };
  }
}

export async function createTransaccion(input: {
  tipo: string;
  concepto: string;
  importe: number;
  fecha: string;
  categoria?: string;
  factura_id?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("transacciones")
      .insert({
        empresa_id: empresaId,
        tipo: input.tipo,
        concepto: input.concepto,
        importe: input.importe,
        fecha: input.fecha,
        categoria: input.categoria ?? null,
        factura_id: input.factura_id ?? null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contabilidad] createTransaccion:", msg);
    return { ok: false, error: msg };
  }
}
