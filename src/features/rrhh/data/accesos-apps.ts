// External app access & credentials management

export type EstadoApp = "Activo" | "Inactivo" | "Archivado";
export type NivelPermiso = "ver_enlace" | "ver_usuario" | "ver_credenciales" | "editar";
export type TipoIntegracion = "enlace" | "embebido" | "sso" | "oauth";

export interface AccesoApp {
  id: string;
  nombre: string;
  descripcion: string;
  url: string;
  icono: string;        // emoji fallback
  logoUrl?: string;     // logo de marca (clearbit / directo)
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
  "Sistemas de gestión",
  "Banca y finanzas",
  "Redes sociales",
  "Presencia digital",
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
  "Hosting y web",
  "Marketplace y servicios",
  "IA y productividad",
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

// ─── Helpers de logos ────────────────────────────────────────────────────────
// icon.horse: agrega de múltiples fuentes, funciona para ~90% de dominios
const logo = (domain: string) => `https://icon.horse/icon/${domain}`;
// Simple Icons CDN: SVGs vectoriales oficiales de marcas conocidas
const si = (slug: string, hex = "000000") => `https://cdn.simpleicons.org/${slug}/${hex}`;
const today = "2026-04-13";

// ─── HABANA ──────────────────────────────────────────────────────────────────
// Set inicial idéntico al de BACANAL. Cada empresa gestiona sus propios
// accesos de forma independiente desde Ajustes → Accesos (puede divergir).
const HABANA_APPS: AccesoApp[] = [
  // SISTEMAS DE GESTIÓN
  {
    id: "ha-sg1", nombre: "Banktrack", descripcion: "Control financiero y tesorería empresarial",
    url: "https://app.banktrack.com", icono: "🏦", logoUrl: "/icons/apps/banktrack.png",
    categoria: "Sistemas de gestión", departamentos: ["Contabilidad", "Dirección"],
    rolesAutorizados: ["Dirección", "Gerencia"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Pedro Ruiz", notas: "", tipoIntegracion: "enlace",
    empresaId: "habana", ultimaActualizacion: today,
  },
  {
    id: "ha-sg2", nombre: "Ágora", descripcion: "Software TPV para hostelería",
    url: "https://www.agora-pv.com", icono: "🍽️", logoUrl: "/icons/apps/agora.png",
    categoria: "Sistemas de gestión", departamentos: ["Gerencia", "Dirección"],
    rolesAutorizados: ["Dirección", "Gerencia"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "María García", notas: "", tipoIntegracion: "enlace",
    empresaId: "habana", ultimaActualizacion: today,
  },
  {
    id: "ha-sg3", nombre: "Sesame", descripcion: "RRHH, fichajes y gestión de personal",
    url: "https://app.sesamehr.es", icono: "👥", logoUrl: logo("sesamehr.com"),
    categoria: "Sistemas de gestión", departamentos: ["RRHH", "Dirección"],
    rolesAutorizados: ["Dirección", "Gerencia", "RRHH"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "María García", notas: "", tipoIntegracion: "enlace",
    empresaId: "habana", ultimaActualizacion: today,
  },
  {
    id: "ha-sg4", nombre: "Cover Manager", descripcion: "Gestión de reservas para restaurantes",
    url: "https://www.covermanager.com", icono: "📅", logoUrl: logo("covermanager.com"),
    categoria: "Sistemas de gestión", departamentos: ["Gerencia", "Dirección"],
    rolesAutorizados: ["Dirección", "Gerencia"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Carlos Martínez", notas: "", tipoIntegracion: "enlace",
    empresaId: "habana", ultimaActualizacion: today,
  },
  {
    id: "ha-sg5", nombre: "High Level", descripcion: "CRM y marketing automation",
    url: "https://app.gohighlevel.com", icono: "📊", logoUrl: "/icons/apps/highlevel.png",
    categoria: "Sistemas de gestión", departamentos: ["Marketing", "Dirección"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Carlos Martínez", notas: "", tipoIntegracion: "enlace",
    empresaId: "habana", ultimaActualizacion: today,
  },
  {
    id: "ha-sg6", nombre: "B2com", descripcion: "Plataforma de gestión para hostelería",
    url: "https://www.b2com.es", icono: "🏢", logoUrl: "/icons/apps/b2com.png",
    categoria: "Sistemas de gestión", departamentos: ["Dirección"],
    rolesAutorizados: ["Dirección"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Pedro Ruiz", notas: "", tipoIntegracion: "enlace",
    empresaId: "habana", ultimaActualizacion: today,
  },

  // BANCA Y FINANZAS
  {
    id: "ha-bf1", nombre: "BBVA Net Cash", descripcion: "Banca online empresarial BBVA",
    url: "https://www.bbva.es/empresas/productos/banca-electronica/net-cash.html", icono: "💳",
    logoUrl: "/icons/apps/bbva.png", categoria: "Banca y finanzas",
    departamentos: ["Contabilidad", "Dirección"], rolesAutorizados: ["Dirección"],
    usuario: "", contrasena: "", estado: "Activo", responsable: "Pedro Ruiz",
    notas: "Doble factor obligatorio.", tipoIntegracion: "enlace",
    empresaId: "habana", ultimaActualizacion: today,
  },
  {
    id: "ha-bf2", nombre: "Revolut Business", descripcion: "Banca digital empresarial Revolut",
    url: "https://business.revolut.com", icono: "💼", logoUrl: si("revolut", "0666EB"),
    categoria: "Banca y finanzas", departamentos: ["Contabilidad", "Dirección"],
    rolesAutorizados: ["Dirección"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Pedro Ruiz", notas: "", tipoIntegracion: "enlace",
    empresaId: "habana", ultimaActualizacion: today,
  },
  {
    id: "ha-bf3", nombre: "Stripe", descripcion: "Pasarela de pagos online",
    url: "https://dashboard.stripe.com", icono: "⚡", logoUrl: si("stripe", "635BFF"),
    categoria: "Banca y finanzas", departamentos: ["Contabilidad", "Dirección"],
    rolesAutorizados: ["Dirección", "Gerencia"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Pedro Ruiz", notas: "", tipoIntegracion: "oauth",
    empresaId: "habana", ultimaActualizacion: today,
  },

  // REDES SOCIALES
  {
    id: "ha-rs1", nombre: "Instagram", descripcion: "Perfil de Instagram de La Habana",
    url: "https://www.instagram.com", icono: "📸", logoUrl: si("instagram", "E4405F"),
    categoria: "Redes sociales", departamentos: ["Marketing"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Carlos Martínez", notas: "", tipoIntegracion: "enlace",
    empresaId: "habana", ultimaActualizacion: today,
  },
  {
    id: "ha-rs2", nombre: "Facebook", descripcion: "Página de Facebook de La Habana",
    url: "https://www.facebook.com", icono: "👍", logoUrl: si("facebook", "1877F2"),
    categoria: "Redes sociales", departamentos: ["Marketing"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Carlos Martínez", notas: "", tipoIntegracion: "oauth",
    empresaId: "habana", ultimaActualizacion: today,
  },
  {
    id: "ha-rs3", nombre: "TikTok", descripcion: "Cuenta TikTok de La Habana",
    url: "https://www.tiktok.com", icono: "🎵", logoUrl: si("tiktok", "000000"),
    categoria: "Redes sociales", departamentos: ["Marketing"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Carlos Martínez", notas: "", tipoIntegracion: "enlace",
    empresaId: "habana", ultimaActualizacion: today,
  },

  // PRESENCIA DIGITAL
  {
    id: "ha-pd1", nombre: "Página Web", descripcion: "Sitio web oficial de La Habana",
    url: "https://www.lahabana.es", icono: "🌐",
    categoria: "Presencia digital", departamentos: ["Marketing", "Dirección"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Carlos Martínez", notas: "", tipoIntegracion: "enlace",
    empresaId: "habana", ultimaActualizacion: today,
  },
  {
    id: "ha-pd2", nombre: "Ficha Google", descripcion: "Google Business Profile de La Habana",
    url: "https://business.google.com", icono: "📍", logoUrl: si("google", "4285F4"),
    categoria: "Presencia digital", departamentos: ["Marketing", "Dirección"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Carlos Martínez", notas: "", tipoIntegracion: "oauth",
    empresaId: "habana", ultimaActualizacion: today,
  },
];

// ─── BACANAL ─────────────────────────────────────────────────────────────────
const BACANAL_APPS: AccesoApp[] = [
  // SISTEMAS DE GESTIÓN
  {
    id: "ba-sg1", nombre: "Banktrack", descripcion: "Control financiero y tesorería empresarial",
    url: "https://app.banktrack.com", icono: "🏦", logoUrl: "/icons/apps/banktrack.png",
    categoria: "Sistemas de gestión", departamentos: ["Contabilidad", "Dirección"],
    rolesAutorizados: ["Dirección", "Gerencia"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Lucía Pérez", notas: "", tipoIntegracion: "enlace",
    empresaId: "bacanal", ultimaActualizacion: today,
  },
  {
    id: "ba-sg2", nombre: "Ágora", descripcion: "Software TPV para hostelería",
    url: "https://www.agora-pv.com", icono: "🍽️", logoUrl: "/icons/apps/agora.png",
    categoria: "Sistemas de gestión", departamentos: ["Gerencia", "Dirección"],
    rolesAutorizados: ["Dirección", "Gerencia"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Andrés Jiménez", notas: "", tipoIntegracion: "enlace",
    empresaId: "bacanal", ultimaActualizacion: today,
  },
  {
    id: "ba-sg3", nombre: "Sesame", descripcion: "RRHH, fichajes y gestión de personal",
    url: "https://app.sesamehr.es", icono: "👥", logoUrl: logo("sesamehr.com"),
    categoria: "Sistemas de gestión", departamentos: ["RRHH", "Dirección"],
    rolesAutorizados: ["Dirección", "Gerencia", "RRHH"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Lucía Pérez", notas: "", tipoIntegracion: "enlace",
    empresaId: "bacanal", ultimaActualizacion: today,
  },
  {
    id: "ba-sg4", nombre: "Cover Manager", descripcion: "Gestión de reservas para restaurantes",
    url: "https://www.covermanager.com", icono: "📅", logoUrl: logo("covermanager.com"),
    categoria: "Sistemas de gestión", departamentos: ["Gerencia", "Dirección"],
    rolesAutorizados: ["Dirección", "Gerencia"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Andrés Jiménez", notas: "", tipoIntegracion: "enlace",
    empresaId: "bacanal", ultimaActualizacion: today,
  },
  {
    id: "ba-sg5", nombre: "High Level", descripcion: "CRM y marketing automation",
    url: "https://app.gohighlevel.com", icono: "📊", logoUrl: "/icons/apps/highlevel.png",
    categoria: "Sistemas de gestión", departamentos: ["Marketing", "Dirección"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Andrés Jiménez", notas: "", tipoIntegracion: "enlace",
    empresaId: "bacanal", ultimaActualizacion: today,
  },
  {
    id: "ba-sg6", nombre: "B2com", descripcion: "Plataforma de gestión para hostelería",
    url: "https://www.b2com.es", icono: "🏢", logoUrl: "/icons/apps/b2com.png",
    categoria: "Sistemas de gestión", departamentos: ["Dirección"],
    rolesAutorizados: ["Dirección"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Andrés Jiménez", notas: "", tipoIntegracion: "enlace",
    empresaId: "bacanal", ultimaActualizacion: today,
  },

  // BANCA Y FINANZAS
  {
    id: "ba-bf1", nombre: "BBVA Net Cash", descripcion: "Banca online empresarial BBVA",
    url: "https://www.bbva.es/empresas/productos/banca-electronica/net-cash.html", icono: "💳",
    logoUrl: "/icons/apps/bbva.png", categoria: "Banca y finanzas",
    departamentos: ["Contabilidad", "Dirección"], rolesAutorizados: ["Dirección"],
    usuario: "", contrasena: "", estado: "Activo", responsable: "Andrés Jiménez",
    notas: "Doble factor obligatorio.", tipoIntegracion: "enlace",
    empresaId: "bacanal", ultimaActualizacion: today,
  },
  {
    id: "ba-bf2", nombre: "Revolut Business", descripcion: "Banca digital empresarial Revolut",
    url: "https://business.revolut.com", icono: "💼", logoUrl: si("revolut", "0666EB"),
    categoria: "Banca y finanzas", departamentos: ["Contabilidad", "Dirección"],
    rolesAutorizados: ["Dirección"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Andrés Jiménez", notas: "", tipoIntegracion: "enlace",
    empresaId: "bacanal", ultimaActualizacion: today,
  },
  {
    id: "ba-bf3", nombre: "Stripe", descripcion: "Pasarela de pagos online",
    url: "https://dashboard.stripe.com", icono: "⚡", logoUrl: si("stripe", "635BFF"),
    categoria: "Banca y finanzas", departamentos: ["Contabilidad", "Dirección"],
    rolesAutorizados: ["Dirección", "Gerencia"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Andrés Jiménez", notas: "", tipoIntegracion: "oauth",
    empresaId: "bacanal", ultimaActualizacion: today,
  },

  // REDES SOCIALES
  {
    id: "ba-rs1", nombre: "Instagram", descripcion: "Perfil de Instagram de Bacanal",
    url: "https://www.instagram.com", icono: "📸", logoUrl: si("instagram", "E4405F"),
    categoria: "Redes sociales", departamentos: ["Marketing"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Andrés Jiménez", notas: "", tipoIntegracion: "enlace",
    empresaId: "bacanal", ultimaActualizacion: today,
  },
  {
    id: "ba-rs2", nombre: "Facebook", descripcion: "Página de Facebook de Bacanal",
    url: "https://www.facebook.com", icono: "👍", logoUrl: si("facebook", "1877F2"),
    categoria: "Redes sociales", departamentos: ["Marketing"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Andrés Jiménez", notas: "", tipoIntegracion: "oauth",
    empresaId: "bacanal", ultimaActualizacion: today,
  },
  {
    id: "ba-rs3", nombre: "TikTok", descripcion: "Cuenta TikTok de Bacanal",
    url: "https://www.tiktok.com", icono: "🎵", logoUrl: si("tiktok", "000000"),
    categoria: "Redes sociales", departamentos: ["Marketing"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Andrés Jiménez", notas: "", tipoIntegracion: "enlace",
    empresaId: "bacanal", ultimaActualizacion: today,
  },

  // PRESENCIA DIGITAL
  {
    id: "ba-pd1", nombre: "Página Web", descripcion: "Sitio web oficial de Bacanal",
    url: "https://www.bacanal.es", icono: "🌐",
    categoria: "Presencia digital", departamentos: ["Marketing", "Dirección"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Andrés Jiménez", notas: "", tipoIntegracion: "enlace",
    empresaId: "bacanal", ultimaActualizacion: today,
  },
  {
    id: "ba-pd2", nombre: "Ficha Google", descripcion: "Google Business Profile de Bacanal",
    url: "https://business.google.com", icono: "📍", logoUrl: si("google", "4285F4"),
    categoria: "Presencia digital", departamentos: ["Marketing", "Dirección"],
    rolesAutorizados: ["Dirección", "Marketing"], usuario: "", contrasena: "",
    estado: "Activo", responsable: "Andrés Jiménez", notas: "", tipoIntegracion: "oauth",
    empresaId: "bacanal", ultimaActualizacion: today,
  },
];

// ─── Public API ──────────────────────────────────────────────────────────────
export function getAccesosAppsPorEmpresa(empresaId: string): AccesoApp[] {
  if (empresaId === "habana") return [...HABANA_APPS];
  if (empresaId === "bacanal") return [...BACANAL_APPS];
  return [];
}

export function getAllAccesosApps(): AccesoApp[] {
  return [...HABANA_APPS, ...BACANAL_APPS];
}

export function getAccesosAppsPorDepartamento(empresaId: string, departamento: string): AccesoApp[] {
  return getAccesosAppsPorEmpresa(empresaId).filter(
    (a) => a.estado === "Activo" && (a.departamentos.includes(departamento) || a.departamentos.includes("Todos"))
  );
}
