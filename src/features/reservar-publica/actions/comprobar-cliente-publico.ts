"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const inputSchema = z.object({
  empresaSlug: z.string().min(1).max(120),
  email: z.string().email().max(160).nullable().optional(),
  telefono: z.string().min(5).max(40).nullable().optional(),
});

export type ComprobarClienteResult =
  | {
      ok: true;
      match: null;
    }
  | {
      ok: true;
      match: {
        nombre: string;
        apellidos: string | null;
        email: string | null;
        telefono: string | null;
        matchPor: "email" | "telefono";
      };
    }
  | { ok: false; error: string };

/**
 * Consulta (solo lectura) si en la empresa existe ya una ficha cuyo email o teléfono
 * normalizado coincida con los datos del form. Se usa en /reservar para avisar al
 * usuario ANTES de crear la reserva.
 */
export async function comprobarClientePublicoAction(input: {
  empresaSlug: string;
  email?: string | null;
  telefono?: string | null;
}): Promise<ComprobarClienteResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos" };
  }
  const data = parsed.data;
  if (!data.email && !data.telefono) {
    return { ok: true, match: null };
  }

  const admin = createAdminClient();
  const { data: empresa } = await admin
    .from("empresas")
    .select("id")
    .eq("slug", data.empresaSlug)
    .maybeSingle();
  if (!empresa) return { ok: false, error: "Restaurante no encontrado" };

  const { data: rpc, error } = await admin.rpc("buscar_cliente_sala_por_contacto", {
    p_empresa_id: empresa.id,
    p_email: data.email ?? null,
    p_telefono: data.telefono ?? null,
  });
  if (error) {
    console.error("[reservar-publica] comprobar cliente:", error);
    return { ok: false, error: "No se pudo comprobar" };
  }
  const r = rpc as {
    cliente: { nombre: string; apellidos: string | null; email: string | null; telefono: string | null } | null;
    matchPor: "email" | "telefono" | null;
  } | null;
  if (!r?.cliente || !r.matchPor) {
    return { ok: true, match: null };
  }
  return {
    ok: true,
    match: {
      nombre: r.cliente.nombre,
      apellidos: r.cliente.apellidos,
      email: r.cliente.email,
      telefono: r.cliente.telefono,
      matchPor: r.matchPor,
    },
  };
}
