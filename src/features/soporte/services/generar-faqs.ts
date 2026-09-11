import "server-only";

import type { Schema } from "@google/generative-ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { geminiJSON, MODELO_REDACCION } from "@/lib/ia/gemini";

/**
 * Escribe las preguntas frecuentes solas, a partir de lo que la gente pregunta.
 *
 * Cómo funciona, por empresa y sin mezclarlas nunca:
 *   1. Coge las consultas de los últimos meses que el asistente SÍ supo
 *      responder. Las que no supo no son candidatas: no hay con qué redactarlas
 *      (esas van a `soporte_huecos`, la lista de trabajo de Dirección).
 *   2. Las agrupa por el ARTÍCULO del manual con el que se respondieron.
 *   3. Los grupos que se repiten lo suficiente se publican, ordenados por
 *      cuántas veces se preguntaron. Si ya hay una pregunta publicada de ese
 *      artículo, se le sube el contador y NO se vuelve a redactar: por eso el
 *      gasto no crece con el tiempo, aunque la gente siga preguntando.
 *   4. Solo los grupos NUEVOS pasan por la IA, una llamada cada uno, con las
 *      preguntas y el artículo. Redacta usando SOLO ese material.
 *
 * ⚠️ Se agrupa por artículo, no por parecido entre los textos de las preguntas.
 * Se probó lo segundo y no funciona: medido con preguntas reales, dos formas de
 * decir lo mismo llegan a 0,168 de distancia mientras que dos temas distintos
 * bajan a 0,125. No hay umbral que separe eso. En cambio, si a dos preguntas les
 * sirvió la misma explicación, son la misma duda — y ese dato ya está guardado.
 *
 * El módulo de la pregunta publicada es el del artículo. De ahí sale el candado:
 * una pregunta de nóminas nace etiquetada RECURSOS HUMANOS y no la ve quien no
 * tiene ese módulo.
 */

/** Ventana de consultas que se mira en cada pasada. */
const DIAS_VENTANA = 90;

/** A partir de cuántas veces preguntada se publica. */
const MINIMO_REPETICIONES = 3;

/**
 * Tope de redacciones por pasada y empresa. El freno de gasto general ya está,
 * pero esto evita que una avalancha de dudas nuevas se coma el mes de una vez.
 */
const MAX_REDACCIONES = 10;

/** Consultas que se traen como mucho. Supabase corta en 1000 de todos modos. */
const MAX_CONSULTAS = 1000;

const ESQUEMA: Schema = {
  type: "object",
  properties: {
    pregunta: { type: "string" },
    respuesta: { type: "string" },
  },
  required: ["pregunta", "respuesta"],
} as unknown as Schema;

const INSTRUCCION = `Escribes las preguntas frecuentes del software de gestión de Balles Hosteleros.

Te doy varias formas en que los trabajadores han preguntado LO MISMO, y el material del manual con el que se les respondió.

Tu trabajo:
- "pregunta": redacta UNA pregunta clara que resuma lo que preguntan todos, en lenguaje de quien pregunta, no de informático.
- "respuesta": contéstala con los pasos, en español claro y directo.

Reglas que NO puedes saltarte:
- Usa ÚNICA Y EXCLUSIVAMENTE el material que te paso. Es todo lo que sabes.
- PROHIBIDO añadir pasos, pantallas, botones o consejos que no estén en el material, por evidentes que te parezcan.
- PROHIBIDO usar conocimiento general o de internet.
- No menciones módulos ni pantallas que no salgan en el material.
- Nada de saludos ni despedidas: la respuesta empieza por lo que hay que hacer.`;

export interface ResultadoGeneracion {
  empresaId: string;
  consultas: number;
  grupos: number;
  publicadas: number;
  actualizadas: number;
  redacciones: number;
}

interface FilaConsulta {
  id: string;
  pregunta: string;
  chunks_usados: string[] | null;
}

interface Articulo {
  id: string;
  modulo: string;
  titulo: string;
  contenido: string;
}

interface Grupo {
  chunkId: string;
  articulo: Articulo;
  consultas: { id: string; pregunta: string }[];
}

/** Redacta una pregunta frecuente con el artículo que ya resolvió la duda. */
async function redactar(grupo: Grupo): Promise<{ pregunta: string; respuesta: string } | null> {
  const preguntas = grupo.consultas
    .slice(0, 12)
    .map((c) => `- ${c.pregunta}`)
    .join("\n");

  try {
    const { data } = await geminiJSON<{ pregunta: string; respuesta: string }>(
      `PREGUNTAS DE LOS TRABAJADORES (todas se resolvieron con el mismo material):\n${preguntas}\n\n` +
        `MATERIAL DEL MANUAL:\n### ${grupo.articulo.titulo}\n${grupo.articulo.contenido}`,
      {
        model: MODELO_REDACCION,
        systemInstruction: INSTRUCCION,
        responseSchema: ESQUEMA,
        temperature: 0.2,
        maxOutputTokens: 1200,
        feature: "ayuda.faq",
      },
    );
    const pregunta = data?.pregunta?.trim();
    const respuesta = data?.respuesta?.trim();
    if (!pregunta || !respuesta) return null;
    return { pregunta, respuesta };
  } catch (e) {
    // Sin cuota, sin clave o tope de gasto agotado: se deja para la próxima
    // pasada. Nunca debe tumbar el cron de las demás empresas.
    console.error("[ayuda.faq] redactar", e);
    return null;
  }
}

/** Genera las preguntas frecuentes de UNA empresa. */
export async function generarFaqsDeEmpresa(empresaId: string): Promise<ResultadoGeneracion> {
  const admin = createAdminClient();
  const vacio: ResultadoGeneracion = {
    empresaId,
    consultas: 0,
    grupos: 0,
    publicadas: 0,
    actualizadas: 0,
    redacciones: 0,
  };

  const desde = new Date(Date.now() - DIAS_VENTANA * 24 * 60 * 60 * 1000).toISOString();

  const { data: filas, error } = await admin
    .from("soporte_consultas")
    .select("id, pregunta, chunks_usados")
    .eq("empresa_id", empresaId)
    .eq("desenlace", "resuelta")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(MAX_CONSULTAS);

  if (error) {
    console.error("[ayuda.faq] leer consultas", error);
    return vacio;
  }

  const consultas = (filas ?? []) as FilaConsulta[];
  if (consultas.length === 0) return vacio;

  // Cada consulta cuenta para el artículo que MEJOR la resolvió, que es el
  // primero de la lista (la búsqueda los devuelve ordenados por cercanía).
  const porChunk = new Map<string, { id: string; pregunta: string }[]>();
  for (const c of consultas) {
    const principal = (c.chunks_usados ?? [])[0];
    if (!principal) continue;
    const arr = porChunk.get(principal) ?? [];
    arr.push({ id: c.id, pregunta: c.pregunta });
    porChunk.set(principal, arr);
  }

  const candidatos = [...porChunk.entries()].filter(
    ([, cs]) => cs.length >= MINIMO_REPETICIONES,
  );
  if (candidatos.length === 0) {
    return { ...vacio, consultas: consultas.length };
  }

  const { data: articulos } = await admin
    .from("soporte_conocimiento")
    .select("id, modulo, titulo, contenido")
    .in("id", candidatos.map(([id]) => id));

  const porId = new Map(
    ((articulos ?? []) as Articulo[]).map((a) => [a.id, a]),
  );

  const grupos: Grupo[] = candidatos
    .map(([chunkId, cs]) => {
      const articulo = porId.get(chunkId);
      // El artículo pudo desactivarse o borrarse desde que se respondió.
      if (!articulo) return null;
      return { chunkId, articulo, consultas: cs };
    })
    .filter((g): g is Grupo => g !== null)
    .sort((a, b) => b.consultas.length - a.consultas.length);

  // Qué hay ya publicado de cada artículo, para sumar en vez de duplicar.
  const { data: yaPublicadas } = await admin
    .from("soporte_faq")
    .select("id, chunk_principal, estado")
    .eq("empresa_id", empresaId)
    .in("chunk_principal", grupos.map((g) => g.chunkId));

  const publicadaPorChunk = new Map(
    ((yaPublicadas ?? []) as { id: string; chunk_principal: string; estado: string }[]).map(
      (f) => [f.chunk_principal, f],
    ),
  );

  let publicadas = 0;
  let actualizadas = 0;
  let redacciones = 0;

  for (const grupo of grupos) {
    const existente = publicadaPorChunk.get(grupo.chunkId);

    if (existente) {
      // Ya está escrita. Solo sube el contador — y si Dirección la archivó, se
      // respeta: archivar es una decisión, no un despiste que haya que corregir.
      await admin
        .from("soporte_faq")
        .update({
          veces_preguntada: grupo.consultas.length,
          consultas_ids: grupo.consultas.map((c) => c.id).slice(0, 200),
        })
        .eq("id", existente.id);
      actualizadas += 1;
      continue;
    }

    if (redacciones >= MAX_REDACCIONES) continue;

    const redactada = await redactar(grupo);
    redacciones += 1;
    if (!redactada) continue;

    const { error: insErr } = await admin.from("soporte_faq").insert({
      empresa_id: empresaId,
      modulo: grupo.articulo.modulo,
      pregunta: redactada.pregunta,
      respuesta: redactada.respuesta,
      veces_preguntada: grupo.consultas.length,
      consultas_ids: grupo.consultas.map((c) => c.id).slice(0, 200),
      chunks_usados: [grupo.chunkId],
      chunk_principal: grupo.chunkId,
      origen: "ia",
      estado: "publicada",
    });
    if (insErr) {
      console.error("[ayuda.faq] insertar", insErr);
      continue;
    }
    publicadas += 1;
  }

  return {
    empresaId,
    consultas: consultas.length,
    grupos: grupos.length,
    publicadas,
    actualizadas,
    redacciones,
  };
}

/** Genera las preguntas frecuentes de todas las empresas, una por una. */
export async function generarFaqsTodasLasEmpresas(): Promise<ResultadoGeneracion[]> {
  const admin = createAdminClient();
  const { data: empresas } = await admin.from("empresas").select("id, nombre");

  const out: ResultadoGeneracion[] = [];
  for (const e of (empresas ?? []) as { id: string; nombre: string }[]) {
    try {
      out.push(await generarFaqsDeEmpresa(e.id));
    } catch (err) {
      console.error(`[ayuda.faq] empresa ${e.nombre}`, err);
    }
  }
  return out;
}
