// External app access & credentials management

export type EstadoApp = "Activo" | "Inactivo" | "Archivado";
export type NivelPermiso = "ver_enlace" | "ver_usuario" | "ver_credenciales" | "editar";
export type TipoIntegracion = "enlace" | "embebido" | "sso" | "oauth";

export interface AccesoApp {
  id: string;
  nombre: string;
  descripcion: string;
  url: string;
  icono: string; // emoji or icon key
  categoria: string;
  departamentos: string[];
  rolesAutorizados: string[];
  usuario: string;
  contrasena: string;
  estado: EstadoApp;
  responsable: string;
  notas: string;
  tipoIntegracion: TipoIntegracion;
  empresaId: string;
  ultimaActualizacion: string;
}

export const CATEGORIAS_APP = [
  "Fichaje y control horario",
  "Nóminas y RRHH",
  "Contabilidad y finanzas",
  "Marketing y redes",
  "Diseño y contenido",
  "Comunicación",
  "Almacenamiento y docs",
  "Gestión y ERP",
  "Logística y proveedores",
  "Legal y compliance",
  "Otros",
];

export const DEPARTAMENTOS = [
  "Dirección",
  "Gerencia",
  "RRHH",
  "Marketing",
  "Contabilidad",
  "Gestoría",
  "Jurídico",
  "Logística",
  "Mantenimiento",
  "Todos",
];

// --- HABANA ---
const HABANA_APPS: AccesoApp[] = [
  { id: "ha-1", nombre: "Factorial", descripcion: "Gestión de RRHH, fichajes y nóminas", url: "https://app.factorialhr.com", icono: "👤", categoria: "Nóminas y RRHH", departamentos: ["RRHH", "Dirección"], rolesAutorizados: ["Administrador", "Director", "Responsable"], usuario: "admin@habana.es", contrasena: "Hab*2026!Fact", estado: "Activo", responsable: "María García", notas: "Plan Business. Renovación anual en septiembre.", tipoIntegracion: "enlace", empresaId: "habana", ultimaActualizacion: "2026-04-01" },
  { id: "ha-2", nombre: "A3 Nóminas", descripcion: "Software de nóminas y seguros sociales", url: "https://a3.wolterskluwer.es", icono: "💰", categoria: "Nóminas y RRHH", departamentos: ["RRHH", "Gestoría"], rolesAutorizados: ["Administrador", "Director"], usuario: "habana_nominas", contrasena: "A3nom*2026", estado: "Activo", responsable: "Laura Sánchez", notas: "Licencia compartida con gestoría.", tipoIntegracion: "enlace", empresaId: "habana", ultimaActualizacion: "2026-03-15" },
  { id: "ha-3", nombre: "Meta Business Suite", descripcion: "Gestión de Facebook e Instagram", url: "https://business.facebook.com", icono: "📱", categoria: "Marketing y redes", departamentos: ["Marketing"], rolesAutorizados: ["Administrador", "Director", "Responsable"], usuario: "marketing@habana.es", contrasena: "MetaHab*2026", estado: "Activo", responsable: "Carlos Martínez", notas: "Cuentas de IG y FB vinculadas.", tipoIntegracion: "oauth", empresaId: "habana", ultimaActualizacion: "2026-04-05" },
  { id: "ha-4", nombre: "Canva Pro", descripcion: "Diseño gráfico y creatividades", url: "https://www.canva.com", icono: "🎨", categoria: "Diseño y contenido", departamentos: ["Marketing"], rolesAutorizados: ["Administrador", "Director", "Responsable", "Empleado"], usuario: "diseno@habana.es", contrasena: "CanvaHab*26", estado: "Activo", responsable: "Carlos Martínez", notas: "5 licencias activas.", tipoIntegracion: "enlace", empresaId: "habana", ultimaActualizacion: "2026-03-28" },
  { id: "ha-5", nombre: "Google Drive", descripcion: "Almacenamiento y documentación", url: "https://drive.google.com", icono: "📁", categoria: "Almacenamiento y docs", departamentos: ["Todos"], rolesAutorizados: ["Administrador", "Director", "Responsable", "Empleado"], usuario: "admin@habana.es", contrasena: "GDrive*Hab26", estado: "Activo", responsable: "Laura Sánchez", notas: "Workspace Business Standard.", tipoIntegracion: "oauth", empresaId: "habana", ultimaActualizacion: "2026-04-07" },
  { id: "ha-6", nombre: "Bankinter Empresas", descripcion: "Banca online empresarial", url: "https://empresas.bankinter.com", icono: "🏦", categoria: "Contabilidad y finanzas", departamentos: ["Contabilidad", "Dirección", "Gerencia"], rolesAutorizados: ["Administrador", "Director"], usuario: "habana_empresa", contrasena: "Bk*Hab2026!!", estado: "Activo", responsable: "Pedro Ruiz", notas: "Doble factor obligatorio.", tipoIntegracion: "enlace", empresaId: "habana", ultimaActualizacion: "2026-04-02" },
  { id: "ha-7", nombre: "Slack", descripcion: "Comunicación interna del equipo", url: "https://habana-team.slack.com", icono: "💬", categoria: "Comunicación", departamentos: ["Todos"], rolesAutorizados: ["Administrador", "Director", "Responsable", "Empleado"], usuario: "—", contrasena: "—", estado: "Activo", responsable: "María García", notas: "Cada usuario tiene su propia cuenta.", tipoIntegracion: "sso", empresaId: "habana", ultimaActualizacion: "2026-04-06" },
  { id: "ha-8", nombre: "Holded", descripcion: "Facturación y contabilidad", url: "https://app.holded.com", icono: "📊", categoria: "Contabilidad y finanzas", departamentos: ["Contabilidad", "Gestoría", "Dirección"], rolesAutorizados: ["Administrador", "Director", "Responsable"], usuario: "admin@habana.es", contrasena: "Hold*Hab26!", estado: "Activo", responsable: "Pedro Ruiz", notas: "Plan Premium.", tipoIntegracion: "enlace", empresaId: "habana", ultimaActualizacion: "2026-03-20" },
  { id: "ha-9", nombre: "Signaturit", descripcion: "Firma digital de contratos", url: "https://app.signaturit.com", icono: "✍️", categoria: "Legal y compliance", departamentos: ["RRHH", "Jurídico", "Dirección"], rolesAutorizados: ["Administrador", "Director"], usuario: "legal@habana.es", contrasena: "Sign*Hab26!", estado: "Activo", responsable: "Laura Sánchez", notas: "500 firmas/año contratadas.", tipoIntegracion: "enlace", empresaId: "habana", ultimaActualizacion: "2026-02-10" },
  { id: "ha-10", nombre: "Uber Eats Manager", descripcion: "Gestión de pedidos delivery", url: "https://merchants.ubereats.com", icono: "🛵", categoria: "Logística y proveedores", departamentos: ["Logística", "Gerencia"], rolesAutorizados: ["Administrador", "Director", "Responsable"], usuario: "habana@ubereats.com", contrasena: "UE*Hab2026", estado: "Inactivo", responsable: "Pedro Ruiz", notas: "Desactivado temporalmente. Revisar en mayo.", tipoIntegracion: "enlace", empresaId: "habana", ultimaActualizacion: "2026-01-15" },
];

// --- BACANAL ---
const BACANAL_APPS: AccesoApp[] = [
  { id: "ba-1", nombre: "Factorial", descripcion: "Gestión de RRHH, fichajes y nóminas", url: "https://app.factorialhr.com", icono: "👤", categoria: "Nóminas y RRHH", departamentos: ["RRHH", "Dirección"], rolesAutorizados: ["Administrador", "Director", "Responsable"], usuario: "admin@bacanal.es", contrasena: "Bac*2026!Fact", estado: "Activo", responsable: "Lucía Pérez", notas: "Plan Business.", tipoIntegracion: "enlace", empresaId: "bacanal", ultimaActualizacion: "2026-04-01" },
  { id: "ba-2", nombre: "Meta Business Suite", descripcion: "Gestión de Facebook e Instagram", url: "https://business.facebook.com", icono: "📱", categoria: "Marketing y redes", departamentos: ["Marketing"], rolesAutorizados: ["Administrador", "Director"], usuario: "marketing@bacanal.es", contrasena: "MetaBac*2026", estado: "Activo", responsable: "Andrés Jiménez", notas: "Página FB + cuenta IG.", tipoIntegracion: "oauth", empresaId: "bacanal", ultimaActualizacion: "2026-04-04" },
  { id: "ba-3", nombre: "Google Drive", descripcion: "Almacenamiento y documentación", url: "https://drive.google.com", icono: "📁", categoria: "Almacenamiento y docs", departamentos: ["Todos"], rolesAutorizados: ["Administrador", "Director", "Responsable", "Empleado"], usuario: "admin@bacanal.es", contrasena: "GDrive*Bac26", estado: "Activo", responsable: "Andrés Jiménez", notas: "Workspace Starter.", tipoIntegracion: "oauth", empresaId: "bacanal", ultimaActualizacion: "2026-04-07" },
  { id: "ba-4", nombre: "CaixaBank Empresas", descripcion: "Banca online empresarial", url: "https://empresas.caixabank.es", icono: "🏦", categoria: "Contabilidad y finanzas", departamentos: ["Contabilidad", "Dirección"], rolesAutorizados: ["Administrador", "Director"], usuario: "bacanal_emp", contrasena: "CxB*Bac2026!", estado: "Activo", responsable: "Andrés Jiménez", notas: "Coordinadora + firma mancomunada.", tipoIntegracion: "enlace", empresaId: "bacanal", ultimaActualizacion: "2026-03-30" },
  { id: "ba-5", nombre: "Glovo Partners", descripcion: "Gestión de pedidos delivery", url: "https://partners.glovoapp.com", icono: "🛵", categoria: "Logística y proveedores", departamentos: ["Logística", "Gerencia"], rolesAutorizados: ["Administrador", "Director", "Responsable"], usuario: "bacanal@glovo.com", contrasena: "Glv*Bac26!", estado: "Activo", responsable: "Lucía Pérez", notas: "Comisión negociada al 22%.", tipoIntegracion: "enlace", empresaId: "bacanal", ultimaActualizacion: "2026-04-03" },
  { id: "ba-6", nombre: "Canva Pro", descripcion: "Diseño gráfico y creatividades", url: "https://www.canva.com", icono: "🎨", categoria: "Diseño y contenido", departamentos: ["Marketing"], rolesAutorizados: ["Administrador", "Director", "Responsable"], usuario: "diseno@bacanal.es", contrasena: "CanvaBac*26", estado: "Activo", responsable: "Andrés Jiménez", notas: "3 licencias.", tipoIntegracion: "enlace", empresaId: "bacanal", ultimaActualizacion: "2026-03-20" },
];

export function getAccesosAppsPorEmpresa(empresaId: string): AccesoApp[] {
  if (empresaId === "habana") return [...HABANA_APPS];
  if (empresaId === "bacanal") return [...BACANAL_APPS];
  return [];
}

export function getAccesosAppsPorDepartamento(empresaId: string, departamento: string): AccesoApp[] {
  return getAccesosAppsPorEmpresa(empresaId).filter(
    (a) => a.estado === "Activo" && (a.departamentos.includes(departamento) || a.departamentos.includes("Todos"))
  );
}
