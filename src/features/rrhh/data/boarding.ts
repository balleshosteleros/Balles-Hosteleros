// ─── Boarding (Onboarding / Offboarding) ────────────────────────

export type TipoBoarding = "onboarding" | "offboarding";
export type EstadoProceso = "activo" | "finalizado" | "archivado";

export interface TareaPlantilla {
  id: string;
  nombre: string;
  orden: number;
}

export interface PlantillaBoarding {
  id: string;
  nombre: string;
  tipo: TipoBoarding;
  empresaId: string;
  tareas: TareaPlantilla[];
}

export interface TareaProceso {
  id: string;
  nombre: string;
  completada: boolean;
  fechaCompletado: string | null;
  orden: number;
}

export interface ProcesoBoarding {
  id: string;
  empleadoId: string;
  tipo: TipoBoarding;
  estado: EstadoProceso;
  plantillaId: string;
  plantillaNombre: string;
  fechaInicio: string;
  empresaId: string;
  tareas: TareaProceso[];
}

// ─── Plantillas ─────────────────────────────────────────────────

const plantillasHabana: PlantillaBoarding[] = [
  {
    id: "plt-h1", nombre: "ON-BOARDING", tipo: "onboarding", empresaId: "habana",
    tareas: [
      { id: "t1", nombre: "Subir documentos del empleado", orden: 1 },
      { id: "t2", nombre: "Comunicar alta del contrato a gestoría", orden: 2 },
      { id: "t3", nombre: "Recibir contrato de gestoría", orden: 3 },
      { id: "t4", nombre: "Contrato firmado digitalmente por el empleado", orden: 4 },
      { id: "t5", nombre: "Alta en software de gestión", orden: 5 },
      { id: "t6", nombre: "Alta en grupo de WhatsApp", orden: 6 },
      { id: "t7", nombre: "Anotar datos en portal del empleado", orden: 7 },
      { id: "t8", nombre: "Enviar contrato interno", orden: 8 },
      { id: "t9", nombre: "Contrato interno firmado", orden: 9 },
      { id: "t10", nombre: "Entrega de uniforme", orden: 10 },
      { id: "t11", nombre: "Anotar entrega de uniforme", orden: 11 },
    ],
  },
  {
    id: "plt-h2", nombre: "OFF-BOARDING", tipo: "offboarding", empresaId: "habana",
    tareas: [
      { id: "t20", nombre: "Comunicar baja a gestoría", orden: 1 },
      { id: "t21", nombre: "Recibir finiquito de gestoría", orden: 2 },
      { id: "t22", nombre: "Finiquito firmado por el empleado", orden: 3 },
      { id: "t23", nombre: "Recoger uniforme", orden: 4 },
      { id: "t24", nombre: "Recoger llaves y tarjetas", orden: 5 },
      { id: "t25", nombre: "Baja en software de gestión", orden: 6 },
      { id: "t26", nombre: "Baja en grupo de WhatsApp", orden: 7 },
      { id: "t27", nombre: "Entrevista de salida", orden: 8 },
    ],
  },
  {
    id: "plt-h3", nombre: "ON-BOARDING GERENTE / ENCARGADO", tipo: "onboarding", empresaId: "habana",
    tareas: [
      { id: "t30", nombre: "Subir documentos del empleado", orden: 1 },
      { id: "t31", nombre: "Comunicar alta del contrato a gestoría", orden: 2 },
      { id: "t32", nombre: "Contrato firmado digitalmente", orden: 3 },
      { id: "t33", nombre: "Alta en software de gestión (permisos avanzados)", orden: 4 },
      { id: "t34", nombre: "Alta en grupo de WhatsApp de dirección", orden: 5 },
      { id: "t35", nombre: "Entrega de llaves y tarjetas", orden: 6 },
      { id: "t36", nombre: "Formación en protocolos internos", orden: 7 },
      { id: "t37", nombre: "Asignación de responsabilidades", orden: 8 },
      { id: "t38", nombre: "Entrega de uniforme", orden: 9 },
    ],
  },
];

const plantillasBacanal: PlantillaBoarding[] = [
  {
    id: "plt-b1", nombre: "ON-BOARDING", tipo: "onboarding", empresaId: "bacanal",
    tareas: [
      { id: "tb1", nombre: "Subir documentos del empleado", orden: 1 },
      { id: "tb2", nombre: "Comunicar alta a gestoría", orden: 2 },
      { id: "tb3", nombre: "Contrato firmado digitalmente", orden: 3 },
      { id: "tb4", nombre: "Alta en software de gestión", orden: 4 },
      { id: "tb5", nombre: "Alta en grupo de WhatsApp", orden: 5 },
      { id: "tb6", nombre: "Entrega de uniforme", orden: 6 },
      { id: "tb7", nombre: "Formación inicial", orden: 7 },
    ],
  },
  {
    id: "plt-b2", nombre: "OFF-BOARDING", tipo: "offboarding", empresaId: "bacanal",
    tareas: [
      { id: "tb10", nombre: "Comunicar baja a gestoría", orden: 1 },
      { id: "tb11", nombre: "Finiquito firmado", orden: 2 },
      { id: "tb12", nombre: "Recoger uniforme y material", orden: 3 },
      { id: "tb13", nombre: "Baja en software", orden: 4 },
      { id: "tb14", nombre: "Entrevista de salida", orden: 5 },
    ],
  },
];

// ─── Procesos de ejemplo ────────────────────────────────────────

function tareasFromPlantilla(plt: PlantillaBoarding, completadas: number[]): TareaProceso[] {
  return plt.tareas.map((t, i) => ({
    id: `proc-${t.id}`,
    nombre: t.nombre,
    completada: completadas.includes(i),
    fechaCompletado: completadas.includes(i) ? "2026-03-15" : null,
    orden: t.orden,
  }));
}

const procesosHabana: ProcesoBoarding[] = [
  {
    id: "proc-h1", empleadoId: "h6", tipo: "onboarding", estado: "activo",
    plantillaId: "plt-h1", plantillaNombre: "ON-BOARDING",
    fechaInicio: "2026-03-10", empresaId: "habana",
    tareas: tareasFromPlantilla(plantillasHabana[0], [0, 1, 2, 3, 4]),
  },
  {
    id: "proc-h2", empleadoId: "h9", tipo: "offboarding", estado: "activo",
    plantillaId: "plt-h2", plantillaNombre: "OFF-BOARDING",
    fechaInicio: "2026-04-01", empresaId: "habana",
    tareas: tareasFromPlantilla(plantillasHabana[1], [0, 1]),
  },
  {
    id: "proc-h3", empleadoId: "h2", tipo: "onboarding", estado: "finalizado",
    plantillaId: "plt-h3", plantillaNombre: "ON-BOARDING GERENTE / ENCARGADO",
    fechaInicio: "2026-01-05", empresaId: "habana",
    tareas: tareasFromPlantilla(plantillasHabana[2], [0, 1, 2, 3, 4, 5, 6, 7, 8]),
  },
];

const procesosBacanal: ProcesoBoarding[] = [
  {
    id: "proc-b1", empleadoId: "b3", tipo: "onboarding", estado: "activo",
    plantillaId: "plt-b1", plantillaNombre: "ON-BOARDING",
    fechaInicio: "2026-03-20", empresaId: "bacanal",
    tareas: tareasFromPlantilla(plantillasBacanal[0], [0, 1, 2]),
  },
  {
    id: "proc-b2", empleadoId: "b7", tipo: "offboarding", estado: "activo",
    plantillaId: "plt-b2", plantillaNombre: "OFF-BOARDING",
    fechaInicio: "2026-04-02", empresaId: "bacanal",
    tareas: tareasFromPlantilla(plantillasBacanal[1], [0]),
  },
];

// ─── Public API ─────────────────────────────────────────────────

export function getProcesosPorEmpresa(empresaId: string): ProcesoBoarding[] {
  if (empresaId === "habana") return procesosHabana;
  if (empresaId === "bacanal") return procesosBacanal;
  return [];
}

export function getPlantillasPorEmpresa(empresaId: string): PlantillaBoarding[] {
  if (empresaId === "habana") return plantillasHabana;
  if (empresaId === "bacanal") return plantillasBacanal;
  return [];
}
