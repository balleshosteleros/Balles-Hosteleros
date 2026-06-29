// External app access & credentials management
// Datos en Supabase (tabla `accesos_apps`). Aquí solo viven los tipos
// y las constantes (CATEGORIAS_APP, DEPARTAMENTOS) que se usan en la UI.

export type EstadoApp = "Activo" | "Inactivo" | "Archivado";
export type NivelPermiso = "ver_enlace" | "ver_usuario" | "ver_credenciales" | "editar";
export type TipoIntegracion = "enlace" | "embebido" | "sso" | "oauth";

/** Un acceso = una pareja usuario/contraseña con etiqueta opcional (ej: "Gerencia"). */
export interface AccesoCredencial {
  etiqueta: string;
  usuario: string;
  contrasena: string;
  /**
   * Roles que pueden VER este acceso concreto. Vacío = solo dirección.
   * Permite que una misma app tenga, p. ej., un acceso para Contabilidad y
   * otro para Marketing, cada uno visible solo a su rol.
   */
  roles?: string[];
  /**
   * Solo en datos que viajan al cliente: indica si el acceso TIENE contraseña
   * guardada (para pintar ••••). La contraseña real no viaja; se obtiene con
   * `revelarAccesoApp` tras verificación. No se persiste en BD.
   */
  tieneContrasena?: boolean;
  /**
   * Datos extra del acceso (PIN, PUK, código empresa, etc.). El valor se cifra
   * igual que la contraseña y se revela bajo verificación. En las listas que
   * viajan al cliente, `valor` va vacío y se marca `tiene`.
   */
  datosExtra?: DatoExtra[];
}

/** Un dato extra (PIN, PUK, código...) dentro de un acceso. */
export interface DatoExtra {
  nombre: string;
  /** Valor en claro al guardar; vacío en listas (se revela aparte). */
  valor: string;
  /** Solo en listas: indica si tiene valor guardado. */
  tiene?: boolean;
}

/** Máximo de accesos (usuario/contraseña) por app. No se muestra en UI; se aplica en silencio. */
export const MAX_ACCESOS_POR_APP = 50;

export interface AccesoApp {
  id: string;
  nombre: string;
  descripcion: string;
  url: string;
  icono: string;
  logoUrl?: string;
  categoria: string;
  departamentos: string[];
  rolesAutorizados: string[];
  /** Varias parejas usuario/contraseña (máx. MAX_ACCESOS_POR_APP). */
  accesos: AccesoCredencial[];
  /** Legacy — se mantiene sincronizado con accesos[0] para compatibilidad. */
  usuario: string;
  contrasena: string;
  estado: EstadoApp;
  responsable: string;
  notas: string;
  tipoIntegracion: TipoIntegracion;
  empresaId: string;
  ultimaActualizacion: string;
}

/**
 * Catálogo fijo de categorías que da el software por defecto. NO editable:
 * 6 categorías genéricas que engloban cualquier tipo de app, presente o futura.
 */
export const CATEGORIAS_APP = [
  "Banca y finanzas",
  "Redes sociales y marketing",
  "Web y presencia digital",
  "Gestión y operaciones",
  "Comunicación y correo",
  "Otros",
];

/**
 * Marcas conocidas → logo nítido (simpleicons). Permite resolver el logo por
 * NOMBRE cuando la app no tiene URL (ej. "Revolut", "Caja Fuerte" no, pero
 * "Stripe" sí). Clave = substring en minúsculas que debe contener el nombre.
 */
const LOGOS_POR_NOMBRE: Array<[string, string]> = [
  ["revolut", "https://cdn.simpleicons.org/revolut/0666EB"],
  ["stripe", "https://cdn.simpleicons.org/stripe/635BFF"],
  ["instagram", "https://cdn.simpleicons.org/instagram/E4405F"],
  ["facebook", "https://cdn.simpleicons.org/facebook/1877F2"],
  ["tiktok", "https://cdn.simpleicons.org/tiktok/000000"],
  ["spotify", "https://cdn.simpleicons.org/spotify/1DB954"],
  ["amazon", "https://cdn.simpleicons.org/amazon/FF9900"],
  ["youtube", "https://cdn.simpleicons.org/youtube/FF0000"],
  ["whatsapp", "https://cdn.simpleicons.org/whatsapp/25D366"],
  ["adyen", "https://cdn.simpleicons.org/adyen/0ABF53"],
  ["mercadona", "https://cdn.simpleicons.org/mercadona/008E5A"],
  ["makro", "https://cdn.simpleicons.org/makro/E2001A"],
  ["google", "https://cdn.simpleicons.org/google/4285F4"],
  ["gmail", "https://cdn.simpleicons.org/gmail/EA4335"],
  ["drive", "https://cdn.simpleicons.org/googledrive/4285F4"],
  ["microsoft", "https://cdn.simpleicons.org/microsoft/5E5E5E"],
  ["sesame", "https://icon.horse/icon/sesamehr.com"],
];

/** Logo por nombre de marca conocida (sin necesidad de URL). "" si no hay match. */
export function logoDesdeNombre(nombre: string): string {
  const n = (nombre ?? "").toLowerCase();
  for (const [clave, url] of LOGOS_POR_NOMBRE) {
    if (n.includes(clave)) return url;
  }
  return "";
}

/**
 * Logo automático de una app: prioriza marca conocida por nombre; si no, saca
 * el favicon nítido del dominio de la URL. "" si no hay nada utilizable.
 */
export function faviconDesdeUrl(url: string, nombre?: string): string {
  // 1) Marca conocida por nombre (logo de máxima calidad).
  if (nombre) {
    const porNombre = logoDesdeNombre(nombre);
    if (porNombre) return porNombre;
  }
  // 2) Favicon del dominio de la URL.
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    if (!host) return "";
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
  } catch {
    return "";
  }
}

// Departamentos a los que se pueden asignar apps/credenciales (Title Case; el
// filtro compara tolerante a mayúsculas/acentos). NO hay departamentos "prohibidos":
// la visibilidad es 100% data-driven — cada app y cada credencial elige sus
// departamentos. Si mañana asignas una app a Sala, Sala la verá.
// "Todos" es un comodín = visible para toda la empresa.
export const DEPARTAMENTOS = [
  "Dirección",
  "Gerencia",
  "Recursos humanos",
  "Marketing",
  "Contabilidad",
  "Gestoría",
  "Jurídico",
  "Logística",
  "Mantenimiento",
  "Calidad",
  "Cocina",
  "Sala",
  "Artistas",
  "Todos",
];
