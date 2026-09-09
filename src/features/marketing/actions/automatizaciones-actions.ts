"use server";

/**
 * Acciones de Marketing → Automatizaciones.
 *
 * El editor de la pantalla escribe aquí y nada más: la validación de lo que
 * llega es Zod, y la de quién puede escribirlo es la RLS de la empresa activa.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMarketingContext } from "@/features/marketing/lib/supabase-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rowToAutomatizacion,
  RECETAS,
  type Automatizacion,
  type EjecucionResumen,
} from "@/features/marketing/data/automatizaciones";
import { barrerAutomatizacion } from "@/features/marketing/services/automatizaciones-barrido";
import { procesarPendientes } from "@/features/marketing/services/automatizaciones-motor";

const RUTA = "/marketing/automatizaciones";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

// ─── Validación ──────────────────────────────────────────────

const pasoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("esperar"),
    cantidad: z.number().int().min(1).max(365),
    unidad: z.enum(["minutos", "horas", "dias"]),
  }),
  z.object({
    tipo: z.literal("email"),
    asunto: z.string().trim().min(1, "El correo necesita un asunto").max(200),
    texto: z.string().trim().min(1, "El correo está vacío").max(5000),
  }),
  z.object({
    tipo: z.literal("whatsapp"),
    texto: z.string().trim().min(1, "El WhatsApp está vacío").max(1000),
    plantilla: z.string().trim().max(100).optional(),
  }),
  z.object({
    tipo: z.literal("sms"),
    texto: z.string().trim().min(1, "El SMS está vacío").max(500),
  }),
  z.object({
    tipo: z.literal("aviso"),
    departamentoId: z.string().uuid("Elige a qué departamento se avisa"),
    titulo: z.string().trim().min(1, "El aviso necesita un título").max(200),
    texto: z.string().trim().min(1, "El aviso está vacío").max(1000),
  }),
  z.object({
    tipo: z.literal("solo_si"),
    condicion: z.enum(["no_ha_vuelto", "acepta_marketing", "es_primera_visita", "visitas_min"]),
    valor: z.number().int().min(1).max(100).optional(),
  }),
]);

const guardarSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  nombre: z.string().trim().min(1, "Ponle un nombre").max(120),
  descripcion: z.string().trim().max(300).nullable().optional(),
  disparador: z.enum([
    "reserva_nueva",
    "visita_terminada",
    "no_show",
    "cliente_nuevo",
    "cumpleanos",
    "cliente_dormido",
    "valoracion_recibida",
  ]),
  disparadorConfig: z.record(z.string(), z.number()).default({}),
  pasos: z.array(pasoSchema).min(1, "Añade al menos un paso"),
});

export type GuardarAutomatizacionInput = z.input<typeof guardarSchema>;

// ─── Lectura ─────────────────────────────────────────────────

export async function listarAutomatizacionesAction(): Promise<Resultado<Automatizacion[]>> {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa" };
    const { data, error } = await supabase
      .from("marketing_automatizaciones")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToAutomatizacion) };
  } catch (err) {
    console.error("[automatizaciones] listar:", err);
    return { ok: false, error: "No se pudieron cargar las automatizaciones" };
  }
}

export async function listarDepartamentosAction(): Promise<Resultado<{ id: string; nombre: string }[]>> {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa" };
    const { data, error } = await supabase
      .from("departamentos")
      .select("id, nombre")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo")
      .order("nombre");
    if (error) throw error;
    return { ok: true, data: (data ?? []) as { id: string; nombre: string }[] };
  } catch (err) {
    console.error("[automatizaciones] departamentos:", err);
    return { ok: false, error: "No se pudieron cargar los departamentos" };
  }
}

/** Las últimas 100 veces que algo se disparó. Es lo que da confianza al usuario. */
export async function listarEjecucionesAction(
  automatizacionId?: string,
): Promise<Resultado<EjecucionResumen[]>> {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa" };
    let q = supabase
      .from("marketing_automatizacion_ejecuciones")
      .select("*, marketing_automatizaciones(nombre)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (automatizacionId) q = q.eq("automatizacion_id", automatizacionId);
    const { data, error } = await q;
    if (error) throw error;

    const filas = (data ?? []) as Record<string, unknown>[];
    return {
      ok: true,
      data: filas.map((row) => {
        const rel = row.marketing_automatizaciones as { nombre?: string } | null;
        return {
          id: row.id as string,
          automatizacionId: row.automatizacion_id as string,
          automatizacionNombre: rel?.nombre ?? "",
          entidadTipo: row.entidad_tipo as string,
          contexto: (row.contexto as Record<string, unknown>) ?? {},
          estado: row.estado as EjecucionResumen["estado"],
          pasoActual: (row.paso_actual as number) ?? 0,
          ejecutarEn: row.ejecutar_en as string,
          historial: (row.historial as EjecucionResumen["historial"]) ?? [],
          ultimoError: (row.ultimo_error as string) ?? null,
          createdAt: row.created_at as string,
        };
      }),
    };
  } catch (err) {
    console.error("[automatizaciones] ejecuciones:", err);
    return { ok: false, error: "No se pudo cargar el historial" };
  }
}

// ─── Escritura ───────────────────────────────────────────────

export async function guardarAutomatizacionAction(
  input: GuardarAutomatizacionInput,
): Promise<Resultado<Automatizacion>> {
  const parsed = guardarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Faltan datos" };
  }
  const v = parsed.data;

  try {
    const { supabase, empresaId, userId } = await getMarketingContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa" };

    const fila = {
      empresa_id: empresaId,
      nombre: v.nombre,
      descripcion: v.descripcion ?? null,
      disparador: v.disparador,
      disparador_config: v.disparadorConfig,
      pasos: v.pasos,
    };

    const { data, error } = v.id
      ? await supabase.from("marketing_automatizaciones").update(fila).eq("id", v.id).select("*").single()
      : await supabase
          .from("marketing_automatizaciones")
          .insert({ ...fila, created_by: userId })
          .select("*")
          .single();

    if (error) throw error;
    revalidatePath(RUTA);
    return { ok: true, data: rowToAutomatizacion(data as Record<string, unknown>) };
  } catch (err) {
    console.error("[automatizaciones] guardar:", err);
    return { ok: false, error: "No se pudo guardar" };
  }
}

/**
 * Encender o apagar. Al encender se pone la fecha a cero: lo que pasó antes de
 * este momento NO se dispara, para que activar "bienvenida al cliente nuevo"
 * no escriba de golpe a todo el histórico.
 */
export async function cambiarEstadoAction(
  id: string,
  activar: boolean,
): Promise<Resultado<Automatizacion>> {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa" };
    const { data, error } = await supabase
      .from("marketing_automatizaciones")
      .update({
        estado: activar ? "Activo" : "Inactivo",
        ...(activar ? { activada_at: new Date().toISOString() } : {}),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(RUTA);
    return { ok: true, data: rowToAutomatizacion(data as Record<string, unknown>) };
  } catch (err) {
    console.error("[automatizaciones] estado:", err);
    return { ok: false, error: "No se pudo cambiar el estado" };
  }
}

export async function cambiarModoPruebaAction(
  id: string,
  modoPrueba: boolean,
): Promise<Resultado<Automatizacion>> {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa" };
    const { data, error } = await supabase
      .from("marketing_automatizaciones")
      .update({ modo_prueba: modoPrueba })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(RUTA);
    return { ok: true, data: rowToAutomatizacion(data as Record<string, unknown>) };
  } catch (err) {
    console.error("[automatizaciones] modo prueba:", err);
    return { ok: false, error: "No se pudo cambiar el modo" };
  }
}

export async function borrarAutomatizacionAction(id: string): Promise<Resultado<true>> {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa" };
    const { error } = await supabase.from("marketing_automatizaciones").delete().eq("id", id);
    if (error) throw error;
    revalidatePath(RUTA);
    return { ok: true, data: true };
  } catch (err) {
    console.error("[automatizaciones] borrar:", err);
    return { ok: false, error: "No se pudo borrar" };
  }
}

/** Crea una de las recetas ya escritas, apagada y en pruebas. */
export async function crearDesdeRecetaAction(
  clave: string,
  departamentoId?: string,
): Promise<Resultado<Automatizacion>> {
  const receta = RECETAS.find((r) => r.clave === clave);
  if (!receta) return { ok: false, error: "Esa plantilla no existe" };

  const pasos = receta.pasos.map((p) =>
    p.tipo === "aviso" && departamentoId ? { ...p, departamentoId } : p,
  );
  // Un aviso sin departamento no se puede guardar: se descarta el paso y el
  // usuario lo añade eligiendo a quién avisar.
  const utiles = pasos.filter((p) => !(p.tipo === "aviso" && !p.departamentoId));
  if (utiles.length === 0) {
    return { ok: false, error: "Elige primero el departamento al que avisar" };
  }

  return guardarAutomatizacionAction({
    nombre: receta.nombre,
    descripcion: receta.descripcion,
    disparador: receta.disparador,
    disparadorConfig: receta.disparadorConfig,
    pasos: utiles,
  });
}

/**
 * "Probar ahora": hace en el momento lo que el cron haría en su próxima pasada,
 * solo para esta automatización. Sin esto, comprobar que algo funciona serían
 * diez minutos de espera mirando una pantalla quieta.
 */
export async function probarAhoraAction(id: string): Promise<Resultado<string>> {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa" };

    const { data, error } = await supabase
      .from("marketing_automatizaciones")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;

    const autom = rowToAutomatizacion(data as Record<string, unknown>);
    if (autom.estado !== "Activo") {
      return { ok: false, error: "Enciéndela antes de probarla" };
    }

    // El motor escribe en el historial y en las estadísticas: necesita service
    // role, igual que cuando corre desde el cron.
    const admin = createAdminClient();
    const nuevos = await barrerAutomatizacion(admin, autom);
    const tirada = await procesarPendientes(admin);
    revalidatePath(RUTA);

    if (nuevos === 0 && tirada.procesadas === 0) {
      return { ok: true, data: "No hay nada que disparar ahora mismo" };
    }
    return {
      ok: true,
      data: `${nuevos} disparos nuevos, ${tirada.procesadas} en marcha`,
    };
  } catch (err) {
    console.error("[automatizaciones] probar:", err);
    return { ok: false, error: "No se pudo probar" };
  }
}
