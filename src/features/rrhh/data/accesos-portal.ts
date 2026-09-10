// Portal access records linking employees to user accounts

// Activo o Inactivo (decisión de Ivan, 2026-08-06): o tienes acceso o no lo
// tienes. "Pendiente" se eliminó — no lo escribía nadie y solo añadía un tercer
// caso ambiguo que había que interpretar en cada pantalla.
//
// OFFBOARDING no rompe esa regla: no es una tercera opción que nadie elija a mano.
// Lo pone el sistema solo, al llegar el último día de trabajo, y lo quita solo al
// cerrar la salida en «Ex-empleados». Es el trabajador que ya se ha ido pero
// todavía tiene que firmar la devolución del material y su finiquito: entra
// únicamente a sus documentos, y nada más del sistema existe para él.
export type EstadoAcceso = "Activo" | "Inactivo" | "Offboarding";

export interface AccesoPortal {
  id: string;
  empleadoId: string;
  userId?: string | null;       // auth.users.id — necesario para gestionar accesos a empresas
  nombreEmpleado: string;
  nombre?: string;
  apellidos?: string;
  esEmpleado?: boolean;
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

// Mapa rol → módulo propio (solo ese módulo + Dashboard).
// El nombre del rol coincide con el del departamento (multi-tenant).
const ROL_MODULO: Record<string, string> = {
  "DIRECCIÓN": "Dirección",
  "RECURSOS HUMANOS": "RRHH",
  "LOGÍSTICA": "Logística",
  "COCINA": "Cocina",
  "SALA": "Sala",
  "GERENCIA": "Gerencia",
  "CONTABILIDAD": "Contabilidad",
  "GESTORÍA": "Gestoría",
  "JURÍDICO": "Jurídico",
  "MARKETING": "Marketing",
  "CALIDAD": "Calidad",
};

export function permisosDesdeRol(rol: string): PermisoPortal[] {
  // Acceso total: rol de DIRECCIÓN (canónico) + alias legacy
  const rolUpper = rol.trim().toUpperCase();
  if (rolUpper === "DIRECCIÓN" || rolUpper === "DIRECCION" || rol === "Administrador" || rolUpper === "DIRECTOR") {
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
  // Roles departamentales: lookup tolerante a mayúsculas
  const moduloPropio =
    ROL_MODULO[rol] ??
    ROL_MODULO[rol.toUpperCase()] ??
    Object.entries(ROL_MODULO).find(([k]) => k.toUpperCase() === rol.toUpperCase())?.[1];
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
    // Nace sin acceso: hasta que alguien lo active a mano, NO entra.
    estadoAcceso: "Inactivo",
    ultimaConexion: "—",
    fechaCreacion: new Date().toISOString().slice(0, 10),
    permisos: permisosDesdeRol(rol),
  };
}
