"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { capitalizeText } from "@/shared/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError } from "@/shared/lib/friendly-errors";

// Todos los campos son obligatorios y los comentarios necesitan un minimo de
// texto: una incidencia sin describir no sirve para reparar ni para reclamar.
const MIN_COMENTARIOS = 15;

function validarIncidencia(v: {
  desperfecto: string; localNombre: string; estado: string; gravedad: string;
  apuntaDesperfecto: string; reparador: string; comentarios: string; fechaPublicado: string;
}): string | null {
  if (!v.desperfecto?.trim()) return "Describe el desperfecto";
  if (!v.localNombre?.trim()) return "Elige el local";
  if (!v.estado?.trim()) return "Elige el estado";
  if (!v.gravedad?.trim()) return "Elige la gravedad";
  if (!v.apuntaDesperfecto?.trim()) return "Elige quien lo apunta";
  if (!v.reparador?.trim()) return "Elige el reparador";
  if (!v.fechaPublicado?.trim()) return "Indica la fecha";
  if (v.comentarios?.trim().length < MIN_COMENTARIOS)
    return `Los comentarios necesitan al menos ${MIN_COMENTARIOS} caracteres`;
  return null;
}
async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, nombre: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);

  const { data } = await supabase

    .from("usuarios")

    .select("nombre, apellidos")

    .eq("user_id", user.id)

    .single();
return {
    supabase,
    user,
    empresaId,
    nombre: data ? data.nombre + " " + data.apellidos : null,
  };
}

export async function listMantenimiento() {
  try {
    const { supabase, empresaId } = await getContext();
    // Se traen las actualizaciones en la misma consulta: sin ellas el historial
    // de la ficha aparecia siempre vacio al recargar.
    const query = supabase
      .from("mantenimiento")
      .select("*, mantenimiento_actualizaciones(*)")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[mantenimiento] listMantenimiento:", err);
    return { ok: false, data: [], error: friendlyError(err, "listMantenimiento") };
  }
}

export async function createIncidenciaMantenimiento(input: {
  desperfecto: string;
  localNombre: string;
  estado: string;
  gravedad: string;
  apuntaDesperfecto: string;
  reparador: string;
  comentarios: string;
  fechaPublicado: string;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const invalido = validarIncidencia(input);
    if (invalido) return { ok: false, error: invalido };
    const { error } = await supabase.from("mantenimiento").insert({
      empresa_id: empresaId,
      // El desperfecto siempre en sentence case: primera en mayúscula, resto en
      // minúsculas. Se fuerza aquí (servidor) para que valga venga de donde venga.
      desperfecto: capitalizeText(input.desperfecto.trim()),
      local_nombre: input.localNombre,
      estado: input.estado,
      gravedad: input.gravedad,
      apunta_desperfecto: input.apuntaDesperfecto,
      reparador: input.reparador,
      comentarios: input.comentarios,
      fecha_publicado: input.fechaPublicado,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mantenimiento] createIncidencia:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateIncidencia(
  id: string,
  updates: {
    desperfecto?: string;
    localNombre?: string;
    estado?: string;
    gravedad?: string;
    apuntaDesperfecto?: string;
    reparador?: string;
    comentarios?: string;
    fechaPublicado?: string;
  }
) {
  try {
    const { supabase } = await getContext();

    // Un desperfecto TERMINADO se consulta, no se edita. Lo unico que sigue
    // abierto es el estado, para poder reabrirlo si se cerro por error o si la
    // averia vuelve.
    const { data: actual } = await supabase
      .from("mantenimiento")
      .select("estado")
      .eq("id", id)
      .single();
    if (actual?.estado === "TERMINADO") {
      const soloEstado =
        Object.keys(updates).length === 1 && updates.estado !== undefined;
      if (!soloEstado)
        return {
          ok: false,
          error: "Este desperfecto está terminado: solo se puede reabrir cambiando su estado",
        };
    }

    // Convert camelCase inputs to snake_case DB fields
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.desperfecto !== undefined)
      dbUpdates.desperfecto = capitalizeText(updates.desperfecto.trim());
    if (updates.localNombre !== undefined)
      dbUpdates.local_nombre = updates.localNombre;
    if (updates.estado !== undefined) dbUpdates.estado = updates.estado;
    if (updates.gravedad !== undefined) dbUpdates.gravedad = updates.gravedad;
    if (updates.apuntaDesperfecto !== undefined)
      dbUpdates.apunta_desperfecto = updates.apuntaDesperfecto;
    if (updates.reparador !== undefined)
      dbUpdates.reparador = updates.reparador;
    if (updates.comentarios !== undefined) {
      if (updates.comentarios.trim().length < MIN_COMENTARIOS)
        return { ok: false, error: `Los comentarios necesitan al menos ${MIN_COMENTARIOS} caracteres` };
      dbUpdates.comentarios = updates.comentarios;
    }
    if (updates.fechaPublicado !== undefined)
      dbUpdates.fecha_publicado = updates.fechaPublicado;

    const { error } = await supabase
      .from("mantenimiento")
      .update(dbUpdates)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mantenimiento] updateIncidencia:", msg);
    return { ok: false, error: msg };
  }
}

export async function addActualizacion(
  incidenciaId: string,
  texto: string,
  apuntadoPor: string,
  resultado: "TERMINADO" | "EN PROGRESO",
  minutos: number,
  fecha?: string
) {
  try {
    const { supabase } = await getContext();

    if (texto.trim().length < MIN_COMENTARIOS)
      return { ok: false, error: `Las observaciones necesitan al menos ${MIN_COMENTARIOS} caracteres` };
    if (!apuntadoPor?.trim()) return { ok: false, error: "Elige quien lo apunta" };
    if (resultado !== "TERMINADO" && resultado !== "EN PROGRESO")
      return { ok: false, error: "Elige si queda terminado o en progreso" };
    if (!Number.isInteger(minutos) || minutos < 15 || minutos > 360 || minutos % 15 !== 0)
      return { ok: false, error: "El tiempo va de 15 min a 6 h en tramos de 15 min" };

    const { error } = await supabase
      .from("mantenimiento_actualizaciones")
      .insert({
        incidencia_id: incidenciaId,
        texto: texto.trim(),
        apuntado_por: apuntadoPor,
        resultado,
        minutos,
        ...(fecha ? { fecha } : {}),
      });
    if (error) throw error;

    // El estado de la incidencia sigue al resultado de su ultima actualizacion.
    const { error: errEstado } = await supabase
      .from("mantenimiento")
      .update({ estado: resultado, updated_at: new Date().toISOString() })
      .eq("id", incidenciaId);
    if (errEstado) throw errEstado;

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mantenimiento] addActualizacion:", msg);
    return { ok: false, error: msg };
  }
}

/** Historial de cambios de estado: quien lo movio, de que a que y cuando. */
export async function listHistorialEstados(incidenciaId: string) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("mantenimiento_estados_historial")
      .select("*")
      .eq("incidencia_id", incidenciaId)
      .order("fecha", { ascending: true });
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[mantenimiento] listHistorialEstados:", err);
    return { ok: false, data: [], error: friendlyError(err, "listHistorialEstados") };
  }
}

export async function listActualizaciones(incidenciaId: string) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("mantenimiento_actualizaciones")
      .select("*")
      .eq("incidencia_id", incidenciaId)
      .order("fecha", { ascending: true });
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[mantenimiento] listActualizaciones:", err);
    return { ok: false, data: [], error: friendlyError(err, "listActualizaciones") };
  }
}
