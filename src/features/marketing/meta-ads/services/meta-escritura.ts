import "server-only";

import { metaPost } from "@/features/marketing/meta-ads/services/meta-client";
import type { MetaCredenciales } from "@/features/marketing/meta-ads/services/meta-credenciales";

/**
 * PRP-087 · Escribir en Meta: los tres niveles.
 *
 * Regla de oro: NADA nace activo. Todo se crea en `PAUSED` y activar es siempre
 * un acto aparte, explícito y consciente, porque gasta dinero real.
 */

export type EstadoMeta = "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";
export type NivelEscritura = "campana" | "conjunto" | "anuncio";

/** Cambia el estado de un elemento de cualquiera de los tres niveles. */
export async function cambiarEstado(
  cred: MetaCredenciales,
  metaId: string,
  estado: EstadoMeta,
): Promise<void> {
  await metaPost(`/${metaId}`, cred.accessToken, { status: estado });
}

/** Renombra un elemento. Lo mismo sirve para los tres niveles. */
export async function renombrar(
  cred: MetaCredenciales,
  metaId: string,
  nombre: string,
): Promise<void> {
  await metaPost(`/${metaId}`, cred.accessToken, { name: nombre });
}

/**
 * Cambia el presupuesto. Meta lo quiere en céntimos y NO admite los dos a la
 * vez: o diario o total, según cómo se creó el elemento.
 */
export async function cambiarPresupuesto(
  cred: MetaCredenciales,
  metaId: string,
  tipo: "diario" | "total",
  centimos: number,
): Promise<void> {
  const campo = tipo === "diario" ? "daily_budget" : "lifetime_budget";
  await metaPost(`/${metaId}`, cred.accessToken, { [campo]: String(Math.round(centimos)) });
}

// ─── Creación de los tres niveles ───────────────────────────────────

/**
 * Objetivos que ofrecemos, con el nombre que entiende Meta y el objetivo de
 * optimización que Meta acepta para cada uno.
 *
 * Esta correspondencia NO es decorativa: Meta rechaza la creación del conjunto
 * si el `optimization_goal` no es válido para el objetivo de la campaña, y el
 * mensaje de error que devuelve no ayuda nada.
 */
export const OBJETIVOS = {
  RECONOCIMIENTO: {
    etiqueta: "Que me conozcan",
    descripcion: "Llegar al máximo de gente posible.",
    metaObjective: "OUTCOME_AWARENESS",
    optimizationGoal: "REACH",
    billingEvent: "IMPRESSIONS",
  },
  TRAFICO: {
    etiqueta: "Visitas a la web",
    descripcion: "Llevar gente a la carta o a la página de reservas.",
    metaObjective: "OUTCOME_TRAFFIC",
    optimizationGoal: "LINK_CLICKS",
    billingEvent: "IMPRESSIONS",
  },
  INTERACCION: {
    etiqueta: "Interacción",
    descripcion: "Más me gusta, comentarios y mensajes.",
    metaObjective: "OUTCOME_ENGAGEMENT",
    optimizationGoal: "POST_ENGAGEMENT",
    billingEvent: "IMPRESSIONS",
  },
  CONTACTOS: {
    etiqueta: "Conseguir contactos",
    descripcion: "Que dejen su teléfono o correo.",
    metaObjective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    billingEvent: "IMPRESSIONS",
  },
  RESERVAS: {
    etiqueta: "Reservas y ventas",
    descripcion: "Que acaben reservando mesa.",
    metaObjective: "OUTCOME_SALES",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    billingEvent: "IMPRESSIONS",
  },
} as const;

export type ClaveObjetivo = keyof typeof OBJETIVOS;

/** Botones que se pueden poner en el anuncio, con su nombre en Meta. */
export const BOTONES = {
  RESERVAR: { etiqueta: "Reservar", metaCta: "BOOK_TRAVEL" },
  SABER_MAS: { etiqueta: "Más información", metaCta: "LEARN_MORE" },
  PEDIR: { etiqueta: "Pedir ahora", metaCta: "ORDER_NOW" },
  LLAMAR: { etiqueta: "Llamar", metaCta: "CALL_NOW" },
  CONTACTAR: { etiqueta: "Contactar", metaCta: "CONTACT_US" },
  VER_MENU: { etiqueta: "Ver menú", metaCta: "SEE_MENU" },
} as const;

export type ClaveBoton = keyof typeof BOTONES;

export interface CrearCampanaInput {
  nombre: string;
  objetivo: ClaveObjetivo;
  /** Si el presupuesto se lleva en la campaña; si no, va en el conjunto. */
  presupuestoDiarioCent?: number;
}

/** Crea la campaña (nivel 1). Siempre en pausa. */
export async function crearCampana(
  cred: MetaCredenciales,
  input: CrearCampanaInput,
): Promise<string> {
  const objetivo = OBJETIVOS[input.objetivo];
  const params: Record<string, unknown> = {
    name: input.nombre,
    objective: objetivo.metaObjective,
    status: "PAUSED",
    // Vacío = publicidad normal. Las categorías especiales (vivienda, empleo,
    // crédito, política) limitan la segmentación y no aplican a hostelería.
    special_ad_categories: [],
    buying_type: "AUCTION",
  };
  if (input.presupuestoDiarioCent) {
    params.daily_budget = String(Math.round(input.presupuestoDiarioCent));
  }

  const res = await metaPost<{ id?: string }>(
    `/${cred.adAccountId}/campaigns`,
    cred.accessToken,
    params,
  );
  if (!res.id) throw new Error("Meta no ha devuelto el identificador de la campaña.");
  return res.id;
}

export interface CrearConjuntoInput {
  nombre: string;
  campanaMetaId: string;
  objetivo: ClaveObjetivo;
  presupuestoDiarioCent?: number;
  presupuestoTotalCent?: number;
  edadMin: number;
  edadMax: number;
  genero: "todos" | "hombres" | "mujeres";
  /** Códigos de ciudad de Meta, o países como respaldo. */
  ciudades: string[];
  paises: string[];
  intereses: Array<{ id: string; name: string }>;
  /** Dónde sale: facebook, instagram, o ambos. */
  plataformas: string[];
  inicioIso?: string;
  finIso?: string;
}

/**
 * Crea el conjunto de anuncios (nivel 2): a quién, dónde y cuándo.
 * Aquí es donde se decide que el anuncio salga en Instagram.
 */
export async function crearConjunto(
  cred: MetaCredenciales,
  input: CrearConjuntoInput,
): Promise<string> {
  const objetivo = OBJETIVOS[input.objetivo];

  const geo: Record<string, unknown> = {};
  if (input.ciudades.length) geo.cities = input.ciudades.map((key) => ({ key }));
  if (input.paises.length) geo.countries = input.paises;
  // Sin ubicación no se puede anunciar; España como respaldo razonable.
  if (!input.ciudades.length && !input.paises.length) geo.countries = ["ES"];

  const targeting: Record<string, unknown> = {
    age_min: input.edadMin,
    age_max: input.edadMax,
    geo_locations: geo,
    publisher_platforms: input.plataformas,
  };
  // Meta usa 1 = hombres, 2 = mujeres. No mandar el campo significa "todos",
  // que no es lo mismo que mandar [1,2] en algunas combinaciones.
  if (input.genero === "hombres") targeting.genders = [1];
  if (input.genero === "mujeres") targeting.genders = [2];
  if (input.intereses.length) {
    targeting.flexible_spec = [{ interests: input.intereses }];
  }

  const params: Record<string, unknown> = {
    name: input.nombre,
    campaign_id: input.campanaMetaId,
    billing_event: objetivo.billingEvent,
    optimization_goal: objetivo.optimizationGoal,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    status: "PAUSED",
  };
  if (input.presupuestoDiarioCent) params.daily_budget = String(Math.round(input.presupuestoDiarioCent));
  if (input.presupuestoTotalCent) params.lifetime_budget = String(Math.round(input.presupuestoTotalCent));
  if (input.inicioIso) params.start_time = input.inicioIso;
  if (input.finIso) params.end_time = input.finIso;

  // Un presupuesto total sin fecha de fin lo rechaza Meta, y el mensaje que
  // devuelve no lo explica.
  if (input.presupuestoTotalCent && !input.finIso) {
    throw new Error("Con presupuesto total hay que poner fecha de fin.");
  }

  const res = await metaPost<{ id?: string }>(
    `/${cred.adAccountId}/adsets`,
    cred.accessToken,
    params,
  );
  if (!res.id) throw new Error("Meta no ha devuelto el identificador del conjunto.");
  return res.id;
}

export interface TarjetaCarrusel {
  imageHash: string;
  titular: string;
  descripcion?: string;
  enlace: string;
}

export interface CrearAnuncioInput {
  nombre: string;
  conjuntoMetaId: string;
  texto: string;
  titular: string;
  descripcion?: string;
  enlace: string;
  boton: ClaveBoton;
  formato: "imagen" | "video" | "carrusel";
  /** Imagen suelta */
  imageHash?: string;
  /** Vídeo (con su miniatura, que Meta exige) */
  videoId?: string;
  miniaturaHash?: string;
  /** Carrusel: de 2 a 10 tarjetas */
  tarjetas?: TarjetaCarrusel[];
}

/**
 * Crea la creatividad y el anuncio (nivel 3). Siempre en pausa.
 *
 * `instagram_actor_id` solo se manda si la empresa lo tiene: si la página no
 * tiene Instagram vinculado y se manda vacío, Meta rechaza la creatividad.
 */
export async function crearAnuncio(
  cred: MetaCredenciales,
  input: CrearAnuncioInput,
): Promise<{ anuncioId: string; creatividadId: string }> {
  const cta = {
    type: BOTONES[input.boton].metaCta,
    value: { link: input.enlace },
  };

  const storySpec: Record<string, unknown> = { page_id: cred.pageId };
  if (cred.instagramActorId) storySpec.instagram_actor_id = cred.instagramActorId;

  if (input.formato === "carrusel") {
    const tarjetas = input.tarjetas ?? [];
    if (tarjetas.length < 2 || tarjetas.length > 10) {
      throw new Error("Un carrusel necesita entre 2 y 10 imágenes.");
    }
    storySpec.link_data = {
      message: input.texto,
      link: input.enlace,
      child_attachments: tarjetas.map((t) => ({
        image_hash: t.imageHash,
        name: t.titular,
        description: t.descripcion ?? "",
        link: t.enlace || input.enlace,
        call_to_action: cta,
      })),
      // Deja que Meta ponga delante la tarjeta que mejor funcione.
      multi_share_optimized: true,
    };
  } else if (input.formato === "video") {
    if (!input.videoId) throw new Error("Falta el vídeo del anuncio.");
    storySpec.video_data = {
      video_id: input.videoId,
      message: input.texto,
      title: input.titular,
      link_description: input.descripcion ?? "",
      call_to_action: { ...cta, value: { link: input.enlace } },
      ...(input.miniaturaHash ? { image_hash: input.miniaturaHash } : {}),
    };
  } else {
    if (!input.imageHash) throw new Error("Falta la imagen del anuncio.");
    storySpec.link_data = {
      message: input.texto,
      link: input.enlace,
      name: input.titular,
      description: input.descripcion ?? "",
      image_hash: input.imageHash,
      call_to_action: cta,
    };
  }

  const creatividad = await metaPost<{ id?: string }>(
    `/${cred.adAccountId}/adcreatives`,
    cred.accessToken,
    { name: `${input.nombre} — creatividad`, object_story_spec: storySpec },
  );
  if (!creatividad.id) throw new Error("Meta no ha podido crear la creatividad del anuncio.");

  const anuncio = await metaPost<{ id?: string }>(
    `/${cred.adAccountId}/ads`,
    cred.accessToken,
    {
      name: input.nombre,
      adset_id: input.conjuntoMetaId,
      creative: { creative_id: creatividad.id },
      status: "PAUSED",
    },
  );
  if (!anuncio.id) throw new Error("Meta no ha devuelto el identificador del anuncio.");

  return { anuncioId: anuncio.id, creatividadId: creatividad.id };
}
