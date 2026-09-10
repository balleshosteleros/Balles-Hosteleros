/**
 * PRP-087 · Constantes y errores de la Marketing API de Meta.
 *
 * La versión de la Graph API se declara AQUÍ y en ningún otro sitio. Repartirla
 * por el código es cómo se acaba con media integración hablando v19 y la otra
 * media v23, y con fallos que solo salen en algunas llamadas.
 */

/** Versión única de la Graph API. Cambiar solo aquí. */
export const META_API_VERSION = "v23.0";

export const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Cookies temporales del baile de conexión. Viven aquí y no en las acciones
 * porque un archivo "use server" solo puede exportar funciones async.
 */
export const META_STATE_COOKIE = "meta_oauth_state";
export const META_EMPRESA_COOKIE = "meta_oauth_empresa";

/** Dónde vuelve Meta tras el "Conectar con Facebook". */
export const META_REDIRECT_PATH = "/api/integraciones/meta/callback";

/**
 * Permisos que pedimos al conectar.
 *  - ads_management / ads_read → leer y escribir campañas, conjuntos y anuncios
 *  - pages_show_list / pages_read_engagement → elegir la página del negocio
 *  - business_management → ver las cuentas publicitarias del Business Manager
 *  - instagram_basic → resolver la cuenta de Instagram vinculada a la página
 */
export const META_SCOPES = [
  "ads_management",
  "ads_read",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
  "instagram_basic",
] as const;

/** Error de Meta ya traducido a algo que se pueda leer en la pantalla. */
export class MetaApiError extends Error {
  readonly codigo: number | null;
  readonly subcodigo: number | null;
  readonly esCupoAgotado: boolean;
  readonly esAccesoCaducado: boolean;

  constructor(mensaje: string, opts: {
    codigo?: number | null;
    subcodigo?: number | null;
    esCupoAgotado?: boolean;
    esAccesoCaducado?: boolean;
  } = {}) {
    super(mensaje);
    this.name = "MetaApiError";
    this.codigo = opts.codigo ?? null;
    this.subcodigo = opts.subcodigo ?? null;
    this.esCupoAgotado = opts.esCupoAgotado ?? false;
    this.esAccesoCaducado = opts.esAccesoCaducado ?? false;
  }
}

/** Forma del error que devuelve la Graph API. */
interface MetaErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
  };
}

/** Códigos de "has llamado demasiadas veces, espera". */
const CODIGOS_CUPO = new Set([4, 17, 32, 613, 80000, 80003, 80004]);
/** Códigos de "este acceso ya no vale: hay que volver a conectar". */
const CODIGOS_ACCESO = new Set([190, 102]);

/**
 * Convierte la respuesta de error de Meta en un MetaApiError con un mensaje
 * en castellano. Meta manda a veces `error_user_msg`, que ya viene redactado
 * para enseñárselo a una persona: ese tiene prioridad sobre el técnico.
 */
export function traducirErrorMeta(body: unknown, httpStatus: number): MetaApiError {
  const err = (body as MetaErrorBody)?.error;
  const codigo = err?.code ?? null;
  const subcodigo = err?.error_subcode ?? null;

  const esCupoAgotado = codigo != null && CODIGOS_CUPO.has(codigo);
  const esAccesoCaducado =
    (codigo != null && CODIGOS_ACCESO.has(codigo)) || httpStatus === 401;

  if (esAccesoCaducado) {
    return new MetaApiError(
      "La conexión con Meta ha caducado. Entra en Ajustes → Integraciones → Meta y vuelve a conectar la cuenta.",
      { codigo, subcodigo, esAccesoCaducado: true },
    );
  }

  if (esCupoAgotado) {
    return new MetaApiError(
      "Meta ha limitado temporalmente las consultas de esta cuenta. Inténtalo de nuevo en unos minutos.",
      { codigo, subcodigo, esCupoAgotado: true },
    );
  }

  // Mensaje ya redactado por Meta para el usuario final.
  const amable = err?.error_user_msg?.trim();
  if (amable) {
    const titulo = err?.error_user_title?.trim();
    return new MetaApiError(titulo ? `${titulo}: ${amable}` : amable, { codigo, subcodigo });
  }

  const tecnico = err?.message?.trim();
  return new MetaApiError(
    tecnico ? `Meta ha rechazado la petición: ${tecnico}` : `Meta ha respondido con un error (HTTP ${httpStatus}).`,
    { codigo, subcodigo },
  );
}

/** Céntimos → euros con coma decimal, como se escribe aquí el dinero. */
export function centimosAEuros(cent: number | null | undefined): string {
  const n = (cent ?? 0) / 100;
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Euros (número) → céntimos enteros, que es lo que espera Meta. */
export function eurosACentimos(euros: number): number {
  return Math.round(euros * 100);
}
