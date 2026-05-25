"use client";

import { Bot, MessageSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTabQuery } from "@/shared/hooks/use-tab-query";
import { ResenasPipeline } from "./ResenasPipeline";
import { AgentesIAView } from "./AgentesIAView";

const VISTAS = ["resenas", "agentes"] as const;

export function CalidadClientesView() {
  const [vista, setVista] = useTabQuery(VISTAS, "resenas");

  return (
    <div className="p-6 space-y-4">
      <Tabs value={vista} onValueChange={(v) => setVista(v as (typeof VISTAS)[number])}>
        <TabsList>
          <TabsTrigger value="resenas" className="gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Reseñas
          </TabsTrigger>
          <TabsTrigger value="agentes" className="gap-2">
            <Bot className="h-3.5 w-3.5" />
            Agentes IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resenas" className="mt-4">
          <ResenasPipeline />
        </TabsContent>

        <TabsContent value="agentes" className="mt-4">
          <AgentesIAView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
