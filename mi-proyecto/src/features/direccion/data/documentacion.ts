export type NivelAcceso = "solo_direccion" | "solo_gerencia" | "lectura" | "edicion" | "privado" | "compartido_interno";
export type EstadoDocumento = "vigente" | "borrador" | "archivado" | "caducado" | "en_revision";
export type TipoArchivo = "pdf" | "docx" | "xlsx" | "pptx" | "jpg" | "png" | "otros";

export interface Documento {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  etiquetas: string[];
  empresa: string;
  creador: string;
  fechaSubida: string;
  ultimaActualizacion: string;
  tipoArchivo: TipoArchivo;
  tamano: string;
  estado: EstadoDocumento;
  nivelAcceso: NivelAcceso;
  permisos: { rol: string; accion: string }[];
  driveFileId?: string;
  driveUrl?: string;
  carpeta: string;
}

export const CATEGORIAS_DOCUMENTALES = [
  "Contratos",
  "Documentación Legal",
  "Documentación Societaria",
  "Documentación Financiera",
  "Documentación Interna",
  "Acuerdos",
  "Manuales Sensibles",
  "Otros",
];

export const NIVELES_ACCESO: { value: NivelAcceso; label: string }[] = [
  { value: "solo_direccion", label: "Solo Dirección" },
  { value: "solo_gerencia", label: "Solo Gerencia" },
  { value: "lectura", label: "Lectura" },
  { value: "edicion", label: "Edición" },
  { value: "privado", label: "Privado" },
  { value: "compartido_interno", label: "Compartido Interno" },
];

export const ESTADOS_DOCUMENTO: { value: EstadoDocumento; label: string }[] = [
  { value: "vigente", label: "Vigente" },
  { value: "borrador", label: "Borrador" },
  { value: "archivado", label: "Archivado" },
  { value: "caducado", label: "Caducado" },
  { value: "en_revision", label: "En revisión" },
];

export const CARPETAS = [
  "General",
  "Dirección",
  "Gerencia",
  "Legal",
  "Financiero",
  "RRHH",
];

const docsHabana: Documento[] = [
  {
    id: "hab-doc-1", nombre: "Contrato de alquiler local Habana", descripcion: "Contrato vigente del local principal",
    categoria: "Contratos", etiquetas: ["alquiler", "local"], empresa: "habana", creador: "Carlos Méndez",
    fechaSubida: "2025-11-10", ultimaActualizacion: "2026-01-15", tipoArchivo: "pdf", tamano: "2.4 MB",
    estado: "vigente", nivelAcceso: "solo_direccion", permisos: [{ rol: "admin", accion: "editar" }],
    driveFileId: "1abc_example", driveUrl: "https://drive.google.com/file/d/1abc_example", carpeta: "Legal",
  },
  {
    id: "hab-doc-2", nombre: "Escrituras de constitución", descripcion: "Escrituras de la sociedad HABANA S.L.",
    categoria: "Documentación Societaria", etiquetas: ["sociedad", "escrituras"], empresa: "habana", creador: "Carlos Méndez",
    fechaSubida: "2024-03-20", ultimaActualizacion: "2024-03-20", tipoArchivo: "pdf", tamano: "5.1 MB",
    estado: "vigente", nivelAcceso: "solo_direccion", permisos: [{ rol: "admin", accion: "ver" }],
    driveFileId: "2def_example", driveUrl: "https://drive.google.com/file/d/2def_example", carpeta: "Legal",
  },
  {
    id: "hab-doc-3", nombre: "Cuentas anuales 2025", descripcion: "Balance y cuenta de resultados ejercicio 2025",
    categoria: "Documentación Financiera", etiquetas: ["cuentas", "2025"], empresa: "habana", creador: "Laura Gómez",
    fechaSubida: "2026-02-01", ultimaActualizacion: "2026-03-10", tipoArchivo: "xlsx", tamano: "1.8 MB",
    estado: "vigente", nivelAcceso: "solo_gerencia", permisos: [{ rol: "gerencia", accion: "lectura" }],
    carpeta: "Financiero",
  },
  {
    id: "hab-doc-4", nombre: "Manual de operaciones interno", descripcion: "Procedimientos operativos del restaurante",
    categoria: "Manuales Sensibles", etiquetas: ["manual", "operaciones"], empresa: "habana", creador: "Ana Torres",
    fechaSubida: "2025-09-15", ultimaActualizacion: "2026-01-05", tipoArchivo: "docx", tamano: "3.2 MB",
    estado: "en_revision", nivelAcceso: "compartido_interno", permisos: [{ rol: "responsable", accion: "lectura" }],
    carpeta: "General",
  },
  {
    id: "hab-doc-5", nombre: "Acuerdo con proveedor bebidas", descripcion: "Condiciones comerciales con distribuidor principal",
    categoria: "Acuerdos", etiquetas: ["proveedor", "bebidas"], empresa: "habana", creador: "Carlos Méndez",
    fechaSubida: "2025-06-01", ultimaActualizacion: "2025-12-01", tipoArchivo: "pdf", tamano: "890 KB",
    estado: "vigente", nivelAcceso: "solo_gerencia", permisos: [{ rol: "gerencia", accion: "ver" }],
    driveFileId: "5ghi_example", driveUrl: "https://drive.google.com/file/d/5ghi_example", carpeta: "Dirección",
  },
  {
    id: "hab-doc-6", nombre: "Póliza de seguro RC", descripcion: "Póliza de responsabilidad civil vigente",
    categoria: "Documentación Legal", etiquetas: ["seguro", "RC"], empresa: "habana", creador: "Laura Gómez",
    fechaSubida: "2025-04-10", ultimaActualizacion: "2025-04-10", tipoArchivo: "pdf", tamano: "1.2 MB",
    estado: "caducado", nivelAcceso: "solo_direccion", permisos: [{ rol: "admin", accion: "ver" }],
    carpeta: "Legal",
  },
];

const docsBacanal: Documento[] = [
  {
    id: "bac-doc-1", nombre: "Contrato de alquiler local Bacanal", descripcion: "Contrato vigente del local Bacanal",
    categoria: "Contratos", etiquetas: ["alquiler", "local"], empresa: "bacanal", creador: "Pedro Ruiz",
    fechaSubida: "2025-10-05", ultimaActualizacion: "2026-02-20", tipoArchivo: "pdf", tamano: "2.1 MB",
    estado: "vigente", nivelAcceso: "solo_direccion", permisos: [{ rol: "admin", accion: "editar" }],
    driveFileId: "bac1_example", driveUrl: "https://drive.google.com/file/d/bac1_example", carpeta: "Legal",
  },
  {
    id: "bac-doc-2", nombre: "Licencia de actividad", descripcion: "Licencia municipal de apertura y actividad",
    categoria: "Documentación Legal", etiquetas: ["licencia", "actividad"], empresa: "bacanal", creador: "Pedro Ruiz",
    fechaSubida: "2024-08-15", ultimaActualizacion: "2024-08-15", tipoArchivo: "pdf", tamano: "4.0 MB",
    estado: "vigente", nivelAcceso: "solo_direccion", permisos: [{ rol: "admin", accion: "ver" }],
    carpeta: "Legal",
  },
  {
    id: "bac-doc-3", nombre: "Presupuesto reforma 2026", descripcion: "Presupuesto detallado de obras de reforma",
    categoria: "Documentación Financiera", etiquetas: ["presupuesto", "reforma"], empresa: "bacanal", creador: "María López",
    fechaSubida: "2026-01-20", ultimaActualizacion: "2026-03-28", tipoArchivo: "xlsx", tamano: "950 KB",
    estado: "borrador", nivelAcceso: "solo_gerencia", permisos: [{ rol: "gerencia", accion: "editar" }],
    carpeta: "Financiero",
  },
  {
    id: "bac-doc-4", nombre: "Protocolo de emergencias", descripcion: "Plan de evacuación y actuación ante emergencias",
    categoria: "Documentación Interna", etiquetas: ["emergencias", "protocolo"], empresa: "bacanal", creador: "Ana Torres",
    fechaSubida: "2025-07-01", ultimaActualizacion: "2025-12-15", tipoArchivo: "pdf", tamano: "1.5 MB",
    estado: "vigente", nivelAcceso: "compartido_interno", permisos: [{ rol: "responsable", accion: "lectura" }],
    carpeta: "General",
  },
];

export const DOCUMENTOS_POR_EMPRESA: Record<string, Documento[]> = {
  habana: docsHabana,
  bacanal: docsBacanal,
};
