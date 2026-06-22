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

export const CRITERIOS_RESENA_DEFAULT: CriterioResena[] = [
  { id: "actitud", nombre: "Actitud" },
  { id: "experiencia", nombre: "Experiencia previa" },
  { id: "disponibilidad", nombre: "Disponibilidad" },
  { id: "comunicacion", nombre: "Comunicación" },
  { id: "encaje_cultural", nombre: "Encaje cultural" },
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

// ─── Mock data generator ────────────────────────────────────────
function generarCandidatos(vacanteId: string, faseDistribucion: Partial<Record<EstadoReclutamiento, number>>, reclutador: string, pool: { nombre: string; apellidos: string; email: string; telefono: string }[]): Candidato[] {
  const candidatos: Candidato[] = [];
  let idx = 0;
  const origenes: OrigenCandidatura[] = ["web", "formulario", "redes_sociales", "recomendacion", "portal_empleo"];
  for (const [estado, count] of Object.entries(faseDistribucion)) {
    for (let i = 0; i < (count || 0); i++) {
      const p = pool[idx % pool.length];
      candidatos.push({
        id: `${vacanteId}-c${idx}`,
        nombre: p.nombre,
        apellidos: p.apellidos,
        telefono: p.telefono,
        email: p.email,
        fechaInscripcion: `2026-0${Math.floor(Math.random() * 3) + 1}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`,
        origen: origenes[idx % origenes.length],
        notasInternas: "",
        fase: estado as EstadoReclutamiento,
        vacanteId,
        reclutadorAsignado: reclutador,
        historial: [],
      });
      idx++;
    }
  }
  return candidatos;
}

const poolNombres = [
  { nombre: "María", apellidos: "García López", email: "maria.garcia@email.com", telefono: "612 345 678" },
  { nombre: "Carlos", apellidos: "Martínez Ruiz", email: "carlos.martinez@email.com", telefono: "623 456 789" },
  { nombre: "Ana", apellidos: "Fernández Soto", email: "ana.fernandez@email.com", telefono: "634 567 890" },
  { nombre: "Pedro", apellidos: "López Navarro", email: "pedro.lopez@email.com", telefono: "645 678 901" },
  { nombre: "Laura", apellidos: "Sánchez Pérez", email: "laura.sanchez@email.com", telefono: "656 789 012" },
  { nombre: "Javier", apellidos: "Romero Gil", email: "javier.romero@email.com", telefono: "667 890 123" },
  { nombre: "Lucía", apellidos: "Díaz Moreno", email: "lucia.diaz@email.com", telefono: "678 901 234" },
  { nombre: "David", apellidos: "Hernández Torres", email: "david.hernandez@email.com", telefono: "689 012 345" },
  { nombre: "Elena", apellidos: "Jiménez Ruiz", email: "elena.jimenez@email.com", telefono: "690 123 456" },
  { nombre: "Miguel", apellidos: "Álvarez Castro", email: "miguel.alvarez@email.com", telefono: "601 234 567" },
];

const vacantesHabana: Vacante[] = [
  {
    id: "v1", puesto: "CAMARERO", categoria: "Sala", ubicacion: "La Habana — Sala principal",
    tipoJornada: "completa", estadoPublicacion: "publicada", fechaCreacion: "2026-01-15",
    cuestionario: true, reclutadores: ["Antonio Ballesteros", "Sara Molina"], favorita: true, empresaId: "habana",
    candidatos: generarCandidatos("v1", { nuevo: 12, elegido: 3, entrevista: 2, practica: 1, papelera: 4 }, "Antonio Ballesteros", poolNombres),
  },
  {
    id: "v2", puesto: "JEFE DE SALA", categoria: "Dirección", ubicacion: "La Habana — Planta baja",
    tipoJornada: "completa", estadoPublicacion: "publicada", fechaCreacion: "2026-02-01",
    cuestionario: true, reclutadores: ["Antonio Ballesteros"], favorita: false, empresaId: "habana",
    candidatos: generarCandidatos("v2", { nuevo: 5, elegido: 1, entrevista: 1 }, "Antonio Ballesteros", poolNombres),
  },
  {
    id: "v3", puesto: "CACHIMBERO", categoria: "Sala", ubicacion: "La Habana — Terraza",
    tipoJornada: "parcial", estadoPublicacion: "borrador", fechaCreacion: "2026-03-10",
    cuestionario: false, reclutadores: ["Sara Molina"], favorita: false, empresaId: "habana",
    candidatos: generarCandidatos("v3", { nuevo: 8, papelera: 2, elegido: 1 }, "Sara Molina", poolNombres),
  },
  {
    id: "v4", puesto: "ARTISTA", categoria: "Entretenimiento", ubicacion: "La Habana — Escenario",
    tipoJornada: "parcial", estadoPublicacion: "publicada", fechaCreacion: "2026-01-20",
    cuestionario: false, reclutadores: ["Antonio Ballesteros"], favorita: true, empresaId: "habana",
    candidatos: generarCandidatos("v4", { nuevo: 15, elegido: 4, entrevista: 3, prueba: 2, no_se_presenta: 1 }, "Antonio Ballesteros", poolNombres),
  },
  {
    id: "v5", puesto: "MANTENIMIENTO", categoria: "Operaciones", ubicacion: "La Habana — General",
    tipoJornada: "completa", estadoPublicacion: "cerrada", fechaCreacion: "2025-11-05",
    cuestionario: false, reclutadores: ["Sara Molina"], favorita: false, empresaId: "habana",
    candidatos: generarCandidatos("v5", { nuevo: 2, empleado: 1, papelera: 3 }, "Sara Molina", poolNombres),
  },
];

const vacantesBacanal: Vacante[] = [
  {
    id: "v6", puesto: "GERENTE", categoria: "Dirección", ubicacion: "Bacanal — Central",
    tipoJornada: "completa", estadoPublicacion: "publicada", fechaCreacion: "2026-02-10",
    cuestionario: true, reclutadores: ["Luis Pérez"], favorita: true, empresaId: "bacanal",
    candidatos: generarCandidatos("v6", { nuevo: 3, elegido: 1, entrevista: 1 }, "Luis Pérez", poolNombres),
  },
  {
    id: "v7", puesto: "CAMARERO", categoria: "Sala", ubicacion: "Bacanal — Sala VIP",
    tipoJornada: "temporal", estadoPublicacion: "publicada", fechaCreacion: "2026-03-01",
    cuestionario: false, reclutadores: ["Luis Pérez", "Carmen Díaz"], favorita: false, empresaId: "bacanal",
    candidatos: generarCandidatos("v7", { nuevo: 20, elegido: 5, entrevista: 4, practica: 2, prueba: 1, papelera: 6 }, "Carmen Díaz", poolNombres),
  },
  {
    id: "v8", puesto: "CONTABLE", categoria: "Administración", ubicacion: "Bacanal — Oficina",
    tipoJornada: "completa", estadoPublicacion: "borrador", fechaCreacion: "2026-03-20",
    cuestionario: true, reclutadores: ["Carmen Díaz"], favorita: false, empresaId: "bacanal",
    candidatos: generarCandidatos("v8", { nuevo: 6, elegido: 2, teorica: 1 }, "Carmen Díaz", poolNombres),
  },
];

export function getVacantesPorEmpresa(empresaId: string): Vacante[] {
  if (empresaId === "habana") return vacantesHabana;
  if (empresaId === "bacanal") return vacantesBacanal;
  return [];
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
// Cadena de progreso secuencial: solo +1 (o −1 para corregir). Cualquier
// estado puede ir directo a un descartado (rescate al revés también vale).
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
  if (origen === destino) return false;
  const destinoFase = getFasePrincipal(destino);
  if (destinoFase === "descartado") return true;
  const origenFase = getFasePrincipal(origen);
  if (origenFase === "descartado") return true; // rescate
  const idxOrigen = CADENA_PROGRESO.indexOf(origen);
  const idxDestino = CADENA_PROGRESO.indexOf(destino);
  if (idxOrigen === -1 || idxDestino === -1) return false;
  return Math.abs(idxDestino - idxOrigen) === 1;
}

export function siguienteEstado(
  origen: EstadoReclutamiento,
): EstadoReclutamiento | null {
  const idx = CADENA_PROGRESO.indexOf(origen);
  if (idx === -1 || idx >= CADENA_PROGRESO.length - 1) return null;
  return CADENA_PROGRESO[idx + 1];
}
