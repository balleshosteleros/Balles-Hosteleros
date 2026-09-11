import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Huecos de conocimiento: lo que la gente pregunta y el software NO sabe.
 *
 * Es la pieza que hace que esto se alimente solo. Cuando el asistente no puede
 * responder, la pregunta no se pierde: se apunta aquí, sumando a un hueco que ya
 * exista si es la misma duda dicha con otras palabras. Dirección escribe el
 * artículo UNA vez y a partir de ahí el asistente ya sabe contestarla, y la
 * pregunta acaba publicándose sola en las preguntas frecuentes.
 *
 * Por empresa, como todo lo que nace de lo que pregunta la gente.
 */

/** Dos preguntas por debajo de esta distancia son la misma duda. */
const MISMA_DUDA = 0.1;

export async function apuntarHueco(opts: {
  empresaId: string | null;
  pregunta: string;
  embedding: number[] | null;
  moduloProbable: string | null;
  consultaId: string | null;
}): Promise<void> {
  if (!opts.empresaId || !opts.embedding || !opts.pregunta.trim()) return;

  try {
    const admin = createAdminClient();
    const embLiteral = JSON.stringify(opts.embedding);

    const { data: parecido } = await admin.rpc("buscar_hueco_parecido", {
      query_embedding: embLiteral,
      p_empresa_id: opts.empresaId,
      max_distancia: MISMA_DUDA,
    });

    const existente = (parecido ?? [])[0] as { id: string } | undefined;

    if (existente) {
      // Ya lo habían preguntado: sube el contador en vez de duplicar la fila.
      const { data: fila } = await admin
        .from("soporte_huecos")
        .select("veces_preguntada, consultas_ids")
        .eq("id", existente.id)
        .single();

      const ids = ((fila?.consultas_ids as string[] | null) ?? []).slice(0, 200);
      if (opts.consultaId) ids.push(opts.consultaId);

      await admin
        .from("soporte_huecos")
        .update({
          veces_preguntada: ((fila?.veces_preguntada as number) ?? 1) + 1,
          consultas_ids: ids,
        })
        .eq("id", existente.id);
      return;
    }

    await admin.from("soporte_huecos").insert({
      empresa_id: opts.empresaId,
      pregunta: opts.pregunta.slice(0, 500),
      veces_preguntada: 1,
      consultas_ids: opts.consultaId ? [opts.consultaId] : [],
      embedding: embLiteral,
      modulo_probable: opts.moduloProbable,
      estado: "abierto",
    });
  } catch (e) {
    // Nunca debe romper la respuesta al empleado.
    console.error("[soporte_huecos]", e);
  }
}
