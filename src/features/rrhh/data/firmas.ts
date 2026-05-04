export type ModalidadFirma =
  | "sms_otp"
  | "email_clave"
  | "biometrica"
  | "certificado_digital"
  | "manuscrita_digital"
  | "click_to_sign";

export type TipoDocumento =
  | "contrato"
  | "anexo_contrato"
  | "politica_rrhh"
  | "reglamento_interno"
  | "nda"
  | "recibo_nomina"
  | "amonestacion"
  | "cesion_imagen"
  | "horario"
  | "onboarding"
  | "finiquito"
  | "vacaciones"
  | "modificacion_contrato";

export type EstadoFirma =
  | "pendiente"
  | "firmado"
  | "rechazado"
  | "expirado"
  | "borrador";

export type ValidezLegal = "eidas_simple" | "eidas_avanzada" | "eidas_cualificada";

export interface DocumentoFirma {
  id: string;
  titulo: string;
  tipo: TipoDocumento;
  modalidad: ModalidadFirma;
  validez: ValidezLegal;
  estado: EstadoFirma;
  empleadoId: string;
  empleadoNombre: string;
  departamento: string;
  enviadoPor: string;
  enviadoEn: string;
  firmadoEn: string | null;
  expiraEn: string | null;
  ipFirma: string | null;
  hash: string | null;
  archivoUrl: string;
  observaciones?: string;
}

export const TIPO_LABEL: Record<TipoDocumento, string> = {
  contrato: "Contrato laboral",
  anexo_contrato: "Anexo de contrato",
  politica_rrhh: "Política RRHH",
  reglamento_interno: "Reglamento interno",
  nda: "Confidencialidad (NDA)",
  recibo_nomina: "Recibo de nómina",
  amonestacion: "Amonestación / Aviso",
  cesion_imagen: "Cesión de imagen",
  horario: "Acuse de horario",
  onboarding: "Onboarding",
  finiquito: "Finiquito",
  vacaciones: "Solicitud de vacaciones",
  modificacion_contrato: "Modificación contractual",
};

export const MODALIDAD_LABEL: Record<ModalidadFirma, string> = {
  sms_otp: "SMS + OTP",
  email_clave: "Email + clave",
  biometrica: "Firma biométrica (trazo)",
  certificado_digital: "Certificado digital",
  manuscrita_digital: "Manuscrita digitalizada",
  click_to_sign: "Click-to-sign",
};

export const VALIDEZ_LABEL: Record<ValidezLegal, string> = {
  eidas_simple: "eIDAS Simple",
  eidas_avanzada: "eIDAS Avanzada",
  eidas_cualificada: "eIDAS Cualificada",
};

export const ESTADO_LABEL: Record<EstadoFirma, string> = {
  pendiente: "Pendiente",
  firmado: "Firmado",
  rechazado: "Rechazado",
  expirado: "Expirado",
  borrador: "Borrador",
};

export const ESTADO_COLOR: Record<EstadoFirma, string> = {
  pendiente: "border-amber-300 bg-amber-50 text-amber-700",
  firmado: "border-emerald-300 bg-emerald-50 text-emerald-700",
  rechazado: "border-rose-300 bg-rose-50 text-rose-700",
  expirado: "border-zinc-300 bg-zinc-50 text-zinc-600",
  borrador: "border-sky-300 bg-sky-50 text-sky-700",
};

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  "contrato",
  "anexo_contrato",
  "politica_rrhh",
  "reglamento_interno",
  "nda",
  "recibo_nomina",
  "amonestacion",
  "cesion_imagen",
  "horario",
  "onboarding",
  "finiquito",
  "vacaciones",
  "modificacion_contrato",
];

export const MODALIDADES_FIRMA: ModalidadFirma[] = [
  "sms_otp",
  "email_clave",
  "biometrica",
  "certificado_digital",
  "manuscrita_digital",
  "click_to_sign",
];

export const VALIDECES_LEGAL: ValidezLegal[] = [
  "eidas_simple",
  "eidas_avanzada",
  "eidas_cualificada",
];

export const FIRMAS_MOCK: DocumentoFirma[] = [
  {
    id: "frm-001",
    titulo: "Contrato indefinido — Carlos Martínez",
    tipo: "contrato",
    modalidad: "certificado_digital",
    validez: "eidas_cualificada",
    estado: "firmado",
    empleadoId: "h1",
    empleadoNombre: "Carlos Martínez López",
    departamento: "CACHIMBEROS",
    enviadoPor: "Laura Sánchez",
    enviadoEn: "2026-04-22T09:14:00",
    firmadoEn: "2026-04-22T11:02:00",
    expiraEn: "2026-04-29T09:14:00",
    ipFirma: "188.74.12.34",
    hash: "0xa1c4...e7b9",
    archivoUrl: "#",
  },
  {
    id: "frm-002",
    titulo: "Política de protección de datos 2026",
    tipo: "politica_rrhh",
    modalidad: "click_to_sign",
    validez: "eidas_simple",
    estado: "pendiente",
    empleadoId: "h2",
    empleadoNombre: "María García Fernández",
    departamento: "JEFE DE SALA",
    enviadoPor: "Laura Sánchez",
    enviadoEn: "2026-04-30T08:30:00",
    firmadoEn: null,
    expiraEn: "2026-05-07T08:30:00",
    ipFirma: null,
    hash: null,
    archivoUrl: "#",
  },
  {
    id: "frm-003",
    titulo: "Recibo de nómina abril",
    tipo: "recibo_nomina",
    modalidad: "sms_otp",
    validez: "eidas_avanzada",
    estado: "firmado",
    empleadoId: "h4",
    empleadoNombre: "Laura Sánchez Moreno",
    departamento: "DIRECCIÓN",
    enviadoPor: "Sistema (auto-nóminas)",
    enviadoEn: "2026-04-30T18:00:00",
    firmadoEn: "2026-05-01T09:21:00",
    expiraEn: null,
    ipFirma: "90.166.21.7",
    hash: "0xfd23...91aa",
    archivoUrl: "#",
  },
  {
    id: "frm-004",
    titulo: "Anexo modificación de jornada",
    tipo: "anexo_contrato",
    modalidad: "biometrica",
    validez: "eidas_avanzada",
    estado: "pendiente",
    empleadoId: "h5",
    empleadoNombre: "Pedro Ruiz Navarro",
    departamento: "GERENTE",
    enviadoPor: "Laura Sánchez",
    enviadoEn: "2026-05-01T10:11:00",
    firmadoEn: null,
    expiraEn: "2026-05-08T10:11:00",
    ipFirma: null,
    hash: null,
    archivoUrl: "#",
  },
  {
    id: "frm-005",
    titulo: "NDA proveedor Ágora",
    tipo: "nda",
    modalidad: "certificado_digital",
    validez: "eidas_cualificada",
    estado: "firmado",
    empleadoId: "h8",
    empleadoNombre: "Sofía Martín Herrero",
    departamento: "RRPP",
    enviadoPor: "Pedro Ruiz",
    enviadoEn: "2026-04-15T12:40:00",
    firmadoEn: "2026-04-15T15:18:00",
    expiraEn: null,
    ipFirma: "37.11.250.88",
    hash: "0x4b71...c2ee",
    archivoUrl: "#",
  },
  {
    id: "frm-006",
    titulo: "Acuse de horario semana 18",
    tipo: "horario",
    modalidad: "click_to_sign",
    validez: "eidas_simple",
    estado: "firmado",
    empleadoId: "h6",
    empleadoNombre: "Ana López Díaz",
    departamento: "CAMAREROS",
    enviadoPor: "María García",
    enviadoEn: "2026-04-28T20:00:00",
    firmadoEn: "2026-04-29T07:42:00",
    expiraEn: null,
    ipFirma: "212.45.18.99",
    hash: "0x88ee...11dc",
    archivoUrl: "#",
  },
  {
    id: "frm-007",
    titulo: "Reglamento interno — actualización 2026",
    tipo: "reglamento_interno",
    modalidad: "email_clave",
    validez: "eidas_avanzada",
    estado: "pendiente",
    empleadoId: "h3",
    empleadoNombre: "Alejandro Ruiz Torres",
    departamento: "ARTISTAS",
    enviadoPor: "Laura Sánchez",
    enviadoEn: "2026-04-29T11:00:00",
    firmadoEn: null,
    expiraEn: "2026-05-06T11:00:00",
    ipFirma: null,
    hash: null,
    archivoUrl: "#",
  },
  {
    id: "frm-008",
    titulo: "Aviso disciplinario — retraso reiterado",
    tipo: "amonestacion",
    modalidad: "biometrica",
    validez: "eidas_avanzada",
    estado: "rechazado",
    empleadoId: "h9",
    empleadoNombre: "Diego Romero Blanco",
    departamento: "CACHIMBEROS",
    enviadoPor: "María García",
    enviadoEn: "2026-04-20T18:30:00",
    firmadoEn: null,
    expiraEn: "2026-04-27T18:30:00",
    ipFirma: null,
    hash: null,
    archivoUrl: "#",
    observaciones: "El empleado no acepta los términos.",
  },
  {
    id: "frm-009",
    titulo: "Cesión de imagen — campaña verano",
    tipo: "cesion_imagen",
    modalidad: "manuscrita_digital",
    validez: "eidas_simple",
    estado: "expirado",
    empleadoId: "h7",
    empleadoNombre: "Javier Fernández Castro",
    departamento: "MANTENIMIENTO",
    enviadoPor: "Sofía Martín",
    enviadoEn: "2026-03-30T09:00:00",
    firmadoEn: null,
    expiraEn: "2026-04-06T09:00:00",
    ipFirma: null,
    hash: null,
    archivoUrl: "#",
  },
  {
    id: "frm-010",
    titulo: "Onboarding — Pack de bienvenida",
    tipo: "onboarding",
    modalidad: "click_to_sign",
    validez: "eidas_simple",
    estado: "firmado",
    empleadoId: "h2",
    empleadoNombre: "María García Fernández",
    departamento: "JEFE DE SALA",
    enviadoPor: "Laura Sánchez",
    enviadoEn: "2026-02-12T08:00:00",
    firmadoEn: "2026-02-12T08:21:00",
    expiraEn: null,
    ipFirma: "188.74.12.34",
    hash: "0x77c2...49bd",
    archivoUrl: "#",
  },
  {
    id: "frm-011",
    titulo: "Solicitud de vacaciones — agosto",
    tipo: "vacaciones",
    modalidad: "sms_otp",
    validez: "eidas_avanzada",
    estado: "pendiente",
    empleadoId: "h8",
    empleadoNombre: "Sofía Martín Herrero",
    departamento: "RRPP",
    enviadoPor: "Sofía Martín",
    enviadoEn: "2026-05-01T16:42:00",
    firmadoEn: null,
    expiraEn: "2026-05-08T16:42:00",
    ipFirma: null,
    hash: null,
    archivoUrl: "#",
  },
  {
    id: "frm-012",
    titulo: "Modificación de contrato — subida salarial",
    tipo: "modificacion_contrato",
    modalidad: "certificado_digital",
    validez: "eidas_cualificada",
    estado: "borrador",
    empleadoId: "h4",
    empleadoNombre: "Laura Sánchez Moreno",
    departamento: "DIRECCIÓN",
    enviadoPor: "Pedro Ruiz",
    enviadoEn: "2026-05-02T10:00:00",
    firmadoEn: null,
    expiraEn: null,
    ipFirma: null,
    hash: null,
    archivoUrl: "#",
  },
];

export const EMPLEADOS_PARA_FIRMA: { id: string; nombre: string; departamento: string }[] = [
  { id: "h1", nombre: "Carlos Martínez López", departamento: "CACHIMBEROS" },
  { id: "h2", nombre: "María García Fernández", departamento: "JEFE DE SALA" },
  { id: "h3", nombre: "Alejandro Ruiz Torres", departamento: "ARTISTAS" },
  { id: "h4", nombre: "Laura Sánchez Moreno", departamento: "DIRECCIÓN" },
  { id: "h5", nombre: "Pedro Ruiz Navarro", departamento: "GERENTE" },
  { id: "h6", nombre: "Ana López Díaz", departamento: "CAMAREROS" },
  { id: "h7", nombre: "Javier Fernández Castro", departamento: "MANTENIMIENTO" },
  { id: "h8", nombre: "Sofía Martín Herrero", departamento: "RRPP" },
  { id: "h9", nombre: "Diego Romero Blanco", departamento: "CACHIMBEROS" },
];
