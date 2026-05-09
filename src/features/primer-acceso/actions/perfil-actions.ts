"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface EmpleadoStatus {
  shouldShowWizard: boolean;
  empleadoId: string | null;
  perfilCompletado: boolean;
  empresaId: string | null;
  // Campos ya cargados que NO debemos volver a pedir
  prefilled: {
    nombre?: string | null;
    apellidos?: string | null;
    email?: string | null;
    telefono?: string | null;
    dni_nie?: string | null;
    fecha_nacimiento?: string | null;
    direccion?: string | null;
    iban?: string | null;
    numero_ss?: string | null;
    contacto_emergencia_nombre?: string | null;
    contacto_emergencia_telefono?: string | null;
    contacto_emergencia_relacion?: string | null;
    talla_uniforme?: string | null;
    alergias_medicas?: string | null;
    avatar_url?: string | null;
    dni_archivo_url?: string | null;
  };
}

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getEmpleadoStatus(): Promise<EmpleadoStatus> {
  const { supabase, user } = await getCtx();
  if (!user) {
    return {
      shouldShowWizard: false,
      empleadoId: null,
      perfilCompletado: true,
      empresaId: null,
      prefilled: {},
    };
  }

  const { data: empleado } = await supabase
    .from("empleados")
    .select(
      "id, empresa_id, perfil_completado, nombre, apellidos, email_personal, telefono, dni_nie, fecha_nacimiento, direccion, iban, numero_ss, contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_relacion, talla_uniforme, alergias_medicas, avatar_url, dni_archivo_url"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!empleado) {
    // No es empleado (es admin sin ficha de empleado, etc.) → no wizard
    return {
      shouldShowWizard: false,
      empleadoId: null,
      perfilCompletado: true,
      empresaId: null,
      prefilled: {},
    };
  }

  return {
    shouldShowWizard: !empleado.perfil_completado,
    empleadoId: empleado.id,
    perfilCompletado: !!empleado.perfil_completado,
    empresaId: empleado.empresa_id,
    prefilled: {
      nombre: empleado.nombre,
      apellidos: empleado.apellidos,
      email: empleado.email_personal,
      telefono: empleado.telefono,
      dni_nie: empleado.dni_nie,
      fecha_nacimiento: empleado.fecha_nacimiento,
      direccion: empleado.direccion,
      iban: empleado.iban,
      numero_ss: empleado.numero_ss,
      contacto_emergencia_nombre: empleado.contacto_emergencia_nombre,
      contacto_emergencia_telefono: empleado.contacto_emergencia_telefono,
      contacto_emergencia_relacion: empleado.contacto_emergencia_relacion,
      talla_uniforme: empleado.talla_uniforme,
      alergias_medicas: empleado.alergias_medicas,
      avatar_url: empleado.avatar_url,
      dni_archivo_url: empleado.dni_archivo_url,
    },
  };
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

  const { data: empleado } = await supabase
    .from("empleados")
    .select("id, empresa_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!empleado) return { ok: false, error: "No se encontró tu ficha de empleado" };

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
      contacto_emergencia_nombre: input.contacto_emergencia_nombre.trim(),
      contacto_emergencia_telefono: input.contacto_emergencia_telefono.trim(),
      contacto_emergencia_relacion: input.contacto_emergencia_relacion.trim(),
      talla_uniforme: input.talla_uniforme ?? null,
      alergias_medicas: input.alergias_medicas ?? null,
      avatar_url: input.avatar_url ?? undefined,
      dni_archivo_url: input.dni_archivo_url ?? undefined,
      perfil_completado: true,
      perfil_completado_at: new Date().toISOString(),
    })
    .eq("id", empleado.id);

  if (error) return { ok: false, error: error.message };

  // Iniciar onboarding por defecto si existe plantilla y no hay proceso activo
  const { data: existingProc } = await supabase
    .from("procesos_boarding")
    .select("id")
    .eq("empleado_id", empleado.id)
    .eq("tipo", "onboarding")
    .eq("estado", "activo")
    .maybeSingle();

  if (!existingProc) {
    const { data: plantilla } = await supabase
      .from("plantillas_boarding")
      .select("id, nombre, tareas")
      .eq("empresa_id", empleado.empresa_id)
      .eq("tipo", "onboarding")
      .eq("por_defecto", true)
      .maybeSingle();

    if (plantilla) {
      type TareaPlantilla = { id: string; nombre: string; orden: number };
      const tareasIniciales = ((plantilla.tareas ?? []) as TareaPlantilla[]).map((t) => ({
        id: t.id,
        nombre: t.nombre,
        orden: t.orden,
        completada: false,
        fechaCompletado: null as string | null,
      }));
      await supabase.from("procesos_boarding").insert({
        empresa_id: empleado.empresa_id,
        empleado_id: empleado.id,
        plantilla_id: plantilla.id,
        plantilla_nombre: plantilla.nombre,
        tipo: "onboarding",
        estado: "activo",
        tareas: tareasIniciales,
        iniciado_por: user.id,
      });
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uploadDocumentoEmpleado(input: {
  tipo: "avatar" | "dni";
  file: File;
}) {
  const { supabase, user } = await getCtx();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: empleado } = await supabase
    .from("empleados")
    .select("id, empresa_id")
    .eq("user_id", user.id)
    .maybeSingle();

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
