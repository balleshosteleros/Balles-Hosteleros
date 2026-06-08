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
}

/** Máximo de accesos (usuario/contraseña) por app. No se muestra en UI; se aplica en silencio. */
export const MAX_ACCESOS_POR_APP = 10;

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

/** Devuelve la URL del favicon del dominio de una URL (icono automático de la app). */
export function faviconDesdeUrl(url: string): string {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    if (!host) return "";
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return "";
  }
}

export const DEPARTAMENTOS = [
  "Dirección",
  "Gerencia",
  "RRHH",
  "Marketing",
  "Contabilidad",
  "Gestoría",
  "Jurídico",
  "Logística",
  "Mantenimiento",
  "Todos",
];
