// ─── Tipos de campañas ──────────────────────────────────────────

export type CanalCampana = "email" | "whatsapp" | "meta";
export type EstadoCampana =
  | "borrador"
  | "programada"
  | "activa"
  | "pausada"
  | "finalizada"
  | "fallida";

export const ESTADOS_CAMPANA: { value: EstadoCampana; label: string; color: string }[] = [
  { value: "borrador", label: "Borrador", color: "gray" },
  { value: "programada", label: "Programada", color: "blue" },
  { value: "activa", label: "Activa", color: "emerald" },
  { value: "pausada", label: "Pausada", color: "amber" },
  { value: "finalizada", label: "Finalizada", color: "default" },
  { value: "fallida", label: "Fallida", color: "red" },
];

// ─── Campaña Email ──────────────────────────────────────────────
export interface CampanaEmail {
  id: string;
  canal: "email";
  empresaId: string;
  nombre: string;
  asunto: string;
  remitenteNombre: string;
  remitenteEmail: string;
  cuerpoHtml: string;
  segmento: string; // "todos" | "vip" | "inactivos" | custom
  fechaEnvio: string | null;
  estado: EstadoCampana;
  estadisticas: {
    enviados: number;
    entregados: number;
    abiertos: number;
    clicks: number;
    rebotes: number;
    bajas: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Campaña WhatsApp ───────────────────────────────────────────
export interface CampanaWhatsApp {
  id: string;
  canal: "whatsapp";
  empresaId: string;
  nombre: string;
  plantilla: string; // nombre de la plantilla aprobada por WhatsApp
  idioma: string; // "es", "en"...
  cuerpo: string;
  variables: Record<string, string>; // mapeo {{1}} → valor
  segmento: string;
  fechaEnvio: string | null;
  estado: EstadoCampana;
  estadisticas: {
    enviados: number;
    entregados: number;
    leidos: number;
    respuestas: number;
    fallidos: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Campaña Meta (Facebook + Instagram Ads) ────────────────────
export type ObjetivoMeta =
  | "AWARENESS"
  | "TRAFFIC"
  | "ENGAGEMENT"
  | "LEADS"
  | "APP_PROMOTION"
  | "SALES";

export const OBJETIVOS_META: { value: ObjetivoMeta; label: string; descripcion: string }[] = [
  { value: "AWARENESS", label: "Notoriedad", descripcion: "Que más gente conozca tu marca" },
  { value: "TRAFFIC", label: "Tráfico", descripcion: "Llevar visitas a tu web o carta" },
  { value: "ENGAGEMENT", label: "Interacción", descripcion: "Más likes, comentarios y seguidores" },
  { value: "LEADS", label: "Leads / Reservas", descripcion: "Captar clientes potenciales" },
  { value: "SALES", label: "Ventas", descripcion: "Convertir anuncios en pedidos" },
  { value: "APP_PROMOTION", label: "Promoción de app", descripcion: "Instalaciones de app móvil" },
];

export interface CampanaMeta {
  id: string;
  canal: "meta";
  empresaId: string;
  nombre: string;
  objetivo: ObjetivoMeta;
  plataformas: ("facebook" | "instagram")[];
  presupuestoDiario: number; // en euros
  duracionDias: number;
  publicoObjetivo: {
    edadMin: number;
    edadMax: number;
    genero: "todos" | "hombre" | "mujer";
    ubicaciones: string[]; // ciudades / códigos postales
    intereses: string[];
  };
  creatividad: {
    titular: string;
    descripcion: string;
    textoPrincipal: string;
    imagenUrl: string;
    cta: "RESERVAR" | "SABER_MAS" | "PEDIR_AHORA" | "LLAMAR" | "CONTACTAR";
    urlDestino: string;
  };
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: EstadoCampana;
  // Meta API refs
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  metaAdId: string | null;
  metaSyncedAt: string | null;
  metaSyncError: string | null;
  estadisticas: {
    impresiones: number;
    alcance: number;
    clicks: number;
    ctr: number;
    cpc: number;
    gasto: number;
    conversiones: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type Campana = CampanaEmail | CampanaWhatsApp | CampanaMeta;

// ─── Helpers ────────────────────────────────────────────────────

export const CTA_META: { value: CampanaMeta["creatividad"]["cta"]; label: string }[] = [
  { value: "RESERVAR", label: "Reservar ahora" },
  { value: "SABER_MAS", label: "Saber más" },
  { value: "PEDIR_AHORA", label: "Pedir ahora" },
  { value: "LLAMAR", label: "Llamar" },
  { value: "CONTACTAR", label: "Contactar" },
];

export const SEGMENTOS_CLIENTE: { value: string; label: string }[] = [
  { value: "todos", label: "Todos los clientes" },
  { value: "vip", label: "Clientes VIP" },
  { value: "recurrentes", label: "Clientes recurrentes" },
  { value: "inactivos", label: "Clientes inactivos (30d+)" },
  { value: "nuevos", label: "Clientes nuevos" },
];

export function crearCampanaEmailVacia(empresaId: string): CampanaEmail {
  const now = new Date().toISOString();
  return {
    id: `em-${Date.now()}`,
    canal: "email",
    empresaId,
    nombre: "",
    asunto: "",
    remitenteNombre: "",
    remitenteEmail: "",
    cuerpoHtml: "",
    segmento: "todos",
    fechaEnvio: null,
    estado: "borrador",
    estadisticas: { enviados: 0, entregados: 0, abiertos: 0, clicks: 0, rebotes: 0, bajas: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

export function crearCampanaWhatsAppVacia(empresaId: string): CampanaWhatsApp {
  const now = new Date().toISOString();
  return {
    id: `wa-${Date.now()}`,
    canal: "whatsapp",
    empresaId,
    nombre: "",
    plantilla: "",
    idioma: "es",
    cuerpo: "",
    variables: {},
    segmento: "todos",
    fechaEnvio: null,
    estado: "borrador",
    estadisticas: { enviados: 0, entregados: 0, leidos: 0, respuestas: 0, fallidos: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

export function crearCampanaMetaVacia(empresaId: string): CampanaMeta {
  const now = new Date().toISOString();
  return {
    id: `me-${Date.now()}`,
    canal: "meta",
    empresaId,
    nombre: "",
    objetivo: "LEADS",
    plataformas: ["facebook", "instagram"],
    presupuestoDiario: 10,
    duracionDias: 7,
    publicoObjetivo: {
      edadMin: 25,
      edadMax: 55,
      genero: "todos",
      ubicaciones: [],
      intereses: [],
    },
    creatividad: {
      titular: "",
      descripcion: "",
      textoPrincipal: "",
      imagenUrl: "",
      cta: "RESERVAR",
      urlDestino: "",
    },
    fechaInicio: null,
    fechaFin: null,
    estado: "borrador",
    metaCampaignId: null,
    metaAdSetId: null,
    metaAdId: null,
    metaSyncedAt: null,
    metaSyncError: null,
    estadisticas: {
      impresiones: 0,
      alcance: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      gasto: 0,
      conversiones: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
}
