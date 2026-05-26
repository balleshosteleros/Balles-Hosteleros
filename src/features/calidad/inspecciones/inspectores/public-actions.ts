/**
 * Action pública de inscripción a la bolsa de inspectores.
 * Usa admin client server-side + rate limit por IP-hash.
 * PRP-040.
 */
"use server";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/shared/lib/rate-limit-memory";
import type { InscripcionPublicaInput } from "./types";
import { normalizarNombre, normalizarTelefono } from "./data";
import { sendInspectorFaseEmail } from "./email-sender";

interface InscribirInput extends InscripcionPublicaInput {
  ip?: string | null;
  user_agent?: string | null;
}

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function inscribirInspectorPublico(
  input: InscribirInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  // 1) Validación de campos siempre exigidos (todos obligatorios)
  if (!input.empresa_slug?.trim()) {
    return { ok: false, error: "Empresa no indicada" };
  }
  const nombre = normalizarNombre(input.nombre);
  const apellidos = normalizarNombre(input.apellidos);
  const tel = input.telefono?.trim();
  const email = input.email?.trim();
  const ciudad = input.ciudad?.trim();
  const horario = input.horario_disponibilidad?.trim();
  if (!nombre || nombre.length < 2) {
    return { ok: false, error: "Nombre inválido" };
  }
  if (!apellidos) {
    return { ok: false, error: "Apellidos obligatorios" };
  }
  if (!tel || normalizarTelefono(tel).length < 9) {
    return { ok: false, error: "Teléfono inválido" };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Email inválido" };
  }
  if (!ciudad) {
    return { ok: false, error: "Ciudad obligatoria" };
  }
  if (!horario) {
    return { ok: false, error: "Selecciona al menos una disponibilidad horaria" };
  }
  if (typeof input.vehiculo_propio !== "boolean") {
    return { ok: false, error: "Indica si tienes vehículo propio" };
  }

  // 2) Rate limit por IP (5 inscripciones / hora)
  const ipHash = hashIp(input.ip);
  if (ipHash) {
    const rl = rateLimit(`inspector_bolsa:${ipHash}`, 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return {
        ok: false,
        error: "Has hecho demasiadas inscripciones. Inténtalo más tarde.",
      };
    }
  }

  const admin = createAdminClient();

  // 3) Resolver empresa
  const { data: empresa } = await admin
    .from("empresas")
    .select("id")
    .eq("slug", input.empresa_slug)
    .maybeSingle();
  if (!empresa) {
    return { ok: false, error: "Empresa no encontrada" };
  }

  // 4) Comprobar duplicado por teléfono (en la misma empresa)
  const { data: existentes } = await admin
    .from("inspectores")
    .select("id, telefono")
    .eq("empresa_id", empresa.id);
  const telNorm = normalizarTelefono(tel);
  const ya = (existentes ?? []).find(
    (e) => normalizarTelefono(e.telefono) === telNorm,
  );
  if (ya) {
    return {
      ok: false,
      error: "Ya hay una inscripción con ese teléfono en esta empresa.",
    };
  }

  // 5) Componer disponibilidad (horario + vehiculo_propio siempre presentes)
  const disponibilidad = {
    ...(input.disponibilidad ?? {}),
    horario,
    vehiculo_propio: input.vehiculo_propio,
  };

  // 6) Insertar (anon RLS permite fase=bolsa, estado=futuro, origen=formulario_publico)
  const { data, error } = await admin
    .from("inspectores")
    .insert({
      empresa_id: empresa.id,
      nombre,
      apellidos,
      email,
      telefono: tel,
      ciudad,
      provincia: input.provincia?.trim() || null,
      disponibilidad,
      cv_url: input.cv_url ?? null,
      notas: input.notas?.trim() || null,
      fase: "bolsa",
      estado_actividad: "futuro",
      origen: "formulario_publico",
      pagina_slug: input.empresa_slug,
      ip_hash: ipHash,
      user_agent: input.user_agent ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Error al inscribir" };
  }

  // Email automático "Nuevo" (fase=bolsa). No bloquea la respuesta al usuario
  // si el envío falla; se loggea para diagnóstico.
  const res = await sendInspectorFaseEmail(empresa.id, data.id, "bolsa");
  if (!res.sent) {
    console.log(
      `[inscribirInspectorPublico] email fase=bolsa no enviado: ${res.reason}`,
    );
  }

  return { ok: true, id: data.id };
}
