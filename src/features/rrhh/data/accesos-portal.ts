// Portal access records linking employees to user accounts

export type EstadoAcceso = "Activo" | "Inactivo" | "Pendiente";

export interface AccesoPortal {
  id: string;
  empleadoId: string;
  nombreEmpleado: string;
  emailUsuario: string;
  empresa: string;
  empresaId: string;
  rol: string;
  departamento?: string;
  estadoAcceso: EstadoAcceso;
  ultimaConexion: string;
  fechaCreacion: string;
  permisos: PermisoPortal[];
}

export interface PermisoPortal {
  modulo: string;
  ver: boolean;
  editar: boolean;
}

const MODULOS_PORTAL = [
  "Dashboard", "Dirección", "RRHH", "Logística", "Cocina",
  "Gerencia", "Contabilidad", "Gestoría", "Jurídico",
  "Marketing", "Ajustes",
];

// Mapa rol → módulo propio (solo ese módulo + Dashboard)
const ROL_MODULO: Record<string, string> = {
  "Dirección": "Dirección",
  "RRHH": "RRHH",
  "Logística": "Logística",
  "Cocina": "Cocina",
  "Gerencia": "Gerencia",
  "Contabilidad": "Contabilidad",
  "Gestoría": "Gestoría",
  "Jurídico": "Jurídico",
  "Marketing": "Marketing",
};

export function permisosDesdeRol(rol: string): PermisoPortal[] {
  // Acceso total
  if (rol === "Administrador" || rol === "Director") {
    return MODULOS_PORTAL.map((m) => ({ modulo: m, ver: true, editar: true }));
  }
  // Solo lectura global
  if (rol === "Solo lectura") {
    return MODULOS_PORTAL.map((m) => ({ modulo: m, ver: true, editar: false }));
  }
  // Empleado: solo su ficha RRHH y Dashboard
  if (rol === "Empleado") {
    return MODULOS_PORTAL.map((m) => ({ modulo: m, ver: m === "RRHH" || m === "Dashboard", editar: false }));
  }
  // Roles departamentales: solo su propio módulo + Dashboard
  const moduloPropio = ROL_MODULO[rol];
  if (moduloPropio) {
    return MODULOS_PORTAL.map((m) => ({
      modulo: m,
      ver: m === "Dashboard" || m === moduloPropio,
      editar: m === moduloPropio,
    }));
  }
  // Fallback sin permisos
  return MODULOS_PORTAL.map((m) => ({ modulo: m, ver: false, editar: false }));
}

export function crearAccesoDesdeEmpleado(
  empleadoId: string,
  nombre: string,
  email: string,
  empresaNombre: string,
  empresaId: string,
  rol: string = "Empleado",
): AccesoPortal {
  return {
    id: `acc-${empleadoId}`,
    empleadoId,
    nombreEmpleado: nombre,
    emailUsuario: email,
    empresa: empresaNombre,
    empresaId,
    rol,
    estadoAcceso: "Pendiente",
    ultimaConexion: "—",
    fechaCreacion: new Date().toISOString().slice(0, 10),
    permisos: permisosDesdeRol(rol),
  };
}

const HABANA_ACCESOS: AccesoPortal[] = [
  { id: "acc-h1", empleadoId: "h1", nombreEmpleado: "Carlos Martínez López", emailUsuario: "carlos.martinez@habana.es", empresa: "HABANA", empresaId: "habana", rol: "Empleado", estadoAcceso: "Activo", ultimaConexion: "2026-04-06 22:15", fechaCreacion: "2022-06-01", permisos: permisosDesdeRol("Empleado") },
  { id: "acc-h2", empleadoId: "h2", nombreEmpleado: "María García Fernández", emailUsuario: "maria.garcia@habana.es", empresa: "HABANA", empresaId: "habana", rol: "Responsable", estadoAcceso: "Activo", ultimaConexion: "2026-04-07 09:30", fechaCreacion: "2020-03-15", permisos: permisosDesdeRol("Responsable") },
  { id: "acc-h4", empleadoId: "h4", nombreEmpleado: "Laura Sánchez Moreno", emailUsuario: "laura.sanchez@habana.es", empresa: "HABANA", empresaId: "habana", rol: "Director", estadoAcceso: "Activo", ultimaConexion: "2026-04-07 10:00", fechaCreacion: "2020-01-10", permisos: permisosDesdeRol("Director") },
  { id: "acc-h5", empleadoId: "h5", nombreEmpleado: "Pedro Ruiz Navarro", emailUsuario: "pedro.ruiz@habana.es", empresa: "HABANA", empresaId: "habana", rol: "Gerencia", estadoAcceso: "Activo", ultimaConexion: "2026-04-06 18:00", fechaCreacion: "2021-02-01", permisos: permisosDesdeRol("Gerencia") },
  { id: "acc-h3", empleadoId: "h3", nombreEmpleado: "Alejandro Ruiz Torres", emailUsuario: "alejandro.ruiz@habana.es", empresa: "HABANA", empresaId: "habana", rol: "Empleado", estadoAcceso: "Inactivo", ultimaConexion: "2026-03-20 23:00", fechaCreacion: "2023-01-15", permisos: permisosDesdeRol("Empleado") },
  { id: "acc-h6", empleadoId: "h6", nombreEmpleado: "Ana López Díaz", emailUsuario: "ana.lopez@habana.es", empresa: "HABANA", empresaId: "habana", rol: "Empleado", estadoAcceso: "Pendiente", ultimaConexion: "—", fechaCreacion: "2024-06-01", permisos: permisosDesdeRol("Empleado") },
];

const BACANAL_ACCESOS: AccesoPortal[] = [
  { id: "acc-b1", empleadoId: "b1", nombreEmpleado: "Andrés Jiménez Ramos", emailUsuario: "andres.jimenez@bacanal.es", empresa: "BACANAL", empresaId: "bacanal", rol: "Administrador", estadoAcceso: "Activo", ultimaConexion: "2026-04-07 08:00", fechaCreacion: "2018-01-10", permisos: permisosDesdeRol("Administrador") },
  { id: "acc-b2", empleadoId: "b2", nombreEmpleado: "Lucía Pérez Ortega", emailUsuario: "lucia.perez@bacanal.es", empresa: "BACANAL", empresaId: "bacanal", rol: "Responsable", estadoAcceso: "Activo", ultimaConexion: "2026-04-06 21:00", fechaCreacion: "2019-09-01", permisos: permisosDesdeRol("Responsable") },
  { id: "acc-b6", empleadoId: "b6", nombreEmpleado: "Isabel Domínguez Lara", emailUsuario: "isabel.dominguez@bacanal.es", empresa: "BACANAL", empresaId: "bacanal", rol: "Empleado", estadoAcceso: "Activo", ultimaConexion: "2026-04-05 17:30", fechaCreacion: "2022-03-01", permisos: permisosDesdeRol("Empleado") },
  { id: "acc-b3", empleadoId: "b3", nombreEmpleado: "Miguel Santos Gil", emailUsuario: "miguel.santos@bacanal.es", empresa: "BACANAL", empresaId: "bacanal", rol: "Empleado", estadoAcceso: "Inactivo", ultimaConexion: "2026-02-10 12:00", fechaCreacion: "2023-05-01", permisos: permisosDesdeRol("Empleado") },
];

export function getAccesosPorEmpresa(empresaId: string): AccesoPortal[] {
  if (empresaId === "habana") return [...HABANA_ACCESOS];
  if (empresaId === "bacanal") return [...BACANAL_ACCESOS];
  return [];
}

export function getAccesoDeEmpleado(empresaId: string, empleadoId: string): AccesoPortal | undefined {
  const accesos = getAccesosPorEmpresa(empresaId);
  return accesos.find((a) => a.empleadoId === empleadoId);
}

export const ROLES_PORTAL = [
  "Administrador",
  "Director",
  "Dirección",
  "RRHH",
  "Logística",
  "Cocina",
  "Gerencia",
  "Contabilidad",
  "Gestoría",
  "Jurídico",
  "Marketing",
  "Empleado",
  "Solo lectura",
];
