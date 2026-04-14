"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import type { ProveedorImport } from "@/features/logistica/types/import";
import type { ProveedorRow } from "@/features/logistica/types/db";
import { capitalizeText } from "@/shared/lib/utils";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, user: userId ? { id: userId } : null, empresaId };
}

export async function listProveedores() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("proveedores")
      .select("*")
      .order("nombre_comercial", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as ProveedorRow[] };
  } catch (err) {
    console.error("[proveedores] listProveedores:", err);
    return { ok: false as const, data: [] as ProveedorRow[] };
  }
}

export async function createProveedor(input: ProveedorImport) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false as const, error: "No autenticado" };

    if (!input.nombreComercial?.trim()) {
      return { ok: false as const, error: "El nombre comercial es obligatorio" };
    }
    if (!input.categoria?.trim()) {
      return { ok: false as const, error: "La categoría es obligatoria" };
    }

    const { error } = await supabase.from("proveedores").insert({
      empresa_id: empresaId,
      nombre_comercial: capitalizeText(input.nombreComercial.trim()),
      razon_social: input.razonSocial ? capitalizeText(input.razonSocial) : null,
      cif_nif: input.cifNif ?? null,
      categoria: capitalizeText(input.categoria.trim()),
      estado: input.estado ?? "Activo",
      persona_contacto: input.personaContacto ? capitalizeText(input.personaContacto) : null,
      telefono_principal: input.telefonoPrincipal ?? null,
      telefono_secundario: input.telefonoSecundario ?? null,
      email_principal: input.emailPrincipal ?? null,
      email_pedidos: input.emailPedidos ?? null,
      email_incidencias: input.emailIncidencias ?? null,
      web: input.web ?? null,
      direccion: input.direccion ? capitalizeText(input.direccion) : null,
      ciudad: input.ciudad ? capitalizeText(input.ciudad) : null,
      provincia: input.provincia ? capitalizeText(input.provincia) : null,
      pais: input.pais ? capitalizeText(input.pais) : "España",
      codigo_postal: input.codigoPostal ?? null,
      dias_reparto: input.diasReparto ?? [],
      condiciones_pago: input.condicionesPago ?? null,
      plazo_entrega: input.plazoEntrega ?? null,
      observaciones: input.observaciones ?? null,
      comentarios_internos: input.comentariosInternos ?? null,
      created_by: user.id,
    });

    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[proveedores] createProveedor:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function updateProveedor(id: string, input: Partial<ProveedorImport>) {
  try {
    const { supabase } = await getContext();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.nombreComercial !== undefined) updates.nombre_comercial = input.nombreComercial ? capitalizeText(input.nombreComercial) : input.nombreComercial;
    if (input.razonSocial !== undefined) updates.razon_social = input.razonSocial ? capitalizeText(input.razonSocial) : input.razonSocial;
    if (input.cifNif !== undefined) updates.cif_nif = input.cifNif;
    if (input.categoria !== undefined) updates.categoria = input.categoria ? capitalizeText(input.categoria) : input.categoria;
    if (input.estado !== undefined) updates.estado = input.estado;
    if (input.personaContacto !== undefined) updates.persona_contacto = input.personaContacto ? capitalizeText(input.personaContacto) : input.personaContacto;
    if (input.telefonoPrincipal !== undefined) updates.telefono_principal = input.telefonoPrincipal;
    if (input.telefonoSecundario !== undefined) updates.telefono_secundario = input.telefonoSecundario;
    if (input.emailPrincipal !== undefined) updates.email_principal = input.emailPrincipal;
    if (input.emailPedidos !== undefined) updates.email_pedidos = input.emailPedidos;
    if (input.emailIncidencias !== undefined) updates.email_incidencias = input.emailIncidencias;
    if (input.web !== undefined) updates.web = input.web;
    if (input.direccion !== undefined) updates.direccion = input.direccion ? capitalizeText(input.direccion) : input.direccion;
    if (input.ciudad !== undefined) updates.ciudad = input.ciudad ? capitalizeText(input.ciudad) : input.ciudad;
    if (input.provincia !== undefined) updates.provincia = input.provincia ? capitalizeText(input.provincia) : input.provincia;
    if (input.pais !== undefined) updates.pais = input.pais ? capitalizeText(input.pais) : input.pais;
    if (input.codigoPostal !== undefined) updates.codigo_postal = input.codigoPostal;
    if (input.diasReparto !== undefined) updates.dias_reparto = input.diasReparto;
    if (input.condicionesPago !== undefined) updates.condiciones_pago = input.condicionesPago;
    if (input.plazoEntrega !== undefined) updates.plazo_entrega = input.plazoEntrega;
    if (input.observaciones !== undefined) updates.observaciones = input.observaciones;
    if (input.comentariosInternos !== undefined) updates.comentarios_internos = input.comentariosInternos;

    const { error } = await supabase.from("proveedores").update(updates).eq("id", id);
    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[proveedores] updateProveedor:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function deleteProveedor(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("proveedores").delete().eq("id", id);
    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[proveedores] deleteProveedor:", msg);
    return { ok: false as const, error: msg };
  }
}

/**
 * Importación masiva de proveedores desde parseo de Excel/CSV.
 */
export async function bulkImportProveedores(proveedores: ProveedorImport[]) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false as const, error: "No autenticado", imported: 0 };

    if (!Array.isArray(proveedores) || proveedores.length === 0) {
      return { ok: false as const, error: "No hay proveedores para importar", imported: 0 };
    }
    if (proveedores.length > 5000) {
      return { ok: false as const, error: "Máximo 5000 proveedores por importación", imported: 0 };
    }

    const rows = proveedores
      .filter((p) => p.nombreComercial && p.categoria)
      .map((p) => ({
        empresa_id: empresaId,
        nombre_comercial: capitalizeText(p.nombreComercial.trim()),
        razon_social: p.razonSocial ? capitalizeText(p.razonSocial) : null,
        cif_nif: p.cifNif ?? null,
        categoria: capitalizeText(p.categoria.trim()),
        estado: p.estado ?? "Activo",
        persona_contacto: p.personaContacto ? capitalizeText(p.personaContacto) : null,
        telefono_principal: p.telefonoPrincipal ?? null,
        telefono_secundario: p.telefonoSecundario ?? null,
        email_principal: p.emailPrincipal ?? null,
        email_pedidos: p.emailPedidos ?? null,
        email_incidencias: p.emailIncidencias ?? null,
        web: p.web ?? null,
        direccion: p.direccion ? capitalizeText(p.direccion) : null,
        ciudad: p.ciudad ? capitalizeText(p.ciudad) : null,
        provincia: p.provincia ? capitalizeText(p.provincia) : null,
        pais: p.pais ? capitalizeText(p.pais) : "España",
        codigo_postal: p.codigoPostal ?? null,
        dias_reparto: p.diasReparto ?? [],
        condiciones_pago: p.condicionesPago ?? null,
        plazo_entrega: p.plazoEntrega ?? null,
        observaciones: p.observaciones ?? null,
        comentarios_internos: p.comentariosInternos ?? null,
        created_by: user.id,
      }));

    if (rows.length === 0) {
      return { ok: false as const, error: "Ninguna fila con nombre comercial y categoría", imported: 0 };
    }

    const { error } = await supabase.from("proveedores").insert(rows);
    if (error) throw error;

    return { ok: true as const, imported: rows.length, skipped: proveedores.length - rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[proveedores] bulkImportProveedores:", msg);
    return { ok: false as const, error: msg, imported: 0 };
  }
}
