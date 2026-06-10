"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgChart, OrgNode, OrgEdge, AreaZone } from "@/features/direccion/data/direccion";

const TABLE = "organigramas";

export async function getOrganigrama(empresaSlug: string): Promise<OrgChart | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("nodes, edges, zones")
      .eq("empresa_slug", empresaSlug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      nodes: (data.nodes ?? []) as OrgNode[],
      edges: (data.edges ?? []) as OrgEdge[],
      zones: (data.zones ?? []) as AreaZone[],
    };
  } catch (err) {
    console.error("[organigrama] getOrganigrama:", err);
    return null;
  }
}

export interface EstructuraEtiquetas {
  /** UPPER(nombre departamento) → puestos de ese departamento. */
  puestosPorDepto: Record<string, string[]>;
  /** Nombres de departamento reales en MAYÚSCULAS (para distinguir cajas). */
  departamentos: string[];
}

/**
 * Etiquetas reales de la estructura para pintar el organigrama: nombres de
 * departamento (para distinguir qué cajas son departamentos) y los puestos de
 * cada uno (para el desplegable). Todo en MAYÚSCULAS para casar con las cajas.
 */
export async function getEstructuraEtiquetas(
  empresaId: string,
): Promise<EstructuraEtiquetas> {
  try {
    const supabase = createAdminClient();
    const [{ data: puestos }, { data: deptos }] = await Promise.all([
      supabase
        .from("puestos")
        .select("nombre, estado, departamento:departamentos(nombre)")
        .eq("empresa_id", empresaId),
      supabase.from("departamentos").select("nombre").eq("empresa_id", empresaId),
    ]);

    const puestosPorDepto: Record<string, string[]> = {};
    for (const row of puestos ?? []) {
      const r = row as { nombre: string; estado: string | null; departamento: unknown };
      if ((r.estado ?? "") === "inactivo") continue;
      const depRel = r.departamento;
      const dep = (Array.isArray(depRel) ? depRel[0] : depRel) as { nombre?: string } | null;
      const key = (dep?.nombre ?? "").trim().toUpperCase();
      if (!key) continue;
      (puestosPorDepto[key] ??= []).push(r.nombre);
    }
    for (const k of Object.keys(puestosPorDepto)) {
      puestosPorDepto[k].sort((a, b) => a.localeCompare(b, "es"));
    }

    const departamentos = (deptos ?? [])
      .map((d) => ((d as { nombre?: string }).nombre ?? "").trim().toUpperCase())
      .filter(Boolean);

    return { puestosPorDepto, departamentos };
  } catch (err) {
    console.error("[organigrama] getEstructuraEtiquetas:", err);
    return { puestosPorDepto: {}, departamentos: [] };
  }
}

export async function getAllOrganigramas(): Promise<Record<string, OrgChart>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("empresa_slug, nodes, edges, zones");
    if (error) throw error;
    const result: Record<string, OrgChart> = {};
    for (const row of data ?? []) {
      result[row.empresa_slug] = {
        nodes: (row.nodes ?? []) as OrgNode[],
        edges: (row.edges ?? []) as OrgEdge[],
        zones: (row.zones ?? []) as AreaZone[],
      };
    }
    return result;
  } catch (err) {
    console.error("[organigrama] getAllOrganigramas:", err);
    return {};
  }
}

export async function saveOrganigrama(
  empresaSlug: string,
  chart: OrgChart,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).upsert({
      empresa_slug: empresaSlug,
      nodes: chart.nodes,
      edges: chart.edges,
      zones: chart.zones,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[organigrama] saveOrganigrama:", err);
    return { ok: false, error: msg };
  }
}
