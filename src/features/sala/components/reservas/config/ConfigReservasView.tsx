"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { ConfigTabReservas } from "./ConfigTabReservas";
import { CodigosTab } from "./CodigosTab";
import { EtiquetasConfigTab } from "./EtiquetasConfigTab";
import { EstructuraTab } from "./EstructuraTab";
import { PoliticasCancelacionTab } from "./PoliticasCancelacionTab";
import { LinksReservaPanel } from "@/features/sala/components/reservas/LinksReservaPanel";

const PLACEHOLDER_TABS = [
  { value: "horarios", label: "Horarios" },
  { value: "canales", label: "Canales" },
  { value: "comunicaciones", label: "Comunicaciones" },
] as const;

interface Props {
  onBack: () => void;
}

export function ConfigReservasView({ onBack }: Props) {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-2 border-b bg-card">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-xs">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Volver a reservas
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="reservas">
          <TabsList className="grid grid-cols-9 w-full">
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="estructura">Estructura</TabsTrigger>
            <TabsTrigger value="codigos">Códigos</TabsTrigger>
            <TabsTrigger value="etiquetas">Etiquetas</TabsTrigger>
            <TabsTrigger value="enlaces">Enlaces</TabsTrigger>
            <TabsTrigger value="politicas">Políticas</TabsTrigger>
            {PLACEHOLDER_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="reservas" className="mt-4">
            <ConfigTabReservas />
          </TabsContent>

          <TabsContent value="estructura" className="mt-4">
            <EstructuraTab />
          </TabsContent>

          <TabsContent value="codigos" className="mt-4">
            <CodigosTab />
          </TabsContent>

          <TabsContent value="etiquetas" className="mt-4">
            <EtiquetasConfigTab />
          </TabsContent>

          <TabsContent value="enlaces" className="mt-4">
            <LinksReservaPanel embedded />
          </TabsContent>

          <TabsContent value="politicas" className="mt-4">
            <PoliticasCancelacionTab />
          </TabsContent>

          {PLACEHOLDER_TABS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              <div className="border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
                <p className="font-medium mb-1">{t.label}</p>
                <p>Próximamente.</p>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
