// ─── Fase principal (3 grupos) ──────────────────────────────────
// Incluye los nombres legacy ("nuevo", "en_progreso", "oferta",
// "seleccionado") para no romper historial antiguo en BD; el render
// activo solo usa los 3 nuevos.
export type FasePrincipal =
  | "seleccion"
  | "formacion"
  | "descartado"
  | "nuevo"
  | "en_progreso"
  | "oferta"
  | "seleccionado";

// ─── Estado interno (columna dentro de la fase) ─────────────────
export type EstadoReclutamiento =
  | "nuevo"
  | "elegido"
  | "papelera"
  | "entrevista"
  | "teorica"
  | "practica"
  | "prueba"
  | "empleado"
  | "no_se_presenta"
  | "suspenso_formacion";

// Keep old alias for backward compat in places that just need the estado
export type FaseReclutamiento = EstadoReclutamiento;

// ─── Género ────────────────────────────────────────────────────
export type Genero = "hombre" | "mujer" | "no_binario" | "prefiere_no_decir";

export const GENERO_LABELS: Record<Genero, string> = {
  hombre: "Hombre",
  mujer: "Mujer",
  no_binario: "No binario",
  prefiere_no_decir: "Prefiere no decirlo",
};

// ─── Fase config ────────────────────────────────────────────────
export interface FasePrincipalConfig {
  label: string;
  color: string;
  colorFrom: string;
  colorTo: string;
  estados: EstadoReclutamiento[];
}

// Solo las 3 fases canónicas se muestran en el pipeline; las legacy
// se mantienen como alias para que el historial antiguo se renderice
// sin crashear.
export const FASES_PRINCIPALES_ORDER: FasePrincipal[] = [
  "seleccion",
  "formacion",
  "descartado",
];

const SELECCION_CONFIG: FasePrincipalConfig = {
  label: "Selección",
  color: "hsl(220, 70%, 55%)",
  colorFrom: "hsl(220, 80%, 60%)",
  colorTo: "hsl(200, 70%, 50%)",
  estados: ["nuevo", "elegido", "entrevista"],
};

const FORMACION_CONFIG: FasePrincipalConfig = {
  label: "Formación",
  color: "hsl(145, 63%, 42%)",
  colorFrom: "hsl(145, 70%, 50%)",
  colorTo: "hsl(145, 55%, 35%)",
  estados: ["teorica", "practica", "prueba", "empleado"],
};

const DESCARTADO_CONFIG: FasePrincipalConfig = {
  label: "Descartado",
  color: "hsl(0, 72%, 51%)",
  colorFrom: "hsl(0, 80%, 58%)",
  colorTo: "hsl(0, 65%, 42%)",
  estados: ["papelera", "no_se_presenta", "suspenso_formacion"],
};

export const FASES_PRINCIPALES: Record<FasePrincipal, FasePrincipalConfig> = {
  seleccion: SELECCION_CONFIG,
  formacion: FORMACION_CONFIG,
  descartado: DESCARTADO_CONFIG,
  // Aliases legacy — apuntan a la fase nueva equivalente para que
  // FASES_PRINCIPALES[historialAntiguo.faseAnterior] siga devolviendo
  // un config válido sin crashear.
  nuevo: SELECCION_CONFIG,
  en_progreso: SELECCION_CONFIG,
  oferta: SELECCION_CONFIG,
  seleccionado: FORMACION_CONFIG,
};

// ─── Estado config ──────────────────────────────────────────────
export const ESTADOS_CONFIG: Record<EstadoReclutamiento, { label: string; color: string; icono: string }> = {
  // Todos los estados heredan el color oficial de su fase (Selección · Formación · Descartado).
  nuevo: { label: "Nuevo", color: "hsl(220, 70%, 55%)", icono: "📥" },
  elegido: { label: "Elegido", color: "hsl(220, 70%, 55%)", icono: "✏️" },
  papelera: { label: "Papelera", color: "hsl(0, 72%, 51%)", icono: "🗑️" },
  entrevista: { label: "Entrevista", color: "hsl(220, 70%, 55%)", icono: "📋" },
  teorica: { label: "Teórica", color: "hsl(145, 63%, 42%)", icono: "📋" },
  practica: { label: "Práctica", color: "hsl(145, 63%, 42%)", icono: "📋" },
  prueba: { label: "Prueba", color: "hsl(145, 63%, 42%)", icono: "📋" },
  empleado: { label: "Empleado", color: "hsl(145, 63%, 42%)", icono: "📋" },
  no_se_presenta: { label: "No se presenta", color: "hsl(0, 72%, 51%)", icono: "📋" },
  suspenso_formacion: { label: "Suspenso Formación", color: "hsl(0, 72%, 51%)", icono: "📋" },
};

// Flat order of all estados (for legacy compat)
export const FASES_ORDER: EstadoReclutamiento[] = [
  "nuevo", "elegido", "entrevista", "teorica", "practica", "prueba", "empleado", "papelera", "no_se_presenta", "suspenso_formacion",
];

// Legacy alias
export const FASES_CONFIG = ESTADOS_CONFIG;

// ─── Helper: get the fase principal (canónica) for a given estado ──
export function getFasePrincipal(estado: EstadoReclutamiento): FasePrincipal {
  if (SELECCION_CONFIG.estados.includes(estado)) return "seleccion";
  if (FORMACION_CONFIG.estados.includes(estado)) return "formacion";
  if (DESCARTADO_CONFIG.estados.includes(estado)) return "descartado";
  return "seleccion";
}

// ─── Origen ─────────────────────────────────────────────────────
export type OrigenCandidatura =
  | "web"
  | "formulario"
  | "redes_sociales"
  | "recomendacion"
  | "base_datos"
  | "portal_empleo"
  | "otros";

// ─── Historial ──────────────────────────────────────────────────
export interface HistorialCambioFase {
  id: string;
  faseAnterior: FasePrincipal;
  estadoAnterior: EstadoReclutamiento;
  faseNueva: FasePrincipal;
  estadoNuevo: EstadoReclutamiento;
  usuario: string;
  fecha: string;
  emailEnviado: boolean;
}

// ─── Reseñas / Notas / Criterios ───────────────────────────────
export interface CriterioResena {
  id: string;
  nombre: string;
}

// Los 5 puntos canónicos que el reclutador valora tras la entrevista. Lista
// fija e igual para todas las empresas (hostelería): pensados para medir lo que
// más importa hoy en sala/cocina, no solo la experiencia técnica.
export const CRITERIOS_RESENA_DEFAULT: CriterioResena[] = [
  { id: "actitud", nombre: "Actitud y motivación" },
  { id: "experiencia", nombre: "Experiencia y aptitud para el puesto" },
  { id: "comunicacion", nombre: "Comunicación y trato" },
  { id: "trabajo_equipo", nombre: "Trabajo en equipo" },
  { id: "disponibilidad", nombre: "Disponibilidad y flexibilidad horaria" },
];

export interface ResenaCriterio {
  criterioId: string;
  estrellas: number;
}

export interface ResenaCandidato {
  id: string;
  autor: string;
  fecha: string;
  puntuaciones: ResenaCriterio[];
  comentario?: string;
}

export interface NotaCandidato {
  id: string;
  autor: string;
  fecha: string;
  texto: string;
}

// ─── Candidato ──────────────────────────────────────────────────
export interface Candidato {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;
  cvAdjunto?: string;
  cvTamanoKb?: number;
  fechaInscripcion: string;
  origen: OrigenCandidatura;
  /** Canal concreto por el que entró el CV (nombre del enlace de empleo), si aplica. */
  canal?: string | null;
  notasInternas: string;
  fase: EstadoReclutamiento;
  vacanteId: string;
  reclutadorAsignado: string;
  historial: HistorialCambioFase[];
  // Extensiones del refactor 2026-05 (todos opcionales para no romper BD)
  ubicacion?: string;
  genero?: Genero;
  expectativasSalariales?: string;
  disponibleDesde?: string;
  sobreTi?: string;
  resenas?: ResenaCandidato[];
  notas?: NotaCandidato[];
  marcadoComoNoVisto?: boolean;
}

// ─── Email plantillas por estado ────────────────────────────────
export const EMAIL_PLANTILLAS_FASE: Record<EstadoReclutamiento, { asunto: string; cuerpo: string; activo: boolean }> = {
  nuevo: { asunto: "Hemos recibido tu candidatura", cuerpo: "Tu candidatura ha sido registrada correctamente. Nos pondremos en contacto contigo próximamente.", activo: true },
  elegido: { asunto: "Has sido preseleccionado/a", cuerpo: "Nos complace informarte de que has sido preseleccionado/a para avanzar en el proceso de selección.", activo: true },
  entrevista: { asunto: "Convocatoria a entrevista", cuerpo: "Queremos invitarte a una entrevista. En breve recibirás los detalles de fecha y hora.", activo: true },
  teorica: { asunto: "Prueba teórica programada", cuerpo: "Te informamos de que pasas a la fase de prueba teórica. Te enviaremos los detalles próximamente.", activo: true },
  practica: { asunto: "Prueba práctica programada", cuerpo: "Avanzas a la fase de prueba práctica. Recibirás instrucciones en breve.", activo: true },
  prueba: { asunto: "Periodo de prueba", cuerpo: "Has avanzado al periodo de prueba. ¡Enhorabuena!", activo: true },
  empleado: { asunto: "¡Bienvenido/a al equipo!", cuerpo: "Nos complace comunicarte que has sido seleccionado/a para incorporarte al equipo. ¡Enhorabuena!", activo: true },
  no_se_presenta: { asunto: "Estado de tu candidatura", cuerpo: "Lamentamos informarte de que tu candidatura ha sido marcada como no presentada.", activo: true },
  suspenso_formacion: { asunto: "Resultado de la formación", cuerpo: "Te informamos del resultado de tu fase de formación.", activo: true },
  papelera: { asunto: "Actualización de tu candidatura", cuerpo: "Te informamos de que tu candidatura no continúa en el proceso de selección actual.", activo: true },
};

// ─── Vacante ────────────────────────────────────────────────────
export type EstadoPublicacion = "publicada" | "borrador" | "cerrada" | "archivada";
export type TipoJornada = "completa" | "parcial" | "temporal" | "indefinido" | "practicas";

export interface Vacante {
  id: string;
  puesto: string;
  categoria: string;
  ubicacion: string;
  tipoJornada: TipoJornada;
  estadoPublicacion: EstadoPublicacion;
  fechaCreacion: string;
  cuestionario: boolean;
  reclutadores: string[];
  favorita: boolean;
  candidatos: Candidato[];
  empresaId: string;
  /** Posición manual fijada por drag & drop (mismo orden en el portal público). */
  orden?: number | null;
}

// ─── Métricas del embudo ───────────────────────────────────────
export interface FilaEmbudo {
  estado: EstadoReclutamiento;
  label: string;
  count: number;
  porcentaje: number;
  color: string;
}

export interface MetricasEmbudo {
  totalBase: number;
  grupoSeleccion: { count: number; porcentaje: number };
  grupoFormacion: { count: number; porcentaje: number };
  grupoDescartado: { count: number; porcentaje: number };
  progreso: FilaEmbudo[];
  descartado: FilaEmbudo[];
}

export function calcularMetricasEmbudo(candidatos: Candidato[]): MetricasEmbudo {
  const totalBase = candidatos.length;
  const counts = contarCandidatosPorFase(candidatos);

  const sumEstados = (estados: EstadoReclutamiento[]) =>
    estados.reduce((acc, e) => acc + (counts[e] || 0), 0);

  const seleccionCount = sumEstados(SELECCION_CONFIG.estados);
  const formacionCount = sumEstados(FORMACION_CONFIG.estados);
  const descartadoCount = sumEstados(DESCARTADO_CONFIG.estados);

  const pct = (n: number) =>
    totalBase === 0 ? 0 : Math.round((n / totalBase) * 1000) / 10;

  const filaEstado = (estado: EstadoReclutamiento): FilaEmbudo => ({
    estado,
    label: ESTADOS_CONFIG[estado].label,
    count: counts[estado] || 0,
    porcentaje: pct(counts[estado] || 0),
    color: ESTADOS_CONFIG[estado].color,
  });

  return {
    totalBase,
    grupoSeleccion: { count: seleccionCount, porcentaje: pct(seleccionCount) },
    grupoFormacion: { count: formacionCount, porcentaje: pct(formacionCount) },
    grupoDescartado: { count: descartadoCount, porcentaje: pct(descartadoCount) },
    progreso: [
      ...SELECCION_CONFIG.estados.map(filaEstado),
      ...FORMACION_CONFIG.estados.map(filaEstado),
    ],
    descartado: DESCARTADO_CONFIG.estados.map(filaEstado),
  };
}

export function contarCandidatosPorFase(candidatos: Candidato[]): Record<EstadoReclutamiento, number> {
  const counts = {} as Record<EstadoReclutamiento, number>;
  for (const f of FASES_ORDER) counts[f] = 0;
  for (const c of candidatos) counts[c.fase]++;
  return counts;
}

export const TIPO_JORNADA_LABELS: Record<TipoJornada, string> = {
  completa: "Jornada completa",
  parcial: "Jornada parcial",
  temporal: "Temporal",
  indefinido: "Indefinido",
  practicas: "Prácticas",
};

export const ESTADO_PUBLICACION_LABELS: Record<EstadoPublicacion, string> = {
  publicada: "Publicada",
  borrador: "Borrador",
  cerrada: "Cerrada",
  archivada: "Archivada",
};

export const ORIGEN_LABELS: Record<OrigenCandidatura, string> = {
  web: "Web principal",
  formulario: "Formulario",
  redes_sociales: "Redes sociales",
  recomendacion: "Recomendación",
  base_datos: "Base de datos",
  portal_empleo: "Portal de empleo",
  otros: "Otros",
};

// ─── Reglas de movimiento entre estados ─────────────────────────
// Movimiento libre: un candidato puede moverse a cualquier estado/fase, hacia
// delante o hacia atrás, sin tener que pasar por los intermedios. La única
// restricción es no soltarlo en su mismo estado.
const CADENA_PROGRESO: EstadoReclutamiento[] = [
  "nuevo",
  "elegido",
  "entrevista",
  "teorica",
  "practica",
  "prueba",
  "empleado",
];

export function puedeMoverA(
  origen: EstadoReclutamiento,
  destino: EstadoReclutamiento,
): boolean {
  return origen !== destino;
}

export function siguienteEstado(
  origen: EstadoReclutamiento,
): EstadoReclutamiento | null {
  const idx = CADENA_PROGRESO.indexOf(origen);
  if (idx === -1 || idx >= CADENA_PROGRESO.length - 1) return null;
  return CADENA_PROGRESO[idx + 1];
}
