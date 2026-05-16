export type ModalidadFirma = "click_to_sign" | "email_otp" | "manuscrita_digital";

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
  click_to_sign: "Click-to-sign",
  email_otp: "Email + código",
  manuscrita_digital: "Firma manuscrita",
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
  "click_to_sign",
  "email_otp",
  "manuscrita_digital",
];

export const VALIDECES_LEGAL: ValidezLegal[] = [
  "eidas_simple",
  "eidas_avanzada",
  "eidas_cualificada",
];
