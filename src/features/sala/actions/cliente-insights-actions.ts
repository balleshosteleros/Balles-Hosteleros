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

    // 1) Visitas totales en la empresa actual (clientes_sala.visitas).
    let visitasTotal = 0;
    if (input.clienteId) {
      const { data } = await supabase
        .from("clientes_sala")
        .select("visitas")
        .eq("id", input.clienteId)
        .maybeSingle();
      visitasTotal = (data?.visitas as number | null) ?? 0;
    } else {
      const orParts: string[] = [];
      if (telNorm) orParts.push(`telefono_normalizado.eq.${telNorm}`);
      if (emailNorm) orParts.push(`email_normalizado.eq.${emailNorm}`);
      if (orParts.length > 0) {
        const { data } = await supabase
          .from("clientes_sala")
          .select("visitas")
          .eq("empresa_id", empresaId)
          .or(orParts.join(","))
          .maybeSingle();
        visitasTotal = (data?.visitas as number | null) ?? 0;
      }
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

    return {
      clienteId: input.clienteId ?? null,
      visitasTotal,
      visitasConValoracion,
      visitasSinValoracion,
      otrosLocalesGrupo,
    };
  } catch (err) {
    console.error("[cliente-insights] get:", err);
    return fallback;
  }
}
