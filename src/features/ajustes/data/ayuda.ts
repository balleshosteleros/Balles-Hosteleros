export const MODULOS_AYUDA = [
  "Dashboard", "Gerencia", "Contabilidad", "Gestoría", "Jurídico",
  "RRHH", "Logística", "Marketing", "Mantenimiento", "Ajustes",
] as const;

export type ModuloAyuda = (typeof MODULOS_AYUDA)[number];

export interface ArticuloAyuda {
  id: string;
  titulo: string;
  respuesta: string;
  modulo: ModuloAyuda;
  rolesAutorizados: string[];
  etiquetas: string[];
  validada: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ConsultaPendiente {
  id: string;
  usuario: string;
  empresaId: string;
  empresaNombre: string;
  modulo: string;
  rolUsuario: string;
  pregunta: string;
  respuestaMostrada: string;
  fecha: string;
  estado: "pendiente" | "resuelta";
  articuloGeneradoId?: string;
}

export interface MensajeChat {
  id: string;
  tipo: "usuario" | "sistema";
  texto: string;
  articuloId?: string;
  fecha: string;
  feedbackDado?: boolean;
  feedbackPositivo?: boolean;
}

export function buildDefaultArticulos(): ArticuloAyuda[] {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  return [
    {
      id: "art-1", titulo: "¿Cómo crear una incidencia de mantenimiento?",
      respuesta: "Accede al módulo GERENCIA > MANTENIMIENTO y pulsa el botón '+ Nueva incidencia'. Rellena los campos obligatorios (título, gravedad, área, local) y guarda.",
      modulo: "Mantenimiento", rolesAutorizados: ["Administrador", "Gerencia", "Logística"],
      etiquetas: ["incidencia", "mantenimiento"], validada: true, creadoEn: now, actualizadoEn: now,
    },
    {
      id: "art-2", titulo: "¿Cómo añadir un usuario a la empresa?",
      respuesta: "Ve a AJUSTES > Usuarios y pulsa 'Añadir usuario'. Completa nombre, email, rol y departamento. El usuario quedará con estado 'Invitado' hasta que acceda por primera vez.",
      modulo: "Ajustes", rolesAutorizados: ["Administrador"],
      etiquetas: ["usuarios", "acceso"], validada: true, creadoEn: now, actualizadoEn: now,
    },
    {
      id: "art-3", titulo: "¿Cómo consultar los ingresos del mes?",
      respuesta: "Accede al módulo CONTABILIDAD y selecciona el período mensual en los filtros superiores. Verás un resumen de ingresos y gastos desglosado.",
      modulo: "Contabilidad", rolesAutorizados: ["Administrador", "Contabilidad", "Gerencia"],
      etiquetas: ["contabilidad", "ingresos"], validada: true, creadoEn: now, actualizadoEn: now,
    },
    {
      id: "art-4", titulo: "¿Cómo gestionar nóminas y contratos?",
      respuesta: "Accede al módulo RECURSOS HUMANOS donde encontrarás las secciones de nóminas, contratos y gestión de personal.",
      modulo: "RRHH", rolesAutorizados: ["Administrador", "Recursos Humanos"],
      etiquetas: ["rrhh", "nóminas"], validada: true, creadoEn: now, actualizadoEn: now,
    },
    {
      id: "art-5", titulo: "¿Cómo cambiar el logotipo de la empresa?",
      respuesta: "Ve a AJUSTES > Datos generales y busca la sección 'Logotipo de la empresa'. Allí podrás subir, cambiar o eliminar el logotipo.",
      modulo: "Ajustes", rolesAutorizados: ["Administrador"],
      etiquetas: ["logo", "identidad"], validada: true, creadoEn: now, actualizadoEn: now,
    },
    {
      id: "art-6", titulo: "¿Cómo lanzar una campaña de marketing?",
      respuesta: "Accede al módulo MARKETING donde encontrarás herramientas para crear y gestionar campañas publicitarias y de comunicación.",
      modulo: "Marketing", rolesAutorizados: ["Administrador", "Marketing"],
      etiquetas: ["marketing", "campañas"], validada: true, creadoEn: now, actualizadoEn: now,
    },
  ];
}
