// ─── Tipos de campañas ──────────────────────────────────────────

export type CanalCampana = "email" | "whatsapp" | "sms" | "meta" | "google";
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

// ─── Tipos compartidos PRP-046 ──────────────────────────────────

export type RecurrenciaCampana = "una_vez" | "diaria" | "semanal" | "mensual";

// ── A quién se le manda una campaña ─────────────────────────────
//
// El segmento se evalúa contra la ficha del cliente. Cada condición es un dato
// que ya está en su ficha: no hay listas que mantener a mano, así que un cliente
// entra o sale del segmento solo, según lo que hace.

export type SegmentoOperador = "AND" | "OR";

export type SegmentoCondicion =
  // ── Cómo de cliente es ──
  | { tipo: "clasificacion"; valores: Array<"REGULAR" | "VIP" | "NUEVO"> }
  | { tipo: "visitas_min"; min: number }
  | { tipo: "visitas_max"; max: number }
  // ── Cuándo vino ──
  | { tipo: "ultima_visita_hace_dias"; max: number }
  | { tipo: "sin_visitar_desde_dias"; min: number }
  | { tipo: "ultima_visita_antes"; fecha: string }
  | { tipo: "ultima_visita_despues"; fecha: string }
  // ── Desde cuándo es cliente ──
  | { tipo: "alta_antes"; fecha: string }
  | { tipo: "alta_despues"; fecha: string }
  // ── Etiquetas de su ficha ──
  | { tipo: "etiquetas"; etiquetaIds: string[]; modo: "alguna" | "todas" }
  // ── Lo que opina ──
  | { tipo: "valoracion_min"; min: number }
  | { tipo: "valoracion_max"; max: number }
  | { tipo: "ha_valorado"; valor: boolean }
  // ── Su cumpleaños ──
  | { tipo: "cumple_mes"; meses: number[] }
  | { tipo: "cumple_en_dias"; dias: number }
  // ── Cómo se porta ──
  | { tipo: "no_shows_max"; max: number }
  | { tipo: "cancelaciones_max"; max: number };

export type TipoSegmentoCondicion = SegmentoCondicion["tipo"];

export interface SegmentoJson {
  operador: SegmentoOperador;
  condiciones: SegmentoCondicion[];
  /**
   * Escribir SOLO a quien dio permiso comercial en el canal de la campaña.
   *
   * Nace encendido y es lo que debe quedarse: el permiso es lo que separa una
   * campaña de un correo no deseado, y apagarlo manda publicidad a quien nunca
   * la pidió —con lo que eso significa ante la ley y ante el filtro de spam,
   * que acaba tirando también las confirmaciones de reserva—. Se puede apagar
   * porque el negocio es quien responde de sus envíos, no el software; pero se
   * apaga a sabiendas.
   *
   * `undefined` en las campañas viejas se lee como ENCENDIDO.
   */
  soloConPermiso?: boolean;
}

/** Cómo se lee el permiso de una campaña guardada antes de que existiera. */
export function exigePermiso(segmento: SegmentoJson | null | undefined): boolean {
  return segmento?.soloConPermiso !== false;
}

/** Reglas de la campaña de cumpleaños. Viajan con ella en los tres canales. */
export interface ReglasCumpleanosCampana {
  diasAntes: number;
  diasValidezDespues: number;
  minimoPersonas: number;
}

export interface CamposComunesPRP046 {
  /**
   * De qué seed salió la campaña (EMAIL_ENERO, CUMPLEANOS…), o null si la
   * escribió una persona. Es común a los tres canales porque la de cumpleaños
   * existe en los tres, y es lo que impide dispararla a mano.
   */
  claveSeed: string | null;
  /** Solo en la de cumpleaños. En el resto, null. */
  reglasCumpleanos: ReglasCumpleanosCampana | null;
  // Atribución
  reservaLinkId: string | null;
  // Recurrencia (null = una vez)
  recurrenciaCron: string | null;
  // Segmento dinámico
  segmentoJson: SegmentoJson;
  // Adjuntos
  mediaUrls: string[];
  // Tracking
  ultimaEjecucion: string | null;
}

const SEGMENTO_VACIO: SegmentoJson = {
  operador: "AND",
  condiciones: [],
  soloConPermiso: true,
};

function camposComunesVacios(): CamposComunesPRP046 {
  return {
    claveSeed: null,
    reglasCumpleanos: null,
    reservaLinkId: null,
    recurrenciaCron: null,
    segmentoJson: SEGMENTO_VACIO,
    mediaUrls: [],
    ultimaEjecucion: null,
  };
}

// ─── Campaña Email ──────────────────────────────────────────────
export interface CampanaEmail extends CamposComunesPRP046 {
  id: string;
  canal: "email";
  empresaId: string;
  nombre: string;
  asunto: string;
  remitenteNombre: string;
  remitenteEmail: string;
  cuerpoHtml: string;
  /** Línea de vista previa que Gmail enseña junto al asunto. */
  preheader: string;
  /** 1-12. Solo en las campañas del calendario anual. */
  mes: number | null;
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
export interface CampanaWhatsApp extends CamposComunesPRP046 {
  id: string;
  canal: "whatsapp";
  empresaId: string;
  nombre: string;
  plantilla: string;
  idioma: string;
  cuerpo: string;
  variables: Record<string, string>;
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

// ─── Campaña SMS ────────────────────────────────────────────────
export interface CampanaSms extends CamposComunesPRP046 {
  id: string;
  canal: "sms";
  empresaId: string;
  nombre: string;
  cuerpo: string; // máx 160 caracteres recomendado
  remitente: string; // sender ID (alfanumérico hasta 11 car. en España)
  fechaEnvio: string | null;
  estado: EstadoCampana;
  estadisticas: {
    enviados: number;
    entregados: number;
    fallidos: number;
    clicks: number;
  };
  createdAt: string;
  updatedAt: string;
}

// El canal Meta ya NO vive aquí. La publicidad de Facebook e Instagram tiene
// tres niveles (campaña → conjunto → anuncio) y no cabe en este modelo plano
// de un solo bloque: se fue a `features/marketing/meta-ads` con su propio
// espejo de la cuenta publicitaria (PRP-087).

export type Campana = CampanaEmail | CampanaWhatsApp | CampanaSms;

// ─── Helpers ────────────────────────────────────────────────────

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
    preheader: "",
    // Una campaña creada a mano no pertenece al calendario anual ni, por tanto,
    // a ningún concurso: eso solo lo trae el seed (ver `claveSeed`, que
    // `camposComunesVacios` deja en null).
    mes: null,
    fechaEnvio: null,
    estado: "borrador",
    estadisticas: { enviados: 0, entregados: 0, abiertos: 0, clicks: 0, rebotes: 0, bajas: 0 },
    createdAt: now,
    updatedAt: now,
    ...camposComunesVacios(),
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
    fechaEnvio: null,
    estado: "borrador",
    estadisticas: { enviados: 0, entregados: 0, leidos: 0, respuestas: 0, fallidos: 0 },
    createdAt: now,
    updatedAt: now,
    ...camposComunesVacios(),
  };
}

export function crearCampanaSmsVacia(empresaId: string): CampanaSms {
  const now = new Date().toISOString();
  return {
    id: `sms-${Date.now()}`,
    canal: "sms",
    empresaId,
    nombre: "",
    cuerpo: "",
    remitente: "",
    fechaEnvio: null,
    estado: "borrador",
    estadisticas: { enviados: 0, entregados: 0, fallidos: 0, clicks: 0 },
    createdAt: now,
    updatedAt: now,
    ...camposComunesVacios(),
  };
}

