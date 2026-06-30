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
  { variable: "{{enlace_documentacion}}", descripcion: "Enlace personal para que el candidato suba su documentación (solo plantilla Documentación)", grupo: "Candidato" },
  { variable: "{{enlace_formacion}}", descripcion: "Enlace de acceso a la formación (configurable en Ajustes → RRHH → Reclutamiento; solo plantilla Formación)", grupo: "Candidato" },
  { variable: "{{prueba_duracion_dias}}", descripcion: "Duración del periodo de prueba en días (configurable; solo plantilla Prueba)", grupo: "Candidato" },
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
  enlace_documentacion: "https://app.balleshosteleros.com/documentacion/ejemplo",
  enlace_formacion: "https://formacion.empresa.com",
  prueba_duracion_dias: "30",
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

// ─── Enlaces en el cuerpo ───────────────────────────────────────
/**
 * Sintaxis para insertar un enlace con texto visible dentro del cuerpo:
 * `[texto a mostrar](https://destino-externo.com)`. También se reconocen las
 * URLs sueltas (`https://…`), que se enlazan mostrando la propia dirección.
 */
export type SegmentoCuerpo =
  | { type: "text"; value: string }
  | { type: "link"; text: string; href: string };

/** Construye la sintaxis de enlace que se inserta en el editor. */
export function formatearEnlaceMarkdown(texto: string, url: string): string {
  const t = (texto || url).trim();
  return `[${t}](${url.trim()})`;
}

/** Divide una porción de texto en segmentos de texto + URLs sueltas enlazadas. */
function trocearUrlsSueltas(chunk: string, out: SegmentoCuerpo[]): void {
  const bare = /(https?:\/\/[^\s<)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = bare.exec(chunk)) !== null) {
    if (m.index > last) out.push({ type: "text", value: chunk.slice(last, m.index) });
    out.push({ type: "link", text: m[1], href: m[1] });
    last = bare.lastIndex;
  }
  if (last < chunk.length) out.push({ type: "text", value: chunk.slice(last) });
}

/**
 * Tokeniza el cuerpo en segmentos de texto y enlaces. Primero detecta los
 * enlaces con texto `[texto](url)` y, en lo que queda, las URLs sueltas. Lo
 * usan tanto la vista previa (cliente) como el render del email (servidor) para
 * que coincidan exactamente.
 */
export function parsearEnlacesCuerpo(texto: string): SegmentoCuerpo[] {
  const segments: SegmentoCuerpo[] = [];
  const mdLink = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = mdLink.exec(texto)) !== null) {
    if (m.index > lastIndex) trocearUrlsSueltas(texto.slice(lastIndex, m.index), segments);
    segments.push({ type: "link", text: m[1], href: m[2] });
    lastIndex = mdLink.lastIndex;
  }
  if (lastIndex < texto.length) trocearUrlsSueltas(texto.slice(lastIndex), segments);
  return segments;
}
