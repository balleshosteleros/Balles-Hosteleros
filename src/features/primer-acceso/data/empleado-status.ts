import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface EmpleadoStatus {
  shouldShowWizard: boolean;
  empleadoId: string | null;
  perfilCompletado: boolean;
  empresaId: string | null;
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

export const getEmpleadoGuardStatus = cache(
  async (): Promise<{ shouldShowWizard: boolean; hasUser: boolean }> => {
    const { supabase, user } = await getCtx();
    if (!user) return { shouldShowWizard: false, hasUser: false };

    const { data: empleado } = await supabase
      .from("empleados")
      .select("perfil_completado")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!empleado) return { shouldShowWizard: false, hasUser: true };
    return { shouldShowWizard: !empleado.perfil_completado, hasUser: true };
  },
);

export const getEmpleadoStatus = cache(async (): Promise<EmpleadoStatus> => {
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
});
