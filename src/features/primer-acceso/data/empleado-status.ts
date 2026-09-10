import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * En qué situación entra la persona al asistente:
 *
 * - `alta`: nunca completó su perfil. Es un onboarding entero y se le pide TODO,
 *   contacto de emergencia incluido.
 * - `documentos`: ya completó el perfil en su día, pero le falta documentación
 *   identificativa. Se le reabre el asistente SOLO para que la suba — nada de
 *   volver a pedirle emergencia ni datos que ya dio.
 */
export type ModoPrimerAcceso = "alta" | "documentos";

/**
 * ⏳ REPESCA TEMPORAL (9-sep-2026) — BORRAR CUANDO TODOS HAYAN SUBIDO LO SUYO.
 *
 * Los empleados que ya estaban antes completaron su perfil sin que se les
 * pidiera la documentación, así que 18 de 19 fichas están sin DNI. En vez de
 * perseguirles por correo, se les reabre el asistente al entrar y no pasan sin
 * subirlo.
 *
 * Se apaga SOLO: en cuanto una persona tiene sus tres documentos deja de verlo,
 * y cuando no quede nadie el asistente no salta a nadie. Para retirar la repesca
 * del todo basta con poner esto en `false` y borrar luego el modo "documentos".
 */
const REPESCA_DOCUMENTOS_ACTIVA = true;

/** Documentos que solo puede aportar el propio empleado. El de la Seguridad
 *  Social NO está: lo genera RRHH del recorte de su nómina. */
export const DOCS_OBLIGATORIOS = [
  "doc_dni_anverso_path",
  "doc_dni_reverso_path",
  "doc_iban_path",
] as const;

export interface EmpleadoStatus {
  shouldShowWizard: boolean;
  empleadoId: string | null;
  perfilCompletado: boolean;
  modo: ModoPrimerAcceso;
  empresaId: string | null;
  prefilled: {
    doc_dni_anverso_path?: string | null;
    doc_dni_reverso_path?: string | null;
    doc_iban_path?: string | null;
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
  async (): Promise<{
    shouldShowWizard: boolean;
    hasUser: boolean;
    modo: ModoPrimerAcceso;
    /**
     * Si TAPAR la pantalla o solo avisar.
     *
     * A DIRECCIÓN se le avisa pero no se le bloquea: es quien lleva la recogida
     * y quien tiene que poder entrar a ver cómo va. Bloqueándola se quedaba sin
     * poder usar el sistema entero por su propio aviso — le pasó a Iván nada más
     * activarlo, atrapado en su propia pantalla.
     */
    bloquea: boolean;
  }> => {
    const { supabase, user } = await getCtx();
    if (!user) return { shouldShowWizard: false, hasUser: false, modo: "alta", bloquea: false };

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
        .select("perfil_completado, estado, doc_dni_anverso_path, doc_dni_reverso_path, doc_iban_path")
        .eq("user_id", user.id);

      if (!fichas || fichas.length === 0) {
        return { shouldShowWizard: false, hasUser: true, modo: "alta", bloquea: false };
      }

      // DIRECCIÓN (rol con `es_admin_plataforma`) recibe el aviso, no el bloqueo.
      const { data: quien } = await supabase
        .from("usuarios")
        .select("empresa_roles(es_admin_plataforma)")
        .eq("id", user.id)
        .maybeSingle();
      const rol = (quien as Record<string, unknown> | null)?.empresa_roles as
        | { es_admin_plataforma?: boolean }
        | { es_admin_plataforma?: boolean }[]
        | null
        | undefined;
      const esDireccion = Array.isArray(rol)
        ? Boolean(rol[0]?.es_admin_plataforma)
        : Boolean(rol?.es_admin_plataforma);

      // Una baja no tiene que rellenar nada: se le deja entrar a lo suyo sin
      // atascarlo en un asistente que ya no le corresponde.
      const vigentes = fichas.filter((f) => f.estado === "Activo");
      if (vigentes.length === 0) {
        return { shouldShowWizard: false, hasUser: true, modo: "alta", bloquea: false };
      }

      // Alta pendiente manda sobre todo lo demás: es un onboarding entero.
      if (vigentes.some((f) => !f.perfil_completado)) {
        return { shouldShowWizard: true, hasUser: true, modo: "alta", bloquea: !esDireccion };
      }

      // Repesca: perfil hecho pero sin documentación. Los documentos viven en
      // la ficha de CADA empresa (el bucket va por empresa), así que basta con
      // que le falte en una para pedírselo.
      if (REPESCA_DOCUMENTOS_ACTIVA) {
        const faltaDoc = vigentes.some((f) =>
          DOCS_OBLIGATORIOS.some((c) => !f[c as keyof typeof f]),
        );
        if (faltaDoc) return { shouldShowWizard: true, hasUser: true, modo: "documentos", bloquea: !esDireccion };
      }

      return { shouldShowWizard: false, hasUser: true, modo: "alta", bloquea: false };
    } catch (e) {
      console.error("[guard] getEmpleadoGuardStatus falló — se deja entrar:", e);
      return { shouldShowWizard: false, hasUser: true, modo: "alta", bloquea: false };
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
      modo: "alta",
      empresaId: null,
      prefilled: {},
    };
  }

  // Varias empresas = varias fichas, y se traen TODAS a propósito. Este cálculo
  // tiene que dar exactamente lo mismo que `getEmpleadoGuardStatus`: si el guard
  // mirase todas las fichas y esto solo una, con documentos en una empresa y no
  // en la otra el layout mandaría al asistente y el asistente devolvería al
  // panel — un rebote infinito del que la persona no podría salir.
  const { data: fichas } = await supabase
    .from("empleados")
    .select(
      "id, empresa_id, estado, perfil_completado, nombre, apellidos, email_personal, telefono, dni_nie, fecha_nacimiento, direccion, iban, numero_ss, contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_relacion, talla_uniforme, tipo_documento, genero, estado_civil, codigo_postal, ciudad, provincia, pais, avatar_url, dni_archivo_url, doc_dni_anverso_path, doc_dni_reverso_path, doc_iban_path"
    )
    .eq("user_id", user.id)
    .order("perfil_completado", { ascending: true });

  const activas = (fichas ?? []).filter((f) => f.estado === "Activo");
  // La ficha que se muestra es la MENOS completa (el order ya la deja primera).
  const empleado = activas[0] ?? null;

  if (!empleado) {
    return {
      shouldShowWizard: false,
      empleadoId: null,
      perfilCompletado: true,
      modo: "alta",
      empresaId: null,
      prefilled: {},
    };
  }

  // Mismo criterio que el guard, ficha a ficha: basta que falte en UNA empresa.
  const perfilHecho = activas.every((f) => f.perfil_completado);
  const faltaDoc = activas.some((f) =>
    DOCS_OBLIGATORIOS.some((c) => !(f as Record<string, unknown>)[c]),
  );
  const modo: ModoPrimerAcceso = perfilHecho ? "documentos" : "alta";

  return {
    shouldShowWizard: !perfilHecho || (REPESCA_DOCUMENTOS_ACTIVA && faltaDoc),
    empleadoId: empleado.id,
    perfilCompletado: perfilHecho,
    modo,
    empresaId: empleado.empresa_id,
    prefilled: {
      doc_dni_anverso_path: empleado.doc_dni_anverso_path,
      doc_dni_reverso_path: empleado.doc_dni_reverso_path,
      doc_iban_path: empleado.doc_iban_path,
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
