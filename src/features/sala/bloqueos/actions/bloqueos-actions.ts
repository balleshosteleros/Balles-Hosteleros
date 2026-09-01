"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { vigenciaToCampos } from "@/features/sala/reglas/data/reglas";
import { vigenciaAplicaEnFecha } from "@/features/sala/bloqueos/data/bloqueos";
import type {
  BloqueoExcepcion,
  BloqueoInput,
  ReservaBloqueo,
} from "@/features/sala/bloqueos/data/bloqueos";
import type { ModoVigencia, TurnoRegla } from "@/features/sala/reglas/data/reglas";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, empresaId };
}

function rowToBloqueo(r: Record<string, unknown>): ReservaBloqueo {
  return {
    id: r.id as string,
    empresaId: r.empresa_id as string,
    localId: r.local_id as string,
    modoVigencia: r.modo_vigencia as ModoVigencia,
    fechaDesde: (r.fecha_desde as string | null) ?? null,
    fechaHasta: (r.fecha_hasta as string | null) ?? null,
    diasSemana: (r.dias_semana as number[] | null) ?? null,
    fechasExtra: (r.fechas_extra as string[] | null) ?? null,
    turno: r.turno as TurnoRegla,
    zonaIds: (r.zona_ids as string[] | null) ?? [],
    mesaIds: (r.mesa_ids as string[] | null) ?? [],
    motivo: (r.motivo as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export async function listBloqueos(localId?: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as ReservaBloqueo[] };
    let q = supabase
      .from("empresa_reservas_bloqueos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (localId) q = q.eq("local_id", localId);
    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToBloqueo) };
  } catch (err) {
    console.error("[bloqueos] list:", err);
    return { ok: false, data: [] as ReservaBloqueo[] };
  }
}

export async function createBloqueo(input: BloqueoInput) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    if (!input.localId) return { ok: false as const, error: "Local obligatorio" };
    const zonaIds = input.zonaIds ?? [];
    const mesaIds = input.mesaIds ?? [];
    if (zonaIds.length === 0 && mesaIds.length === 0) {
      return { ok: false as const, error: "Selecciona al menos una zona o mesa" };
    }
    const campos = vigenciaToCampos(input.vigencia);
    const { data, error } = await supabase
      .from("empresa_reservas_bloqueos")
      .insert({
        empresa_id: empresaId,
        local_id: input.localId,
        modo_vigencia: input.vigencia.modo,
        fecha_desde: campos.fechaDesde,
        fecha_hasta: campos.fechaHasta,
        dias_semana: campos.diasSemana,
        fechas_extra: campos.fechasExtra,
        turno: input.turno,
        zona_ids: zonaIds,
        mesa_ids: mesaIds,
        motivo: input.motivo?.trim() || null,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true as const, data: rowToBloqueo(data) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[bloqueos] create:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function deleteBloqueo(id: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa." };
    const { error } = await supabase
      .from("empresa_reservas_bloqueos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true as const };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[bloqueos] delete:", msg);
    return { ok: false as const, error: msg };
  }
}

// --- Excepciones puntuales ---

function rowToExcepcion(r: Record<string, unknown>): BloqueoExcepcion {
  return {
    id: r.id as string,
    empresaId: r.empresa_id as string,
    localId: r.local_id as string,
    fecha: r.fecha as string,
    turno: r.turno as "COMIDA" | "CENA",
    mesaId: r.mesa_id as string,
    createdAt: r.created_at as string,
  };
}

/**
 * Crea una excepción "esta mesa NO está bloqueada en (fecha, turno)" —
 * permite levantar puntualmente el bloqueo desde el plano de /sala/reservas
 * sin tocar el bloqueo recurrente.
 */
export async function crearBloqueoExcepcion(input: {
  localId: string;
  fecha: string;
  turno: "COMIDA" | "CENA";
  mesaId: string;
}) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    if (!input.localId || !input.mesaId || !input.fecha) {
      return { ok: false as const, error: "Datos incompletos" };
    }
    const { data, error } = await supabase
      .from("empresa_reservas_bloqueos_excepciones")
      .upsert(
        {
          empresa_id: empresaId,
          local_id: input.localId,
          fecha: input.fecha,
          turno: input.turno,
          mesa_id: input.mesaId,
        },
        { onConflict: "empresa_id,fecha,turno,mesa_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true as const, data: rowToExcepcion(data) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[bloqueos] crearExcepcion:", msg);
    return { ok: false as const, error: msg };
  }
}

/** Borra la excepción de una mesa para (fecha, turno) — vuelve a estar bloqueada. */
export async function deleteBloqueoExcepcion(input: {
  localId: string;
  fecha: string;
  turno: "COMIDA" | "CENA";
  mesaId: string;
}) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const { error } = await supabase
      .from("empresa_reservas_bloqueos_excepciones")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("local_id", input.localId)
      .eq("fecha", input.fecha)
      .eq("turno", input.turno)
      .eq("mesa_id", input.mesaId);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true as const };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[bloqueos] deleteExcepcion:", msg);
    return { ok: false as const, error: msg };
  }
}

/** Lista excepciones del local — usado por la UI cliente para restar al pintar. */
export async function listBloqueoExcepciones(localId: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, data: [] as BloqueoExcepcion[] };
    const { data, error } = await supabase
      .from("empresa_reservas_bloqueos_excepciones")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("local_id", localId);
    if (error) throw error;
    return { ok: true as const, data: (data ?? []).map(rowToExcepcion) };
  } catch (err) {
    console.error("[bloqueos] listExcepciones:", err);
    return { ok: false as const, data: [] as BloqueoExcepcion[] };
  }
}


/**
 * DESBLOQUEAR UNA MESA DESDE EL PLANO
 * ===================================
 * Antes esto SIEMPRE creaba una excepción puntual y dejaba el bloqueo intacto:
 * la mesa se veía libre en el plano pero seguía listada en "Bloqueos activos",
 * y peor aún, si el bloqueo era de AMBOS turnos la excepción solo levantaba uno
 * — la mesa seguía bloqueada en el otro (el caso de TE4, 30-ago).
 *
 * Ahora se resuelve por el camino que corresponde a cada bloqueo, para que el
 * plano y la lista de bloqueos digan siempre lo mismo:
 *
 *  1. Bloqueo puntual (solo esta fecha) que cubre SOLO esta mesa → se BORRA.
 *  2. Bloqueo puntual con más mesas                              → se quita la mesa.
 *  3. Bloqueo de varias fechas y esta mesa es la única           → se quita la fecha.
 *  4. Resto (recurrente, por zona, rango)                        → excepción puntual,
 *     que es lo correcto: levantar hoy sin tocar la periodicidad.
 *
 * En los casos 1-3 se levantan LOS DOS turnos si el bloqueo era "AMBOS", porque
 * el usuario ha pedido desbloquear la mesa, no medio día.
 */
export async function quitarBloqueoMesa(input: {
  localId: string;
  fecha: string;
  turno: "COMIDA" | "CENA";
  mesaId: string;
}) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    if (!input.localId || !input.mesaId || !input.fecha) {
      return { ok: false as const, error: "Datos incompletos" };
    }

    const { data: filas, error: errList } = await supabase
      .from("empresa_reservas_bloqueos")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("local_id", input.localId);
    if (errList) throw errList;

    const bloqueos = (filas ?? []).map(rowToBloqueo);

    // La zona de ESTA mesa: un bloqueo por zona solo la afecta si es la suya.
    // Sin esto, cualquier bloqueo de zona del local contaba como si la tapara.
    const { data: mesaRow, error: errMesa } = await supabase
      .from("mesas")
      .select("zona_id")
      .eq("id", input.mesaId)
      .maybeSingle();
    if (errMesa) throw errMesa;
    const zonaDeLaMesa = (mesaRow?.zona_id as string | null) ?? null;

    // Solo nos importan los bloqueos que hoy afectan a esta mesa en este turno.
    const afectan = bloqueos.filter((b) => {
      if (!vigenciaAplicaEnFecha(b, input.fecha)) return false;
      if (b.turno !== "AMBOS" && b.turno !== input.turno) return false;
      if (b.mesaIds.includes(input.mesaId)) return true;
      return zonaDeLaMesa !== null && b.zonaIds.includes(zonaDeLaMesa);
    });

    let necesitaExcepcion = false;

    for (const b of afectan) {
      const soloEstaMesa = b.zonaIds.length === 0 && b.mesaIds.length === 1;
      const fechas = b.fechasExtra ?? [];
      const esPuntualDeHoy =
        (b.modoVigencia === "hoy" || b.modoVigencia === "fechas") &&
        fechas.length === 1 &&
        fechas[0] === input.fecha;

      // Caso 4: recurrente, por zona o por rango → no se toca el bloqueo.
      if (!b.mesaIds.includes(input.mesaId)) {
        necesitaExcepcion = true;
        continue;
      }

      if (esPuntualDeHoy && soloEstaMesa) {
        // Caso 1: el bloqueo existía solo para esto. Desaparece.
        const { error } = await supabase
          .from("empresa_reservas_bloqueos")
          .delete()
          .eq("id", b.id)
          .eq("empresa_id", empresaId);
        if (error) throw error;
        continue;
      }

      if (esPuntualDeHoy && !soloEstaMesa) {
        // Caso 2: el bloqueo sigue vivo para las demás mesas; sale esta.
        const { error } = await supabase
          .from("empresa_reservas_bloqueos")
          .update({ mesa_ids: b.mesaIds.filter((id) => id !== input.mesaId) })
          .eq("id", b.id)
          .eq("empresa_id", empresaId);
        if (error) throw error;
        continue;
      }

      if (
        (b.modoVigencia === "fechas" || b.modoVigencia === "hoy") &&
        fechas.includes(input.fecha) &&
        soloEstaMesa
      ) {
        // Caso 3: varias fechas para esta única mesa → hoy deja de contar.
        const restantes = fechas.filter((f) => f !== input.fecha);
        if (restantes.length === 0) {
          const { error } = await supabase
            .from("empresa_reservas_bloqueos")
            .delete()
            .eq("id", b.id)
            .eq("empresa_id", empresaId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("empresa_reservas_bloqueos")
            .update({ fechas_extra: restantes })
            .eq("id", b.id)
            .eq("empresa_id", empresaId);
          if (error) throw error;
        }
        continue;
      }

      // Recurrente o rango sobre esta mesa: se levanta solo hoy.
      necesitaExcepcion = true;
    }

    // La excepción es por (fecha, turno). Si el bloqueo que la exige cubre
    // "AMBOS", hay que levantar los dos turnos: desbloquear la mesa es
    // desbloquearla, no dejarla a medias.
    if (necesitaExcepcion) {
      const cubreAmbos = afectan.some((b) => b.turno === "AMBOS");
      const turnos: ("COMIDA" | "CENA")[] = cubreAmbos
        ? ["COMIDA", "CENA"]
        : [input.turno];
      const { error } = await supabase
        .from("empresa_reservas_bloqueos_excepciones")
        .upsert(
          turnos.map((t) => ({
            empresa_id: empresaId,
            local_id: input.localId,
            fecha: input.fecha,
            turno: t,
            mesa_id: input.mesaId,
          })),
          { onConflict: "empresa_id,fecha,turno,mesa_id" },
        );
      if (error) throw error;
    }

    revalidatePath("/sala/reservas");
    return { ok: true as const, soloHoy: necesitaExcepcion };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[bloqueos] quitarBloqueoMesa:", msg);
    return { ok: false as const, error: msg };
  }
}
