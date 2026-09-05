/**
 * Tipos del submódulo Página Web (PRP-029).
 * Espejo de las tablas paginas_web, paginas_web_dominios,
 * paginas_web_versiones y leads_web.
 */

export type PaginaWebTipo = "WEB_PRINCIPAL" | "ONE_PAGE";
export type PaginaWebEstado = "BORRADOR" | "PUBLICADA" | "ARCHIVADA";
export type DominioEstado = "PENDIENTE_DNS" | "VERIFICADO" | "ERROR";

export const BLOQUE_TIPOS = [
  "hero",
  "galeria",
  "menu",
  "reservas",
  "tickets",
  "testimonios",
  "cta",
  "formulario",
  "mapa",
  "footer",
  "texto_libre",
  "video",
  "bolsa_inspectores",
  "redes",
  "collage_carta",
  "premios",
  "historia",
  "instagram",
] as const;

export type BloqueTipo = (typeof BLOQUE_TIPOS)[number];

export interface BloqueBase {
  id: string;
  tipo: BloqueTipo;
  orden: number;
  visible: boolean;
}

export interface HeroDatos {
  /** Vídeo de fondo (mp4). Manda sobre `foto_url`, que queda de cartel. */
  video_url?: string;
  titulo: string;
  subtitulo?: string;
  cta?: { label: string; href: string };
  foto_url?: string;
  overlay?: number;
}

export interface GaleriaDatos {
  imagenes: Array<{ url: string; alt: string }>;
  layout: "grid" | "masonry" | "carrusel";
}

export interface MenuDatos {
  fuente: "carta_items" | "manual";
  categoria_ids?: string[];
  items_manual?: Array<{ nombre: string; precio: number; descripcion?: string }>;
}

/**
 * Bloque de Tickets: el cliente compra y paga en la propia web.
 *
 * Va APARTE del de reservas, aunque puedan convivir en la misma página: una
 * cosa es reservar mesa y otra comprar una experiencia por adelantado. Los
 * productos se configuran en Sala → Reservas → Tickets, y aquí solo se elige
 * cómo se presentan.
 */
export interface TicketsDatos {
  titulo?: string;
  subtitulo?: string;
  /**
   * Productos a mostrar. Vacío = todos los que estén activos y a la venta,
   * que es lo normal: así al crear uno nuevo aparece sin tocar la web.
   */
  productoIds?: string[];
}

export interface ReservasDatos {
  /**
   * `portal_propio` monta nuestro motor de reservas (/reservar/[slug]/embed),
   * con disponibilidad real. Es el modo a usar; `embed_cover` queda solo para
   * las empresas que aún no han migrado desde CoverManager.
   */
  modo: "portal_propio" | "embed_cover" | "formulario_propio" | "enlace_externo";
  url?: string;
  campos?: string[];
  /** Sin título se pinta el genérico "Reservas". */
  titulo?: string;
  subtitulo?: string;
}

export interface TestimoniosDatos {
  /** Sin título se pinta el genérico "Lo que dicen nuestros clientes". */
  titulo?: string;
  subtitulo?: string;
  /** Valoración global de Google, como cabecera de los testimonios. */
  rating?: string;
  rating_total?: string;
  rating_href?: string;
  items: Array<{ nombre: string; texto: string; estrellas?: number; foto_url?: string }>;
}

export interface CtaDatos {
  titulo: string;
  /** Fotos de fondo, difuminadas (p. ej. el equipo en "Únete a nosotros"). */
  fondo_imagenes?: Array<{ url: string; alt: string }>;
  texto?: string;
  boton: { label: string; href: string; variante: "primary" | "ghost" };
  /**
   * Foto de fondo, difuminada tras el texto. Sin ella la llamada a la acción
   * queda como un titular suelto sobre negro; con el equipo detrás se ve DÓNDE
   * se trabaja, que es lo que de verdad convence a quien busca empleo.
   */
  imagen_url?: string;
  /**
   * Altura del recorte de `imagen_url`, en % desde arriba (0-100). La sección
   * es una franja ancha: sin esto el recorte va al centro y corta las caras.
   * Se sube o se baja según dónde esté la gente en cada foto. Por defecto 30.
   */
  foco_y?: number;
}

export interface FormularioCampo {
  name: string;
  label: string;
  tipo: "text" | "email" | "tel" | "textarea";
  required: boolean;
}

export interface FormularioDatos {
  titulo: string;
  campos: FormularioCampo[];
  mensaje_exito: string;
}

export interface MapaDatos {
  lat: number;
  lng: number;
  zoom: number;
  direccion_texto: string;
}

export interface FooterColumna {
  titulo: string;
  items: Array<{ label: string; href: string }>;
}

export interface FooterDatos {
  columnas: FooterColumna[];
  redes?: Array<{ red: string; url: string }>;
  texto_legal?: string;
}

export interface TextoLibreDatos {
  html_seguro: string;
}

export interface VideoDatos {
  proveedor: "youtube" | "vimeo" | "url_directa";
  url: string;
  autoplay: boolean;
  muted: boolean;
}

export interface BolsaInspectoresDatos {
  titulo: string;
  descripcion?: string;
  cta_label: string;
}

/**
 * Redes sociales. Los enlaces NO se escriben aquí: se leen de
 * `empresas.datos_generales` (instagram / facebook / tiktok) en tiempo de
 * render, para que cambiar la red en Ajustes actualice la web sola.
 */
export interface RedesDatos {
  titulo: string;
  descripcion?: string;
}

export type Bloque =
  | (BloqueBase & { tipo: "hero"; datos: HeroDatos })
  | (BloqueBase & { tipo: "galeria"; datos: GaleriaDatos })
  | (BloqueBase & { tipo: "menu"; datos: MenuDatos })
  | (BloqueBase & { tipo: "reservas"; datos: ReservasDatos })
  | (BloqueBase & { tipo: "tickets"; datos: TicketsDatos })
  | (BloqueBase & { tipo: "testimonios"; datos: TestimoniosDatos })
  | (BloqueBase & { tipo: "cta"; datos: CtaDatos })
  | (BloqueBase & { tipo: "formulario"; datos: FormularioDatos })
  | (BloqueBase & { tipo: "mapa"; datos: MapaDatos })
  | (BloqueBase & { tipo: "footer"; datos: FooterDatos })
  | (BloqueBase & { tipo: "texto_libre"; datos: TextoLibreDatos })
  | (BloqueBase & { tipo: "video"; datos: VideoDatos })
  | (BloqueBase & { tipo: "bolsa_inspectores"; datos: BolsaInspectoresDatos })
  | (BloqueBase & { tipo: "redes"; datos: RedesDatos })
  | (BloqueBase & { tipo: "collage_carta"; datos: CollageCartaDatos })
  | (BloqueBase & { tipo: "premios"; datos: PremiosDatos })
  | (BloqueBase & { tipo: "historia"; datos: HistoriaDatos })
  | (BloqueBase & { tipo: "instagram"; datos: InstagramDatos });

export type BloqueDatos<T extends BloqueTipo> = Extract<Bloque, { tipo: T }>["datos"];

export interface SeoConfig {
  title?: string;
  description?: string;
  og_image?: string;
  robots?: string;
}

/**
 * Mosaico de fotos con la llamada a la carta encima.
 *
 * POR QUÉ NO SE INCRUSTA LA CARTA:
 * Son 124 platos en BACANAL y 133 en HABANA, con categorías y alérgenos.
 * Metidos en la portada, el visitante que viene a reservar se come un scroll
 * enorme antes de llegar al formulario. El collage vende con foto y manda a
 * /carta/[slug], que ya está hecha para leerse en el móvil.
 */
export interface CollageCartaDatos {
  titulo: string;
  frase?: string;
  cta_label: string;
  /** Vacío = usa las fotos de la galería de la propia página. */
  imagenes?: Array<{ url: string; alt: string }>;
}

/**
 * Reconocimientos externos (Restaurant Guru y equivalentes).
 *
 * Los datos se guardan en el bloque y NO se scrapean en cada carga: la web de
 * un tercero puede cambiar de maquetado o caerse, y no queremos que eso rompa
 * la portada ni que dependa de una petición externa para pintar.
 */
export interface PremiosDatos {
  titulo: string;
  frase?: string;
  /** Enlace a la ficha pública, para que el visitante pueda comprobarlo. */
  href?: string;
  items: Array<{
    /** Ej. "Best in the city" */
    nombre: string;
    /** Ej. "2025 · 2026" */
    anios: string;
    /** Ej. "Restaurant Guru" */
    fuente?: string;
    imagen_url?: string;
  }>;
}

/**
 * Nuestra historia: texto a un lado, foto al otro, con el año de apertura
 * destacado y la valoración de Google. Sustituye al `texto_libre`, que pintaba
 * un párrafo suelto sin jerarquía ni imagen.
 */
export interface HistoriaDatos {
  desde: string;
  titulo: string;
  parrafos: string[];
  imagen_url?: string;
  /** Valoración de Google: se muestra como prueba social junto a la historia. */
  rating?: string;
  rating_total?: string;
  rating_href?: string;
}

/**
 * Tarjeta de Instagram al estilo del propio perfil: avatar, arroba, tick de
 * verificado y seguidores. Un CTA de texto plano no transmite la comunidad que
 * hay detrás; el número sí.
 */
export interface InstagramDatos {
  usuario: string;
  titulo: string;
  frase?: string;
  seguidores?: string;
  publicaciones?: string;
  verificado?: boolean;
  avatar_url?: string;
  cta_label: string;
  /** Web que aparece bajo la bio, como el enlace del perfil real. */
  web?: string;
  /**
   * Historias destacadas (CÓCTELES, INFO, BRUNCH…). Sin ellas el perfil se ve
   * a medio hacer: en un perfil real de restaurante siempre hay varias.
   */
  destacados?: Array<{ nombre: string; imagen_url?: string }>;
  /** Fotos del feed dentro de la maqueta de móvil. Vacío = usa la galería. */
  feed?: Array<{ url: string; alt: string }>;
  /**
   * Captura REAL del perfil, tal cual se ve en el teléfono.
   *
   * Cuando está, la pantalla del móvil la muestra entera y se ignoran avatar,
   * contadores, destacados y feed: recomponer el perfil a mano nunca acaba de
   * parecerse al de verdad —los números se quedan viejos y las fotos no son las
   * que el cliente ve al entrar— y aquí lo que vende es que sea auténtico.
   */
  captura_url?: string;
}

export interface BrandingSnapshot {
  color_primario?: string;
  color_secundario?: string;
  color_fondo?: string;
  tipografia?: string;
  logo_url?: string;
}

export interface PaginaWeb {
  id: string;
  empresa_id: string;
  tipo: PaginaWebTipo;
  nombre: string;
  slug_interno: string;
  bloques: Bloque[];
  branding: BrandingSnapshot | null;
  seo: SeoConfig | null;
  estado: PaginaWebEstado;
  /**
   * Documento legal generado desde empresas.datos_generales (privacidad,
   * aviso legal, cookies). NULL = página normal, editable a mano.
   */
  legal_tipo: "privacidad" | "aviso_legal" | "cookies" | null;
  legal_generada_at: string | null;
  publicada_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginaWebDominio {
  id: string;
  empresa_id: string;
  pagina_id: string;
  hostname: string;
  es_principal: boolean;
  estado: DominioEstado;
  vercel_domain_id: string | null;
  dns_hint: DnsHint | null;
  ssl_activo: boolean;
  verificado_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DnsHint {
  tipo: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
}

export interface PaginaWebVersion {
  id: string;
  pagina_id: string;
  version: number;
  snapshot: {
    bloques: Bloque[];
    seo: SeoConfig | null;
    branding: BrandingSnapshot | null;
  };
  created_by: string | null;
  created_at: string;
}

export interface LeadWeb {
  id: string;
  empresa_id: string;
  pagina_id: string | null;
  bloque_id: string | null;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  mensaje: string | null;
  payload: Record<string, unknown>;
  utm: { source?: string; medium?: string; campaign?: string } | null;
  referrer: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  created_at: string;
}

export interface PaginaPublicaData {
  pagina: Pick<PaginaWeb, "id" | "empresa_id" | "nombre" | "bloques" | "branding" | "seo">;
  empresa: { id: string; nombre: string };
}
