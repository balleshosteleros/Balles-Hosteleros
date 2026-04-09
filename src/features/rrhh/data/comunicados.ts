export type EstadoComunicado = "borrador" | "programado" | "publicado" | "archivado";
export type Recurrencia = "sin_repeticion" | "semanal" | "mensual" | "personalizado";

export const ESTADO_COMUNICADO_LABELS: Record<EstadoComunicado, string> = {
  borrador: "Borrador",
  programado: "Programado",
  publicado: "Publicado",
  archivado: "Archivado",
};

export const RECURRENCIA_LABELS: Record<Recurrencia, string> = {
  sin_repeticion: "Sin repetición",
  semanal: "Semanal",
  mensual: "Mensual",
  personalizado: "Personalizado",
};

export interface DestinatarioInfo {
  empresas: number;
  departamentos: number;
  empleados: number;
}

export interface Comunicado {
  id: string;
  titulo: string;
  asunto: string;
  cuerpo: string;
  estado: EstadoComunicado;
  creadorId: string;
  creadoEl: string;
  envio: string | null;
  recurrencia: Recurrencia;
  alcancePct: number;
  rolesDestinatarios: string[];
  todaEmpresa: boolean;
  destinatarios: DestinatarioInfo;
  prioridad: "baja" | "normal" | "alta" | "urgente";
  observaciones: string;
}

const habanaComunicados: Comunicado[] = [
  { id: "hc1", titulo: "Nuevo protocolo de limpieza", asunto: "Actualización protocolo limpieza", cuerpo: "Se informa del nuevo protocolo de limpieza vigente a partir del lunes...", estado: "publicado", creadorId: "h4", creadoEl: "2026-03-28 09:00", envio: "2026-03-28 10:00", recurrencia: "sin_repeticion", alcancePct: 85, rolesDestinatarios: ["Camareros", "Cocina", "Mantenimiento"], todaEmpresa: false, destinatarios: { empresas: 1, departamentos: 3, empleados: 6 }, prioridad: "alta", observaciones: "" },
  { id: "hc2", titulo: "Horarios de Semana Santa", asunto: "Cambios horarios Semana Santa 2026", cuerpo: "Debido a la alta afluencia prevista durante Semana Santa, se modifican los turnos...", estado: "programado", creadorId: "h5", creadoEl: "2026-04-01 14:30", envio: "2026-04-07 08:00", recurrencia: "sin_repeticion", alcancePct: 0, rolesDestinatarios: [], todaEmpresa: true, destinatarios: { empresas: 1, departamentos: 10, empleados: 10 }, prioridad: "urgente", observaciones: "Pendiente de confirmar turnos de cocina" },
  { id: "hc3", titulo: "Reunión mensual de equipo", asunto: "Recordatorio reunión mensual", cuerpo: "Se recuerda la reunión mensual de equipo el primer lunes de cada mes a las 11:00...", estado: "publicado", creadorId: "h4", creadoEl: "2026-02-01 08:00", envio: "2026-03-03 08:00", recurrencia: "mensual", alcancePct: 100, rolesDestinatarios: [], todaEmpresa: true, destinatarios: { empresas: 1, departamentos: 10, empleados: 10 }, prioridad: "normal", observaciones: "" },
  { id: "hc4", titulo: "Formación en alérgenos", asunto: "Curso obligatorio de alérgenos", cuerpo: "Todos los empleados de cocina y sala deben completar la formación sobre alérgenos antes del 15 de abril...", estado: "borrador", creadorId: "h2", creadoEl: "2026-04-03 11:00", envio: null, recurrencia: "sin_repeticion", alcancePct: 0, rolesDestinatarios: ["Cocina", "Jefe de Sala", "Camareros"], todaEmpresa: false, destinatarios: { empresas: 1, departamentos: 3, empleados: 5 }, prioridad: "alta", observaciones: "Revisar contenido con el chef" },
  { id: "hc5", titulo: "Actualización carta de verano", asunto: "Nueva carta de verano disponible", cuerpo: "La nueva carta de temporada estará disponible en sala a partir del 1 de mayo...", estado: "archivado", creadorId: "h4", creadoEl: "2025-12-15 16:00", envio: "2025-12-16 09:00", recurrencia: "sin_repeticion", alcancePct: 72, rolesDestinatarios: [], todaEmpresa: true, destinatarios: { empresas: 1, departamentos: 10, empleados: 10 }, prioridad: "normal", observaciones: "" },
  { id: "hc6", titulo: "Check semanal de instalaciones", asunto: "Recordatorio check semanal", cuerpo: "Cada viernes a las 16:00 se realizará el check de instalaciones por parte del equipo de mantenimiento...", estado: "publicado", creadorId: "h5", creadoEl: "2026-01-10 10:00", envio: "2026-01-13 16:00", recurrencia: "semanal", alcancePct: 60, rolesDestinatarios: ["Mantenimiento", "Dirección"], todaEmpresa: false, destinatarios: { empresas: 1, departamentos: 2, empleados: 3 }, prioridad: "normal", observaciones: "" },
];

const bacanalComunicados: Comunicado[] = [
  { id: "bc1", titulo: "Bienvenida nuevo personal", asunto: "Bienvenidos al equipo Bacanal", cuerpo: "Damos la bienvenida a los nuevos integrantes del equipo que se incorporan esta semana...", estado: "publicado", creadorId: "b1", creadoEl: "2026-03-25 10:00", envio: "2026-03-25 10:30", recurrencia: "sin_repeticion", alcancePct: 95, rolesDestinatarios: [], todaEmpresa: true, destinatarios: { empresas: 1, departamentos: 8, empleados: 8 }, prioridad: "normal", observaciones: "" },
  { id: "bc2", titulo: "Cambio de proveedor de bebidas", asunto: "Nuevo proveedor de bebidas", cuerpo: "A partir del 1 de abril se trabajará con el nuevo proveedor de bebidas Premium Drinks...", estado: "programado", creadorId: "b6", creadoEl: "2026-04-02 09:00", envio: "2026-04-05 08:00", recurrencia: "sin_repeticion", alcancePct: 0, rolesDestinatarios: ["Cocina", "Jefe de Sala", "Camareros"], todaEmpresa: false, destinatarios: { empresas: 1, departamentos: 3, empleados: 4 }, prioridad: "alta", observaciones: "Adjuntar catálogo nuevo proveedor" },
  { id: "bc3", titulo: "Protocolo de emergencias", asunto: "Revisión protocolo de emergencias", cuerpo: "Se ha actualizado el protocolo de emergencias. Todos deben leerlo y confirmar lectura...", estado: "publicado", creadorId: "b1", creadoEl: "2026-03-10 12:00", envio: "2026-03-10 13:00", recurrencia: "sin_repeticion", alcancePct: 50, rolesDestinatarios: [], todaEmpresa: true, destinatarios: { empresas: 1, departamentos: 8, empleados: 8 }, prioridad: "urgente", observaciones: "" },
  { id: "bc4", titulo: "Informe mensual de ventas", asunto: "Resumen ventas marzo 2026", cuerpo: "Adjuntamos el resumen de ventas del mes de marzo con los principales indicadores...", estado: "borrador", creadorId: "b6", creadoEl: "2026-04-04 15:00", envio: null, recurrencia: "mensual", alcancePct: 0, rolesDestinatarios: ["Dirección", "Administrativo"], todaEmpresa: false, destinatarios: { empresas: 1, departamentos: 2, empleados: 2 }, prioridad: "normal", observaciones: "Pendiente de datos finales" },
  { id: "bc5", titulo: "Evento especial fin de semana", asunto: "Preparación evento VIP sábado", cuerpo: "Este sábado tendremos un evento privado de 60 personas. Revisar asignación de mesas y menú especial...", estado: "publicado", creadorId: "b2", creadoEl: "2026-04-01 09:00", envio: "2026-04-01 09:30", recurrencia: "sin_repeticion", alcancePct: 80, rolesDestinatarios: ["Cocina", "Jefe de Sala", "Camareros", "RRPP"], todaEmpresa: false, destinatarios: { empresas: 1, departamentos: 4, empleados: 5 }, prioridad: "alta", observaciones: "" },
];

export function getComunicadosByEmpresa(empresaId: string): Comunicado[] {
  if (empresaId === "habana") return habanaComunicados;
  if (empresaId === "bacanal") return bacanalComunicados;
  return [];
}
