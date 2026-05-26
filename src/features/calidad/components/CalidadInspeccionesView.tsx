"use client";

import { useState } from "react";
import { PlantillasListView } from "@/features/calidad/inspecciones/components/PlantillasListView";
import { RealizadasView } from "@/features/calidad/inspecciones/components/RealizadasView";

export type InspeccionesTab = "plantillas" | "realizadas";

export function CalidadInspeccionesView() {
  const [tab, setTab] = useState<InspeccionesTab>("realizadas");

  return (
    <div className="px-4 md:px-6 pt-2 pb-4 md:pb-6">
      {tab === "plantillas" ? (
        <PlantillasListView tab={tab} onTabChange={setTab} />
      ) : (
        <RealizadasView tab={tab} onTabChange={setTab} />
      )}
    </div>
  );
}
