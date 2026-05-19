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

// ─── Telefonía ──────────────────────────────────────────────────
export type TelefoniaProveedor = "none" | "b2com_sip" | "sip" | "twilio";

export interface TelefoniaConfig {
  proveedor: TelefoniaProveedor;
  callerId: string;
  displayName: string;
  sipServer: string;
  sipUser: string;
  sipPassword: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioAppSid: string;
  grabarLlamadas: boolean;
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
  telefonia: TelefoniaConfig;
  auditoria: EntradaAuditoria[];
}

// Formato canónico — debe coincidir con MODULOS_NAV en RolesTab y con
// los valores que se persisten en empresa_roles.permisos[].modulo.
const MODULOS = [
  "DIRECCIÓN", "SALA", "COCINA", "GERENCIA", "CALIDAD",
  "RECURSOS HUMANOS", "MARKETING", "LOGÍSTICA",
  "CONTABILIDAD", "GESTORÍA", "JURÍDICO", "AJUSTES",
];

// El nombre del rol coincide con el del departamento que representa
// (multi-tenant uniforme). DIRECCIÓN es la excepción: representa al director
// y recibe acceso a todos los módulos.
function buildRoles(): Rol[] {
  const roleNames = [
    { nombre: "DIRECCIÓN", desc: "Dirección general — acceso completo" },
    { nombre: "RECURSOS HUMANOS", desc: "Gestión de personal y nóminas" },
    { nombre: "LOGÍSTICA", desc: "Proveedores, productos e inventario" },
    { nombre: "COCINA", desc: "Escandallos y producción" },
    { nombre: "SALA", desc: "Servicio y atención en sala" },
    { nombre: "GERENCIA", desc: "Supervisión general y cuadros de mando" },
    { nombre: "CONTABILIDAD", desc: "Facturas, operaciones y tesorería" },
    { nombre: "GESTORÍA", desc: "Gestión documental y fiscal" },
    { nombre: "JURÍDICO", desc: "Procesos legales y normativa" },
    { nombre: "MARKETING", desc: "Comunicación, campañas y reservas" },
    { nombre: "CALIDAD", desc: "APPCC y control de calidad" },
  ];
  return roleNames.map((r, i) => {
    // DIRECCIÓN es excepción: acceso completo a todos los módulos
    // (espejo del seed real en BD via seed_default_roles_for_empresa).
    const accesoTotal = r.nombre === "DIRECCIÓN";
    return {
      id: `rol-${i}`,
      nombre: r.nombre,
      descripcion: r.desc,
      permisos: MODULOS.map((m) => ({
        modulo: m,
        ver: accesoTotal || m === r.nombre,
        editar: accesoTotal || m === r.nombre,
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
    telefonia: {
      proveedor: "none",
      callerId: "",
      displayName: "",
      sipServer: "",
      sipUser: "",
      sipPassword: "",
      twilioAccountSid: "",
      twilioAuthToken: "",
      twilioAppSid: "",
      grabarLlamadas: false,
    },
    auditoria: [
      { id: "a1", usuario: "Admin Principal", accion: "Empresa creada", apartado: "Datos generales", fecha: "2026-01-15 10:00" },
      { id: "a2", usuario: "Admin Principal", accion: "Usuario añadido", apartado: "Usuarios", fecha: "2026-02-01 09:30" },
    ],
  };
}
