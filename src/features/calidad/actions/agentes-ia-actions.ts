"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { generarRespuestaConAgente } from "@/features/calidad/lib/gemini-respuestas";
import {
  agenteAplicaAResena,
  TIPO_RESENA_OPCIONES,
  type AgenteIA,
  type FuenteConfig,
  type IdiomaAgente,
  type Resena,
  type TipoResenaConfig,
  type TonoAgente,
} from "@/features/calidad/types/resenas";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

// ─── CRUD agentes ──────────────────────────────────────────────

export async function listAgentesIA(): Promise<AgenteIA[]> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("resenas_agentes_ia")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[agentes-ia] list:", error.message);
    return [];
  }
  return (data ?? []) as AgenteIA[];
}

export interface CrearAgenteInput {
  nombre: string;
  instrucciones: string;
  tonos: TonoAgente[];
  idioma: IdiomaAgente;
  tipo_resena: TipoResenaConfig;
  fuente: FuenteConfig;
  pie_pagina?: string | null;
  max_dia?: number;
  activo?: boolean;
}

export async function crearAgenteIA(input: CrearAgenteInput) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const tonos = (input.tonos ?? []).slice(0, 2);
    const { data, error } = await supabase
      .from("resenas_agentes_ia")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre.trim(),
        instrucciones: input.instrucciones.trim(),
        tonos,
        idioma: input.idioma,
        tipo_resena: input.tipo_resena,
        fuente: input.fuente,
        pie_pagina: input.pie_pagina?.trim() || null,
        max_dia: input.max_dia ?? 50,
        activo: input.activo ?? true,
        creado_por: user?.id ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/calidad/resenas");
    return { ok: true as const, data: data as AgenteIA };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}

export async function actualizarAgenteIA(
  id: string,
  input: Partial<CrearAgenteInput>,
) {
  try {
    const { supabase } = await getContext();
    const patch: Record<string, unknown> = {};
    if (input.nombre !== undefined) patch.nombre = input.nombre.trim();
    if (input.instrucciones !== undefined)
      patch.instrucciones = input.instrucciones.trim();
    if (input.tonos !== undefined) patch.tonos = input.tonos.slice(0, 2);
    if (input.idioma !== undefined) patch.idioma = input.idioma;
    if (input.tipo_resena !== undefined) patch.tipo_resena = input.tipo_resena;
    if (input.fuente !== undefined) patch.fuente = input.fuente;
    if (input.pie_pagina !== undefined)
      patch.pie_pagina = input.pie_pagina?.trim() || null;
    if (input.max_dia !== undefined) patch.max_dia = input.max_dia;
    if (input.activo !== undefined) patch.activo = input.activo;

    const { error } = await supabase
      .from("resenas_agentes_ia")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/calidad/resenas");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}

export async function eliminarAgenteIA(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("resenas_agentes_ia")
      .delete()
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/calidad/resenas");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}

/**
 * Crea 2 agentes con configuración estándar para empezar:
 * uno para reseñas 3★+, otro para 2★-.
 */
export async function crearAgentesPrincipiantes() {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const plantillas: CrearAgenteInput[] = [
      {
        nombre: "3 o más estrellas",
        instrucciones:
          "Agradece de forma específica algo que mencione el cliente. Si nos dejan menos de 5 estrellas, pregunta qué podemos mejorar para la próxima visita.",
        tonos: ["cordial", "agradecido"],
        idioma: "dinamico",
        tipo_resena: "3_o_mas",
        fuente: "google",
        max_dia: 50,
        activo: true,
      },
      {
        nombre: "2 o menos estrellas",
        instrucciones:
          "Reconoce el problema, no te pongas a la defensiva. Ofrece resolverlo: invita al cliente a contactar con dirección por teléfono o email para arreglar la situación.",
        tonos: ["empatico", "orientado_soluciones"],
        idioma: "dinamico",
        tipo_resena: "2_o_menos",
        fuente: "google",
        max_dia: 50,
        activo: true,
      },
    ];

    const inserts = plantillas.map((p) => ({
      empresa_id: empresaId,
      nombre: p.nombre,
      instrucciones: p.instrucciones,
      tonos: p.tonos,
      idioma: p.idioma,
      tipo_resena: p.tipo_resena,
      fuente: p.fuente,
      pie_pagina: null,
      max_dia: p.max_dia,
      activo: p.activo,
      creado_por: user?.id ?? null,
    }));

    const { error } = await supabase
      .from("resenas_agentes_ia")
      .insert(inserts);
    if (error) throw error;
    revalidatePath("/calidad/resenas");
    return { ok: true as const, created: inserts.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}

// ─── Generación de borradores ──────────────────────────────────

/**
 * Selecciona el agente más específico aplicable a la reseña.
 * Si varios agentes matchean, gana el de rango más estrecho.
 */
function elegirAgenteParaResena(
  agentes: AgenteIA[],
  resena: Resena,
): AgenteIA | null {
  const aplicables = agentes.filter((a) => agenteAplicaAResena(a, resena));
  if (aplicables.length === 0) return null;
  // Cuanto menor el span de ratings, más específico.
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

async function contarBorradoresHoy(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

export interface GenerarBorradorResult {
  ok: boolean;
  error?: string;
  texto?: string;
}

export async function generarBorradorResena(
  resenaId: string,
): Promise<GenerarBorradorResult> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const [{ data: resena }, agentes, { data: empresa }] = await Promise.all([
      supabase
        .from("resenas")
        .select("*")
        .eq("id", resenaId)
        .maybeSingle(),
      listAgentesIA(),
      supabase
        .from("empresas")
        .select("nombre, datos_generales")
        .eq("id", empresaId)
        .maybeSingle(),
    ]);

    if (!resena) return { ok: false, error: "Reseña no encontrada" };

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

    const dg =
      ((empresa?.datos_generales as Record<string, unknown> | null) ?? {}) as
        Record<string, unknown>;
    const empresaNombre =
      ((dg.nombreComercial as string | undefined) || (empresa?.nombre as string | undefined) || "")
        .trim() || "Nuestro restaurante";

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

    revalidatePath("/calidad/resenas");
    return { ok: true, texto: generada.texto };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

/**
 * Genera borradores para todas las reseñas SIN borrador en cola. Respeta
 * los límites diarios. Se usa al sincronizar y desde un botón "Generar
 * todos los borradores pendientes".
 */
export async function generarBorradoresPendientes(): Promise<{
  ok: boolean;
  generados: number;
  saltados: number;
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId)
      return { ok: false, generados: 0, saltados: 0, error: "No autenticado" };

    const { data: pendientes } = await supabase
      .from("resenas")
      .select("id")
      .eq("empresa_id", empresaId)
      .is("respuesta_borrador_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!pendientes || pendientes.length === 0) {
      return { ok: true, generados: 0, saltados: 0 };
    }

    let generados = 0;
    let saltados = 0;
    for (const p of pendientes) {
      const res = await generarBorradorResena((p as { id: string }).id);
      if (res.ok) generados++;
      else saltados++;
    }
    return { ok: true, generados, saltados };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, generados: 0, saltados: 0, error: msg };
  }
}

export async function marcarComoPublicada(resenaId: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("resenas")
      .update({
        respuesta_publicada_at: new Date().toISOString(),
        respondida: true,
      })
      .eq("id", resenaId);
    if (error) throw error;
    revalidatePath("/calidad/resenas");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}

export async function desmarcarComoPublicada(resenaId: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("resenas")
      .update({ respuesta_publicada_at: null, respondida: false })
      .eq("id", resenaId);
    if (error) throw error;
    revalidatePath("/calidad/resenas");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}
