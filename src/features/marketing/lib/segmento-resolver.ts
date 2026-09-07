import type { SupabaseClient } from "@supabase/supabase-js";
import type { SegmentoJson, SegmentoCondicion } from "@/features/marketing/data/campanas";
import {
  COLUMNAS_PERMISO,
  ALCANCE_POR_DEFECTO,
  type AlcanceCampana,
  type CanalPublicidad,
} from "./permiso-publicidad";

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

/**
 * Destinatarios REALES de una campaña, para el canal y el alcance elegidos.
 *
 * Cuatro cosas que `clienteIdsDelSegmento` no hace y aquí son obligatorias:
 *
 *  1. **Permiso del canal.** Cada canal lleva su casilla: el sí del correo no
 *     autoriza un WhatsApp. Con alcance "solo los que lo aceptan" entran los que
 *     dijeron que sí; con "todos menos las bajas" entran también aquellos a los
 *     que nunca se preguntó.
 *  2. **Las bajas, fuera siempre.** Quien pidió no recibir más no entra con
 *     ningún alcance. No es una opción que se pueda activar.
 *  3. **Paginado.** PostgREST corta en 1.000 filas. Sin paginar, una campaña a
 *     seis mil clientes salía a mil y parecía enviada entera.
 *  4. **Sin duplicados.** El mismo correo en dos fichas —pasa: el cliente
 *     reservó con dos teléfonos— recibiría el mensaje dos veces.
 */
export async function destinatariosDeCampana(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson,
  canal: CanalPublicidad = "email",
  alcance: AlcanceCampana = ALCANCE_POR_DEFECTO,
): Promise<Array<{ id: string; email: string }>> {
  const PAGINA = 1000;
  const cols = COLUMNAS_PERMISO[canal];
  const salida: Array<{ id: string; email: string }> = [];
  const vistos = new Set<string>();

  for (let desde = 0; ; desde += PAGINA) {
    let base = supabase
      .from("clientes_sala")
      .select(`id, ${cols.contacto}`)
      .eq("empresa_id", empresaId)
      // La baja es innegociable, mande el alcance lo que mande.
      .is(cols.bajaAt, null)
      .not(cols.contacto, "is", null);

    if (alcance === "con_permiso") base = base.eq(cols.acepta, true);

    const paginada = base.order("id").range(desde, desde + PAGINA - 1) as unknown as FB;

    let q: FB;
    if (!segmento.condiciones.length) {
      q = paginada;
    } else if (segmento.operador === "AND") {
      q = aplicarAnd(paginada, segmento.condiciones);
    } else {
      const ors = segmento.condiciones.map(condicionAOrString).filter(Boolean) as string[];
      q = ors.length ? paginada.or(ors.join(",")) : paginada;
    }

    const { data, error } = await (q as unknown as PromiseLike<{
      data: Array<Record<string, unknown>> | null;
      error: unknown;
    }>);
    if (error) throw error;

    const lote = data ?? [];
    for (const c of lote) {
      const contacto = String(c[cols.contacto] ?? "").trim().toLowerCase();
      if (!contacto || vistos.has(contacto)) continue;
      vistos.add(contacto);
      salida.push({ id: String(c.id), email: contacto });
    }

    if (lote.length < PAGINA) break;
  }

  return salida;
}

/**
 * Destinatarios de una campaña de WHATSAPP.
 *
 * Mismas tres reglas que el correo —consentimiento, paginado y sin repetidos—,
 * pero sobre el teléfono y el permiso de WhatsApp, que es otro distinto: quien
 * autorizó correos no autorizó que le escriban al móvil.
 */
export async function destinatariosWhatsAppDeCampana(
  supabase: SupabaseClient,
  empresaId: string,
  segmento: SegmentoJson,
): Promise<Array<{ id: string; telefono: string }>> {
  const PAGINA = 1000;
  const salida: Array<{ id: string; telefono: string }> = [];
  const vistos = new Set<string>();

  for (let desde = 0; ; desde += PAGINA) {
    const base = supabase
      .from("clientes_sala")
      .select("id, telefono")
      .eq("empresa_id", empresaId)
      .eq("acepta_marketing_whatsapp", true)
      .not("telefono", "is", null)
      .order("id")
      .range(desde, desde + PAGINA - 1) as unknown as FB;

    let q: FB;
    if (!segmento.condiciones.length) {
      q = base;
    } else if (segmento.operador === "AND") {
      q = aplicarAnd(base, segmento.condiciones);
    } else {
      const ors = segmento.condiciones.map(condicionAOrString).filter(Boolean) as string[];
      q = ors.length ? base.or(ors.join(",")) : base;
    }

    const { data, error } = await (q as unknown as PromiseLike<{
      data: Array<{ id: string; telefono: string | null }> | null;
      error: unknown;
    }>);
    if (error) throw error;

    const lote = data ?? [];
    for (const c of lote) {
      const telefono = (c.telefono ?? "").replace(/\s+/g, "");
      if (!telefono || vistos.has(telefono)) continue;
      vistos.add(telefono);
      salida.push({ id: c.id, telefono });
    }

    if (lote.length < PAGINA) break;
  }

  return salida;
}
