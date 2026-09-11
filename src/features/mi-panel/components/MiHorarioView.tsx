import { HorarioSemanaPanel } from "./HorarioSemanaPanel";

/**
 * «Mi panel → Horario»: la misma semana real que ve en el móvil (turnos,
 * patrones y planificación), no una rejilla de muestra.
 */
export function MiHorarioView() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <HorarioSemanaPanel />
    </div>
  );
}
