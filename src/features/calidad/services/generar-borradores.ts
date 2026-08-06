/**
 * Generación de borradores de respuesta con IA, sin depender de la sesión.
 *
 * Las server actions de `agentes-ia-actions.ts` resuelven la empresa desde la
 * cookie del usuario logueado, así que el cron diario (que corre sin sesión)
 * no podía generar borradores: sincronizaba las reseñas nuevas y las dejaba
 * sin responder hasta que alguien entraba a la pantalla.
 *
 * Aquí la lógica recibe `supabase` y `empresaId` como parámetros, de modo que
 * sirve igual para el cron (service role) y para las actions (sesión).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generarRespuestaConAgente } from "@/features/calidad/lib/gemini-respuestas";
import {
  agenteAplicaAResena,
  TIPO_RESENA_OPCIONES,
  type AgenteIA,
  type Resena,
} from "@/features/calidad/types/resenas";

export interface GenerarBorradorResult {
  ok: boolean;
  error?: string;
  texto?: string;
}

export interface GenerarBorradoresPendientesResult {
  ok: boolean;
  generados: number;
  saltados: number;
  error?: string;
}

/** Máximo de reseñas que se procesan en una sola tanda. */
const LIMITE_TANDA = 100;

/**
 * Selecciona el agente más específico aplicable a la reseña.
 * Si varios agentes matchean, gana el de rango de estrellas más estrecho.
 */
export function elegirAgenteParaResena(
  agentes: AgenteIA[],
  resena: Resena,
): AgenteIA | null {
  const aplicables = agentes.filter((a) => agenteAplicaAResena(a, resena));
  if (aplicables.length === 0) return null;
  return aplicables.sort((a, b) => {
    const spanA =
      TIPO_RESENA_OPCIONES.find((t) => t.key === a.tipo_resena)?.ratings
        .length ?? 99;
    const spanB =
      TIPO_RESENA_OPCIONES.find((t) => t.key === b.tipo_resena)?.ratings
        .length ?? 99;
    return spanA - spanB;
  })[0];
}

async function listAgentesActivos(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<AgenteIA[]> {
  const { data, error } = await supabase
    .from("resenas_agentes_ia")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[borradores] listar agentes:", error.message);
    return [];
  }
  return (data ?? []) as AgenteIA[];
}

async function contarBorradoresHoy(
  supabase: SupabaseClient,
  empresaId: string,
  agenteId: string,
): Promise<number> {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("resenas")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("agente_id", agenteId)
    .gte("respuesta_borrador_at", hoy.toISOString());
  return count ?? 0;
}

async function getEmpresaNombre(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<string> {
  const { data: empresa } = await supabase
    .from("empresas")
    .select("nombre, datos_generales")
    .eq("id", empresaId)
    .maybeSingle();
  const dg = ((empresa?.datos_generales as Record<string, unknown> | null) ??
    {}) as Record<string, unknown>;
  return (
    ((dg.nombreComercial as string | undefined) ||
      (empresa?.nombre as string | undefined) ||
      "").trim() || "Nuestro restaurante"
  );
}

/**
 * Genera el borrador de UNA reseña. `agentesPrecargados` y `empresaNombre`
 * evitan repetir las mismas consultas en cada vuelta del bucle.
 */
export async function generarBorradorParaResena(
  supabase: SupabaseClient,
  empresaId: string,
  resenaId: string,
  agentesPrecargados?: AgenteIA[],
  empresaNombrePrecargado?: string,
): Promise<GenerarBorradorResult> {
  try {
    const { data: resena } = await supabase
      .from("resenas")
      .select("*")
      .eq("id", resenaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (!resena) return { ok: false, error: "Reseña no encontrada" };

    const agentes =
      agentesPrecargados ?? (await listAgentesActivos(supabase, empresaId));
    const agente = elegirAgenteParaResena(agentes, resena as Resena);
    if (!agente) {
      return {
        ok: false,
        error:
          "No hay agente IA activo que cubra esta reseña. Crea uno desde 'Agentes IA'.",
      };
    }

    const usadasHoy = await contarBorradoresHoy(supabase, empresaId, agente.id);
    if (usadasHoy >= agente.max_dia) {
      return {
        ok: false,
        error: `El agente "${agente.nombre}" alcanzó su límite diario (${agente.max_dia}). Espera a mañana o sube el límite.`,
      };
    }

    const empresaNombre =
      empresaNombrePrecargado ??
      (await getEmpresaNombre(supabase, empresaId));

    const generada = await generarRespuestaConAgente({
      agente,
      resena: resena as Resena,
      empresaNombre,
    });

    const { error: errUpd } = await supabase
      .from("resenas")
      .update({
        respuesta_propietario: generada.texto,
        respuesta_borrador_at: new Date().toISOString(),
        agente_id: agente.id,
        // Reset publicada si la regeneramos
        respuesta_publicada_at: null,
        respondida: false,
      })
      .eq("id", resenaId);
    if (errUpd) throw errUpd;

    return { ok: true, texto: generada.texto };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

/**
 * Genera borradores para todas las reseñas de la empresa que aún no tienen
 * uno. Respeta los límites diarios de cada agente.
 */
export async function generarBorradoresPendientesForEmpresa(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<GenerarBorradoresPendientesResult> {
  try {
    const { data: pendientes } = await supabase
      .from("resenas")
      .select("id")
      .eq("empresa_id", empresaId)
      .is("respuesta_borrador_at", null)
      .order("created_at", { ascending: false })
      .limit(LIMITE_TANDA);

    if (!pendientes || pendientes.length === 0) {
      return { ok: true, generados: 0, saltados: 0 };
    }

    // Se cargan una sola vez para toda la tanda.
    const agentes = await listAgentesActivos(supabase, empresaId);
    if (agentes.length === 0) {
      return {
        ok: true,
        generados: 0,
        saltados: pendientes.length,
      };
    }
    const empresaNombre = await getEmpresaNombre(supabase, empresaId);

    let generados = 0;
    let saltados = 0;
    for (const p of pendientes) {
      const res = await generarBorradorParaResena(
        supabase,
        empresaId,
        (p as { id: string }).id,
        agentes,
        empresaNombre,
      );
      if (res.ok) generados++;
      else saltados++;
    }
    return { ok: true, generados, saltados };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, generados: 0, saltados: 0, error: msg };
  }
}
