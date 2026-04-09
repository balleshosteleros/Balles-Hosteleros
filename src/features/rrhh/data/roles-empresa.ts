import {
  type Vacante,
  type Candidato,
  type EstadoReclutamiento,
  type OrigenCandidatura,
  type EstadoPublicacion,
  type TipoJornada,
} from "./reclutamiento";

// ─── Rol de empresa (estructura organizativa) ──────────────────
export type EstadoRol = "activo" | "inactivo" | "pendiente";
export type TipoContrato = "indefinido" | "temporal" | "practicas" | "obra_servicio" | "formacion";

export const TIPO_CONTRATO_LABELS: Record<TipoContrato, string> = {
  indefinido: "Indefinido",
  temporal: "Temporal",
  practicas: "Prácticas",
  obra_servicio: "Obra y servicio",
  formacion: "Formación",
};

export const ESTADO_ROL_LABELS: Record<EstadoRol, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  pendiente: "Pendiente",
};

export interface DatosVacante {
  tituloPublico: string;
  descripcion: string;
  ubicacion: string;
  tipoJornada: TipoJornada;
  tipoContrato: TipoContrato;
  salarioMin: string;
  salarioMax: string;
  estadoPublicacion: EstadoPublicacion;
  cuestionario: boolean;
  fechaPublicacion: string;
  reclutadorAsignado: string;
  canalPublicacion: string;
  observaciones: string;
  visiblePortal: boolean;
}

export interface RolEmpresa {
  id: string;
  nombre: string;
  departamento: string;
  descripcionPuesto: string;
  responsable: string;
  empresaId: string;
  estado: EstadoRol;
  activo: boolean;
  ubicacion: string;
  jornada: TipoJornada;
  salario: string;
  tipoContrato: TipoContrato;
  observaciones: string;
  // Vacancy data embedded
  vacante: DatosVacante;
  // Auto-generated vacancy id
  vacanteId: string;
  favorita: boolean;
}

// ─── Convert RolEmpresa → Vacante (with candidates) ────────────
export function rolToVacante(rol: RolEmpresa, candidatos: Candidato[]): Vacante {
  return {
    id: rol.vacanteId,
    puesto: rol.nombre,
    categoria: rol.departamento,
    ubicacion: rol.vacante.ubicacion || rol.ubicacion,
    tipoJornada: rol.vacante.tipoJornada || rol.jornada,
    estadoPublicacion: rol.vacante.estadoPublicacion,
    fechaCreacion: rol.vacante.fechaPublicacion,
    cuestionario: rol.vacante.cuestionario,
    reclutadores: rol.vacante.reclutadorAsignado ? [rol.vacante.reclutadorAsignado] : [],
    favorita: rol.favorita,
    candidatos,
    empresaId: rol.empresaId,
  };
}

// ─── Validation ─────────────────────────────────────────────────
export interface ValidationError {
  campo: string;
  mensaje: string;
}

export function validarRol(rol: Partial<RolEmpresa>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!rol.nombre?.trim()) errors.push({ campo: "nombre", mensaje: "El nombre del rol es obligatorio" });
  if (!rol.departamento?.trim()) errors.push({ campo: "departamento", mensaje: "El departamento es obligatorio" });
  if (!rol.descripcionPuesto?.trim()) errors.push({ campo: "descripcionPuesto", mensaje: "La descripción del puesto es obligatoria" });
  if (!rol.responsable?.trim()) errors.push({ campo: "responsable", mensaje: "El responsable es obligatorio" });
  if (!rol.ubicacion?.trim()) errors.push({ campo: "ubicacion", mensaje: "La ubicación es obligatoria" });
  return errors;
}

export function validarVacante(v: Partial<DatosVacante>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!v.tituloPublico?.trim()) errors.push({ campo: "tituloPublico", mensaje: "El título público es obligatorio" });
  if (!v.descripcion?.trim()) errors.push({ campo: "descripcion", mensaje: "La descripción es obligatoria" });
  if (!v.ubicacion?.trim()) errors.push({ campo: "ubicacion", mensaje: "La ubicación de la vacante es obligatoria" });
  if (!v.reclutadorAsignado?.trim()) errors.push({ campo: "reclutadorAsignado", mensaje: "El reclutador asignado es obligatorio" });
  return errors;
}

// ─── Default empty rol ──────────────────────────────────────────
export function crearRolVacio(empresaId: string): RolEmpresa {
  return {
    id: `rol-${Date.now()}`,
    nombre: "",
    departamento: "",
    descripcionPuesto: "",
    responsable: "",
    empresaId,
    estado: "pendiente",
    activo: true,
    ubicacion: "",
    jornada: "completa",
    salario: "",
    tipoContrato: "indefinido",
    observaciones: "",
    vacante: {
      tituloPublico: "",
      descripcion: "",
      ubicacion: "",
      tipoJornada: "completa",
      tipoContrato: "indefinido",
      salarioMin: "",
      salarioMax: "",
      estadoPublicacion: "borrador",
      cuestionario: false,
      fechaPublicacion: new Date().toISOString().slice(0, 10),
      reclutadorAsignado: "",
      canalPublicacion: "",
      observaciones: "",
      visiblePortal: false,
    },
    vacanteId: `v-${Date.now()}`,
    favorita: false,
  };
}

// ─── Mock data ──────────────────────────────────────────────────
function generarCandidatosMock(vacanteId: string, dist: Partial<Record<EstadoReclutamiento, number>>, reclutador: string): Candidato[] {
  const pool = [
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
  const origenes: OrigenCandidatura[] = ["web", "formulario", "redes_sociales", "recomendacion", "portal_empleo"];
  const candidatos: Candidato[] = [];
  let idx = 0;
  for (const [estado, count] of Object.entries(dist)) {
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

const rolesHabana: RolEmpresa[] = [
  {
    id: "rh1", nombre: "CAMARERO", departamento: "Sala", descripcionPuesto: "Atención al cliente en sala principal, servicio de mesas y barra.",
    responsable: "Antonio Ballesteros", empresaId: "habana", estado: "activo", activo: true,
    ubicacion: "La Habana — Sala principal", jornada: "completa", salario: "1.200€ – 1.500€",
    tipoContrato: "indefinido", observaciones: "",
    vacante: {
      tituloPublico: "Camarero/a para restaurante La Habana", descripcion: "Buscamos camarero/a con experiencia en hostelería para sala principal.",
      ubicacion: "La Habana — Sala principal", tipoJornada: "completa", tipoContrato: "indefinido",
      salarioMin: "1200", salarioMax: "1500", estadoPublicacion: "publicada",
      cuestionario: true, fechaPublicacion: "2026-01-15", reclutadorAsignado: "Antonio Ballesteros",
      canalPublicacion: "Portal propio", observaciones: "", visiblePortal: true,
    },
    vacanteId: "v1", favorita: true,
  },
  {
    id: "rh2", nombre: "JEFE DE SALA", departamento: "Dirección", descripcionPuesto: "Coordinación del equipo de sala, atención VIP y supervisión del servicio.",
    responsable: "Antonio Ballesteros", empresaId: "habana", estado: "activo", activo: true,
    ubicacion: "La Habana — Planta baja", jornada: "completa", salario: "1.800€ – 2.200€",
    tipoContrato: "indefinido", observaciones: "",
    vacante: {
      tituloPublico: "Jefe/a de Sala", descripcion: "Buscamos jefe/a de sala con experiencia en gestión de equipos.",
      ubicacion: "La Habana — Planta baja", tipoJornada: "completa", tipoContrato: "indefinido",
      salarioMin: "1800", salarioMax: "2200", estadoPublicacion: "publicada",
      cuestionario: true, fechaPublicacion: "2026-02-01", reclutadorAsignado: "Antonio Ballesteros",
      canalPublicacion: "Portal propio", observaciones: "", visiblePortal: true,
    },
    vacanteId: "v2", favorita: false,
  },
  {
    id: "rh3", nombre: "CACHIMBERO", departamento: "Sala", descripcionPuesto: "Preparación y servicio de cachimbas en terraza.",
    responsable: "Sara Molina", empresaId: "habana", estado: "activo", activo: true,
    ubicacion: "La Habana — Terraza", jornada: "parcial", salario: "900€ – 1.100€",
    tipoContrato: "temporal", observaciones: "",
    vacante: {
      tituloPublico: "Cachimbero/a para terraza", descripcion: "Se necesita cachimbero/a para servicio en terraza.",
      ubicacion: "La Habana — Terraza", tipoJornada: "parcial", tipoContrato: "temporal",
      salarioMin: "900", salarioMax: "1100", estadoPublicacion: "borrador",
      cuestionario: false, fechaPublicacion: "2026-03-10", reclutadorAsignado: "Sara Molina",
      canalPublicacion: "", observaciones: "", visiblePortal: false,
    },
    vacanteId: "v3", favorita: false,
  },
  {
    id: "rh4", nombre: "ARTISTA / DJ", departamento: "Entretenimiento", descripcionPuesto: "Actuaciones en directo y sesiones DJ en escenario principal.",
    responsable: "Antonio Ballesteros", empresaId: "habana", estado: "activo", activo: true,
    ubicacion: "La Habana — Escenario", jornada: "parcial", salario: "1.000€ – 2.000€",
    tipoContrato: "temporal", observaciones: "",
    vacante: {
      tituloPublico: "Artista / DJ", descripcion: "Buscamos artistas y DJs para sesiones en vivo.",
      ubicacion: "La Habana — Escenario", tipoJornada: "parcial", tipoContrato: "temporal",
      salarioMin: "1000", salarioMax: "2000", estadoPublicacion: "publicada",
      cuestionario: false, fechaPublicacion: "2026-01-20", reclutadorAsignado: "Antonio Ballesteros",
      canalPublicacion: "Redes sociales", observaciones: "", visiblePortal: true,
    },
    vacanteId: "v4", favorita: true,
  },
  {
    id: "rh5", nombre: "MANTENIMIENTO", departamento: "Operaciones", descripcionPuesto: "Mantenimiento general de instalaciones y equipamiento.",
    responsable: "Sara Molina", empresaId: "habana", estado: "activo", activo: true,
    ubicacion: "La Habana — General", jornada: "completa", salario: "1.100€ – 1.400€",
    tipoContrato: "indefinido", observaciones: "",
    vacante: {
      tituloPublico: "Técnico de mantenimiento", descripcion: "Se busca técnico de mantenimiento para instalaciones.",
      ubicacion: "La Habana — General", tipoJornada: "completa", tipoContrato: "indefinido",
      salarioMin: "1100", salarioMax: "1400", estadoPublicacion: "cerrada",
      cuestionario: false, fechaPublicacion: "2025-11-05", reclutadorAsignado: "Sara Molina",
      canalPublicacion: "Portal propio", observaciones: "", visiblePortal: false,
    },
    vacanteId: "v5", favorita: false,
  },
];

const rolesBacanal: RolEmpresa[] = [
  {
    id: "rb1", nombre: "GERENTE", departamento: "Dirección", descripcionPuesto: "Gestión general del establecimiento y coordinación de equipos.",
    responsable: "Luis Pérez", empresaId: "bacanal", estado: "activo", activo: true,
    ubicacion: "Bacanal — Central", jornada: "completa", salario: "2.500€ – 3.000€",
    tipoContrato: "indefinido", observaciones: "",
    vacante: {
      tituloPublico: "Gerente de establecimiento", descripcion: "Buscamos gerente con experiencia en hostelería.",
      ubicacion: "Bacanal — Central", tipoJornada: "completa", tipoContrato: "indefinido",
      salarioMin: "2500", salarioMax: "3000", estadoPublicacion: "publicada",
      cuestionario: true, fechaPublicacion: "2026-02-10", reclutadorAsignado: "Luis Pérez",
      canalPublicacion: "LinkedIn", observaciones: "", visiblePortal: true,
    },
    vacanteId: "v6", favorita: true,
  },
  {
    id: "rb2", nombre: "CAMARERO", departamento: "Sala", descripcionPuesto: "Servicio en sala VIP con atención premium.",
    responsable: "Carmen Díaz", empresaId: "bacanal", estado: "activo", activo: true,
    ubicacion: "Bacanal — Sala VIP", jornada: "temporal", salario: "1.200€ – 1.500€",
    tipoContrato: "temporal", observaciones: "",
    vacante: {
      tituloPublico: "Camarero/a Sala VIP", descripcion: "Se necesita camarero/a para servicio en zona VIP.",
      ubicacion: "Bacanal — Sala VIP", tipoJornada: "temporal", tipoContrato: "temporal",
      salarioMin: "1200", salarioMax: "1500", estadoPublicacion: "publicada",
      cuestionario: false, fechaPublicacion: "2026-03-01", reclutadorAsignado: "Carmen Díaz",
      canalPublicacion: "Portal propio", observaciones: "", visiblePortal: true,
    },
    vacanteId: "v7", favorita: false,
  },
  {
    id: "rb3", nombre: "CONTABLE", departamento: "Administración", descripcionPuesto: "Gestión contable y financiera del establecimiento.",
    responsable: "Carmen Díaz", empresaId: "bacanal", estado: "activo", activo: true,
    ubicacion: "Bacanal — Oficina", jornada: "completa", salario: "1.600€ – 2.000€",
    tipoContrato: "indefinido", observaciones: "",
    vacante: {
      tituloPublico: "Contable", descripcion: "Se busca contable con experiencia en sector hostelero.",
      ubicacion: "Bacanal — Oficina", tipoJornada: "completa", tipoContrato: "indefinido",
      salarioMin: "1600", salarioMax: "2000", estadoPublicacion: "borrador",
      cuestionario: true, fechaPublicacion: "2026-03-20", reclutadorAsignado: "Carmen Díaz",
      canalPublicacion: "", observaciones: "", visiblePortal: false,
    },
    vacanteId: "v8", favorita: false,
  },
];

// Candidate data per vacancy (kept separate for flexibility)
const candidatosPorVacante: Record<string, Candidato[]> = {
  v1: generarCandidatosMock("v1", { nuevo: 12, elegido: 3, entrevista: 2, practica: 1, papelera: 4 }, "Antonio Ballesteros"),
  v2: generarCandidatosMock("v2", { nuevo: 5, elegido: 1, entrevista: 1 }, "Antonio Ballesteros"),
  v3: generarCandidatosMock("v3", { nuevo: 8, papelera: 2, elegido: 1 }, "Sara Molina"),
  v4: generarCandidatosMock("v4", { nuevo: 15, elegido: 4, entrevista: 3, prueba: 2, no_se_presenta: 1 }, "Antonio Ballesteros"),
  v5: generarCandidatosMock("v5", { nuevo: 2, empleado: 1, papelera: 3 }, "Sara Molina"),
  v6: generarCandidatosMock("v6", { nuevo: 3, elegido: 1, entrevista: 1 }, "Luis Pérez"),
  v7: generarCandidatosMock("v7", { nuevo: 20, elegido: 5, entrevista: 4, practica: 2, prueba: 1, papelera: 6 }, "Carmen Díaz"),
  v8: generarCandidatosMock("v8", { nuevo: 6, elegido: 2, teorica: 1 }, "Carmen Díaz"),
};

// ─── Public API ─────────────────────────────────────────────────
export function getRolesPorEmpresa(empresaId: string): RolEmpresa[] {
  if (empresaId === "habana") return rolesHabana;
  if (empresaId === "bacanal") return rolesBacanal;
  return [];
}

export function getCandidatosPorVacante(vacanteId: string): Candidato[] {
  return candidatosPorVacante[vacanteId] || [];
}

export function getVacantesDesdeRoles(empresaId: string): Vacante[] {
  const roles = getRolesPorEmpresa(empresaId);
  return roles.map((rol) => rolToVacante(rol, getCandidatosPorVacante(rol.vacanteId)));
}

export const DEPARTAMENTOS = ["Sala", "Dirección", "Entretenimiento", "Operaciones", "Administración", "Cocina", "Barra", "Seguridad"];
