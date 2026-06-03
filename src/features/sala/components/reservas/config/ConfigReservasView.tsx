"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { ConfigTabReservas } from "./ConfigTabReservas";
import { CodigosTab } from "./CodigosTab";
import { EtiquetasConfigTab } from "./EtiquetasConfigTab";
import { EstructuraTab } from "./EstructuraTab";
import { PoliticasCancelacionTab } from "./PoliticasCancelacionTab";
import { BloqueosTab } from "@/features/sala/bloqueos/components/BloqueosTab";
import { ComunicacionesPanel } from "./ComunicacionesPanel";
import { LinksReservaPanel } from "@/features/sala/components/reservas/LinksReservaPanel";

const PLACEHOLDER_TABS = [
  { value: "horarios", label: "Horarios" },
  { value: "canales", label: "Canales" },
] as const;

interface Props {
  onBack: () => void;
}

export function ConfigReservasView({ onBack }: Props) {
  // Lazy: solo el tab activo se monta. Cambia de tab → componente del anterior se desmonta.
  const [tab, setTab] = useState<string>("reservas");

  function renderTab() {
    switch (tab) {
      case "reservas":   return <ConfigTabReservas />;
      case "estructura": return <EstructuraTab />;
      case "codigos":    return <CodigosTab />;
      case "etiquetas":  return <EtiquetasConfigTab />;
      case "enlaces":    return <LinksReservaPanel embedded />;
      case "politicas":  return <PoliticasCancelacionTab />;
      case "bloqueos":   return <BloqueosTab />;
      case "comunicaciones": return <ComunicacionesPanel />;
      default: {
        const placeholder = PLACEHOLDER_TABS.find((t) => t.value === tab);
        if (placeholder) {
          return (
            <div className="border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
              <p className="font-medium mb-1">{placeholder.label}</p>
              <p>Próximamente.</p>
            </div>
          );
        }
        return null;
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-2 border-b bg-card">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-xs">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Volver a reservas
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-10 w-full">
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="estructura">Estructura</TabsTrigger>
            <TabsTrigger value="codigos">Códigos</TabsTrigger>
            <TabsTrigger value="etiquetas">Etiquetas</TabsTrigger>
            <TabsTrigger value="enlaces">Enlaces</TabsTrigger>
            <TabsTrigger value="politicas">Políticas</TabsTrigger>
            <TabsTrigger value="bloqueos">Bloqueos</TabsTrigger>
            <TabsTrigger value="comunicaciones">Comunicaciones</TabsTrigger>
            {PLACEHOLDER_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="mt-4">{renderTab()}</div>
      </div>
    </div>
  );
}
