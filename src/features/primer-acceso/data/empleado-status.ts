import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  COLUMNAS_REVISION,
  fundirFichas,
  loQueFalta,
  pasosNecesarios,
  type CampoPendiente,
  type PasoFicha,
} from "@/features/primer-acceso/lib/ficha-incompleta";

/**
 * En qué situación entra la persona al asistente:
 *
 * - `alta`: le faltan datos de su ficha (además, quizá, de los papeles).
 * - `documentos`: solo le faltan los papeles; los datos ya los tiene todos.
 *
 * El modo hoy solo decide QUÉ SE LE DICE. Los pasos que ve salen de
 * `pasosNecesarios`: se le enseña únicamente donde le falta algo.
 */
export type ModoPrimerAcceso = "alta" | "documentos";

/**
 * Interruptor general de la recogida (12-sep-2026).
 *
 * Mientras esté encendido, a quien le falte CUALQUIER dato de los que dependen
 * de él se le tapa la app —fichaje incluido, con salida— hasta que lo rellene.
 * Ponerlo en `false` lo apaga entero sin tocar nada más: es la marcha atrás si
 * un día se lía en plena apertura.
 */
const EXIGENCIA_FICHA_ACTIVA = true;

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
  /** Qué le falta exactamente, para pedirle solo eso. */
  pendientes: CampoPendiente[];
  /** Pasos que verá en el asistente. */
  pasos: PasoFicha[];
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
    nacionalidad?: string | null;
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

type FilaFicha = Record<string, unknown>;

const vacio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

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
    /** Lo que le falta, para decírselo por su nombre en el propio aviso. */
    pendientes: CampoPendiente[];
  }> => {
    const vacia = {
      shouldShowWizard: false,
      hasUser: false,
      modo: "alta" as const,
      bloquea: false,
      pendientes: [] as CampoPendiente[],
    };
    const { supabase, user } = await getCtx();
    if (!user) return vacia;
    if (!EXIGENCIA_FICHA_ACTIVA) return { ...vacia, hasUser: true };

    // Un trabajador en VARIAS empresas tiene una ficha por empresa, así que aquí
    // pueden venir 2+ filas. Con `.maybeSingle()` la consulta fallaba y devolvía
    // null: el asistente NO se mostraba nunca y esas personas se quedaban sin
    // rellenar sus datos indefinidamente. Se piden todas y se funden.
    //
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
        .select(`estado, ${COLUMNAS_REVISION}`)
        .eq("user_id", user.id);

      if (!fichas || fichas.length === 0) {
        return { ...vacia, hasUser: true };
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
      const vigentes = (fichas as unknown as FilaFicha[]).filter((f) => f.estado === "Activo");
      if (vigentes.length === 0) {
        return { ...vacia, hasUser: true };
      }

      const pendientes = loQueFalta(fundirFichas(vigentes));
      if (pendientes.length === 0) {
        return { ...vacia, hasUser: true };
      }

      const soloPapeles = pendientes.every((p) => p.paso === "documentos");
      return {
        shouldShowWizard: true,
        hasUser: true,
        modo: soloPapeles ? "documentos" : "alta",
        bloquea: !esDireccion,
        pendientes,
      };
    } catch (e) {
      console.error("[guard] getEmpleadoGuardStatus falló — se deja entrar:", e);
      return { ...vacia, hasUser: true };
    }
  },
);

export const getEmpleadoStatus = cache(async (): Promise<EmpleadoStatus> => {
  const completo: EmpleadoStatus = {
    shouldShowWizard: false,
    empleadoId: null,
    perfilCompletado: true,
    modo: "alta",
    empresaId: null,
    pendientes: [],
    pasos: [],
    prefilled: {},
  };

  const { supabase, user } = await getCtx();
  if (!user) return completo;

  // Varias empresas = varias fichas, y se traen TODAS a propósito. Este cálculo
  // tiene que dar exactamente lo mismo que `getEmpleadoGuardStatus`: si el guard
  // mirase todas las fichas y esto solo una, con datos en una empresa y no en la
  // otra el layout mandaría al asistente y el asistente devolvería al panel — un
  // rebote infinito del que la persona no podría salir.
  // Si esta consulta revienta, la persona se queda con la app tapada por el
  // guard Y sin poder abrir el asistente que la destaparía: encerrada. Ante la
  // duda se devuelve «ficha completa», que como mucho la deja entrar de más.
  let fichas: FilaFicha[] | null = null;
  try {
    const { data } = await supabase
      .from("empleados")
      .select(
        `id, empresa_id, estado, perfil_completado, nombre, apellidos, email_personal, nacionalidad, avatar_url, dni_archivo_url, ${COLUMNAS_REVISION}`,
      )
      .eq("user_id", user.id);
    fichas = (data ?? []) as unknown as FilaFicha[];
  } catch (e) {
    console.error("[primer-acceso] no se pudo leer la ficha:", e);
    return completo;
  }

  const activas = (fichas ?? []).filter((f) => f.estado === "Activo");
  if (activas.length === 0) return completo;

  const fundida = fundirFichas(activas);
  const pendientes = loQueFalta(fundida);
  const pasos = pasosNecesarios(pendientes);
  const soloPapeles = pendientes.length > 0 && pendientes.every((p) => p.paso === "documentos");

  // Para el resto de campos (nombre, foto…) basta la primera ficha: son iguales
  // en todas. Lo que se revisa ya viene fundido.
  const base = activas[0];
  const dato = (campo: string) => activas.find((f) => !vacio(f[campo]))?.[campo] ?? null;

  return {
    shouldShowWizard: EXIGENCIA_FICHA_ACTIVA && pendientes.length > 0,
    empleadoId: String(base.id),
    perfilCompletado: pendientes.length === 0,
    modo: soloPapeles ? "documentos" : "alta",
    empresaId: String(base.empresa_id),
    pendientes,
    pasos,
    prefilled: {
      doc_dni_anverso_path: fundida.doc_dni_anverso_path ?? null,
      doc_dni_reverso_path: fundida.doc_dni_reverso_path ?? null,
      doc_iban_path: fundida.doc_iban_path ?? null,
      nombre: dato("nombre") as string | null,
      apellidos: dato("apellidos") as string | null,
      email: dato("email_personal") as string | null,
      telefono: fundida.telefono ?? null,
      dni_nie: fundida.dni_nie ?? null,
      fecha_nacimiento: fundida.fecha_nacimiento ?? null,
      nacionalidad: dato("nacionalidad") as string | null,
      direccion: fundida.direccion ?? null,
      iban: fundida.iban ?? null,
      numero_ss: fundida.numero_ss ?? null,
      contacto_emergencia_nombre: fundida.contacto_emergencia_nombre ?? null,
      contacto_emergencia_telefono: fundida.contacto_emergencia_telefono ?? null,
      contacto_emergencia_relacion: fundida.contacto_emergencia_relacion ?? null,
      talla_uniforme: fundida.talla_uniforme ?? null,
      tipo_documento: fundida.tipo_documento ?? null,
      genero: fundida.genero ?? null,
      estado_civil: fundida.estado_civil ?? null,
      codigo_postal: fundida.codigo_postal ?? null,
      ciudad: fundida.ciudad ?? null,
      provincia: fundida.provincia ?? null,
      pais: fundida.pais ?? null,
      avatar_url: dato("avatar_url") as string | null,
      dni_archivo_url: dato("dni_archivo_url") as string | null,
    },
  };
});
