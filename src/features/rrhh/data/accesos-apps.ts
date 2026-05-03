// External app access & credentials management
// Datos en Supabase (tabla `accesos_apps`). Aquí solo viven los tipos
// y las constantes (CATEGORIAS_APP, DEPARTAMENTOS) que se usan en la UI.

export type EstadoApp = "Activo" | "Inactivo" | "Archivado";
export type NivelPermiso = "ver_enlace" | "ver_usuario" | "ver_credenciales" | "editar";
export type TipoIntegracion = "enlace" | "embebido" | "sso" | "oauth";

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
  usuario: string;
  contrasena: string;
  estado: EstadoApp;
  responsable: string;
  notas: string;
  tipoIntegracion: TipoIntegracion;
  empresaId: string;
  ultimaActualizacion: string;
}

export const CATEGORIAS_APP = [
  "Sistemas de gestión",
  "Banca y finanzas",
  "Redes sociales",
  "Presencia digital",
  "Fichaje y control horario",
  "Nóminas y RRHH",
  "Contabilidad y finanzas",
  "Marketing y redes",
  "Diseño y contenido",
  "Comunicación",
  "Almacenamiento y docs",
  "Gestión y ERP",
  "Logística y proveedores",
  "Legal y compliance",
  "Hosting y web",
  "Marketplace y servicios",
  "IA y productividad",
  "Otros",
];

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
