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
}

export const DEPARTAMENTOS_SEED: DepartamentoSeed[] = [
  // ADMINISTRATIVA — equipo de gestión
  { nombre: "DIRECCIÓN", descripcion: "Departamento de Dirección", area: "ADMINISTRATIVA", estado: "Activo" },
  { nombre: "GERENCIA", descripcion: "Departamento de Gerencia", area: "ADMINISTRATIVA", estado: "Activo" },
  { nombre: "RECURSOS HUMANOS", descripcion: "Departamento de Recursos Humanos", area: "ADMINISTRATIVA", estado: "Activo" },
  { nombre: "CALIDAD", descripcion: "Departamento de Calidad", area: "ADMINISTRATIVA", estado: "Activo" },
  { nombre: "CONTABILIDAD", descripcion: "Departamento de Contabilidad", area: "ADMINISTRATIVA", estado: "Activo" },
  { nombre: "LOGÍSTICA", descripcion: "Departamento de Logística", area: "ADMINISTRATIVA", estado: "Activo" },
  { nombre: "MARKETING", descripcion: "Departamento de Marketing", area: "ADMINISTRATIVA", estado: "Activo" },
  { nombre: "GESTORÍA", descripcion: "Departamento de Gestoría", area: "ADMINISTRATIVA", estado: "Activo" },
  { nombre: "JURÍDICO", descripcion: "Departamento de Jurídico", area: "ADMINISTRATIVA", estado: "Activo" },

  // OPERATIVA — equipo de servicio en local
  { nombre: "SALA", descripcion: "Departamento de Sala", area: "OPERATIVA", estado: "Activo" },
  { nombre: "COCINA", descripcion: "Departamento de Cocina", area: "OPERATIVA", estado: "Activo" },
  { nombre: "ARTISTAS", descripcion: "Artistas y DJs en directo", area: "OPERATIVA", estado: "Activo" },
  { nombre: "MANTENIMIENTO", descripcion: "Mantenimiento general de instalaciones y equipamiento", area: "OPERATIVA", estado: "Activo" },
];

export function normalizeDeptoNombre(nombre: string): string {
  return nombre.trim().toUpperCase();
}
