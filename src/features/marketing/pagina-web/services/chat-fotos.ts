/**
 * PRP-076 · Fase 2 — Colocar FOTOS por conversación.
 *
 * Misma regla de oro que los textos: la IA no devuelve bloques ni URLs. La foto
 * ya está subida (el navegador la sube al bucket antes de hablar con la IA), y
 * la IA solo decide UN destino de una lista cerrada. Aquí se valida ese destino
 * y se escribe la URL sobre los bloques reales.
 *
 * Así, lo peor que puede pasar es que una foto acabe en la sección equivocada,
 * y eso se deshace.
 */
import type { Bloque } from "../types";

/**
 * Destinos donde puede ir una foto, con el nombre que usa el cliente al
 * hablar. La IA elige una `clave`; nunca escribe rutas ni campos.
 */
export const DESTINOS_FOTO = [
  {
    clave: "portada",
    tipo: "hero" as const,
    etiqueta: "la portada",
    modo: "unica" as const,
    ayuda: "La imagen grande de arriba del todo, la primera que se ve.",
  },
  {
    clave: "carta",
    tipo: "collage_carta" as const,
    etiqueta: "la sección de la carta",
    modo: "lista" as const,
    ayuda: "La foto que acompaña a la llamada a ver la carta.",
  },
  {
    clave: "historia",
    tipo: "historia" as const,
    etiqueta: "nuestra historia",
    modo: "unica" as const,
    ayuda: "La foto que va junto al relato del local.",
  },
  {
    clave: "instagram",
    tipo: "instagram" as const,
    etiqueta: "el feed de Instagram",
    modo: "lista" as const,
    ayuda: "Las fotos que salen dentro del móvil de la sección de Instagram.",
  },
  {
    clave: "empleo",
    tipo: "cta" as const,
    etiqueta: "la llamada de empleo",
    modo: "unica" as const,
    ayuda: "El fondo de la sección para captar personal.",
  },
  {
    clave: "galeria",
    tipo: "galeria" as const,
    etiqueta: "la galería",
    modo: "lista" as const,
    ayuda: "Solo si la web tiene una galería de fotos.",
  },
] as const;

export type ClaveDestino = (typeof DESTINOS_FOTO)[number]["clave"];

/** Topes por sección: una lista sin límite acaba en un scroll infinito. */
const MAX_LISTA: Record<string, number> = {
  collage_carta: 12,
  instagram: 9,
  galeria: 60,
};

export interface FotoAColocar {
  url: string;
  alt: string;
  destino: string;
}

export interface ResultadoFotos {
  bloques: Bloque[];
  colocadas: Array<{ url: string; etiqueta: string }>;
  descartadas: Array<{ url: string; motivo: string }>;
}

/**
 * Destinos que EXISTEN en esta web, para ofrecérselos a la IA y al usuario.
 * Una web sin sección de Instagram no debe aceptar fotos "para Instagram".
 */
export function destinosDisponibles(bloques: Bloque[]) {
  return DESTINOS_FOTO.filter((d) => bloques.some((b) => b.tipo === d.tipo)).map((d) => ({
    clave: d.clave,
    etiqueta: d.etiqueta,
    ayuda: d.ayuda,
  }));
}

/**
 * Coloca las fotos ya subidas en el destino indicado.
 *
 * Descarta —informando— todo lo que no cuadre: destino desconocido, sección que
 * esta web no tiene, url que no es del bucket, o sección ya llena. Nunca lanza.
 */
export function colocarFotos(
  bloques: Bloque[],
  fotos: FotoAColocar[],
  urlsPermitidas: Set<string>,
): ResultadoFotos {
  const colocadas: ResultadoFotos["colocadas"] = [];
  const descartadas: ResultadoFotos["descartadas"] = [];
  let nuevos = [...bloques];

  for (const foto of fotos) {
    // La URL tiene que ser una de las que ACABA de subir este usuario en esta
    // petición. Si no, la IA podría colar cualquier dirección de internet en la
    // web (una imagen ajena, o un rastreador).
    if (!urlsPermitidas.has(foto.url)) {
      descartadas.push({ url: foto.url, motivo: "Esa imagen no se ha subido aquí" });
      continue;
    }

    const destino = DESTINOS_FOTO.find((d) => d.clave === foto.destino);
    if (!destino) {
      descartadas.push({ url: foto.url, motivo: "No sé en qué parte de la web ponerla" });
      continue;
    }

    const idx = nuevos.findIndex((b) => b.tipo === destino.tipo);
    if (idx === -1) {
      descartadas.push({
        url: foto.url,
        motivo: `Esta web no tiene ${destino.etiqueta}`,
      });
      continue;
    }

    const bloque = nuevos[idx];
    const datos = { ...(bloque.datos as unknown as Record<string, unknown>) };

    if (destino.modo === "unica") {
      // Campo distinto según la sección: el hero usa `foto_url`, el resto
      // `imagen_url`. Se escribe el que corresponde, no los dos.
      datos[bloque.tipo === "hero" ? "foto_url" : "imagen_url"] = foto.url;
    } else {
      const campo = bloque.tipo === "instagram" ? "feed" : "imagenes";
      const actuales = Array.isArray(datos[campo])
        ? (datos[campo] as Array<{ url: string; alt: string }>)
        : [];
      const tope = MAX_LISTA[bloque.tipo] ?? 60;
      if (actuales.length >= tope) {
        descartadas.push({
          url: foto.url,
          motivo: `${destino.etiqueta} ya tiene el máximo de fotos (${tope})`,
        });
        continue;
      }
      datos[campo] = [...actuales, { url: foto.url, alt: foto.alt || "" }];
    }

    nuevos = nuevos.map((b, i) => (i === idx ? ({ ...b, datos } as unknown as Bloque) : b));
    colocadas.push({ url: foto.url, etiqueta: destino.etiqueta });
  }

  return { bloques: nuevos, colocadas, descartadas };
}
