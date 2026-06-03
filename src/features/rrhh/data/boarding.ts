// ─── Boarding (Onboarding / Offboarding) — tipos canónicos ──────
//
// OLA2-04: el mock de plantillas/procesos se retiró. La fuente de verdad es la
// BD (tablas `plantillas_boarding` / `procesos_boarding`) consumida vía
// `boarding-actions.ts`. Este archivo conserva únicamente los tipos TS
// compartidos por la UI, el IO y las actions — NO vuelve a ser fuente de datos.

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
