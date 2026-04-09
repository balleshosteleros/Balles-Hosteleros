export type EstadoVencimiento = "AL DÍA" | "PRÓXIMO" | "VENCIDO" | "EN REVISIÓN" | "COMPLETADO";
export type Frecuencia = "ÚNICA" | "MENSUAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL" | "PERSONALIZADA";
export type CategoriaVencimiento = "PERMISO" | "SEGURO" | "REVISIÓN" | "MANTENIMIENTO" | "INSPECCIÓN" | "RENOVACIÓN" | "OBLIGACIÓN" | "OTRO";

export interface HistorialRevision {
  id: string;
  fecha: string;
  resultado: string;
  realizadoPor: string;
  observaciones: string;
}

export interface Vencimiento {
  id: string;
  nombre: string;
  tipo: string;
  local: string;
  categoria: CategoriaVencimiento;
  fechaVencimiento: string;
  frecuencia: Frecuencia;
  estado: EstadoVencimiento;
  responsable: string;
  proveedorExterno: string;
  observaciones: string;
  documentacion: string;
  historial: HistorialRevision[];
}

export const CATEGORIAS: CategoriaVencimiento[] = ["PERMISO", "SEGURO", "REVISIÓN", "MANTENIMIENTO", "INSPECCIÓN", "RENOVACIÓN", "OBLIGACIÓN", "OTRO"];
export const FRECUENCIAS: Frecuencia[] = ["ÚNICA", "MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL", "PERSONALIZADA"];
export const ESTADOS_VENCIMIENTO: EstadoVencimiento[] = ["AL DÍA", "PRÓXIMO", "VENCIDO", "EN REVISIÓN", "COMPLETADO"];
export const TIPOS_VENCIMIENTO = ["LICENCIA", "SEGURO", "REVISIÓN TÉCNICA", "MANTENIMIENTO PERIÓDICO", "INSPECCIÓN OFICIAL", "CERTIFICADO", "CONTRATO", "OTRO"];
export const LOCALES_VENCIMIENTO = ["HABANA", "BACANAL", "CENTRAL", "TERRAZA", "ALMACÉN", "TODOS"];
export const RESPONSABLES = ["GERENCIA", "DIRECCIÓN", "MANTENIMIENTO", "ADMINISTRACIÓN", "PROVEEDOR EXTERNO"];

export function calcularEstado(fechaVencimiento: string): EstadoVencimiento {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaVencimiento);
  fecha.setHours(0, 0, 0, 0);
  const diffDias = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias < 0) return "VENCIDO";
  if (diffDias <= 30) return "PRÓXIMO";
  return "AL DÍA";
}

export const SAMPLE_VENCIMIENTOS: Vencimiento[] = [
  {
    id: "v1", nombre: "Permiso de terraza", tipo: "LICENCIA", local: "HABANA", categoria: "PERMISO",
    fechaVencimiento: "2026-05-15", frecuencia: "ANUAL", estado: "PRÓXIMO", responsable: "GERENCIA",
    proveedorExterno: "", observaciones: "Renovar antes del 15 de mayo. Presentar documentación en el Ayuntamiento.",
    documentacion: "", historial: [
      { id: "h1", fecha: "2025-05-10", resultado: "Renovado", realizadoPor: "GERENCIA", observaciones: "Renovación sin incidencias." },
    ],
  },
  {
    id: "v2", nombre: "Seguro del local", tipo: "SEGURO", local: "HABANA", categoria: "SEGURO",
    fechaVencimiento: "2026-09-01", frecuencia: "ANUAL", estado: "AL DÍA", responsable: "ADMINISTRACIÓN",
    proveedorExterno: "Mapfre", observaciones: "Póliza todo riesgo. Incluye responsabilidad civil.",
    documentacion: "", historial: [],
  },
  {
    id: "v3", nombre: "Revisión de aires acondicionados", tipo: "REVISIÓN TÉCNICA", local: "BACANAL", categoria: "REVISIÓN",
    fechaVencimiento: "2026-04-20", frecuencia: "SEMESTRAL", estado: "PRÓXIMO", responsable: "MANTENIMIENTO",
    proveedorExterno: "Climafrío S.L.", observaciones: "Revisar filtros y gas refrigerante de todas las unidades.",
    documentacion: "", historial: [
      { id: "h2", fecha: "2025-10-18", resultado: "OK", realizadoPor: "Climafrío S.L.", observaciones: "Se cambiaron filtros." },
    ],
  },
  {
    id: "v4", nombre: "Extintores – Revisión trimestral", tipo: "REVISIÓN TÉCNICA", local: "TODOS", categoria: "INSPECCIÓN",
    fechaVencimiento: "2026-06-30", frecuencia: "TRIMESTRAL", estado: "AL DÍA", responsable: "DIRECCIÓN",
    proveedorExterno: "Extintores Madrid", observaciones: "Incluye todos los locales. 14 extintores en total.",
    documentacion: "", historial: [],
  },
  {
    id: "v5", nombre: "Control de plagas", tipo: "MANTENIMIENTO PERIÓDICO", local: "HABANA", categoria: "MANTENIMIENTO",
    fechaVencimiento: "2026-04-10", frecuencia: "MENSUAL", estado: "PRÓXIMO", responsable: "GERENCIA",
    proveedorExterno: "Rentokil", observaciones: "Desinsectación y desratización mensual.",
    documentacion: "", historial: [
      { id: "h3", fecha: "2026-03-10", resultado: "Sin incidencias", realizadoPor: "Rentokil", observaciones: "" },
    ],
  },
  {
    id: "v6", nombre: "Revisión de ambientadores", tipo: "REVISIÓN TÉCNICA", local: "BACANAL", categoria: "REVISIÓN",
    fechaVencimiento: "2026-04-25", frecuencia: "MENSUAL", estado: "PRÓXIMO", responsable: "MANTENIMIENTO",
    proveedorExterno: "Ambientadores Pro", observaciones: "Recarga de difusores en baños y entrada.",
    documentacion: "", historial: [],
  },
  {
    id: "v7", nombre: "Certificado PRL", tipo: "CERTIFICADO", local: "TODOS", categoria: "OBLIGACIÓN",
    fechaVencimiento: "2026-12-31", frecuencia: "ANUAL", estado: "AL DÍA", responsable: "ADMINISTRACIÓN",
    proveedorExterno: "Prevención Total S.L.", observaciones: "Plan de prevención de riesgos laborales vigente.",
    documentacion: "", historial: [],
  },
  {
    id: "v8", nombre: "Revisión de baños", tipo: "REVISIÓN TÉCNICA", local: "HABANA", categoria: "REVISIÓN",
    fechaVencimiento: "2026-03-15", frecuencia: "MENSUAL", estado: "VENCIDO", responsable: "MANTENIMIENTO",
    proveedorExterno: "", observaciones: "Comprobar cisternas, grifería y limpieza profunda.",
    documentacion: "", historial: [],
  },
  {
    id: "v9", nombre: "Seguro de responsabilidad civil", tipo: "SEGURO", local: "BACANAL", categoria: "SEGURO",
    fechaVencimiento: "2026-11-15", frecuencia: "ANUAL", estado: "AL DÍA", responsable: "ADMINISTRACIÓN",
    proveedorExterno: "AXA Seguros", observaciones: "Cobertura hasta 600.000€.",
    documentacion: "", historial: [],
  },
  {
    id: "v10", nombre: "Inspección sanitaria", tipo: "INSPECCIÓN OFICIAL", local: "HABANA", categoria: "INSPECCIÓN",
    fechaVencimiento: "2026-07-01", frecuencia: "ANUAL", estado: "AL DÍA", responsable: "DIRECCIÓN",
    proveedorExterno: "", observaciones: "Inspección de sanidad programada para julio.",
    documentacion: "", historial: [],
  },
];
