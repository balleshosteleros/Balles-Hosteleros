"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarNombre } from "@/shared/lib/normalizar-nombre";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export interface PerfilCompletoInput {
  dni_nie: string;
  fecha_nacimiento: string;
  nacionalidad?: string | null;
  telefono: string;
  direccion: string;
  iban: string;
  numero_ss: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
  contacto_emergencia_relacion: string;
  talla_uniforme?: string | null;
  alergias_medicas?: string | null;
  avatar_url?: string | null;
  dni_archivo_url?: string | null;
}

function normalizarIban(s: string): string {
  return s.toUpperCase().replace(/\s+/g, "");
}

function validarPerfil(p: PerfilCompletoInput): string | null {
  if (!p.dni_nie?.trim()) return "El DNI/NIE es obligatorio";
  if (!p.fecha_nacimiento) return "La fecha de nacimiento es obligatoria";
  if (!p.telefono?.trim()) return "El teléfono es obligatorio";
  if (!p.direccion?.trim()) return "La dirección es obligatoria";
  if (!p.numero_ss?.trim()) return "El número de la Seguridad Social es obligatorio";
  if (!p.contacto_emergencia_nombre?.trim() || !p.contacto_emergencia_telefono?.trim()) {
    return "El contacto de emergencia es obligatorio (nombre + teléfono)";
  }
  const ibanNorm = normalizarIban(p.iban ?? "");
  if (!ibanNorm) return "El IBAN es obligatorio";
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(ibanNorm)) {
    return "El IBAN no tiene un formato válido";
  }
  return null;
}

export async function guardarPerfilCompleto(input: PerfilCompletoInput) {
  const { supabase, user } = await getCtx();
  if (!user) return { ok: false, error: "No autenticado" };

  const err = validarPerfil(input);
  if (err) return { ok: false, error: err };

  // Un trabajador en varias empresas tiene una ficha por empresa. Los datos
  // personales (DNI, IBAN, dirección…) son de la PERSONA, así que se guardan en
  // TODAS sus fichas: si no, quedaría completo en una empresa e incompleto en la
  // otra. Antes se usaba `.maybeSingle()`, que con 2 fichas fallaba y hacía
  // imposible completar el perfil.
  const { data: fichas } = await supabase
    .from("empleados")
    .select("id, empresa_id")
    .eq("user_id", user.id);

  if (!fichas || fichas.length === 0) return { ok: false, error: "No se encontró tu ficha de empleado" };
  const empleado = fichas[0];

  const ibanNorm = normalizarIban(input.iban);
  const dniNorm = input.dni_nie.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");

  const { error } = await supabase
    .from("empleados")
    .update({
      dni_nie: dniNorm,
      fecha_nacimiento: input.fecha_nacimiento,
      nacionalidad: input.nacionalidad ?? null,
      telefono: input.telefono.trim(),
      direccion: input.direccion.trim(),
      iban: ibanNorm,
      numero_ss: input.numero_ss.trim(),
      contacto_emergencia_nombre: normalizarNombre(input.contacto_emergencia_nombre),
      contacto_emergencia_telefono: input.contacto_emergencia_telefono.trim(),
      contacto_emergencia_relacion: input.contacto_emergencia_relacion.trim(),
      talla_uniforme: input.talla_uniforme ?? null,
      alergias_medicas: input.alergias_medicas ?? null,
      avatar_url: input.avatar_url ?? undefined,
      dni_archivo_url: input.dni_archivo_url ?? undefined,
      perfil_completado: true,
      perfil_completado_at: new Date().toISOString(),
    })
    // A TODAS sus fichas (una por empresa), no solo a una.
    .in("id", fichas.map((f) => f.id as string));

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uploadDocumentoEmpleado(input: {
  tipo: "avatar" | "dni";
  file: File;
}) {
  const { supabase, user } = await getCtx();
  if (!user) return { ok: false, error: "No autenticado" };

  // Basta una ficha cualquiera (solo se usa para componer la ruta del archivo),
  // pero con `.maybeSingle()` fallaba en quien tiene ficha en dos empresas.
  const { data: fichasDoc } = await supabase
    .from("empleados")
    .select("id, empresa_id")
    .eq("user_id", user.id)
    .limit(1);
  const empleado = fichasDoc?.[0];

  if (!empleado) return { ok: false, error: "No se encontró tu ficha de empleado" };

  const ext = input.file.name.split(".").pop() ?? "bin";
  const path = `${empleado.empresa_id}/${empleado.id}/${input.tipo}-${Date.now()}.${ext}`;

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const { error } = await supabase.storage
    .from("empleados-docs")
    .upload(path, buffer, {
      contentType: input.file.type,
      upsert: true,
    });

  if (error) return { ok: false, error: error.message };

  const { data: signed } = await supabase.storage
    .from("empleados-docs")
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 año

  return { ok: true, path, url: signed?.signedUrl ?? null };
}
