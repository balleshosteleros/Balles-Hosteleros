"use server";

import { createClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, nombre: null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id, nombre, apellidos")
    .eq("user_id", user.id)
    .single();
  return {
    supabase,
    user,
    empresaId: data?.empresa_id ?? null,
    nombre: data ? data.nombre + " " + data.apellidos : null,
  };
}

export async function listProveedores() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("proveedores")
      .select("*")
      .order("nombre", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[proveedores] listProveedores:", err);
    return { ok: false, data: [] };
  }
}

export async function createProveedor(input: {
  nombre: string;
  nombreComercial?: string;
  cif?: string;
  direccion?: string;
  codigoPostal?: string;
  ciudad?: string;
  telefonoPrincipal?: string;
  telefonoSecundario?: string;
  emailPrincipal?: string;
  emailPedidos?: string;
  emailIncidencias?: string;
  web?: string;
  estado?: string;
  diaPedido?: string;
  diaEntrega?: string;
  horaLimite?: string;
  formaPago?: string;
  condiciones?: string;
  notas?: string;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase.from("proveedores").insert({
      empresa_id: empresaId,
      nombre: input.nombre,
      nombre_comercial: input.nombreComercial ?? null,
      cif: input.cif ?? null,
      direccion: input.direccion ?? null,
      codigo_postal: input.codigoPostal ?? null,
      ciudad: input.ciudad ?? null,
      telefono_principal: input.telefonoPrincipal ?? null,
      telefono_secundario: input.telefonoSecundario ?? null,
      email_principal: input.emailPrincipal ?? null,
      email_pedidos: input.emailPedidos ?? null,
      email_incidencias: input.emailIncidencias ?? null,
      web: input.web ?? null,
      estado: input.estado ?? "Activo",
      dia_pedido: input.diaPedido ?? null,
      dia_entrega: input.diaEntrega ?? null,
      hora_limite: input.horaLimite ?? null,
      forma_pago: input.formaPago ?? null,
      condiciones: input.condiciones ?? null,
      notas: input.notas ?? null,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[proveedores] createProveedor:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateProveedor(
  id: string,
  input: {
    nombre?: string;
    nombreComercial?: string;
    cif?: string;
    direccion?: string;
    codigoPostal?: string;
    ciudad?: string;
    telefonoPrincipal?: string;
    telefonoSecundario?: string;
    emailPrincipal?: string;
    emailPedidos?: string;
    emailIncidencias?: string;
    web?: string;
    estado?: string;
    diaPedido?: string;
    diaEntrega?: string;
    horaLimite?: string;
    formaPago?: string;
    condiciones?: string;
    notas?: string;
  }
) {
  try {
    const { supabase } = await getContext();
    // Convert camelCase inputs to snake_case DB fields
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.nombre !== undefined) dbUpdates.nombre = input.nombre;
    if (input.nombreComercial !== undefined)
      dbUpdates.nombre_comercial = input.nombreComercial;
    if (input.cif !== undefined) dbUpdates.cif = input.cif;
    if (input.direccion !== undefined) dbUpdates.direccion = input.direccion;
    if (input.codigoPostal !== undefined)
      dbUpdates.codigo_postal = input.codigoPostal;
    if (input.ciudad !== undefined) dbUpdates.ciudad = input.ciudad;
    if (input.telefonoPrincipal !== undefined)
      dbUpdates.telefono_principal = input.telefonoPrincipal;
    if (input.telefonoSecundario !== undefined)
      dbUpdates.telefono_secundario = input.telefonoSecundario;
    if (input.emailPrincipal !== undefined)
      dbUpdates.email_principal = input.emailPrincipal;
    if (input.emailPedidos !== undefined)
      dbUpdates.email_pedidos = input.emailPedidos;
    if (input.emailIncidencias !== undefined)
      dbUpdates.email_incidencias = input.emailIncidencias;
    if (input.web !== undefined) dbUpdates.web = input.web;
    if (input.estado !== undefined) dbUpdates.estado = input.estado;
    if (input.diaPedido !== undefined) dbUpdates.dia_pedido = input.diaPedido;
    if (input.diaEntrega !== undefined)
      dbUpdates.dia_entrega = input.diaEntrega;
    if (input.horaLimite !== undefined)
      dbUpdates.hora_limite = input.horaLimite;
    if (input.formaPago !== undefined) dbUpdates.forma_pago = input.formaPago;
    if (input.condiciones !== undefined)
      dbUpdates.condiciones = input.condiciones;
    if (input.notas !== undefined) dbUpdates.notas = input.notas;

    const { error } = await supabase
      .from("proveedores")
      .update(dbUpdates)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[proveedores] updateProveedor:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteProveedor(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("proveedores")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[proveedores] deleteProveedor:", msg);
    return { ok: false, error: msg };
  }
}
