export type TipoContratacion = "alta" | "baja" | "modificacion";

export type EmailEstado = "pendiente" | "enviado" | "fallido";

export interface ContratacionRow {
  id: string;
  empresa_id: string;
  tipo: TipoContratacion;

  // Alta
  nombre: string | null;
  apellidos: string | null;
  dni: string | null;
  numero_ss: string | null;
  fecha_comienzo: string | null;
  nomina: string | null;
  puesto: string | null;
  jornada_horas: number | null;
  horario_lunes: string | null;
  horario_martes: string | null;
  horario_miercoles: string | null;
  horario_jueves: string | null;
  horario_viernes: string | null;
  horario_sabado: string | null;
  horario_domingo: string | null;

  // Baja
  empleado_id: string | null;
  fecha_finalizacion: string | null;
  motivo: string | null;
  motivo_otro: string | null;
  liquidar_vacaciones: boolean | null;
  dias_vacaciones: number | null;
  descontar_preaviso: boolean | null;
  dias_preaviso: number | null;

  // Modificación
  fecha_cambio: string | null;
  modificacion_tipo: string | null;
  modificacion_detalle: string | null;

  // Email
  email_to_gestoria: string | null;
  email_to_departamento: string | null;
  email_estado: EmailEstado;
  email_enviado_at: string | null;
  email_error: string | null;

  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface AltaInput {
  nombre: string;
  apellidos?: string;
  dni?: string;
  numero_ss?: string;
  fecha_comienzo: string;
  nomina?: string;
  puesto: string;
  jornada_horas: number;
  horario_lunes?: string;
  horario_martes?: string;
  horario_miercoles?: string;
  horario_jueves?: string;
  horario_viernes?: string;
  horario_sabado?: string;
  horario_domingo?: string;
}

export interface BajaInput {
  empleado_id: string;
  fecha_finalizacion: string;
  motivo: string;
  motivo_otro?: string;
  liquidar_vacaciones: boolean;
  dias_vacaciones?: number;
  descontar_preaviso: boolean;
  dias_preaviso?: number;
}

export interface ModificacionInput {
  empleado_id: string;
  fecha_cambio: string;
  modificacion_tipo: string;
  modificacion_detalle: string;
  // Cuando modificacion_tipo === "Puesto", el nuevo puesto destino (opcional, complementa el detalle).
  nuevo_puesto?: string;
}

export interface ContratacionesConfig {
  email_gestoria: string;
  email_departamento: string | null;
}

export interface EmpleadoActivo {
  id: string;
  nombre: string;
  apellidos: string | null;
  puesto: string | null;
}
