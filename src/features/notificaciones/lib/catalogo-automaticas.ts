/**
 * Catálogo de notificaciones AUTOMÁTICAS del software.
 *
 * Fuente única de Ajustes → Herramientas → Notificaciones: lo que aparece aquí
 * es lo que se puede encender y apagar. Al añadir una notificación automática
 * nueva al software, se añade su entrada aquí y ya sale en el panel.
 *
 * `tipo` debe coincidir con el que se pasa a `emitirNotificacion({ tipo })`, o
 * con la clave propia del cron para los avisos que no pasan por esa capa
 * (fichaje y reservas, que envían push directo).
 */

export interface NotifAutomatica {
  /** Clave persistida en `notificaciones_config.tipo`. */
  tipo: string;
  /** Nombre en la UI (sentence case). */
  label: string;
  /** Cuándo salta, en lenguaje del usuario. */
  cuando: string;
  /** Quién la recibe. */
  destinatario: string;
}

export interface GrupoNotif {
  clave: string;
  titulo: string;
  items: NotifAutomatica[];
}

export const NOTIFICACIONES_AUTOMATICAS: GrupoNotif[] = [
  {
    clave: "fichaje",
    titulo: "Fichaje",
    items: [
      {
        tipo: "fichaje_recordatorio",
        label: "Recordatorio de fichar",
        cuando: "Cerca de su hora de entrada, si aún no ha fichado",
        destinatario: "El empleado",
      },
      {
        tipo: "fichaje_cambio_empresa",
        label: "Su jornada continúa en otra empresa",
        cuando: "Sigue fichado y su turno pasa a otra empresa",
        destinatario: "El empleado",
      },
    ],
  },
  {
    clave: "rrhh",
    titulo: "RRHH y nóminas",
    items: [
      {
        tipo: "liquidacion",
        label: "Liquidación emitida",
        cuando: "Se le emite una liquidación",
        destinatario: "El empleado",
      },
      {
        tipo: "liquidacion_pagada",
        label: "Liquidación pagada",
        cuando: "RRHH la marca como pagada",
        destinatario: "El empleado",
      },
      {
        tipo: "nominas_gestoria_subidas",
        label: "Nóminas subidas por la gestoría",
        cuando: "La gestoría entrega una tanda, o se rechaza",
        destinatario: "Administración",
      },
      {
        tipo: "solicitud_pendiente",
        label: "Solicitud pendiente de validar",
        cuando: "Un empleado pide vacaciones o una ausencia",
        destinatario: "Su validador",
      },
      {
        tipo: "cambio_email_acceso",
        label: "Cambio del correo de acceso",
        cuando: "Se le cambia el correo con el que entra",
        destinatario: "El empleado",
      },
      {
        tipo: "nueva_incorporacion",
        label: "Nueva incorporación",
        cuando: "Se da de alta un contrato",
        destinatario: "Administración",
      },
    ],
  },
  {
    clave: "contratacion",
    titulo: "Contratación y gestoría",
    items: [
      {
        tipo: "gestoria_alta_enviada",
        label: "Alta enviada a la gestoría",
        cuando: "Se envía el alta de un empleado",
        destinatario: "Administración",
      },
      {
        tipo: "gestoria_recordatorio",
        label: "Recordatorio a la gestoría",
        cuando: "El alta lleva días sin contrato",
        destinatario: "Administración",
      },
      {
        tipo: "gestoria_contrato_subido",
        label: "Contrato subido",
        cuando: "La gestoría sube el contrato",
        destinatario: "Administración",
      },
      {
        tipo: "gestoria_contrato_firmado",
        label: "Contrato firmado",
        cuando: "El empleado firma su contrato",
        destinatario: "Administración",
      },
      {
        tipo: "validador_no_configurado",
        label: "Aviso: falta el validador",
        cuando: "Se contrata y el puesto no tiene validador",
        destinatario: "Administración",
      },
      {
        tipo: "horario_no_configurado",
        label: "Aviso: falta el horario",
        cuando: "Se contrata y el puesto no tiene horario",
        destinatario: "Administración",
      },
    ],
  },
  {
    clave: "reclutamiento",
    titulo: "Reclutamiento",
    items: [
      {
        tipo: "nueva_candidatura",
        label: "Nueva candidatura",
        cuando: "Alguien se inscribe en una vacante",
        destinatario: "Administración",
      },
      {
        tipo: "documentacion_candidato",
        label: "Documentación del candidato",
        cuando: "El candidato sube sus documentos",
        destinatario: "Administración",
      },
      {
        tipo: "prueba_aviso",
        label: "Aviso de periodo de prueba",
        cuando: "Se acerca el fin del periodo de prueba",
        destinatario: "Administración",
      },
      {
        tipo: "prueba_evaluacion",
        label: "Evaluación del periodo de prueba",
        cuando: "Toca evaluar al empleado en prueba",
        destinatario: "Administración",
      },
      {
        tipo: "prueba_cierre",
        label: "Cierre del periodo de prueba",
        cuando: "Termina el periodo de prueba",
        destinatario: "Administración",
      },
    ],
  },
  {
    clave: "operativa",
    titulo: "Operativa y vencimientos",
    items: [
      {
        tipo: "cronograma",
        label: "Tareas del cronograma",
        cuando: "Tiene una tarea pendiente del día",
        destinatario: "El empleado del puesto",
      },
      {
        tipo: "vencimiento",
        label: "Vencimientos",
        cuando: "Un documento o contrato está por caducar",
        destinatario: "Administración",
      },
      {
        tipo: "comunicado",
        label: "Comunicados",
        cuando: "Se publica un comunicado",
        destinatario: "Los empleados elegidos",
      },
      {
        tipo: "firma_pendiente",
        label: "Firma pendiente",
        cuando: "Tiene un documento que firmar",
        destinatario: "El empleado",
      },
      {
        tipo: "llamada_entrante",
        label: "Llamada interna entrante",
        cuando: "Le llaman desde el chat interno",
        destinatario: "El empleado",
      },
    ],
  },
  {
    clave: "negocio",
    titulo: "Reservas y reseñas",
    items: [
      {
        tipo: "reserva_recordatorio",
        label: "Recordatorio de reserva",
        cuando: "Unas horas antes de su reserva",
        destinatario: "El cliente",
      },
      {
        tipo: "resena_google",
        label: "Nueva reseña de Google",
        cuando: "Entra una reseña nueva",
        destinatario: "Administración",
      },
      {
        tipo: "modelos_aeat",
        label: "Modelos fiscales (AEAT)",
        cuando: "Se acerca el plazo de presentación",
        destinatario: "Administración",
      },
    ],
  },
];

/** Todas las notificaciones automáticas en plano. */
export const TODAS_AUTOMATICAS: NotifAutomatica[] =
  NOTIFICACIONES_AUTOMATICAS.flatMap((g) => g.items);
