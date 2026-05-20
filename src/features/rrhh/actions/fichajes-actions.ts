"use server";

import { createClient } from "@/lib/supabase/server";
import { distanciaMetros } from "@/features/rrhh/utils/geo";
import { getEmpresaActivaId } from "@/features/empresa/actions/empresa-activa-actions";
import { revalidatePath } from "next/cache";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, nombre: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellidos")
    .eq("user_id", user.id)
    .single();

  let empresaId = await getEmpresaActivaId();
  if (!empresaId) {
    const { data: link } = await supabase
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    empresaId = link?.empresa_id ?? null;
  }

  return {
    supabase,
    user,
    empresaId,
    nombre: profile ? profile.nombre + " " + profile.apellidos : null,
  };
}

export async function listFichajes(fecha?: string) {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("fichajes")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    if (fecha) query.eq("fecha", fecha);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[fichajes] listFichajes:", err);
    return { ok: false, data: [] };
  }
}

export type FichajeEmpleadoResumen = {
  id: string;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  pausaInicio: string | null;
  pausaFin: string | null;
  horasTotales: number;
  estado: string;
  incidencia: string | null;
  observaciones: string;
  centro: string;
};

export async function listFichajesEmpleado(
  empleadoId: string,
  rango?: { desde?: string; hasta?: string },
): Promise<{ ok: true; data: FichajeEmpleadoResumen[] } | { ok: false; data: []; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };

    const { data: empleado, error: empErr } = await supabase
      .from("empleados")
      .select("user_id")
      .eq("id", empleadoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!empleado?.user_id) return { ok: false, data: [], error: "Empleado sin usuario vinculado" };

    const query = supabase
      .from("fichajes")
      .select("id, fecha, hora_entrada, hora_salida, pausa_inicio, pausa_fin, horas_totales, estado, incidencia, observaciones, centro")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleado.user_id)
      .order("fecha", { ascending: false })
      .limit(60);

    if (rango?.desde) query.gte("fecha", rango.desde);
    if (rango?.hasta) query.lte("fecha", rango.hasta);

    const { data, error } = await query;
    if (error) throw error;

    return {
      ok: true,
      data: (data ?? []).map((row) => ({
        id: row.id as string,
        fecha: row.fecha as string,
        horaEntrada: (row.hora_entrada as string | null) ?? null,
        horaSalida: (row.hora_salida as string | null) ?? null,
        pausaInicio: (row.pausa_inicio as string | null) ?? null,
        pausaFin: (row.pausa_fin as string | null) ?? null,
        horasTotales: Number(row.horas_totales ?? 0),
        estado: (row.estado as string | null) ?? "pendiente",
        incidencia: (row.incidencia as string | null) ?? null,
        observaciones: (row.observaciones as string | null) ?? "",
        centro: (row.centro as string | null) ?? "",
      })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichajes] listFichajesEmpleado:", msg);
    return { ok: false, data: [], error: msg };
  }
}

type GeoInput = { lat: number; lng: number; precision: number } | null;

export async function ficharEntrada(geo: GeoInput) {
  try {
    const { supabase, user, empresaId, nombre } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };

    const { data: empleado } = await supabase
      .from("empleados")
      .select("id, local_id, permite_teletrabajo")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (!empleado) {
      return {
        ok: false,
        error: "Tu usuario no está vinculado a ningún empleado.",
      };
    }
    if (!empleado.local_id) {
      return {
        ok: false,
        error:
          "No tienes un local asignado. Pide a tu responsable que te asigne uno.",
      };
    }

    const modoTeletrabajo = empleado.permite_teletrabajo;
    if (!modoTeletrabajo) {
      if (!geo) {
        return {
          ok: false,
          error: "Activa la geolocalización para poder fichar.",
        };
      }
      const { data: local } = await supabase
        .from("locales")
        .select("lat, lng, radio_metros, nombre")
        .eq("id", empleado.local_id)
        .single();
      if (!local || local.lat == null || local.lng == null) {
        return {
          ok: false,
          error:
            "Tu local no tiene ubicación configurada. Avisa a tu responsable.",
        };
      }
      const dist = distanciaMetros(geo.lat, geo.lng, local.lat, local.lng);
      if (dist > local.radio_metros) {
        return {
          ok: false,
          error: `Estás a ${Math.round(dist)} m de "${local.nombre}" (radio permitido ${local.radio_metros} m). Acércate al local para fichar.`,
        };
      }
    }

    const { data, error } = await supabase
      .from("fichajes")
      .insert({
        empresa_id: empresaId,
        empleado_id: user.id,
        empleado_nombre: nombre ?? "Sin nombre",
        fecha: new Date().toISOString().split("T")[0],
        hora_entrada: new Date().toISOString(),
        estado: "trabajando",
        local_id: empleado.local_id,
        lat_entrada: geo?.lat ?? null,
        lng_entrada: geo?.lng ?? null,
        precision_entrada_metros: geo?.precision ?? null,
        modo_teletrabajo: modoTeletrabajo,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichajes] ficharEntrada:", msg);
    return { ok: false, error: msg };
  }
}

export async function ficharSalida(fichajeId: string, geo: GeoInput) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };

    const { data: fichaje, error: fetchErr } = await supabase
      .from("fichajes")
      .select("hora_entrada, local_id, modo_teletrabajo")
      .eq("id", fichajeId)
      .single();
    if (fetchErr) throw fetchErr;

    if (!fichaje.modo_teletrabajo && fichaje.local_id) {
      if (!geo) {
        return {
          ok: false,
          error: "Activa la geolocalización para registrar la salida.",
        };
      }
      const { data: local } = await supabase
        .from("locales")
        .select("lat, lng, radio_metros, nombre")
        .eq("id", fichaje.local_id)
        .single();
      if (local && local.lat != null && local.lng != null) {
        const dist = distanciaMetros(geo.lat, geo.lng, local.lat, local.lng);
        if (dist > local.radio_metros) {
          return {
            ok: false,
            error: `Estás a ${Math.round(dist)} m de "${local.nombre}". Acércate al local para registrar la salida.`,
          };
        }
      }
    }

    const ahora = new Date();
    let horasTotales = 0;
    if (fichaje?.hora_entrada) {
      const entrada = new Date(fichaje.hora_entrada);
      horasTotales =
        Math.round(((ahora.getTime() - entrada.getTime()) / 3600000) * 100) /
        100;
    }

    const { error } = await supabase
      .from("fichajes")
      .update({
        hora_salida: ahora.toISOString(),
        horas_totales: horasTotales,
        estado: "completado",
        lat_salida: geo?.lat ?? null,
        lng_salida: geo?.lng ?? null,
        precision_salida_metros: geo?.precision ?? null,
      })
      .eq("id", fichajeId);
    if (error) throw error;
    return { ok: true, data: { horas_totales: horasTotales } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichajes] ficharSalida:", msg);
    return { ok: false, error: msg };
  }
}

type CrearFichajeManualInput = {
  empleadoId: string;
  fecha: string; // YYYY-MM-DD
  horaEntrada: string; // HH:MM
  horaSalida?: string | null; // HH:MM
  pausaInicio?: string | null; // HH:MM
  pausaFin?: string | null; // HH:MM
  observaciones?: string | null;
};

function toIsoCombinado(fecha: string, hora: string): string {
  // El navegador interpreta el string YYYY-MM-DDTHH:MM como hora local;
  // toISOString() lo convierte a UTC, que es lo que persistimos.
  return new Date(`${fecha}T${hora}:00`).toISOString();
}

export async function crearFichajeManual(input: CrearFichajeManualInput) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };

    const { data: empleado } = await supabase
      .from("empleados")
      .select("id, user_id, local_id, nombre, apellidos, departamentos(nombre)")
      .eq("id", input.empleadoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (!empleado) {
      return { ok: false, error: "Empleado no encontrado en esta empresa." };
    }
    if (!empleado.local_id) {
      return {
        ok: false,
        error: "Este empleado no tiene un local asignado. Asígnale uno antes de crear el fichaje.",
      };
    }

    const { data: local } = await supabase
      .from("locales")
      .select("nombre")
      .eq("id", empleado.local_id)
      .maybeSingle();

    const horaEntradaIso = toIsoCombinado(input.fecha, input.horaEntrada);
    const horaSalidaIso = input.horaSalida
      ? toIsoCombinado(input.fecha, input.horaSalida)
      : null;
    const pausaInicioIso = input.pausaInicio
      ? toIsoCombinado(input.fecha, input.pausaInicio)
      : null;
    const pausaFinIso = input.pausaFin
      ? toIsoCombinado(input.fecha, input.pausaFin)
      : null;

    let horasTotales = 0;
    if (horaSalidaIso) {
      const entrada = new Date(horaEntradaIso).getTime();
      const salida = new Date(horaSalidaIso).getTime();
      const pausaMs =
        pausaInicioIso && pausaFinIso
          ? Math.max(0, new Date(pausaFinIso).getTime() - new Date(pausaInicioIso).getTime())
          : 0;
      horasTotales =
        Math.max(0, Math.round((((salida - entrada) - pausaMs) / 3600000) * 100) / 100);
    }

    const nombreCompleto = `${empleado.nombre ?? ""} ${empleado.apellidos ?? ""}`.trim();
    const departamentoNombre =
      (empleado.departamentos as { nombre?: string } | null)?.nombre ?? "";

    const { data, error } = await supabase
      .from("fichajes")
      .insert({
        empresa_id: empresaId,
        empleado_id: empleado.user_id,
        empleado_nombre: nombreCompleto || "Sin nombre",
        fecha: input.fecha,
        hora_entrada: horaEntradaIso,
        hora_salida: horaSalidaIso,
        pausa_inicio: pausaInicioIso,
        pausa_fin: pausaFinIso,
        horas_totales: horasTotales,
        estado: horaSalidaIso ? "completado" : "trabajando",
        local_id: empleado.local_id,
        modo_teletrabajo: true,
        observaciones: input.observaciones ?? "",
        departamento: departamentoNombre,
        centro: local?.nombre ?? "",
        tipo: "MAN",
      })
      .select()
      .single();
    if (error) throw error;

    revalidatePath("/rrhh/fichajes");
    revalidatePath("/mi-panel");
    revalidatePath("/mi-panel/fichajes");

    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichajes] crearFichajeManual:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateFichaje(
  id: string,
  updates: { notas?: string; estado?: string }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("fichajes")
      .update({
        ...(updates.notas !== undefined && { observaciones: updates.notas }),
        ...(updates.estado !== undefined && { estado: updates.estado }),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichajes] updateFichaje:", msg);
    return { ok: false, error: msg };
  }
}
