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
   * Se entra con la cuenta de Google, no con usuario y contraseña propios
   * (ej. Gamma: se accede con balleshosteleros@gmail.com). Cuando está activo
   * solo se guarda el correo: no hay contraseña que pedir ni que revelar, y la
   * ficha deja de parecer incompleta. Regla de Iván (2026-08-29).
   */
  accesoGoogle?: boolean;
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
  /**
   * Solo en datos que viajan al cliente: posición REAL de este acceso dentro
   * del array guardado en BD. Imprescindible desde PRP-075: el servidor filtra
   * las credenciales que el rol no puede ver, así que la posición en la lista
   * recibida ya no coincide con la de BD. `revelarAccesoApp` usa este índice;
   * sin él se revelaría la contraseña equivocada. No se persiste.
   */
  indiceReal?: number;
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

/**
 * Máximo de datos extra por acceso. Cada acceso lleva ya usuario y contraseña;
 * estos son los adicionales.
 *
 * Son DOS y no más por decisión de Iván (2026-08-29): una credencial es un
 * usuario y una contraseña, y como mucho el par PIN + PUK de un móvil o SIM
 * —que van juntos pero deben poder copiarse por separado—. Lo que no encaje
 * en ese molde es otra credencial distinta, no un campo más: por eso el código
 * de desbloqueo del móvil de logística se separó en su propia ficha, y las
 * claves de API de Adyen dejaron de vivir aquí.
 */
export const MAX_DATOS_EXTRA_POR_ACCESO = 2;

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
 * Marcas conocidas → logo servido por la PROPIA app (`public/logos-apps`).
 *
 * Antes esto apuntaba a CDNs externos (simpleicons, favicons de Google), con
 * dos problemas: el navegador de cada empleado pedía las imágenes fuera, y
 * varias marcas ya no existían allí (BBVA, Mercadona, Makro, Amazon y Microsoft
 * devolvían 404, así que la app salía como una letra en un cuadro gris).
 * Ahora los logos viajan con el proyecto: sin peticiones externas y sin 404.
 *
 * Clave = substring en minúsculas que debe contener el nombre. Permite resolver
 * el logo por NOMBRE aunque la app no tenga URL.
 */
const LOGOS_POR_NOMBRE: Array<[string, string]> = [
  ["revolut", "/logos-apps/revolut.svg"],
  ["stripe", "/logos-apps/stripe.svg"],
  ["instagram", "/logos-apps/instagram.svg"],
  ["facebook", "/logos-apps/facebook.svg"],
  ["tiktok", "/logos-apps/tiktok.svg"],
  ["spotify", "/logos-apps/spotify.svg"],
  ["amazon", "/logos-apps/amazon.png"],
  ["aliexpress", "/logos-apps/aliexpress.svg"],
  ["youtube", "/logos-apps/youtube.svg"],
  ["whatsapp", "/logos-apps/whatsapp.svg"],
  ["adyen", "/logos-apps/adyen.svg"],
  ["mercadona", "/logos-apps/mercadona.png"],
  ["makro", "/logos-apps/makro.png"],
  ["gmail", "/logos-apps/gmail.svg"],
  ["drive", "/logos-apps/googledrive.svg"],
  ["google", "/logos-apps/google.svg"],
  ["microsoft", "/logos-apps/microsoft.png"],
  ["sesame", "/logos-apps/sesametime.png"],
  ["bbva", "/logos-apps/bbva.png"],
  ["ágora", "/logos-apps/agorapos.png"],
  ["agora", "/logos-apps/agorapos.png"],
  ["b2com", "/logos-apps/b2com.png"],
  ["cover manager", "/logos-apps/covermanager.png"],
  ["covermanager", "/logos-apps/covermanager.png"],
  ["high level", "/logos-apps/gohighlevel.png"],
  ["highlevel", "/logos-apps/gohighlevel.png"],
  ["siteground", "/logos-apps/siteground.png"],
  ["banktrack", "/logos-apps/banktrack.png"],
  ["gamma", "/logos-apps/gamma.png"],
  ["asgae", "/logos-apps/somos-musica.png"],
  ["infojobs", "/logos-apps/infojobs.png"],
  ["tripadvisor", "/logos-apps/tripadvisor.svg"],
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
 * Logo automático de una app: prioriza marca conocida por nombre; si no, pide
 * el favicon del dominio a nuestra propia ruta `/api/logo-app`. "" si no hay nada utilizable.
 */
export function faviconDesdeUrl(url: string, nombre?: string): string {
  // 1) Marca conocida por nombre (logo de máxima calidad).
  if (nombre) {
    const porNombre = logoDesdeNombre(nombre);
    if (porNombre) return porNombre;
  }
  // 2) Favicon del dominio, servido por nuestra propia ruta: el navegador del
  //    empleado nunca pide la imagen a un tercero.
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    if (!host || !host.includes(".")) return "";
    return `/api/logo-app?dominio=${encodeURIComponent(host)}`;
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
