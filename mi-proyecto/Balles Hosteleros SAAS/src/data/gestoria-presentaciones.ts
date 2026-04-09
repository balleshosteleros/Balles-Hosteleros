export type EstadoPresentacion = "completo" | "pendiente" | "fuera_de_plazo" | "en_revision" | "incompleto";

export interface DocumentoGestoria {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  fechaSubida?: string;
  subidoPor?: string;
  archivoUrl?: string;
  archivoNombre?: string;
}

export interface DocumentoRequerido {
  id: string;
  nombre: string;
  descripcion: string;
  obligatorio: boolean;
  documento?: DocumentoGestoria;
}

export interface DocumentoComplementario extends DocumentoGestoria {
  observaciones?: string;
}

export interface PeriodoTrimestral {
  id: string;
  trimestre: "1T" | "2T" | "3T" | "4T";
  anio: number;
  empresa: string;
  estado: EstadoPresentacion;
  fechaLimitePresentacion: string; // fecha oficial
  fechaLimiteSubida: string; // oficial + 10 días hábiles
  documentosRequeridos: DocumentoRequerido[];
  documentosComplementarios: DocumentoComplementario[];
}

export interface PeriodoAnual {
  id: string;
  anio: number;
  empresa: string;
  estado: EstadoPresentacion;
  fechaLimiteSubida: string;
  documentosRequeridos: DocumentoRequerido[];
  documentosComplementarios: DocumentoComplementario[];
}

export const ESTADOS_PRESENTACION: { value: EstadoPresentacion; label: string; color: string }[] = [
  { value: "completo", label: "Completo", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "pendiente", label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "fuera_de_plazo", label: "Fuera de plazo", color: "bg-red-100 text-red-800 border-red-200" },
  { value: "en_revision", label: "En revisión", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "incompleto", label: "Incompleto", color: "bg-orange-100 text-orange-800 border-orange-200" },
];

export const DOCUMENTOS_TRIMESTRALES_BASE = [
  { nombre: "Modelo 303 – IVA", descripcion: "Autoliquidación trimestral del IVA" },
  { nombre: "Modelo 111 – Retenciones IRPF", descripcion: "Retenciones e ingresos a cuenta del IRPF" },
  { nombre: "Modelo 115 – Retenciones alquileres", descripcion: "Retenciones por arrendamientos urbanos" },
  { nombre: "Modelo 349 – Operaciones intracomunitarias", descripcion: "Declaración recapitulativa de operaciones intracomunitarias" },
  { nombre: "Resguardo de presentación", descripcion: "Justificante de presentación telemática ante la AEAT" },
  { nombre: "Liquidación trimestral", descripcion: "Documento de liquidación del periodo" },
];

export const DOCUMENTOS_ANUALES_BASE = [
  { nombre: "Modelo 200 – Impuesto de Sociedades", descripcion: "Declaración anual del Impuesto sobre Sociedades" },
  { nombre: "Modelo 390 – Resumen anual IVA", descripcion: "Declaración resumen anual del IVA" },
  { nombre: "Modelo 190 – Resumen anual IRPF", descripcion: "Resumen anual de retenciones e ingresos a cuenta" },
  { nombre: "Modelo 180 – Resumen anual alquileres", descripcion: "Resumen anual de retenciones sobre arrendamientos" },
  { nombre: "Cuentas anuales", descripcion: "Balance, cuenta de pérdidas y ganancias, memoria" },
  { nombre: "Depósito en Registro Mercantil", descripcion: "Justificante de depósito de cuentas anuales" },
  { nombre: "Libros oficiales", descripcion: "Libro diario y libro de inventarios y cuentas anuales" },
];

// Helper: calcula fecha límite oficial trimestral (día 20 del mes siguiente al cierre)
function fechaLimiteTrimestral(anio: number, trimestre: number): string {
  const meses = [4, 7, 10, 1]; // meses siguientes al cierre de cada trimestre
  const mes = meses[trimestre - 1];
  const y = trimestre === 4 ? anio + 1 : anio;
  return `${y}-${String(mes).padStart(2, "0")}-20`;
}

// +10 días hábiles (simplificación: +14 días naturales)
function sumarDiasHabiles(fecha: string, dias: number): string {
  const d = new Date(fecha);
  let added = 0;
  while (added < dias) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().split("T")[0];
}

export function calcularEstadoAutomatico(periodo: PeriodoTrimestral | PeriodoAnual): EstadoPresentacion {
  const hoy = new Date();
  const limite = new Date(periodo.fechaLimiteSubida);
  const todosSubidos = periodo.documentosRequeridos.every((d) => !!d.documento);
  const algunoSubido = periodo.documentosRequeridos.some((d) => !!d.documento);

  if (todosSubidos) return "completo";
  if (hoy > limite && !todosSubidos) {
    return algunoSubido ? "incompleto" : "fuera_de_plazo";
  }
  if (algunoSubido) return "en_revision";
  return "pendiente";
}

function crearDocRequerido(base: { nombre: string; descripcion: string }, idx: number, prefix: string, doc?: Partial<DocumentoGestoria>): DocumentoRequerido {
  return {
    id: `${prefix}-${idx}`,
    nombre: base.nombre,
    descripcion: base.descripcion,
    obligatorio: true,
    documento: doc ? {
      id: `${prefix}-doc-${idx}`,
      nombre: doc.archivoNombre || base.nombre,
      descripcion: base.descripcion,
      tipo: "pdf",
      fechaSubida: doc.fechaSubida,
      subidoPor: doc.subidoPor,
      archivoUrl: doc.archivoUrl,
      archivoNombre: doc.archivoNombre,
    } : undefined,
  };
}

// ---------- HABANA ----------
const habanaTrimestrales: PeriodoTrimestral[] = [
  {
    id: "hab-1t-2026", trimestre: "1T", anio: 2026, empresa: "habana",
    estado: "completo",
    fechaLimitePresentacion: fechaLimiteTrimestral(2026, 1),
    fechaLimiteSubida: sumarDiasHabiles(fechaLimiteTrimestral(2026, 1), 10),
    documentosRequeridos: DOCUMENTOS_TRIMESTRALES_BASE.map((b, i) =>
      crearDocRequerido(b, i, "hab-1t26", { fechaSubida: "2026-04-22", subidoPor: "Gestoría López", archivoNombre: `${b.nombre}.pdf`, archivoUrl: "#" })
    ),
    documentosComplementarios: [
      { id: "hab-1t26-comp-1", nombre: "Carta complementaria AEAT", descripcion: "Respuesta a requerimiento", tipo: "pdf", fechaSubida: "2026-04-25", subidoPor: "Gestoría López", observaciones: "Requerimiento resuelto" },
    ],
  },
  {
    id: "hab-2t-2026", trimestre: "2T", anio: 2026, empresa: "habana",
    estado: "pendiente",
    fechaLimitePresentacion: fechaLimiteTrimestral(2026, 2),
    fechaLimiteSubida: sumarDiasHabiles(fechaLimiteTrimestral(2026, 2), 10),
    documentosRequeridos: DOCUMENTOS_TRIMESTRALES_BASE.map((b, i) =>
      crearDocRequerido(b, i, "hab-2t26")
    ),
    documentosComplementarios: [],
  },
  {
    id: "hab-3t-2025", trimestre: "3T", anio: 2025, empresa: "habana",
    estado: "completo",
    fechaLimitePresentacion: fechaLimiteTrimestral(2025, 3),
    fechaLimiteSubida: sumarDiasHabiles(fechaLimiteTrimestral(2025, 3), 10),
    documentosRequeridos: DOCUMENTOS_TRIMESTRALES_BASE.map((b, i) =>
      crearDocRequerido(b, i, "hab-3t25", { fechaSubida: "2025-10-22", subidoPor: "Gestoría López", archivoNombre: `${b.nombre}.pdf`, archivoUrl: "#" })
    ),
    documentosComplementarios: [],
  },
  {
    id: "hab-4t-2025", trimestre: "4T", anio: 2025, empresa: "habana",
    estado: "completo",
    fechaLimitePresentacion: fechaLimiteTrimestral(2025, 4),
    fechaLimiteSubida: sumarDiasHabiles(fechaLimiteTrimestral(2025, 4), 10),
    documentosRequeridos: DOCUMENTOS_TRIMESTRALES_BASE.map((b, i) =>
      crearDocRequerido(b, i, "hab-4t25", { fechaSubida: "2026-01-25", subidoPor: "Gestoría López", archivoNombre: `${b.nombre}.pdf`, archivoUrl: "#" })
    ),
    documentosComplementarios: [],
  },
];

const habanaAnuales: PeriodoAnual[] = [
  {
    id: "hab-anual-2025", anio: 2025, empresa: "habana",
    estado: "en_revision",
    fechaLimiteSubida: "2026-07-25",
    documentosRequeridos: DOCUMENTOS_ANUALES_BASE.map((b, i) =>
      crearDocRequerido(b, i, "hab-a25", i < 3 ? { fechaSubida: "2026-03-15", subidoPor: "Gestoría López", archivoNombre: `${b.nombre}.pdf`, archivoUrl: "#" } : undefined)
    ),
    documentosComplementarios: [],
  },
  {
    id: "hab-anual-2024", anio: 2024, empresa: "habana",
    estado: "completo",
    fechaLimiteSubida: "2025-07-25",
    documentosRequeridos: DOCUMENTOS_ANUALES_BASE.map((b, i) =>
      crearDocRequerido(b, i, "hab-a24", { fechaSubida: "2025-06-10", subidoPor: "Gestoría López", archivoNombre: `${b.nombre}.pdf`, archivoUrl: "#" })
    ),
    documentosComplementarios: [
      { id: "hab-a24-comp-1", nombre: "Acta junta general", descripcion: "Aprobación de cuentas", tipo: "pdf", fechaSubida: "2025-06-15", subidoPor: "Carlos Méndez", observaciones: "Aprobadas por unanimidad" },
    ],
  },
];

// ---------- BACANAL ----------
const bacanalTrimestrales: PeriodoTrimestral[] = [
  {
    id: "bac-1t-2026", trimestre: "1T", anio: 2026, empresa: "bacanal",
    estado: "incompleto",
    fechaLimitePresentacion: fechaLimiteTrimestral(2026, 1),
    fechaLimiteSubida: sumarDiasHabiles(fechaLimiteTrimestral(2026, 1), 10),
    documentosRequeridos: DOCUMENTOS_TRIMESTRALES_BASE.map((b, i) =>
      crearDocRequerido(b, i, "bac-1t26", i < 3 ? { fechaSubida: "2026-04-28", subidoPor: "Asesoría Martín", archivoNombre: `${b.nombre}.pdf`, archivoUrl: "#" } : undefined)
    ),
    documentosComplementarios: [],
  },
  {
    id: "bac-2t-2026", trimestre: "2T", anio: 2026, empresa: "bacanal",
    estado: "pendiente",
    fechaLimitePresentacion: fechaLimiteTrimestral(2026, 2),
    fechaLimiteSubida: sumarDiasHabiles(fechaLimiteTrimestral(2026, 2), 10),
    documentosRequeridos: DOCUMENTOS_TRIMESTRALES_BASE.map((b, i) =>
      crearDocRequerido(b, i, "bac-2t26")
    ),
    documentosComplementarios: [],
  },
];

const bacanalAnuales: PeriodoAnual[] = [
  {
    id: "bac-anual-2025", anio: 2025, empresa: "bacanal",
    estado: "pendiente",
    fechaLimiteSubida: "2026-07-25",
    documentosRequeridos: DOCUMENTOS_ANUALES_BASE.map((b, i) =>
      crearDocRequerido(b, i, "bac-a25")
    ),
    documentosComplementarios: [],
  },
];

export const TRIMESTRALES_POR_EMPRESA: Record<string, PeriodoTrimestral[]> = {
  habana: habanaTrimestrales,
  bacanal: bacanalTrimestrales,
};

export const ANUALES_POR_EMPRESA: Record<string, PeriodoAnual[]> = {
  habana: habanaAnuales,
  bacanal: bacanalAnuales,
};

export const TIPOS_DOCUMENTO_GESTORIA = [
  "Modelo tributario",
  "Resguardo",
  "Liquidación",
  "Certificado",
  "Escrito",
  "Requerimiento",
  "Complementaria",
  "Otros",
];
