"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrLinkClienteSala, type CampoDistinto } from "@/features/sala/lib/cliente-link";
import { asignarMesaAutomatica } from "@/features/sala/planos/lib/asignacion-mesa";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  codigo: z.string().min(1).max(64).optional().nullable(),
});

export type CrearReservaPublicaInput = z.infer<typeof inputSchema>;

export type CrearReservaPublicaResult =
  | {
      ok: true;
      clienteExistente: boolean;
      camposDistintos: CampoDistinto[];
      datosCliente: {
        nombre: string;
        apellidos: string | null;
        email: string | null;
        telefono: string | null;
      };
    }
  | { ok: false; error: string };

export async function crearReservaPublicaAction(
  input: CrearReservaPublicaInput,
): Promise<CrearReservaPublicaResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos" };
  }
  const data = parsed.data;
  const admin = createAdminClient();

  const { data: empresa, error: errEmpresa } = await admin
    .from("empresas")
    .select("id, nombre")
    .eq("slug", data.empresaSlug)
    .maybeSingle();
  if (errEmpresa || !empresa) {
    return { ok: false, error: "Restaurante no encontrado" };
  }

  // Código → solo aviso. No se valida vigencia/stock/personas/turno/día,
  // ni se consume stock. Si el código existe en la empresa lo enlazamos por id
  // para futura integración con el POS; si no, guardamos el texto tal cual.
  let codigoId: string | null = null;
  let codigoNombre: string | null = null;
  if (data.codigo) {
    const nombreNorm = data.codigo.toUpperCase().replace(/\s+/g, "");
    codigoNombre = nombreNorm;
    const { data: match } = await admin
      .from("reserva_codigos")
      .select("id, nombre")
      .eq("empresa_id", empresa.id)
      .eq("nombre", nombreNorm)
      .maybeSingle();
    if (match) {
      codigoId = match.id as string;
      codigoNombre = (match.nombre as string) ?? nombreNorm;
    }
  }

  // Vincular o crear ficha de cliente (match por email O teléfono normalizado dentro de la empresa).
  const link = await findOrLinkClienteSala(admin, {
    empresaId: empresa.id,
    nombre: data.nombre,
    apellidos: data.apellidos,
    email: data.email,
    telefono: data.telefono,
  });
  if (!link.ok) {
    console.error("[reservar-publica] vincular cliente:", link.error);
    return { ok: false, error: "No pudimos vincular tu ficha de cliente" };
  }
  const cliente = link.result.cliente;

  // Asignación automática de mesa (PRP-048): coge el primer local de la
  // empresa (las empresas hoy tienen 1 local; cuando aparezcan multi-local
  // habrá que añadir selector en el form público). Si no hay plano activo
  // o ninguna mesa libre, la reserva queda sin mesa y aparece en la bandeja
  // "Pendiente de asignar" para que el jefe de sala la coloque.
  let mesaFinal: string | null = null;
  let zonaFinal: string | null = null;
  const { data: local } = await admin
    .from("locales")
    .select("id")
    .eq("empresa_id", empresa.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (local) {
    const asign = await asignarMesaAutomatica(admin as unknown as SupabaseClient, {
      localId: local.id as string,
      empresaId: empresa.id,
      fecha: data.fecha,
      hora: data.hora,
      personas: data.personas,
    });
    if (asign.ok && asign.mesa) {
      mesaFinal = asign.mesa.codigo;
      zonaFinal = asign.mesa.zonaNombre || null;
    }
  }

  const { error } = await admin.from("reservas").insert({
    empresa_id: empresa.id,
    cliente_id: cliente.id,
    // Snapshot de la reserva = datos canónicos de la ficha (los originales mandan).
    cliente_nombre: cliente.nombre,
    cliente_apellidos: cliente.apellidos,
    cliente_telefono: cliente.telefono,
    cliente_email: cliente.email,
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
    mesa: mesaFinal,
    zona: zonaFinal,
    notas: data.notas ?? null,
    origen: data.origen ?? null,
    estado: "PENDIENTE",
    turno: "COMIDA",
    codigo_id: codigoId,
    codigo_nombre: codigoNombre,
  });
  if (error) {
    console.error("[reservar-publica] insert error:", error);
    return { ok: false, error: "No pudimos crear la reserva" };
  }

  await admin.rpc("registrar_visita_cliente_sala", {
    p_cliente_id: cliente.id,
    p_fecha: data.fecha,
  });

  return {
    ok: true,
    clienteExistente: link.result.existed,
    camposDistintos: link.result.camposDistintos,
    datosCliente: {
      nombre: cliente.nombre,
      apellidos: cliente.apellidos,
      email: cliente.email,
      telefono: cliente.telefono,
    },
  };
}
