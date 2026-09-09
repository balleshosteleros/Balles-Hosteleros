"use client";

/**
 * Submódulo Entregas, en tres vistas:
 *   • Entregas: quién tiene qué, con sus actas firmadas.
 *   • Almacén: cuánto hay, cuánto está puesto y cuánto tiene la empresa.
 *   • Recuentos: contar la estantería y ver el descuadre.
 *
 * Van juntas y sin permiso propio porque son la misma pregunta vista desde
 * distintos lados: quien puede ver lo que lleva cada trabajador puede ver lo que
 * queda en la estantería.
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EntregasView } from "./EntregasView";
import { AlmacenTab } from "./AlmacenTab";
import { RecuentosTab } from "./RecuentosTab";

export function EntregasModulo() {
  return (
    <Tabs defaultValue="entregas" className="pb-28">
      <div className="px-4 md:px-6 pt-4 md:pt-6 max-w-7xl mx-auto">
        <TabsList>
          <TabsTrigger value="entregas">Entregas</TabsTrigger>
          <TabsTrigger value="almacen">Almacén</TabsTrigger>
          <TabsTrigger value="recuentos">Recuentos</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="entregas">
        {/* EntregasView ya trae su propio contenedor con padding. */}
        <EntregasView />
      </TabsContent>

      <TabsContent value="almacen">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <AlmacenTab />
        </div>
      </TabsContent>

      <TabsContent value="recuentos">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <RecuentosTab />
        </div>
      </TabsContent>
    </Tabs>
  );
}
