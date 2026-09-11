import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Apunta cada pregunta que se le hace al asistente.
 *
 * Es la materia prima de las preguntas frecuentes: sin esto no hay nada que
 * agrupar y la ayuda no se escribe sola. Guardamos también la RESPUESTA que se
 * dio y el EMBEDDING de la pregunta — el embedding ya se calculó para poder
 * buscar, así que guardarlo sale gratis y evita recalcular 300 embeddings cada
 * vez que el motor agrupa.
 *
 * ⚠️ La empresa es la ACTIVA (la del selector de arriba), no la de la ficha del
 * usuario. Antes se usaba `usuarios.empresa_id` y, como quien probaba el chat no
 * tenía empresa en su ficha, la consulta no se guardaba NUNCA: la tabla llevaba
 * meses vacía sin que fallara nada a la vista. Además, a quien trabaja en dos
 * empresas le habría archivado las preguntas en la empresa equivocada.
 */

export type Desenlace = "resuelta" | "escalada" | "sin_datos" | "ajena";

export interface ConsultaRegistrada {
  empresaId: string | null;
  userId: string;
  pregunta: string;
  respuesta: string;
  modulos: string[];
  chunksUsados: string[];
  embedding: number[] | null;
  desenlace: Desenlace;
}

/** Devuelve el id de la consulta guardada, o null si no se pudo guardar. */
export async function registrarConsulta(c: ConsultaRegistrada): Promise<string | null> {
  if (!c.empresaId) {
    // Sin empresa no hay dónde archivarla. Se avisa en vez de perderla en
    // silencio, que es justamente lo que pasaba antes.
    console.warn("[soporte] consulta sin empresa activa, no se registra:", c.pregunta.slice(0, 80));
    return null;
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("soporte_consultas")
      .insert({
        empresa_id: c.empresaId,
        user_id: c.userId,
        pregunta: c.pregunta.slice(0, 2000),
        respuesta: c.respuesta.slice(0, 8000),
        modulos_permitidos: c.modulos,
        chunks_usados: c.chunksUsados,
        escalo: c.desenlace === "escalada",
        desenlace: c.desenlace,
        embedding: c.embedding ? JSON.stringify(c.embedding) : null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[soporte_consultas] insert", error);
      return null;
    }
    return (data?.id as string) ?? null;
  } catch (e) {
    console.error("[soporte_consultas] insert", e);
    return null;
  }
}
