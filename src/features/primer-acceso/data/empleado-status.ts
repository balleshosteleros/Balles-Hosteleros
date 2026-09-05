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
    tipo_documento?: string | null;
    genero?: string | null;
    estado_civil?: string | null;
    codigo_postal?: string | null;
    ciudad?: string | null;
    provincia?: string | null;
    pais?: string | null;
    avatar_url?: string | null;
    dni_archivo_url?: string | null;
  };
}

async function getCtx() {
  const supabase = await createClient();
  // `getUser()` es una llamada de RED en cada carga de página. Si revienta
  // (timeout, red), la excepción sube desde el layout y tumba la app entera.
  // Sin usuario resuelto se trata como "no autenticado", que es el camino
  // seguro y ya está contemplado más abajo.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return { supabase, user };
  } catch (e) {
    console.error("[guard] getUser falló:", e);
    return { supabase, user: null };
  }
}

export const getEmpleadoGuardStatus = cache(
  async (): Promise<{ shouldShowWizard: boolean; hasUser: boolean }> => {
    const { supabase, user } = await getCtx();
    if (!user) return { shouldShowWizard: false, hasUser: false };

    // Un trabajador en VARIAS empresas tiene una ficha por empresa, así que aquí
    // pueden venir 2+ filas. Con `.maybeSingle()` la consulta fallaba y devolvía
    // null: el asistente NO se mostraba nunca y esas personas se quedaban sin
    // rellenar sus datos indefinidamente. Se piden todas y basta con que UNA esté
    // pendiente (los datos personales son de la persona, no de la empresa: al
    // guardarlos se reflejan en sus fichas espejo).
    // Blindaje: esto lo llama el LAYOUT (escritorio y móvil), por encima de
    // cualquier boundary. Si la consulta revienta —timeout de Supabase, red, el
    // pool ocupado— la excepción sube sin que nada la recoja y tumba la app
    // entera: el "No se ha podido cargar" del que no se sale ni recargando.
    //
    // Ante la duda NO se muestra el asistente: dejar entrar a alguien que ya
    // tenía sus datos es inofensivo (lo peor, verlo una vez de más); impedirle
    // entrar y fichar, no. `hasUser` es true porque la sesión SÍ está validada.
    try {
      const { data: fichas } = await supabase
        .from("empleados")
        .select("perfil_completado")
        .eq("user_id", user.id);

      if (!fichas || fichas.length === 0) return { shouldShowWizard: false, hasUser: true };
      const pendiente = fichas.some((f) => !f.perfil_completado);
      return { shouldShowWizard: pendiente, hasUser: true };
    } catch (e) {
      console.error("[guard] getEmpleadoGuardStatus falló — se deja entrar:", e);
      return { shouldShowWizard: false, hasUser: true };
    }
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
      "id, empresa_id, perfil_completado, nombre, apellidos, email_personal, telefono, dni_nie, fecha_nacimiento, direccion, iban, numero_ss, contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_relacion, talla_uniforme, tipo_documento, genero, estado_civil, codigo_postal, ciudad, provincia, pais, avatar_url, dni_archivo_url"
    )
    // Varias empresas = varias fichas. Se prioriza la que esté PENDIENTE, que es
    // la que el asistente tiene que rellenar (con `.maybeSingle()` esto fallaba
    // y el asistente no llegaba a mostrarse nunca).
    .eq("user_id", user.id)
    .order("perfil_completado", { ascending: true })
    .limit(1)
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
      tipo_documento: empleado.tipo_documento,
      genero: empleado.genero,
      estado_civil: empleado.estado_civil,
      codigo_postal: empleado.codigo_postal,
      ciudad: empleado.ciudad,
      provincia: empleado.provincia,
      pais: empleado.pais,
      avatar_url: empleado.avatar_url,
      dni_archivo_url: empleado.dni_archivo_url,
    },
  };
});
