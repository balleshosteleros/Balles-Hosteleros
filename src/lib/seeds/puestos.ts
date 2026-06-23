/**
 * Seed canónico de PUESTOS del software (hijos de cada departamento).
 *
 * Fuente de verdad: se replica a TODAS las empresas existentes vía
 * `syncSeedsToAllEmpresas()` (aditivo) y se aplica a las empresas nuevas vía
 * `seedEmpresaDefaults()`. Cada puesto se enlaza a su departamento por NOMBRE.
 *
 * PUESTO ≠ ROL: el puesto es el nombre del trabajo (con salario), hijo del
 * departamento; el rol es el perfil de accesos al software.
 *
 * NO añadir aquí puestos específicos de un cliente — esos los crea el cliente
 * desde RRHH → Salarios / Ajustes y NO se replican a otras empresas.
 */

export interface PuestoSeed {
  /** Nombre del departamento al que pertenece (debe existir en DEPARTAMENTOS_SEED). */
  departamento: string;
  nombre: string;
}

export const PUESTOS_SEED: PuestoSeed[] = [
  // ── ADMINISTRATIVA ──────────────────────────────────────────
  { departamento: "DIRECCIÓN", nombre: "DIRECTOR" },
  { departamento: "GERENCIA", nombre: "GERENTE" },
  { departamento: "RECURSOS HUMANOS", nombre: "RECURSOS HUMANOS" },
  { departamento: "CALIDAD", nombre: "CALIDAD" },
  { departamento: "CONTABILIDAD", nombre: "CONTABLE" },
  { departamento: "LOGÍSTICA", nombre: "LOGISTICA" },
  { departamento: "MARKETING", nombre: "COMMUNITY" },
  { departamento: "MARKETING", nombre: "FILMMAKER" },
  { departamento: "MARKETING", nombre: "TRAFFIQER" },
  { departamento: "GESTORÍA", nombre: "GESTOR" },
  { departamento: "JURÍDICO", nombre: "ABOGADO" },

  // ── OPERATIVA ───────────────────────────────────────────────
  { departamento: "SALA", nombre: "JEFE DE SALA" },
  { departamento: "SALA", nombre: "CAMAREROS" },
  { departamento: "SALA", nombre: "CACHIMBEROS" },
  { departamento: "SALA", nombre: "HOSTESS" },
  { departamento: "SALA", nombre: "LIMPIEZA" },
  { departamento: "COCINA", nombre: "JEFE DE COCINA" },
  { departamento: "COCINA", nombre: "COCINEROS" },
  { departamento: "COCINA", nombre: "OFFICE" },
  { departamento: "ARTISTAS", nombre: "DJ" },
  { departamento: "MANTENIMIENTO", nombre: "TECNICO" },
];

export function normalizePuestoNombre(nombre: string): string {
  return nombre.trim().toUpperCase();
}
