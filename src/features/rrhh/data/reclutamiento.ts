// ─── Fase principal (3 grupos) ──────────────────────────────────
// El pipeline tiene 3 grupos: Selección · Onboarding · Descartado.
// «Onboarding» agrupa como sub-columnas: Formación · Contratación · Prueba ·
// Empleado. Se mantienen los nombres legacy de fase para historial antiguo.
export type FasePrincipal =
  | "seleccion"
  | "onboarding"
  | "descartado"
  // Aliases legacy de fase (historial antiguo en BD; mapean a las 3 nuevas)
  | "formacion"
  | "contratacion"
  | "prueba"
  | "empleado"
  | "nuevo"
  | "en_progreso"
  | "oferta"
  | "seleccionado";

// ─── Estado interno (columna dentro de la fase) ─────────────────
// El pipeline tiene 8 columnas: 4 de Selección + las 4 del Onboarding
// (formacion, contratacion, prueba, empleado) + las de Descartado.
// El detalle del avance dentro de «contratacion» (alta a gestoría, contrato
// interno/oficial firmado…) NO es un estado de columna: se gestiona de forma
// automática por dentro y se ve en la ficha, no en el pipeline.
export type EstadoReclutamiento =
  | "nuevo"
  | "elegido"
  | "papelera"
  | "entrevista"
  | "documentacion"
  // ── Onboarding (4 columnas) ──
  | "formacion"
  | "contratacion"
  | "prueba"
  | "empleado"
  // ── Descartado ──
  | "no_se_presenta"
  | "suspenso_formacion"
  // ── Estados legacy (historial antiguo; mapean a Formación / Contratación) ──
  | "teorica"
  | "practica"
  | "alta_pendiente_revision"
  | "alta_enviada"
  | "contrato_interno_firmado"
  | "contrato_oficial_subido"
  | "contrato_oficial_firmado"
  | "alta_completada";

// Keep old alias for backward compat in places that just need the estado
export type FaseReclutamiento = EstadoReclutamiento;

// ─── Género ────────────────────────────────────────────────────
// Solo dos valores: el formulario público de empleo captura masculino/femenino.
export type Genero = "masculino" | "femenino";

export const GENERO_LABELS: Record<Genero, string> = {
  masculino: "Masculino",
  femenino: "Femenino",
};

// ─── Disponibilidad de incorporación ───────────────────────────
export type Disponibilidad = "inmediato" | "15_dias";

export const DISPONIBILIDAD_LABELS: Record<Disponibilidad, string> = {
  inmediato: "Inmediato",
  "15_dias": "En 15 días",
};

// ─── Experiencia previa ────────────────────────────────────────
// 4 tramos: sin experiencia + 3 rangos, el último abierto (infinito).
export type ExperienciaPrevia = "sin_experiencia" | "menos_1" | "de_1_a_5" | "mas_5";

export const EXPERIENCIA_PREVIA_LABELS: Record<ExperienciaPrevia, string> = {
  sin_experiencia: "Sin experiencia",
  menos_1: "Menos de 1 año",
  de_1_a_5: "De 1 a 5 años",
  mas_5: "Más de 5 años",
};

// Orden de presentación en selectores.
export const EXPERIENCIA_PREVIA_OPCIONES = (
  Object.keys(EXPERIENCIA_PREVIA_LABELS) as ExperienciaPrevia[]
).map((value) => ({ value, label: EXPERIENCIA_PREVIA_LABELS[value] }));

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
// 3 fases canónicas en el pipeline: Selección · Onboarding · Descartado.
export const FASES_PRINCIPALES_ORDER: FasePrincipal[] = [
  "seleccion",
  "onboarding",
  "descartado",
];

const SELECCION_CONFIG: FasePrincipalConfig = {
  label: "Selección",
  color: "hsl(220, 70%, 55%)",
  colorFrom: "hsl(220, 80%, 60%)",
  colorTo: "hsl(200, 70%, 50%)",
  estados: ["nuevo", "elegido", "entrevista", "documentacion"],
};

// «Onboarding»: una sola fase con 4 sub-columnas (Formación · Contratación ·
// Prueba · Empleado). Cada una mantiene su color propio de columna; la cabecera
// de la fase usa el verde de incorporación.
const ONBOARDING_CONFIG: FasePrincipalConfig = {
  label: "Onboarding",
  color: "hsl(145, 63%, 42%)",
  colorFrom: "hsl(145, 70%, 50%)",
  colorTo: "hsl(145, 55%, 35%)",
  estados: ["formacion", "contratacion", "prueba", "empleado"],
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
  onboarding: ONBOARDING_CONFIG,
  descartado: DESCARTADO_CONFIG,
  // Aliases legacy de fase — apuntan a la fase nueva equivalente para que
  // FASES_PRINCIPALES[historialAntiguo.faseAnterior] siga devolviendo un config
  // válido sin crashear.
  formacion: ONBOARDING_CONFIG,
  contratacion: ONBOARDING_CONFIG,
  prueba: ONBOARDING_CONFIG,
  empleado: ONBOARDING_CONFIG,
  nuevo: SELECCION_CONFIG,
  en_progreso: SELECCION_CONFIG,
  oferta: SELECCION_CONFIG,
  seleccionado: ONBOARDING_CONFIG,
};

// ─── Estado config ──────────────────────────────────────────────
export const ESTADOS_CONFIG: Record<EstadoReclutamiento, { label: string; color: string; icono: string }> = {
  // Cada estado hereda el color oficial de su fase.
  nuevo: { label: "Nuevo", color: "hsl(220, 70%, 55%)", icono: "📥" },
  elegido: { label: "Elegido", color: "hsl(220, 70%, 55%)", icono: "✏️" },
  papelera: { label: "Papelera", color: "hsl(0, 72%, 51%)", icono: "🗑️" },
  entrevista: { label: "Entrevista", color: "hsl(220, 70%, 55%)", icono: "📋" },
  documentacion: { label: "Documentación", color: "hsl(220, 70%, 55%)", icono: "📄" },
  // ── Onboarding: 4 columnas ──
  formacion: { label: "Formación", color: "hsl(145, 63%, 42%)", icono: "🎓" },
  contratacion: { label: "Contratación", color: "hsl(38, 92%, 50%)", icono: "📝" },
  prueba: { label: "Prueba", color: "hsl(265, 60%, 55%)", icono: "⏳" },
  empleado: { label: "Empleado", color: "hsl(145, 63%, 42%)", icono: "👤" },
  // ── Descartado ──
  no_se_presenta: { label: "No se presenta", color: "hsl(0, 72%, 51%)", icono: "📋" },
  suspenso_formacion: { label: "Suspenso Formación", color: "hsl(0, 72%, 51%)", icono: "📋" },
  // ── Legacy (mapean visualmente a su columna nueva; NO se muestran) ──
  teorica: { label: "Formación", color: "hsl(145, 63%, 42%)", icono: "🎓" },
  practica: { label: "Formación", color: "hsl(145, 63%, 42%)", icono: "🎓" },
  alta_pendiente_revision: { label: "Contratación", color: "hsl(38, 92%, 50%)", icono: "📝" },
  alta_enviada: { label: "Contratación", color: "hsl(38, 92%, 50%)", icono: "📝" },
  contrato_interno_firmado: { label: "Contratación", color: "hsl(38, 92%, 50%)", icono: "📝" },
  contrato_oficial_subido: { label: "Contratación", color: "hsl(38, 92%, 50%)", icono: "📝" },
  contrato_oficial_firmado: { label: "Contratación", color: "hsl(38, 92%, 50%)", icono: "📝" },
  alta_completada: { label: "Contratación", color: "hsl(38, 92%, 50%)", icono: "📝" },
};

// Estados legacy → su columna nueva (para getFasePrincipal e historial).
const LEGACY_A_FORMACION = new Set<EstadoReclutamiento>(["teorica", "practica"]);
const LEGACY_A_CONTRATACION = new Set<EstadoReclutamiento>([
  "alta_pendiente_revision", "alta_enviada", "contrato_interno_firmado",
  "contrato_oficial_subido", "contrato_oficial_firmado", "alta_completada",
]);

// Flat order of all estados (for legacy compat)
export const FASES_ORDER: EstadoReclutamiento[] = [
  "nuevo", "elegido", "entrevista", "documentacion",
  "formacion", "contratacion", "prueba", "empleado",
  "papelera", "no_se_presenta", "suspenso_formacion",
  // legacy (no se muestran como columnas; siguen siendo válidos en BD/historial)
  "teorica", "practica",
  "alta_pendiente_revision", "alta_enviada", "contrato_interno_firmado",
  "contrato_oficial_subido", "contrato_oficial_firmado", "alta_completada",
];

// Legacy alias
export const FASES_CONFIG = ESTADOS_CONFIG;

// ─── Helper: get the fase principal (canónica) for a given estado ──
export function getFasePrincipal(estado: EstadoReclutamiento): FasePrincipal {
  if (SELECCION_CONFIG.estados.includes(estado)) return "seleccion";
  if (DESCARTADO_CONFIG.estados.includes(estado)) return "descartado";
  // Todo lo demás (formacion, contratacion, prueba, empleado + sus legacy)
  // pertenece a la única fase «Onboarding».
  if (ONBOARDING_CONFIG.estados.includes(estado)) return "onboarding";
  if (LEGACY_A_FORMACION.has(estado) || LEGACY_A_CONTRATACION.has(estado)) return "onboarding";
  return "seleccion";
}

// ─── Requisito de reseñas para avanzar ─────────────────────────
// Un candidato no puede entrar en «Documentación» ni en ninguna fase por
// delante (Formación al completo) sin tener la entrevista valorada por
// completo. También se exige al descartarlo (ya ha tenido la entrevista),
// SALVO «Papelera», que es la única salida sin reseñas.
const ESTADOS_EXENTOS_RESENA = new Set<EstadoReclutamiento>([
  "nuevo",
  "elegido",
  "entrevista",
  "papelera",
]);

/** ¿Mover a este estado exige tener las reseñas completas? */
export function estadoRequiereResenas(estado: EstadoReclutamiento): boolean {
  return !ESTADOS_EXENTOS_RESENA.has(estado);
}

// ─── Requisito de documentación para avanzar ───────────────────
// «Documentación» es un paso obligatorio: un candidato no puede entrar en
// Formación (Teórica/Práctica/Prueba/Empleado) sin haber completado su
// documentación (DNI/NIE, IBAN, Nº SS, foto, etc.). El propio candidato la
// rellena desde el enlace personal que recibe por correo al llegar a la fase
// «Documentación». Los estados de Selección y Descartado NO lo exigen (aún no
// ha llegado el momento, o se le está descartando).
const ESTADOS_REQUIEREN_DOCUMENTACION = new Set<EstadoReclutamiento>([
  "formacion",
  "contratacion",
  "prueba",
  "empleado",
  // legacy
  "teorica",
  "practica",
  "alta_pendiente_revision",
  "alta_enviada",
  "contrato_interno_firmado",
  "contrato_oficial_subido",
  "contrato_oficial_firmado",
  "alta_completada",
]);

/** ¿Mover a este estado exige tener la documentación del candidato completa? */
export function estadoRequiereDocumentacion(estado: EstadoReclutamiento): boolean {
  return ESTADOS_REQUIEREN_DOCUMENTACION.has(estado);
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
  /** Asunto del correo enviado en este cambio de fase (si lo hubo). */
  emailAsunto?: string | null;
  /**
   * HTML exacto del correo enviado (snapshot inmutable, cabecera de marca
   * incluida). Permite ver en la ficha el correo tal cual lo recibió el
   * candidato aunque la plantilla cambie después. null si no se archivó.
   */
  emailHtml?: string | null;
  /**
   * Si la fila es un movimiento de vacante, títulos de origen y destino.
   * `vacanteNueva` no-null marca la fila como movimiento (no cambio de fase).
   */
  vacanteAnterior?: string | null;
  vacanteNueva?: string | null;
  /**
   * Días que el candidato pasó en la fase ANTERIOR antes de este cambio.
   * Redondeo: ≥12 h cuenta como 1 día; <12 h cuenta como 0. null si no se puede
   * calcular (primer evento sin referencia previa).
   */
  diasEnFaseAnterior?: number | null;
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
  /** Fecha+hora de inscripción ya formateada en horario español (para el historial). */
  fechaInscripcionFull?: string;
  origen: OrigenCandidatura;
  /** Canal concreto por el que entró el CV (nombre del enlace de empleo), si aplica. */
  canal?: string | null;
  /**
   * «¿Por dónde nos has conocido?» — origen DECLARADO por el candidato en el
   * formulario público (nombre del catálogo `reclutamiento_origenes`). Distinto
   * de `canal` (atribución automática por enlace). Editable en la ficha.
   */
  comoNosConocio?: string | null;
  notasInternas: string;
  fase: EstadoReclutamiento;
  vacanteId: string;
  reclutadorAsignado: string;
  historial: HistorialCambioFase[];
  // Extensiones del refactor 2026-05 (todos opcionales para no romper BD)
  ubicacion?: string;
  genero?: Genero;
  disponibilidad?: Disponibilidad;
  experienciaPrevia?: ExperienciaPrevia;
  sobreTi?: string;
  resenas?: ResenaCandidato[];
  notas?: NotaCandidato[];
  // ── Cuestionario de la vacante (resultado del candidato, si lo respondió) ──
  /** Nº de preguntas acertadas. null = no ha respondido el cuestionario. */
  cuestionarioAciertos?: number | null;
  /** Nº total de preguntas del cuestionario. null = no ha respondido. */
  cuestionarioTotal?: number | null;
  // ── Reseñas (entrevista) ──
  /** Media de estrellas de todas las reseñas (1–5). null = sin reseñas. */
  resenaMedia?: number | null;
  /**
   * true = el candidato tiene la entrevista valorada por completo: existe al
   * menos una reseña y TODAS las reseñas puntúan TODOS los criterios (sin
   * dejar ninguno a 0). Requisito para pasar a «Documentación» o más adelante.
   */
  resenasCompletas?: boolean;
  /**
   * Fecha en que se revisó por primera vez al candidato (se abrió su ficha).
   * null/undefined = aún sin revisar. Pinta el tick «visto» en la tarjeta.
   */
  vistoAt?: string | null;
  /**
   * Fecha del último cambio de fase. Base del contador de «días en la fase
   * actual», que se reinicia a cero en cada cambio de fase.
   */
  faseActualizadaAt?: string | null;
  /** Inactivo = se conserva en BD y en el listado, pero no se ve en el pipeline. Default true. */
  activo?: boolean;
  /** Fecha en que se promovió a empleado (no null = ya contratado). */
  promovidoAt?: string | null;
  /** Empleado creado al contratar, si ya se promovió. */
  empleadoId?: string | null;
  // ── Paso «Documentación» (datos aportados por el candidato) ──
  dniNie?: string | null;
  iban?: string | null;
  numSeguridadSocial?: string | null;
  docDniAnversoPath?: string | null;
  docDniReversoPath?: string | null;
  docIbanPath?: string | null;
  docSsPath?: string | null;
  fotoPerfilPath?: string | null;
  direccion?: string | null;
  fechaNacimiento?: string | null;
  /** No null = el candidato completó su documentación (fecha de recepción). */
  documentacionCompletadaAt?: string | null;
}

// ─── Email plantillas por estado ────────────────────────────────
export const EMAIL_PLANTILLAS_FASE: Record<EstadoReclutamiento, { asunto: string; cuerpo: string; activo: boolean }> = {
  nuevo: { asunto: "Hemos recibido tu candidatura", cuerpo: "Tu candidatura ha sido registrada correctamente. Nos pondremos en contacto contigo próximamente.", activo: true },
  elegido: { asunto: "Has sido preseleccionado/a", cuerpo: "Nos complace informarte de que has sido preseleccionado/a para avanzar en el proceso de selección.", activo: true },
  entrevista: { asunto: "Convocatoria a entrevista", cuerpo: "Queremos invitarte a una entrevista. En breve recibirás los detalles de fecha y hora.", activo: true },
  documentacion: { asunto: "Documentación necesaria para tu incorporación", cuerpo: "Para continuar con tu incorporación necesitamos que nos aportes tu documentación (DNI/NIE por ambas caras, número de cuenta bancaria, número de la Seguridad Social y una foto de perfil).\n\nSúbela desde tu enlace personal: {{enlace_documentacion}}\n\nImportante: este enlace caduca a los {{documentacion_dias_validez}} días. Complétalo antes de que expire; si caduca, pídenos uno nuevo.", activo: true },
  formacion: { asunto: "Accede a tu formación", cuerpo: "Has pasado a la fase de formación. Antes de continuar con el proceso debes completar toda la formación: conocerás la empresa, las normas internas, la forma de trabajar y lo que esperamos del puesto. Es obligatoria. Cuando la termines, revisaremos tu avance para continuar.", activo: true },
  // Contratación: el email al candidato es el del contrato interno; el alta a la
  // gestoría y el contrato oficial tienen sus propias plantillas (no por estado).
  contratacion: { asunto: "Pasas a contratación", cuerpo: "Comenzamos con tu contratación. Recibirás los documentos que debes firmar antes de incorporarte.", activo: true },
  // Estados legacy de Contratación (ya no son columnas; inactivos).
  alta_pendiente_revision: { asunto: "Revisión de tu alta", cuerpo: "Estamos revisando tus datos para tramitar tu alta.", activo: false },
  alta_enviada: { asunto: "Tu alta está en marcha", cuerpo: "Hemos iniciado el proceso de tu alta.", activo: false },
  contrato_interno_firmado: { asunto: "Contrato interno firmado", cuerpo: "Hemos recibido tu contrato interno firmado.", activo: false },
  contrato_oficial_subido: { asunto: "Contrato oficial disponible", cuerpo: "Tu contrato oficial ya está disponible.", activo: false },
  contrato_oficial_firmado: { asunto: "Contrato oficial firmado", cuerpo: "Hemos recibido tu contrato oficial firmado.", activo: false },
  alta_completada: { asunto: "Alta completada", cuerpo: "Tu alta y contratos están completados.", activo: false },
  prueba: { asunto: "Comienza tu periodo de prueba", cuerpo: "Ya has sido dado/a de alta y has firmado la documentación correspondiente. Comienza tu periodo de prueba. Durante este tiempo evaluaremos tu adaptación, actitud, desempeño y cumplimiento de las normas internas.", activo: true },
  empleado: { asunto: "¡Bienvenido/a al equipo!", cuerpo: "Nos complace comunicarte que has sido seleccionado/a para incorporarte al equipo. ¡Enhorabuena!", activo: true },
  no_se_presenta: { asunto: "Estado de tu candidatura", cuerpo: "Lamentamos informarte de que tu candidatura ha sido marcada como no presentada.", activo: true },
  suspenso_formacion: { asunto: "Resultado de la formación", cuerpo: "Te informamos del resultado de tu fase de formación.", activo: true },
  papelera: { asunto: "Actualización de tu candidatura", cuerpo: "Te informamos de que tu candidatura no continúa en el proceso de selección actual.", activo: true },
  // ── Legacy (mapean a Formación; ya no se usan en el pipeline activo) ──
  teorica: { asunto: "Prueba teórica programada", cuerpo: "Te informamos de que pasas a la fase de prueba teórica.", activo: true },
  practica: { asunto: "Prueba práctica programada", cuerpo: "Avanzas a la fase de prueba práctica.", activo: true },
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
  /** Puesto plantilla del que es espejo la vacante (para contratar precargando el puesto). */
  puestoId?: string | null;
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
  // «Onboarding» agrupa el tramo posterior a Selección (Formación · Contratación
  // · Prueba · Empleado).
  const formacionCount = sumEstados(ONBOARDING_CONFIG.estados);
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
      ...ONBOARDING_CONFIG.estados.map(filaEstado),
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
  "documentacion",
  "formacion",
  "contratacion",
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
