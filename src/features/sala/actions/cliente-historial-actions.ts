"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Una línea de la actividad de un CLIENTE: qué dato suyo cambió, de qué a qué,
 * quién lo hizo y cuándo.
 *
 * No confundir con `ReservaActividad`: eso es lo que le pasa a UNA reserva
 * (mesa, hora, estado). Esto es lo que le pasa a la persona.
 */
export interface ClienteActividad {
  id: string;
  campo: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  /** Nombre de quien lo cambió. Null si no hubo persona detrás. */
  usuarioNombre: string | null;
  origen: "MANUAL" | "AUTOMATICO" | "PORTAL_PUBLICO" | "GOOGLE_RWG";
  createdAt: string;
}

/**
 * Actividad de un cliente, de lo más reciente a lo más antiguo. Solo lectura:
 * la tabla no tiene políticas de UPDATE ni DELETE, es un registro histórico.
 */
export async function listClienteActividad(clienteId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, data: [] as ClienteActividad[] };
    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ok: false, data: [] as ClienteActividad[] };

    // El filtro por empresa va explícito: la RLS acota a las empresas DEL
    // usuario, no a la ACTIVA (mismo motivo que en el resto de sala).
    const { data, error } = await supabase
      .from("cliente_historial")
      .select(
        "id, campo, valor_anterior, valor_nuevo, usuario_nombre, origen, created_at",
      )
      .eq("cliente_id", clienteId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const filas: ClienteActividad[] = (data ?? []).map((r) => ({
      id: r.id as string,
      campo: r.campo as string,
      valorAnterior: (r.valor_anterior as string | null) ?? null,
      valorNuevo: (r.valor_nuevo as string | null) ?? null,
      usuarioNombre: (r.usuario_nombre as string | null) ?? null,
      origen: (r.origen as ClienteActividad["origen"]) ?? "MANUAL",
      createdAt: r.created_at as string,
    }));
    return { ok: true, data: filas };
  } catch (err) {
    console.error("[clientes] listClienteActividad:", err);
    return { ok: false, data: [] as ClienteActividad[] };
  }
}
