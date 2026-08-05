"use client";

import { useState } from "react";
import { CampanasListView } from "./CampanasListView";
import { PlantillasCuestionarioView } from "./PlantillasCuestionarioView";

type Vista = "campanas" | "plantillas";

export function CuestionariosShell() {
  const [vista, setVista] = useState<Vista>("campanas");

  return (
    <div className="px-4 md:px-6 pt-2 pb-4 md:pb-6">
      {vista === "plantillas" ? (
        <PlantillasCuestionarioView onVolver={() => setVista("campanas")} />
      ) : (
        <CampanasListView onAbrirPlantillas={() => setVista("plantillas")} />
      )}
    </div>
  );
}
