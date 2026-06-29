// Clasificación de puestos por ÁREA para el grid de Formación, basada en el
// DEPARTAMENTO del puesto (no en el nombre del puesto). Espejo de la lógica de
// Cronogramas pero por departamento, que es el dato fiable en BD.

export type AreaFormacion = "OPERATIVA" | "ADMINISTRATIVA";

function normalize(s: string): string {
  return s
    .toUpperCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Departamentos operativos (equipo de servicio en local). El resto → administrativa.
const DEPTOS_OPERATIVOS = new Set(
  ["SALA", "COCINA", "ARTISTAS", "MANTENIMIENTO"].map(normalize),
);

export function getAreaForDepartamento(departamento?: string): AreaFormacion {
  if (!departamento) return "ADMINISTRATIVA";
  return DEPTOS_OPERATIVOS.has(normalize(departamento)) ? "OPERATIVA" : "ADMINISTRATIVA";
}

export const AREA_FORM_LABEL: Record<AreaFormacion, string> = {
  OPERATIVA: "Operativa",
  ADMINISTRATIVA: "Administrativa",
};

export const AREA_FORM_BADGE: Record<AreaFormacion, string> = {
  OPERATIVA: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ADMINISTRATIVA: "bg-sky-100 text-sky-700 border-sky-200",
};

// Gradiente de portada por defecto, por departamento (cuando no hay imagen).
export const DEPTO_GRADIENTE: Record<string, string> = {
  SALA: "from-emerald-500 to-teal-600",
  COCINA: "from-orange-500 to-red-600",
  ARTISTAS: "from-fuchsia-500 to-purple-600",
  MANTENIMIENTO: "from-slate-500 to-slate-700",
  DIRECCION: "from-indigo-500 to-blue-700",
  "DIRECCIÓN": "from-indigo-500 to-blue-700",
  GERENCIA: "from-rose-500 to-pink-600",
  "RECURSOS HUMANOS": "from-pink-500 to-rose-600",
  CALIDAD: "from-blue-500 to-cyan-600",
  CONTABILIDAD: "from-teal-500 to-emerald-600",
  "LOGÍSTICA": "from-amber-500 to-orange-600",
  LOGISTICA: "from-amber-500 to-orange-600",
  MARKETING: "from-purple-500 to-violet-600",
  "GESTORÍA": "from-sky-500 to-blue-600",
  GESTORIA: "from-sky-500 to-blue-600",
  "JURÍDICO": "from-fuchsia-600 to-purple-700",
  JURIDICO: "from-fuchsia-600 to-purple-700",
};

export function getGradienteDepto(departamento?: string): string {
  if (!departamento) return "from-slate-500 to-slate-700";
  return DEPTO_GRADIENTE[normalize(departamento)] ?? DEPTO_GRADIENTE[departamento] ?? "from-slate-500 to-slate-700";
}
