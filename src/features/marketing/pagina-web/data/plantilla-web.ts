/**
 * PATRÓN ÚNICO DE WEB — plantilla base para cualquier empresa nueva.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO:
 * Hasta ahora una web nueva nacía vacía y había que montarla bloque a bloque,
 * así que cada empresa acababa con un orden distinto. Aquí se fija el orden
 * canónico y los textos de arranque, para que toda empresa nueva empiece con
 * la misma estructura y solo tenga que cambiar SU contenido.
 *
 * EL CONTENIDO ES FICTICIO A PROPÓSITO:
 * No se copia nada de BACANAL ni de HABANA. El restaurante de ejemplo se llama
 * "La Sobremesa" y no existe. Así nadie hereda por error las reseñas, las
 * fotos, la historia ni los premios de otro local, que además sería falso
 * publicarlos. Todo lo que hay aquí es un andamio para sustituir.
 *
 * ORDEN CANÓNICO Y SU PORQUÉ (recorrido de conversión):
 *   1. hero           — engancha y ofrece reservar de entrada
 *   2. collage_carta  — lo primero que quiere ver el visitante: qué se come
 *   3. testimonios    — prueba social JUSTO ANTES de pedir el paso
 *   4. reservas       — el formulario, ya con la confianza construida
 *   5. historia       — quién eres, para quien sigue bajando
 *   6. instagram      — vida real y actual del local
 *   7. cta            — empleo; fuera ya del embudo de cliente
 *   8. premios        — refuerzo final de autoridad
 *   9. mapa           — la dirección, para quien ya decidió venir
 *  10. footer         — cierre, enlaces y legal
 *
 * NO SE INCLUYE `galeria`: el collage ya enseña fotos con una llamada a la
 * carta, y un grid suelto encima solo alargaba el scroll antes del formulario.
 */
import type { Bloque } from "../types";

/** Marcador de foto pendiente: el editor y el chat lo tratan como "sin imagen". */
export const FOTO_PENDIENTE = "";

/** Textos de ejemplo del restaurante ficticio, para reconocerlos de un vistazo. */
export const RESTAURANTE_EJEMPLO = "La Sobremesa";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Devuelve los bloques del patrón, ya ordenados y con ids nuevos.
 *
 * @param nombreEmpresa Nombre real de la empresa. Se usa en los textos para que
 *   el borrador no hable de un restaurante que no es el suyo. Sin él se queda
 *   el nombre ficticio, que es una señal clara de "esto hay que cambiarlo".
 * @param slugEmpresa Slug de la empresa: enlaza los portales propios (carta y
 *   empleo). Sin él esos botones se quedan sin destino y no se pintan.
 */
export function crearBloquesPlantilla(nombreEmpresa?: string, slugEmpresa?: string): Bloque[] {
  const marca = nombreEmpresa?.trim() || RESTAURANTE_EJEMPLO;
  const slug = slugEmpresa?.trim() ?? "";

  const bloques: Array<Omit<Bloque, "id" | "orden">> = [
    {
      tipo: "hero",
      visible: true,
      datos: {
        titulo: `Cocina de siempre, servida como hoy`,
        subtitulo: `Bienvenido a ${marca}`,
        cta: { label: "Reservar mesa", href: "#reservas" },
        foto_url: FOTO_PENDIENTE,
        overlay: 0.45,
      },
    },
    {
      tipo: "collage_carta",
      visible: true,
      datos: {
        titulo: "Descubre nuestra carta",
        frase:
          "Producto de temporada y recetas para compartir, pensadas para disfrutar sin prisa.",
        cta_label: "Ver la carta",
        imagenes: [],
      },
    },
    {
      tipo: "testimonios",
      visible: true,
      datos: {
        titulo: "Lo que dicen nuestros clientes",
        // Vacío a propósito: las reseñas se añaden desde el editor con las
        // reales del local. Inventar testimonios sería publicar algo falso.
        items: [],
      },
    },
    {
      tipo: "reservas",
      visible: true,
      datos: {
        modo: "portal_propio",
        titulo: "Reserva tu mesa",
        subtitulo: "Elige día y hora; te confirmamos al momento.",
      },
    },
    {
      tipo: "historia",
      visible: true,
      datos: {
        desde: "",
        titulo: "Nuestra historia",
        parrafos: [
          `Cuenta aquí cómo empezó ${marca}: quién está detrás, qué os mueve y qué encontrará quien cruce la puerta.`,
          "Un segundo párrafo para hablar del producto, del equipo o del barrio. Dos o tres frases bastan.",
        ],
        imagen_url: FOTO_PENDIENTE,
      },
    },
    {
      tipo: "instagram",
      visible: true,
      datos: {
        usuario: "",
        titulo: "Síguenos en Instagram",
        frase: "Cada día, lo que pasa dentro del local.",
        cta_label: "Seguir",
        verificado: false,
        feed: [],
      },
    },
    {
      tipo: "cta",
      visible: true,
      datos: {
        titulo: "Aquí tu talento se nota",
        texto: `Únete al equipo de ${marca}`,
        // Al portal de empleo, no a un ancla de esta página: las ofertas viven
        // en /empleo/[slug]. El slug real lo pone `crearPagina` al crear la web.
        boton: {
          label: "Ver ofertas de empleo",
          href: slug ? `/empleo?o=WEB` : "",
          variante: "primary",
        },
        imagen_url: FOTO_PENDIENTE,
      },
    },
    {
      tipo: "premios",
      visible: true,
      datos: {
        titulo: "Reconocimientos",
        frase: "El reconocimiento de quienes nos visitan.",
        // Sin items: los premios se añaden cuando el local los tenga de verdad.
        items: [],
      },
    },
    {
      tipo: "mapa",
      visible: true,
      datos: {
        lat: 40.4168,
        lng: -3.7038,
        zoom: 16,
        direccion_texto: "Escribe aquí la dirección del local",
      },
    },
    {
      tipo: "footer",
      visible: true,
      datos: {
        columnas: [
          {
            titulo: "Navegación",
            items: [
              { label: "Carta", href: slug ? `/carta` : "#carta" },
              { label: "Reservar", href: "#reservas" },
              ...(slug ? [{ label: "Empleo", href: `/empleo?o=WEB` }] : []),
            ],
          },
        ],
        redes: [],
      },
    },
  ];

  return bloques.map((b, i) => ({ ...b, id: uuid(), orden: i }) as Bloque);
}
