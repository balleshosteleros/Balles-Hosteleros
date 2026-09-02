"use server";

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError } from "@/shared/lib/friendly-errors";

/**
 * Cuántas reservas ha hecho cada cliente en ESTA empresa.
 *
 * Alimenta el recuadro azul que va junto al nombre en el listado de sala: si es
 * la primera vez que reserva no sale nada, y a partir de la segunda sale el
 * número. Es el dato que dice de un vistazo si quien entra por la puerta es un
 * cliente habitual o alguien que viene por primera vez.
 *
 * Qué cuenta: TODAS sus reservas de la empresa, incluida la que se está
 * mirando. Una que canceló o a la que no se presentó también la hizo, así que
 * cuenta: el recuadro dice "veces que ha reservado", no "veces que ha venido"
 * (eso son las visitas de la ficha del cliente, que sí descuentan las fallidas).
 *
 * Se pide en lote para el día que hay en pantalla: una sola consulta para toda
 * la lista, en vez de una por fila.
 */
export async function contarReservasPorCliente(
  clienteIds: string[],
): Promise<{ ok: boolean; data: Record<string, number>; error?: string }> {
  try {
    const ids = Array.from(new Set(clienteIds.filter(Boolean)));
    if (ids.length === 0) return { ok: true, data: {} };

    const supabase = await createClient();
    const user = await getUsuarioActual();
    if (!user) return { ok: true, data: {} };

    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ok: true, data: {} };

    // Se traen los `cliente_id` y se cuentan aquí: `count` de Supabase es un
    // total por consulta, no un agrupado, y hacer una consulta por cliente
    // sería una por fila del listado.
    const { data, error } = await supabase
      .from("reservas")
      .select("cliente_id")
      .eq("empresa_id", empresaId)
      .in("cliente_id", ids);
    if (error) throw error;

    const conteo: Record<string, number> = {};
    for (const row of data ?? []) {
      const id = row.cliente_id as string | null;
      if (!id) continue;
      conteo[id] = (conteo[id] ?? 0) + 1;
    }
    return { ok: true, data: conteo };
  } catch (err) {
    console.error("[reservas] contarReservasPorCliente:", err);
    return {
      ok: false,
      data: {},
      error: friendlyError(err, "contarReservasPorCliente"),
    };
  }
}
