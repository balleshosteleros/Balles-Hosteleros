// PRP-067 — Catálogo canónico de pasos del onboarding (bootstrap).
// Orden por dependencias del modelo. Obligatorios (1–3) NO son omitibles; el
// resto son opcionales. El estado "completado" se deriva de conteos reales
// (ver onboarding-actions.ts). La estructura base (departamentos/roles/
// organigrama) ya viene sembrada por seedEmpresaDefaults → no es un paso aquí.

import type { OnboardingStep } from "@/features/onboarding/types/onboarding";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: "locales",
    titulo: "Locales",
    descripcion: "Los puntos de fichaje del negocio. Necesarios para asignar empleados.",
    obligatorio: true,
    dependencias: [],
    icono: "MapPin",
    rutaGestion: "/ajustes",
    entidad: "locales",
  },
  {
    key: "puestos",
    titulo: "Puestos y salarios",
    descripcion: "Las plantillas de puesto con sus niveles y condiciones. De aquí copia cada empleado.",
    obligatorio: true,
    dependencias: [],
    icono: "Briefcase",
    rutaGestion: "/rrhh/salarios",
    entidad: "puestos",
  },
  {
    key: "empleados",
    titulo: "Empleados",
    descripcion: "Vuelca de golpe la plantilla que ya trabaja en el negocio. Las nuevas contrataciones entrarán por el portal de empleo.",
    obligatorio: true,
    dependencias: ["locales", "puestos"],
    icono: "Users",
    rutaGestion: "/rrhh/empleados",
    entidad: "empleados",
    volcadoMasivo: true,
  },
  {
    key: "proveedores",
    titulo: "Proveedores",
    descripcion: "Tus proveedores de compra. Necesarios para dar de alta productos.",
    obligatorio: false,
    dependencias: [],
    icono: "Truck",
    rutaGestion: "/logistica/proveedores",
    entidad: "proveedores",
  },
  {
    key: "productos",
    titulo: "Productos",
    descripcion: "El catálogo de compra y venta del negocio.",
    obligatorio: false,
    dependencias: ["proveedores"],
    icono: "Package",
    rutaGestion: "/logistica/productos",
    entidad: "productos",
  },
  {
    key: "imagen_marca",
    titulo: "Imagen de marca",
    descripcion: "Logo y colores de la empresa para emails, carta y portal.",
    obligatorio: false,
    dependencias: [],
    icono: "Image",
    rutaGestion: "/ajustes",
    entidad: "imagen_marca",
  },
  {
    key: "carta",
    titulo: "Carta digital",
    descripcion: "La carta pública con los productos de venta.",
    obligatorio: false,
    dependencias: ["productos"],
    icono: "BookOpen",
    rutaGestion: "/marketing/carta-digital",
    entidad: "carta",
  },
  {
    key: "calendarios",
    titulo: "Calendarios de vacaciones",
    descripcion: "Periodos y días festivos para la gestión de vacaciones.",
    obligatorio: false,
    dependencias: [],
    icono: "CalendarDays",
    rutaGestion: "/rrhh/calendarios",
    entidad: "calendarios",
  },
];

/** Pasos obligatorios (deben quedar completados para cerrar el onboarding). */
export const ONBOARDING_STEPS_OBLIGATORIOS = ONBOARDING_STEPS.filter((s) => s.obligatorio);

export function getStep(key: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((s) => s.key === key);
}
