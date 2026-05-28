import type { SupabaseClient } from "@supabase/supabase-js";
import type { SegmentoJson, SegmentoCondicion } from "@/features/marketing/data/campanas";

/**
 * Construye filtros sobre `clientes_sala` a partir del AST de segmento.
 *
 * Operador AND: encadenamos `.eq/.gte/.lt/.in` directamente.
 * Operador OR: usamos `.or(...)` con cláusula PostgREST string-encoded.
 *
 * Aprendizaje: nunca extraer `ReturnType<SupabaseClient["from"]>` para reutilizar
 * un query builder entre funciones — `.from()` devuelve QueryBuilder pero el
 * `.select()` lo convierte en FilterBuilder y los tipos no encajan. Mejor
 * construir la query localmente en cada función.
 */

function diasISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function condicionAOrString(c: SegmentoCondicion): string | null {
  switch (c.tipo) {
    case "ultima_visita_hace_dias":
      return `ultima_visita.gte.${diasISO(c.max)}`;
    case "sin_visitar_desde_dias":
      return `ultima_visita.lt.${diasISO(c.min)}`;
    case "clasificacion":
      if (!c.valores.length) return null;
      return `clasificacion.in.(${c.valores.join(",")})`;
    case "visitas_min":
      return `visitas.gte.${c.min}`;
  }
}

// FilterBuilder mínimo que necesitamos (evita acoplarnos a tipos internos del SDK).
type FB = {
  eq: (col: string, v: unknown) => FB;
  gte: (col: string, v: unknown) => FB;
  lt: (col: string, v: unknown) => FB;
  in: (col: string, v: unknown[]) => FB;
  or: (filters: string) => FB;
};

function aplicarAnd(q: FB, condiciones: SegmentoCondicion[]): FB {
  let cur = q;
  for (const c of condiciones) {
    switch (c.tipo) {
      case "ultima_visita_hace_dias":
        cur = cur.gte("ultima_visita", diasISO(c.max));
        break;
      case "sin_visitar_desde_dias":
        cur = cur.lt("ultima_visita", diasISO(c.min));
        break;
      case "clasificacion":
        if (c.valores.length) cur = cur.in("clasificacion", c.valores);
        break;
      case "visitas_min":
        cur = cur.gte("visitas", c.min);
        break;
    }
  }
  return cur;
}

export async function contarSegmento(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson,
): Promise<number> {
  const base = supabase
    .from("clientes_sala")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId) as unknown as FB;

  let q: FB;
  if (!segmento.condiciones.length) {
    q = base;
  } else if (segmento.operador === "AND") {
    q = aplicarAnd(base, segmento.condiciones);
  } else {
    const ors = segmento.condiciones.map(condicionAOrString).filter(Boolean) as string[];
    q = ors.length ? base.or(ors.join(",")) : base;
  }

  const { count } = await (q as unknown as { count: Promise<number> } & PromiseLike<{ count: number | null }>);
  return count ?? 0;
}

export async function clienteIdsDelSegmento(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson,
): Promise<Array<{ id: string; email: string | null; telefono: string | null }>> {
  const base = supabase
    .from("clientes_sala")
    .select("id, email, telefono")
    .eq("empresa_id", empresaId) as unknown as FB;

  let q: FB;
  if (!segmento.condiciones.length) {
    q = base;
  } else if (segmento.operador === "AND") {
    q = aplicarAnd(base, segmento.condiciones);
  } else {
    const ors = segmento.condiciones.map(condicionAOrString).filter(Boolean) as string[];
    q = ors.length ? base.or(ors.join(",")) : base;
  }

  const { data, error } = await (q as unknown as PromiseLike<{ data: unknown; error: unknown }>);
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; email: string | null; telefono: string | null }>;
}
