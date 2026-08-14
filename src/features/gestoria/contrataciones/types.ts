/**
 * Visor de CONTRATACIONES (Gestoría) — SOLO LECTURA.
 *
 * Esta pantalla NO crea nada. Es el histórico de lo que RRHH ya ha enviado a la
 * gestoría por correo. Cada tipo se lee de su fuente real:
 *   · altas          → `gestoria_contrato_tokens` (una fila por alta enviada)
 *   · bajas          → `gestoria_bajas`
 *   · modificaciones → `empleado_promociones` (con `gestoria_enviado_at`)
 */

export type TipoContratacion = "alta" | "baja" | "modificacion";

/**
 * Estado del trámite de cara a la gestoría.
 *
 * ALTAS: hay documentación que la gestoría debe devolver (contrato) y que el
 * trabajador debe firmar, así que el estado sigue ese circuito.
 * BAJAS y MODIFICACIONES: no hay documento de vuelta; lo único que puede fallar
 * es que el correo no llegue a salir.
 */
export type EstadoTramite = "correcto" | "pendiente";

/** Qué falta exactamente cuando el estado es «pendiente». */
export type MotivoPendiente =
  | "contrato_gestoria" // la gestoría aún no ha subido el contrato
  | "firma_trabajador" // subido, pero el trabajador no lo ha firmado
  | "enlace_caducado" // el enlace de subida expiró sin contrato
  | "email_fallido" // el aviso a la gestoría no salió
  | "justificante_baja"; // falta el justificante de baja de la Seguridad Social

/** Nivel de alerta de la fila. `peligro` se pinta en rojo. */
export type NivelAviso = "ninguno" | "peligro";

export interface ContratacionRow {
  id: string;
  tipo: TipoContratacion;

  /** Empleado (puede ser null si su ficha se borró; el histórico se conserva). */
  empleado_id: string | null;
  nombre: string;
  dni_nie: string | null;
  puesto: string | null;

  /** Instante del aviso a la gestoría (fecha Y hora, en la zona de la empresa). */
  enviado_en: string;

  /**
   * Fecha clave del trámite, según el tipo:
   *   · alta          → día de comienzo del contrato
   *   · baja          → último día efectivo de trabajo
   *   · modificación  → fecha del cambio
   */
  fecha_evento: string | null;

  estado: EstadoTramite;
  pendiente_de: MotivoPendiente | null;

  /** Peligro: pendiente y la fecha del trámite ya llegó (o pasó). */
  aviso: NivelAviso;
  aviso_texto: string | null;

  /** Detalle propio de bajas. */
  tipo_baja_label?: string | null;
  motivo?: string | null;
  /** Detalle propio de modificaciones. */
  puesto_anterior?: string | null;
  puesto_nuevo?: string | null;
}
