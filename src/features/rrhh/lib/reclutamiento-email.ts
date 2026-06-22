/**
 * Catálogo de CÓDIGOS (placeholders) de las plantillas de email de
 * Reclutamiento + motor de sustitución.
 *
 * Estos códigos son los que el usuario inserta en el editor (parte inferior de
 * cada email) y que en el envío se reemplazan por los datos reales del
 * candidato / vacante / empresa / reclutador.
 *
 * Módulo plano (sin "use server"): lo usan tanto el editor (cliente) para
 * pintar los botones y la vista previa como el resolver del servidor.
 */

/** Un código disponible para insertar en asunto/cuerpo. */
export interface VariableReclutamiento {
  /** Token tal cual se inserta, p.ej. "{{candidato_nombre}}". */
  variable: string;
  /** Descripción legible (tooltip). */
  descripcion: string;
  /** Grupo para agrupar visualmente en el editor. */
  grupo: "Candidato" | "Vacante" | "Empresa";
}

export const VARIABLES_RECLUTAMIENTO: VariableReclutamiento[] = [
  // ── Candidato ──
  { variable: "{{candidato_nombre}}", descripcion: "Nombre del candidato", grupo: "Candidato" },
  { variable: "{{candidato_apellidos}}", descripcion: "Apellidos del candidato", grupo: "Candidato" },
  { variable: "{{candidato_nombre_completo}}", descripcion: "Nombre y apellidos del candidato", grupo: "Candidato" },
  { variable: "{{candidato_email}}", descripcion: "Email del candidato", grupo: "Candidato" },
  { variable: "{{candidato_telefono}}", descripcion: "Teléfono del candidato", grupo: "Candidato" },
  // ── Vacante / puesto ──
  { variable: "{{vacante_nombre}}", descripcion: "Nombre de la vacante", grupo: "Vacante" },
  { variable: "{{vacante_ubicacion}}", descripcion: "Ubicación de la vacante", grupo: "Vacante" },
  { variable: "{{departamento_nombre}}", descripcion: "Departamento del puesto", grupo: "Vacante" },
  { variable: "{{tipo_jornada}}", descripcion: "Tipo de jornada de la vacante", grupo: "Vacante" },
  // ── Empresa ──
  { variable: "{{empresa_nombre}}", descripcion: "Nombre de la empresa", grupo: "Empresa" },
  { variable: "{{empresa_email}}", descripcion: "Correo de RRHH / contacto de la empresa", grupo: "Empresa" },
  { variable: "{{empresa_telefono}}", descripcion: "Teléfono de la empresa", grupo: "Empresa" },
  { variable: "{{empresa_web}}", descripcion: "Web de la empresa", grupo: "Empresa" },
  { variable: "{{empresa_direccion}}", descripcion: "Dirección de la empresa", grupo: "Empresa" },
];

/** Orden de los grupos para pintarlos en el editor. */
export const GRUPOS_VARIABLES_RECLUTAMIENTO: VariableReclutamiento["grupo"][] = [
  "Candidato",
  "Vacante",
  "Empresa",
];

/**
 * Datos de ejemplo para la vista previa del editor. Las claves coinciden con el
 * nombre interno del token (sin las llaves).
 */
export const VARIABLES_RECLUTAMIENTO_EJEMPLO: Record<string, string> = {
  candidato_nombre: "María",
  candidato_apellidos: "García López",
  candidato_nombre_completo: "María García López",
  candidato_email: "maria.garcia@email.com",
  candidato_telefono: "612 345 678",
  vacante_nombre: "Camarero/a",
  vacante_ubicacion: "Sala principal",
  departamento_nombre: "Sala",
  tipo_jornada: "Jornada completa",
  empresa_nombre: "Tu empresa",
  empresa_email: "rrhh@empresa.com",
  empresa_telefono: "912 345 678",
  empresa_web: "www.empresa.com",
  empresa_direccion: "Calle Mayor 1, Madrid",
};

/**
 * Sustituye los códigos `{{clave}}` por el valor correspondiente en `vars`.
 * Si un código no tiene valor (o no se reconoce), se sustituye por cadena vacía:
 * así NUNCA llega un `{{codigo}}` literal al destinatario del correo.
 */
export function sustituirVariablesReclutamiento(
  texto: string,
  vars: Record<string, string>,
): string {
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_full, key) => {
    const val = vars[String(key).toLowerCase()];
    return val != null && val !== "" ? val : "";
  });
}
