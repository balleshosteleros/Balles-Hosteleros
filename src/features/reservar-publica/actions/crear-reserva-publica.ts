"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const inputSchema = z.object({
  empresaSlug: z.string().min(1).max(120),
  origen: z.string().regex(/^[A-Z0-9_]+$/).max(32).nullable().optional(),
  nombre: z.string().min(1).max(120),
  apellidos: z.string().max(120).optional().nullable(),
  telefono: z.string().min(5).max(40),
  email: z.string().email().max(160).optional().nullable(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  personas: z.number().int().min(1).max(50),
  notas: z.string().max(500).optional().nullable(),
});

export type CrearReservaPublicaInput = z.infer<typeof inputSchema>;

export async function crearReservaPublicaAction(input: CrearReservaPublicaInput) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }
  const data = parsed.data;
  const admin = createAdminClient();

  const { data: empresa, error: errEmpresa } = await admin
    .from("empresas")
    .select("id, nombre")
    .eq("slug", data.empresaSlug)
    .maybeSingle();
  if (errEmpresa || !empresa) {
    return { ok: false as const, error: "Restaurante no encontrado" };
  }

  const { error } = await admin.from("reservas").insert({
    empresa_id: empresa.id,
    cliente_nombre: data.nombre,
    cliente_apellidos: data.apellidos ?? null,
    cliente_telefono: data.telefono,
    cliente_email: data.email ?? null,
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
    notas: data.notas ?? null,
    origen: data.origen ?? null,
    estado: "PENDIENTE",
    turno: "COMIDA",
  });
  if (error) {
    console.error("[reservar-publica] insert error:", error);
    return { ok: false as const, error: "No pudimos crear la reserva" };
  }
  return { ok: true as const };
}
