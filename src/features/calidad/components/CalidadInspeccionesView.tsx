"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LayoutPanelTop, FileText, ClipboardCheck } from "lucide-react";
import { PresentacionTab } from "@/features/calidad/inspecciones/components/PresentacionTab";
import { PlantillasListView } from "@/features/calidad/inspecciones/components/PlantillasListView";
import { RealizadasView } from "@/features/calidad/inspecciones/components/RealizadasView";

type Tab = "presentacion" | "plantillas" | "realizadas";

export function CalidadInspeccionesView() {
  const [tab, setTab] = useState<Tab>("realizadas");

  return (
    <div className="p-4 md:p-6 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={tab === "presentacion" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setTab("presentacion")}
        >
          <LayoutPanelTop className="h-4 w-4" />
          PRESENTACIÓN
        </Button>
        <Button
          variant={tab === "plantillas" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setTab("plantillas")}
        >
          <FileText className="h-4 w-4" />
          PLANTILLAS
        </Button>
        <Button
          variant={tab === "realizadas" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setTab("realizadas")}
        >
          <ClipboardCheck className="h-4 w-4" />
          INSPECCIONES REALIZADAS
        </Button>
      </div>

      {tab === "presentacion" ? (
        <PresentacionTab />
      ) : tab === "plantillas" ? (
        <PlantillasListView />
      ) : (
        <RealizadasView />
      )}
    </div>
  );
}
