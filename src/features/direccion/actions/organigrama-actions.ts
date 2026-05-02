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
