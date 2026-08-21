"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteInsights } from "@/features/sala/data/reservas";

function normalizeTelefono(t: string): string {
  return t.replace(/[^\d+]/g, "");
}

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

/**
 * Devuelve insights cross-local + valoraciones de un cliente. Pensado para
 * llamarse on-demand al abrir el detalle de una reserva (no en cada fila).
 *
 * Cross-local respeta RLS: solo cuenta empresas a las que el usuario actual
 * tiene acceso (otros locales del mismo grupo del dueño).
 */
export async function getClienteInsights(input: {
  clienteId?: string | null;
  telefono?: string | null;
  email?: string | null;
}): Promise<ClienteInsights> {
  const fallback: ClienteInsights = {
    clienteId: input.clienteId ?? null,
    visitasTotal: 0,
    visitasConValoracion: 0,
    visitasSinValoracion: 0,
    otrosLocalesGrupo: 0,
    noShows: 0,
    canceladas: 0,
  };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fallback;
    const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
    if (!empresaId) return fallback;

    const telNorm = input.telefono ? normalizeTelefono(input.telefono) : null;
    const emailNorm = input.email ? normalizeEmail(input.email) : null;

    if (!input.clienteId && !telNorm && !emailNorm) return fallback;

    // 1) Visitas: se CUENTAN de sus reservas pasadas, no se lee el contador
    //    `clientes_sala.visitas`.
    //
    //    POR QUÉ: ese contador se incrementaba a mano y está a 0 en todas las
    //    fichas, así que la reserva mostraba "0 visitas" para un cliente que en
    //    la pantalla de Clientes salía con 3. Mismo cliente, dos cifras según
    //    dónde se mirara. El criterio es el de `listClientesEnriquecidos`:
    //    reserva ya pasada a la que no faltó.
    let clienteId = input.clienteId ?? null;
    if (!clienteId) {
      const orParts: string[] = [];
      if (telNorm) orParts.push(`telefono_normalizado.eq.${telNorm}`);
      if (emailNorm) orParts.push(`email_normalizado.eq.${emailNorm}`);
      if (orParts.length > 0) {
        const { data } = await supabase
          .from("clientes_sala")
          .select("id")
          .eq("empresa_id", empresaId)
          .or(orParts.join(","))
          .maybeSingle();
        clienteId = (data?.id as string | null) ?? null;
      }
    }

    let visitasTotal = 0;
    if (clienteId) {
      const hoy = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from("reservas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("cliente_id", clienteId)
        .lt("fecha", hoy)
        .not("estado", "in", "(CANCELADA,NO_SHOW)");
      visitasTotal = count ?? 0;
    }

    // 2) Reseñas del mismo cliente en la empresa actual.
    // resenas no tiene FK a clientes_sala; matchea por telefono/email.
    let visitasConValoracion = 0;
    if (telNorm || emailNorm) {
      const orParts: string[] = [];
      if (telNorm) orParts.push(`telefono.eq.${telNorm}`);
      if (emailNorm) orParts.push(`email.eq.${emailNorm}`);
      if (orParts.length > 0) {
        const { count } = await supabase
          .from("resenas")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .or(orParts.join(","));
        visitasConValoracion = count ?? 0;
      }
    }

    const visitasSinValoracion = Math.max(0, visitasTotal - visitasConValoracion);

    // 3) Cross-local: nº de OTRAS empresas (accesibles vía RLS) donde aparece
    // este mismo telefono/email en clientes_sala.
    let otrosLocalesGrupo = 0;
    if (telNorm || emailNorm) {
      const orParts: string[] = [];
      if (telNorm) orParts.push(`telefono_normalizado.eq.${telNorm}`);
      if (emailNorm) orParts.push(`email_normalizado.eq.${emailNorm}`);
      if (orParts.length > 0) {
        const { data } = await supabase
          .from("clientes_sala")
          .select("empresa_id")
          .neq("empresa_id", empresaId)
          .or(orParts.join(","));
        const distinct = new Set((data ?? []).map((r) => r.empresa_id as string));
        otrosLocalesGrupo = distinct.size;
      }
    }

    // 4) Fiabilidad del cliente en ESTA empresa: cuántas veces no apareció y
    // cuántas canceló. Es lo que decide en el momento si se le guarda la mesa
    // o se le pide garantía.
    let noShows = 0;
    let canceladas = 0;
    // Se usa el `clienteId` RESUELTO, no el de entrada: cuando la reserva se
    // identifica por teléfono o email (sin ficha enlazada todavía), el de
    // entrada viene vacío y el historial de plantones salía siempre a cero,
    // que es justo lo contrario de lo que sala necesita saber.
    if (clienteId) {
      const [resNo, resCan] = await Promise.all([
        supabase
          .from("reservas")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq("cliente_id", clienteId)
          .eq("estado", "NO_SHOW"),
        supabase
          .from("reservas")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq("cliente_id", clienteId)
          .eq("estado", "CANCELADA"),
      ]);
      noShows = resNo.count ?? 0;
      canceladas = resCan.count ?? 0;
    }

    return {
      clienteId,
      visitasTotal,
      visitasConValoracion,
      visitasSinValoracion,
      otrosLocalesGrupo,
      noShows,
      canceladas,
    };
  } catch (err) {
    console.error("[cliente-insights] get:", err);
    return fallback;
  }
}
