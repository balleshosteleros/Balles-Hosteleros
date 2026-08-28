"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Una línea de la actividad de una reserva: qué campo cambió, de qué a qué,
 * quién lo hizo y cuándo.
 */
export interface ReservaActividad {
  id: string;
  campo: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  /** Nombre de quien lo cambió. Null si no hubo persona detrás. */
  usuarioNombre: string | null;
  origen: "MANUAL" | "AUTOMATICO" | "PORTAL_PUBLICO" | "GOOGLE_RWG";
  createdAt: string;
}

async function getCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

/**
 * Actividad de una reserva, de lo más reciente a lo más antiguo. Solo lectura:
 * la actividad la escribe `updateReserva` y nadie más, y no se puede modificar
 * ni borrar (no hay políticas de UPDATE/DELETE en la tabla).
 */
export async function listReservaActividad(reservaId: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as ReservaActividad[] };

    // El filtro por empresa va explícito: la RLS acota a las empresas DEL
    // usuario, no a la ACTIVA (mismo motivo que en el resto de reservas).
    const { data, error } = await supabase
      .from("reserva_historial")
      .select(
        "id, campo, valor_anterior, valor_nuevo, usuario_nombre, origen, created_at",
      )
      .eq("reserva_id", reservaId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const filas: ReservaActividad[] = (data ?? []).map((r) => ({
      id: r.id as string,
      campo: r.campo as string,
      valorAnterior: (r.valor_anterior as string | null) ?? null,
      valorNuevo: (r.valor_nuevo as string | null) ?? null,
      usuarioNombre: (r.usuario_nombre as string | null) ?? null,
      origen: (r.origen as ReservaActividad["origen"]) ?? "MANUAL",
      createdAt: r.created_at as string,
    }));
    return { ok: true, data: filas };
  } catch (err) {
    console.error("[reservas] listReservaActividad:", err);
    return { ok: false, data: [] as ReservaActividad[] };
  }
}
