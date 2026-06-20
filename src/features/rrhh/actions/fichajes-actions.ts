"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { distanciaMetros } from "@/features/rrhh/utils/geo";
import { getEmpresaActivaId } from "@/features/empresa/actions/empresa-activa-actions";
import { calcularSalidaPrevista, cerrarConReparto } from "@/features/mi-panel/utils/fichaje-multiempresa";
import { revalidatePath } from "next/cache";

const ROLES_ADMIN_FICHAJES = ["admin", "director"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica admin/director y, opcionalmente, pertenencia del caller a las
 * empresas indicadas vía user_empresas.
 *
 * Mismo patrón que `requireAdminUser` en empleados-actions.ts — el fix de
 * TASK-002 (handoff 2026-05-25) demostró que el listado RRHH multiempresa
 * necesita esta combinación: createAdminClient + scope explícito.
 */
async function requireAdminFichajes(opts?: { empresaIds?: string[] }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: rolesRows } = await supabase
    .from("usuario_roles")
    .select("role")
    .eq("user_id", user.id);
  const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roles.some((r) =>
    (ROLES_ADMIN_FICHAJES as readonly string[]).includes(r),
  );
  if (!isAdmin) {
    throw new Error(
      "Sin permisos: solo admin o director pueden gestionar fichajes",
    );
  }

  if (opts?.empresaIds && opts.empresaIds.length > 0 && !roles.includes("director")) {
    const empresasReq = Array.from(
      new Set(
        opts.empresaIds.filter(
          (id) => typeof id === "string" && UUID_RE.test(id),
        ),
      ),
    );
    if (empresasReq.length === 0) {
      throw new Error("Sin permisos: empresas no válidas");
    }
    const { data: rels } = await supabase
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("user_id", user.id)
      .in("empresa_id", empresasReq);
    const accesibles = new Set(
      (rels ?? []).map((r: { empresa_id: string }) => r.empresa_id),
    );
    const sinAcceso = empresasReq.filter((id) => !accesibles.has(id));
    if (sinAcceso.length > 0) {
      throw new Error(
        sinAcceso.length === 1
          ? "Sin permisos: no tienes acceso a esa empresa"
          : `Sin permisos: no tienes acceso a ${sinAcceso.length} de las empresas seleccionadas`,
      );
    }
  }

  return user;
}

/**
 * Calcula distancia segura: devuelve `null` si falta cualquier coordenada.
 * Usado server-side en `listFichajes` para precomputar y evitar exponer
 * coordenadas innecesariamente al cliente.
 */
function computeDistanciaSafe(
  lat: number | null,
  lng: number | null,
  local: { lat: number | null; lng: number | null } | null,
): number | null {
  if (
    lat == null ||
    lng == null ||
    !local ||
    local.lat == null ||
    local.lng == null
  ) {
    return null;
  }
  return Math.round(distanciaMetros(lat, lng, local.lat, local.lng));
}

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, nombre: null };

  const { data: profile } = await supabase
    .from("usuarios")
    .select("nombre, apellidos")
    .eq("user_id", user.id)
    .single();

  let empresaId = await getEmpresaActivaId();
  if (!empresaId) {
    const { data: link } = await supabase
      .from("usuario_empresas")
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

/**
 * Lista fichajes del supervisor RRHH para la empresa activa.
 *
 * Multi-tenant: el listado RRHH multiempresa necesita admin client + scope
 * explícito porque la RLS de `fichajes` y `locales` filtra por
 * `profiles.empresa_id` (única) y no por `user_empresas` (canónica). Mismo
 * patrón aplicado a `listEmpleados` en TASK-002. Sin esto, un admin/director
 * con empresa activa BACANAL y `profiles.empresa_id = HABANA` no vería ningún
 * fichaje.
 *
 * Geo audit (PRP-037): el payload incluye coordenadas, modo teletrabajo, el
 * local asignado y las **distancias precalculadas en servidor**. Los campos
 * snake_case mantienen compat con `FichajesView.mapDbToFichaje` actual; los
 * consumidores que mapean a `Fichaje` extendido podrán poblar los campos
 * camelCase desde aquí (TASK-002.02).
 */
export async function listFichajes(fecha?: string) {
  try {
    const { empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    await requireAdminFichajes({ empresaIds: [empresaId] });

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { ok: false, data: [], error: "Supabase admin no configurado." };
    }

    let query = admin
      .from("fichajes")
      .select(
        `*, locales!local_id(id, nombre, lat, lng, radio_metros, color)`,
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (fecha) query = query.eq("fecha", fecha);

    const { data, error } = await query;
    if (error) throw error;

    // Precomputar distancias server-side. Se añaden como snake_case para
    // mantener compat con el mapper actual de FichajesView; los consumidores
    // que mapeen a Fichaje extendido leen también estos campos.
    const enriched = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const local = r.locales as
        | {
            id: string;
            nombre: string;
            lat: number | null;
            lng: number | null;
            radio_metros: number;
            color: string;
          }
        | null;

      const latEntrada = (r.lat_entrada as number | null) ?? null;
      const lngEntrada = (r.lng_entrada as number | null) ?? null;
      const latSalida = (r.lat_salida as number | null) ?? null;
      const lngSalida = (r.lng_salida as number | null) ?? null;

      const distanciaEntrada = computeDistanciaSafe(latEntrada, lngEntrada, local);
      const distanciaSalida = computeDistanciaSafe(latSalida, lngSalida, local);

      return {
        ...r,
        distancia_entrada_metros: distanciaEntrada,
        distancia_salida_metros: distanciaSalida,
      };
    });

    return { ok: true, data: enriched };
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
  updates: { notas?: string; estado?: string; incidencia?: string | null }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("fichajes")
      .update({
        ...(updates.notas !== undefined && { observaciones: updates.notas }),
        ...(updates.estado !== undefined && { estado: updates.estado }),
        ...(updates.incidencia !== undefined && { incidencia: updates.incidencia }),
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

/**
 * Cierra de golpe TODOS los fichajes que quedaron abiertos en la empresa activa
 * (estado trabajando/pausa sin hora_salida), por si alguien se dejó la jornada
 * abierta fuera de su turno. Para cada uno calcula la salida prevista de su
 * horario (fijo o flexible diario) y lo cierra a esa hora como fichaje normal
 * (sin marcarlo para revisión, igual que el auto-cierre). Si el empleado no
 * tiene horario que permita predecir la salida, se cierra a la hora actual y SÍ
 * se marca para revisión, porque no se conoce su hora real de salida.
 * Acción manual de admin/director.
 */
export async function cerrarFichajesAbiertos() {
  try {
    await requireAdminFichajes();
    const empresaId = await getEmpresaActivaId();
    if (!empresaId) return { ok: false, error: "No hay empresa activa" };

    const admin = createAdminClient();
    const { data: abiertos, error: fetchErr } = await admin
      .from("fichajes")
      .select(
        "id, empleado_id, empleado_nombre, fecha, hora_entrada, local_id, centro, tipo, modo_teletrabajo, empresa_id",
      )
      .eq("empresa_id", empresaId)
      .is("hora_salida", null)
      .in("estado", ["trabajando", "pausa"]);
    if (fetchErr) throw fetchErr;

    const ahora = new Date();
    let cerrados = 0;
    let revisados = 0;

    for (const f of abiertos ?? []) {
      const userId = f.empleado_id as string;
      const horaEntrada = f.hora_entrada as string | null;
      if (!userId || !horaEntrada) continue;

      let salidaPrevista: Date | null = null;
      try {
        salidaPrevista = await calcularSalidaPrevista(admin, userId, f.fecha as string, horaEntrada);
      } catch {
        salidaPrevista = null;
      }
      // Con horario → cierra a la salida prevista (fichaje normal). Sin horario
      // → cierra ahora y marca revisión (no se conoce la hora real de salida).
      const salida = salidaPrevista ?? ahora;
      const ctx = {
        fichajeId: f.id as string,
        userId,
        nombre: (f.empleado_nombre as string) ?? "",
        empresaId: f.empresa_id as string,
        localId: (f.local_id as string | null) ?? null,
        centro: (f.centro as string | null) ?? "",
        tipo: (f.tipo as string | null) ?? null,
        modoTeletrabajo: Boolean(f.modo_teletrabajo),
        fecha: f.fecha as string,
        horaEntrada,
      };
      try {
        if (salidaPrevista) {
          await cerrarConReparto(admin, ctx, salida, { autoCierre: true });
        } else {
          const horas =
            Math.round(((salida.getTime() - new Date(horaEntrada).getTime()) / 3600000) * 100) / 100;
          await admin
            .from("fichajes")
            .update({
              hora_salida: salida.toISOString(),
              horas_totales: horas,
              estado: "completado",
              requiere_revision: true,
              revision_motivo: "Cierre manual masivo: sin horario para calcular la salida real",
              incidencia: "Cierre manual: fichaje abierto sin horario — pendiente de revisión",
            })
            .eq("id", ctx.fichajeId);
          revisados++;
        }
        cerrados++;
      } catch (e) {
        console.error("[fichajes] cerrarFichajesAbiertos item:", e);
      }
    }

    revalidatePath("/rrhh/fichajes");
    return { ok: true, data: { cerrados, revisados } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichajes] cerrarFichajesAbiertos:", msg);
    return { ok: false, error: msg };
  }
}
