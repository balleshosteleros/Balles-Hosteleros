"use client";

import { useState } from "react";
import { CampanasListView } from "./CampanasListView";
import { PlantillasCuestionarioView } from "./PlantillasCuestionarioView";

type Vista = "campanas" | "plantillas";

export function CuestionariosShell() {
  const [vista, setVista] = useState<Vista>("campanas");

  if (vista === "plantillas") {
    return <PlantillasCuestionarioView onVolver={() => setVista("campanas")} />;
  }
  return <CampanasListView onAbrirPlantillas={() => setVista("plantillas")} />;
}
