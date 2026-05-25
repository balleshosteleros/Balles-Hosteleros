/**
 * Seed canónico de ROLES del software.
 *
 * Cada rol referencia a un `departamento` por nombre (debe existir en
 * DEPARTAMENTOS_SEED). El sync los crea con `departamento_id` resuelto por
 * nombre dentro de cada empresa.
 */

export interface PermisoModulo {
  modulo: string;
  ver: boolean;
  editar: boolean;
}

export interface RolSeed {
  nombre: string;
  descripcion: string;
  /** Nombre del departamento canónico (de DEPARTAMENTOS_SEED) o null si transversal. */
  departamento: string | null;
  permisos: PermisoModulo[];
  protected: boolean;
}

export const ROLES_SEED: RolSeed[] = [
  {
    nombre: "DIRECCIÓN",
    descripcion: "Dirección general — acceso completo",
    departamento: null,
    protected: false,
    permisos: [
      { modulo: "DIRECCIÓN", ver: true, editar: true },
      { modulo: "SALA", ver: true, editar: true },
      { modulo: "COCINA", ver: true, editar: true },
      { modulo: "GERENCIA", ver: true, editar: true },
      { modulo: "CALIDAD", ver: true, editar: true },
      { modulo: "RECURSOS HUMANOS", ver: true, editar: true },
      { modulo: "MARKETING", ver: true, editar: true },
      { modulo: "LOGÍSTICA", ver: true, editar: true },
      { modulo: "CONTABILIDAD", ver: true, editar: true },
      { modulo: "GESTORÍA", ver: true, editar: true },
      { modulo: "JURÍDICO", ver: true, editar: true },
      { modulo: "AJUSTES", ver: true, editar: true },
    ],
  },
  { nombre: "GERENCIA", descripcion: "Supervisión general y cuadros de mando", departamento: null, protected: false, permisos: [{ modulo: "GERENCIA", ver: true, editar: true }] },
  { nombre: "RECURSOS HUMANOS", descripcion: "Gestión de personal y nóminas", departamento: null, protected: false, permisos: [{ modulo: "RECURSOS HUMANOS", ver: true, editar: true }] },
  { nombre: "CALIDAD", descripcion: "Control de calidad y APPCC", departamento: null, protected: false, permisos: [{ modulo: "CALIDAD", ver: true, editar: true }] },
  { nombre: "CONTABILIDAD", descripcion: "Facturas, operaciones y tesorería", departamento: null, protected: false, permisos: [{ modulo: "CONTABILIDAD", ver: true, editar: true }] },
  { nombre: "LOGÍSTICA", descripcion: "Proveedores, productos e inventario", departamento: null, protected: false, permisos: [{ modulo: "LOGÍSTICA", ver: true, editar: true }] },
  { nombre: "MARKETING", descripcion: "Comunicación, campañas y reservas", departamento: null, protected: false, permisos: [{ modulo: "MARKETING", ver: true, editar: true }] },
  { nombre: "GESTORÍA", descripcion: "Gestión documental y fiscal", departamento: null, protected: false, permisos: [{ modulo: "GESTORÍA", ver: true, editar: true }] },
  { nombre: "JURÍDICO", descripcion: "Procesos legales y normativa", departamento: null, protected: false, permisos: [{ modulo: "JURÍDICO", ver: true, editar: true }] },
  { nombre: "COCINA", descripcion: "Escandallos y producción", departamento: null, protected: false, permisos: [{ modulo: "COCINA", ver: true, editar: true }] },
  { nombre: "SALA", descripcion: "Servicio y atención en sala", departamento: null, protected: false, permisos: [{ modulo: "SALA", ver: true, editar: true }] },
  { nombre: "ARTISTAS", descripcion: "Rol de artistas sin acceso a departamentos.", departamento: "ARTISTAS", protected: false, permisos: [] },
  { nombre: "MANTENIMIENTO", descripcion: "Rol de mantenimiento sin acceso a departamentos.", departamento: "MANTENIMIENTO", protected: false, permisos: [] },
];

export function normalizeRolNombre(nombre: string): string {
  return nombre.trim().toUpperCase();
}
