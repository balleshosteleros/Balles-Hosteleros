// ─── Fase principal (grupo) ──────────────────────────────────────
export type FasePrincipal = "nuevo" | "en_progreso" | "oferta" | "seleccionado" | "descartado";

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

// ─── Fase config ────────────────────────────────────────────────
export interface FasePrincipalConfig {
  label: string;
  color: string;        // gradient / bar color
  colorFrom: string;    // gradient start
  colorTo: string;      // gradient end
  estados: EstadoReclutamiento[];
}

export const FASES_PRINCIPALES_ORDER: FasePrincipal[] = [
  "nuevo", "en_progreso", "oferta", "seleccionado", "descartado",
];

export const FASES_PRINCIPALES: Record<FasePrincipal, FasePrincipalConfig> = {
  nuevo: {
    label: "Nuevo",
    color: "hsl(220, 70%, 55%)",
    colorFrom: "hsl(220, 80%, 60%)",
    colorTo: "hsl(220, 60%, 45%)",
    estados: ["nuevo"],
  },
  en_progreso: {
    label: "En progreso",
    color: "hsl(200, 70%, 50%)",
    colorFrom: "hsl(200, 80%, 55%)",
    colorTo: "hsl(200, 60%, 40%)",
    estados: ["elegido", "papelera"],
  },
  oferta: {
    label: "Oferta",
    color: "hsl(145, 63%, 42%)",
    colorFrom: "hsl(145, 70%, 50%)",
    colorTo: "hsl(145, 55%, 35%)",
    estados: ["entrevista"],
  },
  seleccionado: {
    label: "Seleccionado",
    color: "hsl(145, 70%, 35%)",
    colorFrom: "hsl(145, 75%, 42%)",
    colorTo: "hsl(145, 60%, 28%)",
    estados: ["teorica", "practica", "prueba", "empleado"],
  },
  descartado: {
    label: "Descartado",
    color: "hsl(0, 72%, 51%)",
    colorFrom: "hsl(0, 80%, 58%)",
    colorTo: "hsl(0, 65%, 42%)",
    estados: ["no_se_presenta", "suspenso_formacion"],
  },
};

// ─── Estado config ──────────────────────────────────────────────
export const ESTADOS_CONFIG: Record<EstadoReclutamiento, { label: string; color: string; icono: string }> = {
  nuevo: { label: "Nuevo", color: "hsl(220, 70%, 55%)", icono: "📥" },
  elegido: { label: "Elegido", color: "hsl(200, 70%, 50%)", icono: "✏️" },
  papelera: { label: "Papelera", color: "hsl(0, 0%, 50%)", icono: "🗑️" },
  entrevista: { label: "Entrevista", color: "hsl(145, 63%, 42%)", icono: "📋" },
  teorica: { label: "Teórica", color: "hsl(270, 60%, 55%)", icono: "📋" },
  practica: { label: "Práctica", color: "hsl(200, 70%, 50%)", icono: "📋" },
  prueba: { label: "Prueba", color: "hsl(45, 90%, 50%)", icono: "📋" },
  empleado: { label: "Empleado", color: "hsl(145, 70%, 35%)", icono: "📋" },
  no_se_presenta: { label: "No se presenta", color: "hsl(0, 0%, 55%)", icono: "📋" },
  suspenso_formacion: { label: "Suspenso Formación", color: "hsl(0, 72%, 51%)", icono: "📋" },
};

// Flat order of all estados (for legacy compat)
export const FASES_ORDER: EstadoReclutamiento[] = [
  "nuevo", "elegido", "papelera", "entrevista", "teorica", "practica", "prueba", "empleado", "no_se_presenta", "suspenso_formacion",
];

// Legacy alias
export const FASES_CONFIG = ESTADOS_CONFIG;

// ─── Helper: get the fase principal for a given estado ──────────
export function getFasePrincipal(estado: EstadoReclutamiento): FasePrincipal {
  for (const [fase, cfg] of Object.entries(FASES_PRINCIPALES)) {
    if (cfg.estados.includes(estado)) return fase as FasePrincipal;
  }
  return "nuevo";
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

// ─── Candidato ──────────────────────────────────────────────────
export interface Candidato {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;
  cvAdjunto?: string;
  fechaInscripcion: string;
  origen: OrigenCandidatura;
  notasInternas: string;
  fase: EstadoReclutamiento; // the estado (kept as `fase` for back-compat)
  vacanteId: string;
  reclutadorAsignado: string;
  historial: HistorialCambioFase[];
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
  no_se_presenta: { asunto: "Estado de tu candidatura", cuerpo: "Lamentamos informarte de que tu candidatura ha sido marcada como no presentada.", activo: false },
  suspenso_formacion: { asunto: "Resultado de la formación", cuerpo: "Te informamos del resultado de tu fase de formación.", activo: false },
  papelera: { asunto: "Actualización de tu candidatura", cuerpo: "Te informamos de que tu candidatura no continúa en el proceso de selección actual.", activo: false },
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
    id: "v4", puesto: "ARTISTA / DJ", categoria: "Entretenimiento", ubicacion: "La Habana — Escenario",
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
