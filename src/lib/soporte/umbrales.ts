/**
 * Hasta dónde se parece una pregunta a lo que el software sabe.
 *
 * Son distancias de coseno del motor de embeddings (`gte-small`, 384 dims):
 * 0 es idéntico y cuanto más alto, menos tiene que ver. Los números NO son
 * inventados, salen de medir preguntas reales contra el manual ya indexado:
 *
 *   DEL software  ("cómo veo mi nómina", "cómo monto un escandallo",
 *                  "cómo doy de baja a alguien"):           0,05 – 0,13
 *   De FUERA      ("la capital de Francia", "un chiste",
 *                  "cómo se hace una paella"):              0,13 – 0,17
 *
 * Las dos nubes se tocan, así que NINGÚN corte acierta siempre. Lo importante
 * es que de esto no depende qué información se enseña —eso lo decide el candado
 * de módulos, que es exacto— sino solo qué mensaje educado se da cuando no
 * sabemos responder.
 */

/**
 * Por debajo de esto, el material recuperado se considera que viene al caso y
 * se le pasa al asistente.
 *
 * Que pase el corte no garantiza que responda: el asistente lee el material y,
 * si no contesta a lo que le preguntan, lo dice. Ahí la duda acaba igualmente en
 * la lista de lo que falta por explicar. Este umbral solo evita llamar (y
 * gastar) cuando está claro que no hay nada que leer.
 */
export const UMBRAL_RELEVANTE = 0.135;

/**
 * Por encima de esto, la pregunta no se parece a NADA del software: se contesta
 * que no es información de la empresa. Por debajo se asume que sí lo es pero que
 * todavía no está escrito, y se apunta para que Dirección lo explique.
 *
 * Está deliberadamente ALTO, por encima del punto donde mejor separan las dos
 * nubes. Equivocarse hacia "lo revisaremos y se añadirá" no cuesta nada: aparece
 * una línea en la lista de Dirección que se descarta de un clic. Equivocarse
 * hacia "eso no es información de la empresa" sí cuesta: le suelta esa frase a
 * alguien que preguntaba algo legítimo de su trabajo.
 *
 * El caso que lo fijó: "¿cuánta propina me toca del bote de esta semana?" mide
 * 0,135. Es una pregunta de la empresa como una casa, y con el corte pegado a
 * los datos se la despachaba como si preguntara por el tiempo.
 */
export const UMBRAL_AJENO = 0.155;
