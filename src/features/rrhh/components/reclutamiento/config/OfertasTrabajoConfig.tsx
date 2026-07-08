import { Card, CardContent } from "@/components/ui/card";
import { JornadasVacantesPanel } from "@/features/ajustes/components/JornadasVacantesPanel";

export function OfertasTrabajoConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Vacantes</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configura los tipos de jornada de las vacantes
        </p>
      </div>

      {/* Tipos de jornada — CRUD real conectado a la tabla `jornadas` (por empresa).
          Es la misma fuente que usa el desplegable de "Jornada" en cada vacante y el
          buscador del portal de empleo, así lo que se ve aquí es exactamente lo que existe. */}
      <Card>
        <CardContent className="p-5">
          <JornadasVacantesPanel />
        </CardContent>
      </Card>
    </div>
  );
}
