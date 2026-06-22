export type AreaCronograma = "OPERATIVA" | "ADMINISTRATIVA";

export interface CronogramaRol {
  rol: string;
  area: AreaCronograma;
}

// Listado canónico de cronogramas. Cualquier rol que exista en la BD pero no
// figure aquí cae por defecto a ADMINISTRATIVA.
export const CRONOGRAMA_ROLES: CronogramaRol[] = [
  // OPERATIVA — equipo de servicio en local
  { rol: "JEFE DE SALA", area: "OPERATIVA" },
  { rol: "JEFE DE COCINA", area: "OPERATIVA" },
  { rol: "CAMARERO", area: "OPERATIVA" },
  { rol: "COCINERO", area: "OPERATIVA" },
  { rol: "OFFICE", area: "OPERATIVA" },
  { rol: "LIMPIEZA", area: "OPERATIVA" },
  { rol: "ARTISTA", area: "OPERATIVA" },

  // ADMINISTRATIVA — equipo de gestión
  { rol: "DIRECCION", area: "ADMINISTRATIVA" },
  { rol: "GERENTE", area: "ADMINISTRATIVA" },
  { rol: "RECURSOS HUMANOS", area: "ADMINISTRATIVA" },
  { rol: "CALIDAD", area: "ADMINISTRATIVA" },
  { rol: "CONTABILIDAD", area: "ADMINISTRATIVA" },
  { rol: "LOGISTICA", area: "ADMINISTRATIVA" },
  { rol: "MARKETING", area: "ADMINISTRATIVA" },
  { rol: "GESTORIA", area: "ADMINISTRATIVA" },
  { rol: "JURIDICO", area: "ADMINISTRATIVA" },
];

function normalize(rol: string): string {
  return rol
    .toUpperCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function getAreaForRol(rol: string): AreaCronograma {
  const key = normalize(rol);
  const match = CRONOGRAMA_ROLES.find((r) => normalize(r.rol) === key);
  return match?.area ?? "ADMINISTRATIVA";
}

export const AREA_LABEL: Record<AreaCronograma, string> = {
  OPERATIVA: "Operativa",
  ADMINISTRATIVA: "Administrativa",
};

export const AREA_BADGE_CLASS: Record<AreaCronograma, string> = {
  OPERATIVA: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ADMINISTRATIVA: "bg-sky-100 text-sky-700 border-sky-200",
};

// Cronograma (texto suelto en cronogramas_operativos.rol) → Módulo/departamento.
// Esta tabla normaliza la inconsistencia actual de la BD donde el campo `rol`
// mezcla nombres de departamentos (DIRECCION, CALIDAD…) y nombres de puestos
// (GERENTE, JEFE DE COCINA…). Los módulos siguen el catálogo de
// src/features/ajustes/data/ajustes.ts → MODULOS.
export const CRONOGRAMA_TO_MODULO: Record<string, string> = {
  // ADMINISTRATIVA
  "DIRECCION": "Dirección",
  "GERENTE": "Gerencia",
  "RECURSOS HUMANOS": "RRHH",
  "CALIDAD": "Calidad",
  "CONTABILIDAD": "Contabilidad",
  "LOGISTICA": "Logística",
  "MARKETING": "Marketing",
  "GESTORIA": "Gestoría",
  "JURIDICO": "Jurídico",
  // OPERATIVA
  "JEFE DE SALA": "Sala",
  "JEFE DE COCINA": "Cocina",
  "CAMARERO": "Sala",
  "COCINERO": "Cocina",
  "OFFICE": "Cocina",
  "LIMPIEZA": "Cocina",
  "ARTISTA": "Sala",
};

export function getModuloForCronograma(cronograma: string): string {
  const key = normalize(cronograma);
  const entry = Object.entries(CRONOGRAMA_TO_MODULO).find(
    ([k]) => normalize(k) === key,
  );
  return entry?.[1] ?? cronograma.trim();
}
