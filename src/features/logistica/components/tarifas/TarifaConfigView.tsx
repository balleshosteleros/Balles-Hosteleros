"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Sliders } from "lucide-react";

interface Props {
  onBack: () => void;
}

export default function TarifaConfigView({ onBack }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}>
          ← Volver
        </Button>
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Configuración de tarifas</h2>
      </div>

      <Tabs defaultValue="reglas" className="w-full">
        <TabsList>
          <TabsTrigger value="reglas" className="gap-1.5">
            <Sliders className="h-3.5 w-3.5" /> Reglas de aplicación
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reglas" className="space-y-3 mt-4">
          <div className="border rounded-lg bg-card p-6 text-center">
            <Badge variant="secondary" className="mb-2">Próximamente</Badge>
            <p className="text-sm font-medium text-foreground">Sin reglas configuradas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aquí podrás definir cuándo se aplica cada tarifa (horarios, días, salas, tipos de cliente…).
              Las añadiremos según las vayas pidiendo.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
