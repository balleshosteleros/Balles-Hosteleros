"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/shared/lib/friendly-errors";

/**
 * Grupos de zonas: lo que el cliente ve en el desplegable al reservar online.
 *
 * Cada una agrupa una o varias zonas internas bajo un nombre comercial
 * ("Sala" = Cuadrado + Redondas + Cristalera). El cliente solo puede reservar
 * en las zonas publicadas; las zonas internas que no estén en ningún grupo
 * quedan fuera del canal web.
 */

export interface GrupoZona {
  id: string;
  localId: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activa: boolean;
  /** Zonas internas que la componen. */
  zonaIds: string[];
}

function rowToGrupoZona(
  r: Record<string, unknown>,
  zonaIds: string[],
): GrupoZona {
  return {
    id: r.id as string,
    localId: r.local_id as string,
    nombre: r.nombre as string,
    descripcion: (r.descripcion as string | null) ?? null,
    orden: (r.orden as number) ?? 0,
    activa: (r.activa as boolean) ?? true,
    zonaIds,
  };
}

export async function listGruposZonas(localId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("grupos_zonas")
      .select("*")
      .eq("local_id", localId)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) throw error;

    const ids = (data ?? []).map((r) => r.id as string);
    const porPublica = new Map<string, string[]>();
    if (ids.length > 0) {
      const { data: rel, error: errRel } = await supabase
        .from("grupo_zona_zonas")
        .select("grupo_zona_id, zona_id")
        .in("grupo_zona_id", ids);
      if (errRel) throw errRel;
      for (const r of rel ?? []) {
        const k = r.grupo_zona_id as string;
        const lista = porPublica.get(k);
        if (lista) lista.push(r.zona_id as string);
        else porPublica.set(k, [r.zona_id as string]);
      }
    }

    return {
      ok: true,
      data: (data ?? []).map((r) =>
        rowToGrupoZona(r, porPublica.get(r.id as string) ?? []),
      ),
    };
  } catch (err) {
    console.error("[grupos-zonas] list:", err);
    return { ok: false, data: [] as GrupoZona[] };
  }
}

/**
 * Reemplaza las zonas internas de un grupo público.
 *
 * Una zona interna solo puede estar en un grupo (índice único). Si se intenta
 * mover una que ya pertenece a otro, se avisa con nombres legibles en vez de
 * soltar el error de Postgres.
 */
async function asignarZonas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grupoZonaId: string,
  zonaIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: errDel } = await supabase
    .from("grupo_zona_zonas")
    .delete()
    .eq("grupo_zona_id", grupoZonaId);
  if (errDel) return { ok: false, error: errDel.message };

  if (zonaIds.length === 0) return { ok: true };

  const { error: errIns } = await supabase
    .from("grupo_zona_zonas")
    .insert(zonaIds.map((zona_id) => ({ grupo_zona_id: grupoZonaId, zona_id })));

  if (errIns) {
    if (errIns.code === "23505") {
      return {
        ok: false,
        error:
          "Alguna de esas zonas ya pertenece a otro grupo. Quítala del otro antes de añadirla aquí.",
      };
    }
    return { ok: false, error: errIns.message };
  }
  return { ok: true };
}

export async function createGrupoZona(input: {
  localId: string;
  nombre: string;
  descripcion?: string | null;
  zonaIds: string[];
  orden?: number;
}) {
  try {
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
    if (!input.localId) return { ok: false, error: "Local obligatorio" };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("grupos_zonas")
      .insert({
        local_id: input.localId,
        nombre,
        descripcion: input.descripcion?.trim() || null,
        orden: input.orden ?? 0,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Ya existe un grupo de zonas con ese nombre" };
      }
      throw error;
    }

    const asign = await asignarZonas(supabase, data.id as string, input.zonaIds);
    if (!asign.ok) {
      // Sin zonas internas el grupo no sirve para nada: se deshace el alta.
      await supabase.from("grupos_zonas").delete().eq("id", data.id as string);
      return { ok: false, error: asign.error };
    }

    revalidatePath("/sala/reservas");
    return { ok: true, id: data.id as string };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[grupos-zonas] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateGrupoZona(
  id: string,
  updates: {
    nombre?: string;
    descripcion?: string | null;
    zonaIds?: string[];
    orden?: number;
    activa?: boolean;
  },
) {
  try {
    const supabase = await createClient();

    const patch: Record<string, unknown> = {};
    if (updates.nombre !== undefined) {
      const n = updates.nombre.trim();
      if (!n) return { ok: false, error: "El nombre es obligatorio" };
      patch.nombre = n;
    }
    if (updates.descripcion !== undefined) {
      patch.descripcion = updates.descripcion?.trim() || null;
    }
    if (updates.orden !== undefined) patch.orden = updates.orden;
    if (updates.activa !== undefined) patch.activa = updates.activa;

    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase.from("grupos_zonas").update(patch).eq("id", id);
      if (error) {
        if (error.code === "23505") {
          return { ok: false, error: "Ya existe un grupo de zonas con ese nombre" };
        }
        throw error;
      }
    }

    if (updates.zonaIds !== undefined) {
      const asign = await asignarZonas(supabase, id, updates.zonaIds);
      if (!asign.ok) return { ok: false, error: asign.error };
    }

    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[grupos-zonas] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteGrupoZona(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("grupos_zonas").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[grupos-zonas] delete:", msg);
    return { ok: false, error: msg };
  }
}

/** ¿Se obliga al cliente a elegir zona? Vive en la config de reservas. */
export async function getExigirZonaCliente(empresaId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("empresa_reservas_config")
      .select("exigir_zona_cliente")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    return { ok: true, data: (data?.exigir_zona_cliente as boolean) ?? false };
  } catch (err) {
    console.error("[grupos-zonas] getExigir:", err);
    return { ok: false, data: false, error: friendlyError(err, "getExigirZonaCliente") };
  }
}

export async function setExigirZonaCliente(empresaId: string, valor: boolean) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("empresa_reservas_config")
      .upsert(
        { empresa_id: empresaId, exigir_zona_cliente: valor },
        { onConflict: "empresa_id" },
      );
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[grupos-zonas] setExigir:", msg);
    return { ok: false, error: msg };
  }
}
