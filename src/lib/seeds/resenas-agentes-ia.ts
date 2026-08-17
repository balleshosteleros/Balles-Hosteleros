/**
 * Seed canónico de AGENTES IA DE RESEÑAS.
 *
 * Un agente define CÓMO contesta la IA a una reseña: a qué rango de estrellas
 * aplica, con qué tono, en qué idioma y con qué pie de página. Sin agentes, la
 * IA no redacta nada — mira la reseña, no encuentra quién la cubra y la salta.
 * Ese era el motivo real de que BACANAL y HABANA tuvieran 22 reseñas sin
 * contestar: el motor estaba bien, pero no había ningún agente creado.
 *
 * ORIGEN: réplica 1:1 de la configuración que Iván ya tenía funcionando en
 * GoHighLevel (Reputación → Reviews AI), con 441 + 111 respuestas enviadas.
 * Se copian sus instrucciones literales para que el software responda igual
 * que venía respondiendo GHL y la migración no cambie la voz del restaurante.
 *
 * DOS agentes, no tres: cubren el rango completo sin solaparse.
 *   - "3 o mas"   → 3, 4 y 5 estrellas
 *   - "2 o menos" → 1 y 2 estrellas
 *
 * Cualquier cambio aquí se propaga a TODAS las empresas existentes vía
 * `syncSeedsToAllEmpresas()` (modo aditivo: solo crea los nombres que falten,
 * NO sobreescribe los que el cliente ya tenga personalizados) y se aplica a
 * las empresas nuevas vía `seedEmpresaDefaults()`.
 */

import type {
  FuenteConfig,
  IdiomaAgente,
  TipoResenaConfig,
  TonoAgente,
} from "@/features/calidad/types/resenas";

export interface ResenaAgenteIaSeed {
  nombre: string;
  instrucciones: string;
  tonos: TonoAgente[];
  idioma: IdiomaAgente;
  tipo_resena: TipoResenaConfig;
  fuente: FuenteConfig;
  pie_pagina: string | null;
  max_dia: number;
}

export const RESENAS_AGENTES_IA_SEED: ResenaAgenteIaSeed[] = [
  {
    // Positivas y neutras. Instrucciones literales de GHL.
    nombre: "3 o mas",
    instrucciones:
      "Recibirá reseñas de una empresa. Su tarea es generar una respuesta " +
      "adecuada. Esta respuesta se utilizará directamente en un entorno " +
      "empresarial real. No haga preguntas adicionales. No incluya ningún " +
      "saludo al final de la respuesta. Mantenga la respuesta en menos de " +
      "cinco oraciones. Despidete del cliente agradecidamente.",
    tonos: ["cordial"],
    idioma: "dinamico",
    tipo_resena: "3_o_mas",
    fuente: "google",
    pie_pagina: null,
    max_dia: 50,
  },
  {
    // Negativas. Las tres reglas duras (no devolver dinero, no comprometer
    // decisiones propias, no firmar con nombre) son de Iván y evitan que la
    // IA prometa en público algo que luego hay que sostener.
    nombre: "2 o menos",
    instrucciones:
      "Quiero que contestes reseñas negativas y que seas muy empatico y " +
      "pidas disculpas por todo lo que digan en la reseña. Es super " +
      "importante que nunca ofrezcas DEVOLUCION del dinero por una mala " +
      "reseña, nunca comprometas decisiones tuyas y valoraciones tuyas para " +
      "dar una solucion al cliente.\n\n" +
      "no incluyas tu nombre puesto o empresa en la reseña",
    tonos: ["cordial"],
    idioma: "dinamico",
    tipo_resena: "2_o_menos",
    fuente: "google",
    // Pie literal de GHL, confirmado por Iván (17-ago-2026). Se respeta tal
    // cual lo tiene escrito, incluidas sus expresiones: es la voz con la que
    // el restaurante lleva años contestando.
    pie_pagina:
      "Nos gustaria hablar con tigo desde el departamento de calidad, donde " +
      "intentamos mejorar y darte solucion por tu mala experiencia, nos puedes " +
      "escribir a : calidad.grupobacanal@gmail.com.\n" +
      "Muchas gracias, que tengas un buen dia.",
    max_dia: 50,
  },
];

export function normalizeAgenteIaNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}
