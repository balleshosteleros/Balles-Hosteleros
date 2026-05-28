export interface KpiThresholds {
  // Auditorías: nº de envíos realizados en el trimestre
  auditoriasTrimestreOk: number;
  auditoriasTrimestreWarning: number;
  // Auditorías: nota media (0-10)
  auditoriasNotaOk: number;
  auditoriasNotaWarning: number;
  // Inspecciones: nº de envíos en el trimestre
  inspeccionesTrimestreOk: number;
  inspeccionesTrimestreWarning: number;
  // Inspecciones: nota media (0-10)
  inspeccionesNotaOk: number;
  inspeccionesNotaWarning: number;
  // Reseñas: rating medio (0-5)
  resenasRatingOk: number;
  resenasRatingWarning: number;
  // Reseñas: % pendientes de respuesta (menor = mejor)
  resenasPendientesPctOk: number;
  resenasPendientesPctWarning: number;
  // Cuestionarios: % de respuesta de campañas activas
  cuestionariosRespuestaPctOk: number;
  cuestionariosRespuestaPctWarning: number;
}

export const DEFAULT_KPI_THRESHOLDS: KpiThresholds = {
  auditoriasTrimestreOk: 4,
  auditoriasTrimestreWarning: 2,
  auditoriasNotaOk: 8,
  auditoriasNotaWarning: 6,
  inspeccionesTrimestreOk: 3,
  inspeccionesTrimestreWarning: 1,
  inspeccionesNotaOk: 8,
  inspeccionesNotaWarning: 6,
  resenasRatingOk: 4.5,
  resenasRatingWarning: 3.8,
  resenasPendientesPctOk: 10,
  resenasPendientesPctWarning: 30,
  cuestionariosRespuestaPctOk: 80,
  cuestionariosRespuestaPctWarning: 50,
};

export interface CalidadDashboard {
  empresaNombre: string | null;
  trimestre: { label: string; inicio: string; fin: string };
  thresholds: KpiThresholds;
  auditorias: {
    enviadasTrimestre: number;
    pendientesBorrador: number;
    notaMediaTrimestre: number | null;
    plantillasActivas: number;
    porLocal: { local: string; envios: number; notaMedia: number | null }[];
  };
  inspecciones: {
    enviadasTrimestre: number;
    pendientesRevision: number;
    revisadasTrimestre: number;
    notaMediaTrimestre: number | null;
    plantillasPublicadas: number;
  };
  resenas: {
    totalTrimestre: number;
    ratingMedio: number | null;
    excelente: number;
    regular: number;
    malo: number;
    sinResponder: number;
    pctPendientesPct: number;
  };
  cuestionarios: {
    campanasActivas: number;
    enviosTotalesActivas: number;
    respondidosActivas: number;
    pctRespuestaActivas: number;
    reunionesPendientesActivas: number;
    puntosAbiertosTotal: number;
  };
}
