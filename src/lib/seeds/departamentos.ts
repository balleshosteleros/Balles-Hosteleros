/**
 * Seed canónico de DEPARTAMENTOS del software.
 *
 * Esta lista es la fuente de verdad. Cualquier cambio se propaga a TODAS las
 * empresas existentes vía `syncSeedsToAllEmpresas()` (modo aditivo) y se aplica
 * a las empresas nuevas vía `seedEmpresaDefaults()`.
 *
 * NO añadir aquí departamentos específicos de un cliente — esos los crea el
 * cliente desde Ajustes → Departamentos y NO se replican a otras empresas.
 */

export type AreaDepartamento = "OPERATIVA" | "ADMINISTRATIVA";

export interface DepartamentoSeed {
  nombre: string;
  descripcion: string;
  area: AreaDepartamento;
  estado: "Activo";
  /** Color hex del departamento: tinte único de sus turnos en el cuadrante. */
  color: string;
}

export const DEPARTAMENTOS_SEED: DepartamentoSeed[] = [
  // ADMINISTRATIVA — equipo de gestión
  { nombre: "DIRECCIÓN", descripcion: "Departamento de Dirección", area: "ADMINISTRATIVA", estado: "Activo", color: "#4f46e5" },
  { nombre: "GERENCIA", descripcion: "Departamento de Gerencia", area: "ADMINISTRATIVA", estado: "Activo", color: "#7c3aed" },
  { nombre: "RECURSOS HUMANOS", descripcion: "Departamento de Recursos Humanos", area: "ADMINISTRATIVA", estado: "Activo", color: "#e11d48" },
  { nombre: "CALIDAD", descripcion: "Departamento de Calidad", area: "ADMINISTRATIVA", estado: "Activo", color: "#0d9488" },
  { nombre: "CONTABILIDAD", descripcion: "Departamento de Contabilidad", area: "ADMINISTRATIVA", estado: "Activo", color: "#64748b" },
  { nombre: "LOGÍSTICA", descripcion: "Departamento de Logística", area: "ADMINISTRATIVA", estado: "Activo", color: "#ea580c" },
  { nombre: "MARKETING", descripcion: "Departamento de Marketing", area: "ADMINISTRATIVA", estado: "Activo", color: "#db2777" },
  { nombre: "GESTORÍA", descripcion: "Departamento de Gestoría", area: "ADMINISTRATIVA", estado: "Activo", color: "#0284c7" },
  { nombre: "JURÍDICO", descripcion: "Departamento de Jurídico", area: "ADMINISTRATIVA", estado: "Activo", color: "#57534e" },

  // OPERATIVA — equipo de servicio en local
  { nombre: "SALA", descripcion: "Departamento de Sala", area: "OPERATIVA", estado: "Activo", color: "#10b981" },
  { nombre: "COCINA", descripcion: "Departamento de Cocina", area: "OPERATIVA", estado: "Activo", color: "#f59e0b" },
  { nombre: "ARTISTAS", descripcion: "Artistas y DJs en directo", area: "OPERATIVA", estado: "Activo", color: "#a855f7" },
  { nombre: "MANTENIMIENTO", descripcion: "Mantenimiento general de instalaciones y equipamiento", area: "OPERATIVA", estado: "Activo", color: "#84cc16" },
];

/** Color por defecto para un departamento ajeno al catálogo canónico. */
export const DEPARTAMENTO_COLOR_FALLBACK = "#6b7280";

export function normalizeDeptoNombre(nombre: string): string {
  return nombre.trim().toUpperCase();
}
