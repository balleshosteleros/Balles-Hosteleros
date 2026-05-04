export interface DatosGenerales {
  nombreComercial: string;
  razonSocial: string;
  cif: string;
  epigrafeIae: string;
  direccionFiscal: string;
  direccionLocal: string;
  telefonoPrincipal: string;
  telefonoSecundario: string;
  correoGeneral: string;
  correoAdmin: string;
  correoRrhh: string;
  correoContabilidad: string;
  correoMarketing: string;
  correoJuridico: string;
  correoReservas: string;
  correoIncidencias: string;
  web: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  ciudad: string;
  provincia: string;
  pais: string;
  codigoPostal: string;
  estado: "Activa" | "Inactiva";
  gerente: string;
  horarioGeneral: string;
  observaciones: string;
  logoUrl: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  rol: string;
  departamento: string;
  estado: "Activo" | "Invitado" | "Pendiente";
  fechaAlta: string;
  ultimaConexion: string;
}

export interface Departamento {
  id: string;
  nombre: string;
  responsableId: string;
  descripcion: string;
  estado: "Activo" | "Inactivo";
}

export interface PermisoModulo {
  modulo: string;
  ver: boolean;
  editar: boolean;
}

export interface Rol {
  id: string;
  nombre: string;
  descripcion: string;
  permisos: PermisoModulo[];
}

export interface Contacto {
  correoGeneral: string;
  correoReservas: string;
  correoAdmin: string;
  correoRrhh: string;
  correoContabilidad: string;
  correoMarketing: string;
  correoJuridico: string;
  correoIncidencias: string;
  telefonoGeneral: string;
  whatsapp: string;
  web: string;
  instagram: string;
  facebook: string;
  tiktok: string;
}

export interface ConfigOperativa {
  moneda: string;
  idioma: string;
  zonaHoraria: string;
  formatoFecha: string;
  primerDiaSemana: string;
  localesAsociados: string;
  etiquetasInternas: string;
  colorPrimario: string;
}

export interface EntradaAuditoria {
  id: string;
  usuario: string;
  accion: string;
  apartado: string;
  fecha: string;
}

export interface AjustesEmpresa {
  datosGenerales: DatosGenerales;
  usuarios: Usuario[];
  departamentos: Departamento[];
  roles: Rol[];
  contactos: Contacto;
  configOperativa: ConfigOperativa;
  auditoria: EntradaAuditoria[];
}

const MODULOS = [
  "Dirección", "RRHH", "Logística", "Cocina",
  "Gerencia", "Contabilidad", "Gestoría", "Jurídico",
  "Marketing", "Ajustes",
];

// Mapa rol persona → módulo propio
const ROLE_MODULE_MAP: Record<string, string> = {
  "DIRECTOR": "Dirección",
  "RESPONSABLE RRHH": "RRHH",
  "JEFE DE LOGÍSTICA": "Logística",
  "JEFE DE COCINA": "Cocina",
  "JEFE DE SALA": "Sala",
  "GERENTE": "Gerencia",
  "CONTABLE": "Contabilidad",
  "GESTOR": "Gestoría",
  "ABOGADO": "Jurídico",
  "RESPONSABLE MARKETING": "Marketing",
  "RESPONSABLE CALIDAD": "Calidad",
};

function buildRoles(): Rol[] {
  const roleNames = [
    { nombre: "DIRECTOR", desc: "Dirección general — gestión de aperturas y cronogramas" },
    { nombre: "RESPONSABLE RRHH", desc: "Gestión de personal y nóminas" },
    { nombre: "JEFE DE LOGÍSTICA", desc: "Proveedores, productos e inventario" },
    { nombre: "JEFE DE COCINA", desc: "Fichas técnicas y producción" },
    { nombre: "GERENTE", desc: "Supervisión general y cuadros de mando" },
    { nombre: "CONTABLE", desc: "Facturas, operaciones y tesorería" },
    { nombre: "GESTOR", desc: "Gestión documental y fiscal" },
    { nombre: "ABOGADO", desc: "Procesos legales y normativa" },
    { nombre: "RESPONSABLE MARKETING", desc: "Comunicación, campañas y reservas" },
  ];
  return roleNames.map((r, i) => {
    const moduloPropio = ROLE_MODULE_MAP[r.nombre];
    return {
      id: `rol-${i}`,
      nombre: r.nombre,
      descripcion: r.desc,
      permisos: MODULOS.map((m) => ({
        modulo: m,
        ver: m === moduloPropio,
        editar: m === moduloPropio,
      })),
    };
  });
}

function buildDepts(): Departamento[] {
  const names = ["DIRECCIÓN", "GERENCIA", "CONTABILIDAD", "GESTORÍA", "JURÍDICO", "RECURSOS HUMANOS", "LOGÍSTICA", "MARKETING", "COCINA", "SALA", "CALIDAD"];
  return names.map((n, i) => ({
    id: `dept-${i}`,
    nombre: n,
    responsableId: "",
    descripcion: `Departamento de ${n.charAt(0) + n.slice(1).toLowerCase()}`,
    estado: "Activo",
  }));
}

export function buildDefaultAjustes(empresaNombre: string): AjustesEmpresa {
  return {
    datosGenerales: {
      nombreComercial: empresaNombre,
      razonSocial: `${empresaNombre} S.L.`,
      cif: "",
      epigrafeIae: "",
      direccionFiscal: "",
      direccionLocal: "",
      telefonoPrincipal: "",
      telefonoSecundario: "",
      correoGeneral: "",
      correoAdmin: "",
      correoRrhh: "",
      correoContabilidad: "",
      correoMarketing: "",
      correoJuridico: "",
      correoReservas: "",
      correoIncidencias: "",
      web: "",
      whatsapp: "",
      instagram: "",
      facebook: "",
      tiktok: "",
      ciudad: "Madrid",
      provincia: "Madrid",
      pais: "España",
      codigoPostal: "",
      estado: "Activa",
      gerente: "",
      horarioGeneral: "",
      observaciones: "",
      logoUrl: "",
    },
    usuarios: [
      { id: "u1", nombre: "Admin Principal", email: `admin@${empresaNombre.toLowerCase()}.es`, telefono: "", rol: "Dirección", departamento: "GERENCIA", estado: "Activo", fechaAlta: "2026-01-15", ultimaConexion: "2026-04-06" },
      { id: "u2", nombre: "María López", email: `maria@${empresaNombre.toLowerCase()}.es`, telefono: "", rol: "Gerencia", departamento: "GERENCIA", estado: "Activo", fechaAlta: "2026-02-01", ultimaConexion: "2026-04-05" },
    ],
    departamentos: buildDepts(),
    roles: buildRoles(),
    contactos: {
      correoGeneral: "", correoReservas: "", correoAdmin: "", correoRrhh: "",
      correoContabilidad: "", correoMarketing: "", correoJuridico: "", correoIncidencias: "",
      telefonoGeneral: "", whatsapp: "", web: "", instagram: "", facebook: "", tiktok: "",
    },
    configOperativa: {
      moneda: "EUR (€)", idioma: "Español", zonaHoraria: "Europe/Madrid",
      formatoFecha: "DD/MM/AAAA", primerDiaSemana: "Lunes",
      localesAsociados: "", etiquetasInternas: "", colorPrimario: "#3B82F6",
    },
    auditoria: [
      { id: "a1", usuario: "Admin Principal", accion: "Empresa creada", apartado: "Datos generales", fecha: "2026-01-15 10:00" },
      { id: "a2", usuario: "Admin Principal", accion: "Usuario añadido", apartado: "Usuarios", fecha: "2026-02-01 09:30" },
    ],
  };
}
