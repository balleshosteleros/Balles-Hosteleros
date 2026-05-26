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
  "testimonios",
  "cta",
  "formulario",
  "mapa",
  "footer",
  "texto_libre",
  "video",
  "bolsa_inspectores",
] as const;

export type BloqueTipo = (typeof BLOQUE_TIPOS)[number];

export interface BloqueBase {
  id: string;
  tipo: BloqueTipo;
  orden: number;
  visible: boolean;
}

export interface HeroDatos {
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

export interface ReservasDatos {
  modo: "embed_cover" | "formulario_propio" | "enlace_externo";
  url?: string;
  campos?: string[];
}

export interface TestimoniosDatos {
  items: Array<{ nombre: string; texto: string; estrellas?: number; foto_url?: string }>;
}

export interface CtaDatos {
  titulo: string;
  texto?: string;
  boton: { label: string; href: string; variante: "primary" | "ghost" };
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

export type Bloque =
  | (BloqueBase & { tipo: "hero"; datos: HeroDatos })
  | (BloqueBase & { tipo: "galeria"; datos: GaleriaDatos })
  | (BloqueBase & { tipo: "menu"; datos: MenuDatos })
  | (BloqueBase & { tipo: "reservas"; datos: ReservasDatos })
  | (BloqueBase & { tipo: "testimonios"; datos: TestimoniosDatos })
  | (BloqueBase & { tipo: "cta"; datos: CtaDatos })
  | (BloqueBase & { tipo: "formulario"; datos: FormularioDatos })
  | (BloqueBase & { tipo: "mapa"; datos: MapaDatos })
  | (BloqueBase & { tipo: "footer"; datos: FooterDatos })
  | (BloqueBase & { tipo: "texto_libre"; datos: TextoLibreDatos })
  | (BloqueBase & { tipo: "video"; datos: VideoDatos })
  | (BloqueBase & { tipo: "bolsa_inspectores"; datos: BolsaInspectoresDatos });

export type BloqueDatos<T extends BloqueTipo> = Extract<Bloque, { tipo: T }>["datos"];

export interface SeoConfig {
  title?: string;
  description?: string;
  og_image?: string;
  robots?: string;
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
