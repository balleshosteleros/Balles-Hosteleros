// ─── Proveedores data ─────────────────────────────────────

export type EstadoProveedor = "Activo" | "Inactivo" | "Archivado";
export const ESTADOS_PROVEEDOR: EstadoProveedor[] = ["Activo", "Inactivo", "Archivado"];

export const CATEGORIAS_PROVEEDOR = [
  "Cárnicos", "Pescados y mariscos", "Frutas y verduras", "Bebidas",
  "Lácteos", "Congelados", "Limpieza e higiene", "Panadería",
  "Envasados y conservas", "Equipamiento", "Otros",
];

export const DIAS_REPARTO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export interface Proveedor {
  id: string;
  empresaId: string;
  nombreComercial: string;
  razonSocial: string;
  cifNif: string;
  categoria: string;
  estado: EstadoProveedor;
  observaciones: string;
  // Contacto
  personaContacto: string;
  telefonoPrincipal: string;
  telefonoSecundario: string;
  emailPrincipal: string;
  emailPedidos: string;
  emailIncidencias: string;
  web: string;
  // Dirección
  direccion: string;
  ciudad: string;
  provincia: string;
  pais: string;
  codigoPostal: string;
  // Condiciones
  diasReparto: string[];
  condicionesPago: string;
  plazo: string;
  observacionesLogisticas: string;
  comentariosInternos: string;
  // Meta
  creador: string;
  createdAt: string;
  ultimaActualizacion: string;
}

// ─── Mock data ────────────────────────────────────────────

const proveedoresHabana: Proveedor[] = [
  {
    id: "prov-h1", empresaId: "habana",
    nombreComercial: "CARNES SELECTAS IBÉRICA", razonSocial: "Carnes Selectas Ibérica S.L.", cifNif: "B12345678",
    categoria: "Cárnicos", estado: "Activo", observaciones: "Proveedor principal de cárnicos",
    personaContacto: "Antonio Ruiz", telefonoPrincipal: "912 345 678", telefonoSecundario: "",
    emailPrincipal: "info@carnesiberica.es", emailPedidos: "pedidos@carnesiberica.es", emailIncidencias: "incidencias@carnesiberica.es", web: "www.carnesiberica.es",
    direccion: "Polígono Industrial Las Rozas, Nave 12", ciudad: "Madrid", provincia: "Madrid", pais: "España", codigoPostal: "28230",
    diasReparto: ["Lunes", "Miércoles", "Viernes"], condicionesPago: "30 días", plazo: "48h", observacionesLogisticas: "Reparto antes de las 10:00", comentariosInternos: "Buen servicio",
    creador: "Carlos López", createdAt: "2025-01-15", ultimaActualizacion: "2026-03-15",
  },
  {
    id: "prov-h2", empresaId: "habana",
    nombreComercial: "BEBIDAS PREMIUM S.L.", razonSocial: "Bebidas Premium S.L.", cifNif: "B87654321",
    categoria: "Bebidas", estado: "Activo", observaciones: "",
    personaContacto: "Laura Vega", telefonoPrincipal: "913 456 789", telefonoSecundario: "600 123 456",
    emailPrincipal: "info@bebidaspremium.es", emailPedidos: "pedidos@bebidaspremium.es", emailIncidencias: "", web: "www.bebidaspremium.es",
    direccion: "C/ Alcalá 200", ciudad: "Madrid", provincia: "Madrid", pais: "España", codigoPostal: "28028",
    diasReparto: ["Martes", "Jueves"], condicionesPago: "15 días", plazo: "24h", observacionesLogisticas: "", comentariosInternos: "",
    creador: "María García", createdAt: "2025-02-20", ultimaActualizacion: "2026-03-10",
  },
  {
    id: "prov-h3", empresaId: "habana",
    nombreComercial: "LIMPIEZA INDUSTRIAL ROCA", razonSocial: "Limpieza Industrial Roca S.A.", cifNif: "A11223344",
    categoria: "Limpieza e higiene", estado: "Activo", observaciones: "Sin email de pedidos configurado",
    personaContacto: "Pedro Roca", telefonoPrincipal: "914 567 890", telefonoSecundario: "",
    emailPrincipal: "contacto@limpiezaroca.es", emailPedidos: "", emailIncidencias: "", web: "",
    direccion: "Av. Industria 45", ciudad: "Getafe", provincia: "Madrid", pais: "España", codigoPostal: "28901",
    diasReparto: ["Lunes", "Viernes"], condicionesPago: "Contado", plazo: "72h", observacionesLogisticas: "Mínimo 100€ por pedido", comentariosInternos: "Pendiente renegociar condiciones",
    creador: "Carlos López", createdAt: "2025-03-10", ultimaActualizacion: "2026-03-18",
  },
  {
    id: "prov-h4", empresaId: "habana",
    nombreComercial: "DISTRIBUCIONES GARCÍA S.L.", razonSocial: "Distribuciones García S.L.", cifNif: "B55667788",
    categoria: "Lácteos", estado: "Activo", observaciones: "",
    personaContacto: "Manuel García", telefonoPrincipal: "915 678 901", telefonoSecundario: "",
    emailPrincipal: "info@distgarcia.es", emailPedidos: "pedidos@distgarcia.es", emailIncidencias: "", web: "www.distgarcia.es",
    direccion: "C/ Mayor 88", ciudad: "Alcalá de Henares", provincia: "Madrid", pais: "España", codigoPostal: "28801",
    diasReparto: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"], condicionesPago: "30 días", plazo: "24h", observacionesLogisticas: "", comentariosInternos: "",
    creador: "María García", createdAt: "2025-01-05", ultimaActualizacion: "2026-02-28",
  },
  {
    id: "prov-h5", empresaId: "habana",
    nombreComercial: "PESCADOS ATLÁNTICO S.L.", razonSocial: "Pescados Atlántico S.L.", cifNif: "B99887766",
    categoria: "Pescados y mariscos", estado: "Inactivo", observaciones: "Dejó de servir en enero 2026",
    personaContacto: "Rosa Martín", telefonoPrincipal: "916 789 012", telefonoSecundario: "",
    emailPrincipal: "info@pescadosatlantico.es", emailPedidos: "ventas@pescadosatlantico.es", emailIncidencias: "", web: "",
    direccion: "Puerto Pesquero, Lonja 3", ciudad: "Cádiz", provincia: "Cádiz", pais: "España", codigoPostal: "11001",
    diasReparto: ["Martes", "Jueves", "Sábado"], condicionesPago: "Contado", plazo: "24h", observacionesLogisticas: "Solo producto fresco", comentariosInternos: "Buscar alternativa",
    creador: "Carlos López", createdAt: "2025-01-20", ultimaActualizacion: "2026-01-22",
  },
  {
    id: "prov-h6", empresaId: "habana",
    nombreComercial: "FRUTAS Y VERDURAS LEVANTE", razonSocial: "Frutas y Verduras Levante S.L.", cifNif: "B44332211",
    categoria: "Frutas y verduras", estado: "Activo", observaciones: "",
    personaContacto: "Isabel Torres", telefonoPrincipal: "961 234 567", telefonoSecundario: "",
    emailPrincipal: "info@frutaslevante.es", emailPedidos: "pedidos@frutaslevante.es", emailIncidencias: "", web: "www.frutaslevante.es",
    direccion: "Mercado Central, Puesto 15", ciudad: "Valencia", provincia: "Valencia", pais: "España", codigoPostal: "46001",
    diasReparto: ["Lunes", "Miércoles", "Viernes"], condicionesPago: "15 días", plazo: "48h", observacionesLogisticas: "Producto de temporada", comentariosInternos: "",
    creador: "María García", createdAt: "2025-04-01", ultimaActualizacion: "2026-03-01",
  },
];

const proveedoresBacanal: Proveedor[] = [
  {
    id: "prov-b1", empresaId: "bacanal",
    nombreComercial: "CARNES SELECTAS IBÉRICA", razonSocial: "Carnes Selectas Ibérica S.L.", cifNif: "B12345678",
    categoria: "Cárnicos", estado: "Activo", observaciones: "",
    personaContacto: "Antonio Ruiz", telefonoPrincipal: "912 345 678", telefonoSecundario: "",
    emailPrincipal: "info@carnesiberica.es", emailPedidos: "pedidos@carnesiberica.es", emailIncidencias: "", web: "www.carnesiberica.es",
    direccion: "Polígono Industrial Las Rozas, Nave 12", ciudad: "Madrid", provincia: "Madrid", pais: "España", codigoPostal: "28230",
    diasReparto: ["Martes", "Jueves"], condicionesPago: "30 días", plazo: "48h", observacionesLogisticas: "", comentariosInternos: "",
    creador: "Laura Martínez", createdAt: "2025-02-01", ultimaActualizacion: "2026-03-16",
  },
  {
    id: "prov-b2", empresaId: "bacanal",
    nombreComercial: "BEBIDAS PREMIUM S.L.", razonSocial: "Bebidas Premium S.L.", cifNif: "B87654321",
    categoria: "Bebidas", estado: "Activo", observaciones: "",
    personaContacto: "Laura Vega", telefonoPrincipal: "913 456 789", telefonoSecundario: "",
    emailPrincipal: "info@bebidaspremium.es", emailPedidos: "pedidos@bebidaspremium.es", emailIncidencias: "", web: "",
    direccion: "C/ Alcalá 200", ciudad: "Madrid", provincia: "Madrid", pais: "España", codigoPostal: "28028",
    diasReparto: ["Lunes", "Miércoles", "Viernes"], condicionesPago: "30 días", plazo: "24h", observacionesLogisticas: "", comentariosInternos: "",
    creador: "Laura Martínez", createdAt: "2025-02-01", ultimaActualizacion: "2026-03-08",
  },
];

// ─── Accessors ────────────────────────────────────────────

const ALL_PROVEEDORES: Record<string, Proveedor[]> = {
  habana: proveedoresHabana,
  bacanal: proveedoresBacanal,
};

export function getProveedoresPorEmpresa(empresaId: string): Proveedor[] {
  return structuredClone(ALL_PROVEEDORES[empresaId] || []);
}
