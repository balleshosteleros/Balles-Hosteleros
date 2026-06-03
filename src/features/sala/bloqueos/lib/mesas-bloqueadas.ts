import type { SupabaseClient } from "@supabase/supabase-js";
import {
  vigenciaAplicaEnFecha,
  type ReservaBloqueo,
} from "@/features/sala/bloqueos/data/bloqueos";
import type { ModoVigencia, TurnoRegla } from "@/features/sala/reglas/data/reglas";

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

/**
 * Devuelve los `mesa_id` con un bloqueo activo en (`fecha`, `turno`) para el
 * `localId`. Si `turno` es null, cualquier turno cuenta. Las zonas se expanden
 * a sus mesas.
 *
 * Recibe el cliente Supabase para poder funcionar tanto desde el panel
 * autenticado como desde el form público (admin).
 */
export async function getMesasBloqueadas(
  supabase: SupabaseClient,
  args: {
    empresaId: string;
    localId: string;
    fechaISO: string;
    turno?: "COMIDA" | "CENA" | null;
  },
): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("empresa_reservas_bloqueos")
      .select("*")
      .eq("empresa_id", args.empresaId)
      .eq("local_id", args.localId);
    if (error) throw error;
    const bloqueos = (data ?? []).map(rowToBloqueo);
    const aplicables = bloqueos.filter((b) => {
      if (!vigenciaAplicaEnFecha(b, args.fechaISO)) return false;
      if (b.turno === "AMBOS") return true;
      if (!args.turno) return true;
      return b.turno === args.turno;
    });
    if (aplicables.length === 0) return new Set();

    const mesaIds = new Set<string>();
    const zonaIds = new Set<string>();
    for (const b of aplicables) {
      for (const m of b.mesaIds) mesaIds.add(m);
      for (const z of b.zonaIds) zonaIds.add(z);
    }

    if (zonaIds.size > 0) {
      const { data: mesasZona, error: errMz } = await supabase
        .from("mesas")
        .select("id")
        .eq("local_id", args.localId)
        .in("zona_id", Array.from(zonaIds));
      if (errMz) throw errMz;
      for (const m of mesasZona ?? []) mesaIds.add(m.id as string);
    }
    return mesaIds;
  } catch (err) {
    console.error("[bloqueos] getMesasBloqueadas:", err);
    return new Set();
  }
}
