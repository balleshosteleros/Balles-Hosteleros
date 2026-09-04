"use server";

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError } from "@/shared/lib/friendly-errors";

/**
 * Cuántas VISITAS lleva cada cliente en ESTA empresa.
 *
 * Alimenta el recuadro azul que va junto al nombre en el listado de sala: si es
 * la primera vez que viene no sale nada, y a partir de la segunda sale el
 * número. Es el dato que dice de un vistazo si quien entra por la puerta es un
 * cliente habitual o alguien que viene por primera vez.
 *
 * Qué cuenta: las veces que REALMENTE vino, es decir todas sus reservas menos
 * las canceladas y los no-show. Antes contaba tambien esas dos y la que se esta
 * mirando, y el numero no cuadraba con la realidad: salia un 5 en alguien que
 * habia venido 3 veces. El desglose (no-show y canceladas) ya se ve dentro del
 * detalle de la reserva, asi que el recuadro da la cifra que importa en sala.
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
    //
    // Se excluyen canceladas y no-show (no llego a venir) y las de hoy en
    // adelante (todavia no ha venido): el recuadro cuenta visitas, no reservas.
    const hoy = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("reservas")
      .select("cliente_id")
      .eq("empresa_id", empresaId)
      .in("cliente_id", ids)
      .lt("fecha", hoy)
      .not("estado", "in", "(CANCELADA,NO_SHOW)");
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
