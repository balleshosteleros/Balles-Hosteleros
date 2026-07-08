"use client";

/**
 * Módulo de Fichajes con dos vistas:
 *   • Timeline (por día, estilo Sesame): barra previsto vs fichado por empleado.
 *   • Histórico: la tabla completa de fichajes (incidencias, geo, editar).
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FichajesTimelineDia } from "@/features/rrhh/components/fichajes/FichajesTimelineDia";
import { FichajesView } from "@/features/rrhh/components/fichajes/FichajesView";

export function FichajesModulo() {
  return (
    <Tabs defaultValue="timeline" className="pb-28">
      <div className="px-6 pt-6">
        <TabsList>
          <TabsTrigger value="timeline">Fichajes del día</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="timeline">
        <div className="p-6 max-w-[1600px] mx-auto">
          <FichajesTimelineDia />
        </div>
      </TabsContent>
      <TabsContent value="historico">
        {/* FichajesView ya trae su propio p-6 */}
        <FichajesView />
      </TabsContent>
    </Tabs>
  );
}
