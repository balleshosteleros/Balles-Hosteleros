export interface PuestoRatio {
  id: string;
  nombre: string;
  area: "operativa" | "administrativa";
  costePorHora: number;
}

export interface DiaRatio {
  dia: string;
  fecha: string;
  horas: number;
  coste: number;
}

export interface FilaRatio {
  puestoId: string;
  nombre: string;
  area: "operativa" | "administrativa";
  dias: DiaRatio[];
  totalCoste: number;
  totalHoras: number;
}

export interface DiaPrevisiones {
  dia: string;
  facturacionReal: number;
  facturacionPrevista: number;
  reservasReales: number;
  reservasPrevistas: number;
}

export interface SemanaRatio {
  fechaInicio: string;
  fechaFin: string;
  filas: FilaRatio[];
  facturacionDiaria: Record<string, number>;
  facturacionTotal: number;
  previsiones: DiaPrevisiones[];
  previsionFacturacionTotal: number;
  previsionReservasTotal: number;
  reservasRealesTotal: number;
  // Datos del año anterior para el cálculo
  datosAnoAnterior: {
    facturacionSemana: number;
    reservasSemana: number;
  };
  tendencia: {
    factorFacturacion: number; // >1 = crecimiento, <1 = descenso
    factorReservas: number;
    descripcion: "ascendente" | "descendente" | "estable";
  };
}

const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function generarFechasSemana(inicio: string): string[] {
  const d = new Date(inicio);
  return DIAS_SEMANA.map((_, i) => {
    const f = new Date(d);
    f.setDate(d.getDate() + i);
    return f.toISOString().split("T")[0];
  });
}

function crearFila(
  id: string,
  nombre: string,
  area: "operativa" | "administrativa",
  costePorHora: number,
  horasPorDia: number[],
  fechas: string[]
): FilaRatio {
  const dias: DiaRatio[] = DIAS_SEMANA.map((dia, i) => ({
    dia,
    fecha: fechas[i],
    horas: horasPorDia[i],
    coste: Math.round(horasPorDia[i] * costePorHora * 100) / 100,
  }));
  return {
    puestoId: id,
    nombre,
    area,
    dias,
    totalCoste: dias.reduce((s, d) => s + d.coste, 0),
    totalHoras: dias.reduce((s, d) => s + d.horas, 0),
  };
}

/**
 * Calcula la previsión ajustada:
 * 1. Toma el dato de la misma fecha del año anterior
 * 2. Calcula el factor de tendencia del año actual vs anterior (media aritmética de las últimas semanas)
 * 3. Aplica: previsto = dato_año_anterior * factor_tendencia
 */
function calcularPrevisiones(
  facturacionDiaria: Record<string, number>,
  facturacionAnoAnterior: Record<string, number>,
  reservasDiarias: Record<string, number>,
  reservasAnoAnterior: Record<string, number>,
  factorFact: number,
  factorRes: number
): DiaPrevisiones[] {
  return DIAS_SEMANA.map((dia) => ({
    dia,
    facturacionReal: facturacionDiaria[dia] ?? 0,
    facturacionPrevista: Math.round((facturacionAnoAnterior[dia] ?? 0) * factorFact),
    reservasReales: reservasDiarias[dia] ?? 0,
    reservasPrevistas: Math.round((reservasAnoAnterior[dia] ?? 0) * factorRes),
  }));
}

function calcTendencia(factorFact: number, factorRes: number): SemanaRatio["tendencia"] {
  const avg = (factorFact + factorRes) / 2;
  return {
    factorFacturacion: factorFact,
    factorReservas: factorRes,
    descripcion: avg > 1.03 ? "ascendente" : avg < 0.97 ? "descendente" : "estable",
  };
}

function buildHabanaSemana(): SemanaRatio {
  const inicio = "2026-03-30";
  const fechas = generarFechasSemana(inicio);
  const filas: FilaRatio[] = [
    crearFila("h-hostes", "HOOSTES", "operativa", 9.5, [0, 5, 5, 6, 7, 8, 8], fechas),
    crearFila("h-jefe-sala-1", "JEFE DE SALA 1", "operativa", 13, [8, 8, 0, 8, 8, 8, 8], fechas),
    crearFila("h-jefe-sala-2", "JEFE DE SALA 2", "operativa", 12, [0, 8, 8, 8, 8, 8, 0], fechas),
    crearFila("h-camarero-1", "CAMARERO 1", "operativa", 9, [6, 6, 6, 6, 7, 8, 8], fechas),
    crearFila("h-camarero-2", "CAMARERO 2", "operativa", 9, [0, 6, 6, 6, 7, 8, 8], fechas),
    crearFila("h-jefe-cocina-1", "JEFE COCINA 1", "operativa", 14, [8, 8, 0, 8, 8, 8, 8], fechas),
    crearFila("h-jefe-cocina-2", "JEFE COCINA 2", "operativa", 13, [0, 8, 8, 8, 8, 8, 0], fechas),
    crearFila("h-cocinero", "COCINERO", "operativa", 10, [6, 6, 6, 6, 7, 8, 8], fechas),
    crearFila("h-artista", "ARTISTA", "operativa", 15, [0, 0, 0, 4, 5, 6, 6], fechas),
    crearFila("h-office", "OFFICE", "operativa", 8, [4, 4, 4, 4, 5, 5, 5], fechas),
    crearFila("h-limpieza", "LIMPIEZA", "operativa", 8.5, [4, 4, 4, 4, 5, 5, 5], fechas),
    crearFila("h-gerencia", "GERENCIA", "administrativa", 18, [8, 8, 8, 8, 8, 4, 0], fechas),
    crearFila("h-logistica", "LOGÍSTICA", "administrativa", 12, [8, 8, 8, 8, 8, 0, 0], fechas),
    crearFila("h-rrhh", "RECURSOS HUMANOS", "administrativa", 14, [8, 8, 8, 8, 8, 0, 0], fechas),
    crearFila("h-contabilidad", "CONTABILIDAD", "administrativa", 13, [8, 8, 8, 8, 8, 0, 0], fechas),
    crearFila("h-direccion", "DIRECCIÓN", "administrativa", 22, [6, 6, 6, 6, 6, 0, 0], fechas),
    crearFila("h-marketing", "MARKETING", "administrativa", 13, [8, 8, 8, 8, 8, 0, 0], fechas),
    crearFila("h-calidad", "CALIDAD", "administrativa", 12, [4, 4, 4, 4, 4, 0, 0], fechas),
    crearFila("h-gestoria", "GESTORÍA", "administrativa", 14, [4, 4, 4, 4, 4, 0, 0], fechas),
    crearFila("h-juridico", "JURÍDICO", "administrativa", 16, [4, 4, 4, 4, 4, 0, 0], fechas),
  ];

  const facturacionDiaria: Record<string, number> = {
    lunes: 2800, martes: 3200, miércoles: 3500, jueves: 5200,
    viernes: 8400, sábado: 11000, domingo: 9500,
  };

  // Año anterior (misma semana 2025)
  const facturacionAnoAnterior: Record<string, number> = {
    lunes: 2500, martes: 2900, miércoles: 3100, jueves: 4600,
    viernes: 7500, sábado: 9800, domingo: 8500,
  };

  const reservasDiarias: Record<string, number> = {
    lunes: 25, martes: 38, miércoles: 42, jueves: 68,
    viernes: 110, sábado: 145, domingo: 120,
  };

  const reservasAnoAnterior: Record<string, number> = {
    lunes: 22, martes: 34, miércoles: 38, jueves: 60,
    viernes: 95, sábado: 130, domingo: 105,
  };

  // Factor de tendencia: media del crecimiento de las últimas semanas del año actual vs anterior
  const factorFact = 1.08; // +8% crecimiento
  const factorRes = 1.12; // +12% crecimiento en reservas

  const previsiones = calcularPrevisiones(
    facturacionDiaria, facturacionAnoAnterior,
    reservasDiarias, reservasAnoAnterior,
    factorFact, factorRes
  );

  const facturacionTotal = Object.values(facturacionDiaria).reduce((s, v) => s + v, 0);

  return {
    fechaInicio: inicio,
    fechaFin: "2026-04-05",
    filas,
    facturacionDiaria,
    facturacionTotal,
    previsiones,
    previsionFacturacionTotal: previsiones.reduce((s, d) => s + d.facturacionPrevista, 0),
    previsionReservasTotal: previsiones.reduce((s, d) => s + d.reservasPrevistas, 0),
    reservasRealesTotal: previsiones.reduce((s, d) => s + d.reservasReales, 0),
    datosAnoAnterior: {
      facturacionSemana: Object.values(facturacionAnoAnterior).reduce((s, v) => s + v, 0),
      reservasSemana: Object.values(reservasAnoAnterior).reduce((s, v) => s + v, 0),
    },
    tendencia: calcTendencia(factorFact, factorRes),
  };
}

function buildBacanalSemana(): SemanaRatio {
  const inicio = "2026-03-30";
  const fechas = generarFechasSemana(inicio);
  const filas: FilaRatio[] = [
    crearFila("b-hostes", "HOOSTES", "operativa", 9, [0, 4, 4, 5, 6, 7, 7], fechas),
    crearFila("b-jefe-sala-1", "JEFE DE SALA 1", "operativa", 12, [8, 8, 0, 8, 8, 8, 8], fechas),
    crearFila("b-camarero-1", "CAMARERO 1", "operativa", 8.5, [5, 5, 5, 6, 7, 8, 8], fechas),
    crearFila("b-camarero-2", "CAMARERO 2", "operativa", 8.5, [0, 5, 5, 6, 7, 8, 8], fechas),
    crearFila("b-jefe-cocina-1", "JEFE COCINA 1", "operativa", 13, [8, 8, 0, 8, 8, 8, 8], fechas),
    crearFila("b-cocinero", "COCINERO", "operativa", 9.5, [5, 5, 5, 6, 7, 8, 8], fechas),
    crearFila("b-artista", "ARTISTA", "operativa", 14, [0, 0, 0, 4, 5, 6, 6], fechas),
    crearFila("b-office", "OFFICE", "operativa", 7.5, [4, 4, 4, 4, 5, 5, 5], fechas),
    crearFila("b-limpieza", "LIMPIEZA", "operativa", 8, [4, 4, 4, 4, 5, 5, 5], fechas),
    crearFila("b-gerencia", "GERENCIA", "administrativa", 17, [8, 8, 8, 8, 8, 4, 0], fechas),
    crearFila("b-logistica", "LOGÍSTICA", "administrativa", 11, [8, 8, 8, 8, 8, 0, 0], fechas),
    crearFila("b-rrhh", "RECURSOS HUMANOS", "administrativa", 13, [8, 8, 8, 8, 8, 0, 0], fechas),
    crearFila("b-contabilidad", "CONTABILIDAD", "administrativa", 12, [8, 8, 8, 8, 8, 0, 0], fechas),
    crearFila("b-direccion", "DIRECCIÓN", "administrativa", 20, [6, 6, 6, 6, 6, 0, 0], fechas),
    crearFila("b-marketing", "MARKETING", "administrativa", 12, [6, 6, 6, 6, 6, 0, 0], fechas),
    crearFila("b-calidad", "CALIDAD", "administrativa", 11, [4, 4, 4, 4, 4, 0, 0], fechas),
    crearFila("b-gestoria", "GESTORÍA", "administrativa", 13, [4, 4, 4, 4, 4, 0, 0], fechas),
    crearFila("b-juridico", "JURÍDICO", "administrativa", 15, [4, 4, 4, 4, 4, 0, 0], fechas),
  ];

  const facturacionDiaria: Record<string, number> = {
    lunes: 2200, martes: 2600, miércoles: 2900, jueves: 4300,
    viernes: 7100, sábado: 9200, domingo: 7800,
  };

  const facturacionAnoAnterior: Record<string, number> = {
    lunes: 2400, martes: 2800, miércoles: 3100, jueves: 4700,
    viernes: 7600, sábado: 10000, domingo: 8400,
  };

  const reservasDiarias: Record<string, number> = {
    lunes: 18, martes: 28, miércoles: 32, jueves: 52,
    viernes: 85, sábado: 115, domingo: 90,
  };

  const reservasAnoAnterior: Record<string, number> = {
    lunes: 20, martes: 32, miércoles: 36, jueves: 58,
    viernes: 92, sábado: 125, domingo: 100,
  };

  // Bacanal tiene tendencia ligeramente descendente
  const factorFact = 0.95;
  const factorRes = 0.93;

  const previsiones = calcularPrevisiones(
    facturacionDiaria, facturacionAnoAnterior,
    reservasDiarias, reservasAnoAnterior,
    factorFact, factorRes
  );

  const facturacionTotal = Object.values(facturacionDiaria).reduce((s, v) => s + v, 0);

  return {
    fechaInicio: inicio,
    fechaFin: "2026-04-05",
    filas,
    facturacionDiaria,
    facturacionTotal,
    previsiones,
    previsionFacturacionTotal: previsiones.reduce((s, d) => s + d.facturacionPrevista, 0),
    previsionReservasTotal: previsiones.reduce((s, d) => s + d.reservasPrevistas, 0),
    reservasRealesTotal: previsiones.reduce((s, d) => s + d.reservasReales, 0),
    datosAnoAnterior: {
      facturacionSemana: Object.values(facturacionAnoAnterior).reduce((s, v) => s + v, 0),
      reservasSemana: Object.values(reservasAnoAnterior).reduce((s, v) => s + v, 0),
    },
    tendencia: calcTendencia(factorFact, factorRes),
  };
}

export function getRatiosPorEmpresa(empresaId: string): SemanaRatio {
  if (empresaId === "bacanal") return buildBacanalSemana();
  return buildHabanaSemana();
}

export const DIAS_LABELS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function calcularResumenArea(filas: FilaRatio[], area: "operativa" | "administrativa") {
  const filtradas = filas.filter((f) => f.area === area);
  const porDia = DIAS_LABELS.map((dia) => ({
    dia,
    coste: filtradas.reduce((s, f) => s + (f.dias.find((d) => d.dia === dia)?.coste ?? 0), 0),
    horas: filtradas.reduce((s, f) => s + (f.dias.find((d) => d.dia === dia)?.horas ?? 0), 0),
  }));
  return {
    porDia,
    totalCoste: filtradas.reduce((s, f) => s + f.totalCoste, 0),
    totalHoras: filtradas.reduce((s, f) => s + f.totalHoras, 0),
  };
}
