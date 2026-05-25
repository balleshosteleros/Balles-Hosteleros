"use client";

import { useState } from "react";
import { PlantillasListView } from "./PlantillasListView";
import { EnviosListView } from "./EnviosListView";

export type AuditoriasTab = "plantillas" | "envios";

export function CalidadAuditoriasView() {
  const [tab, setTab] = useState<AuditoriasTab>("envios");

  return (
    <div className="px-4 md:px-6 pt-2 pb-4 md:pb-6">
      {tab === "plantillas" ? (
        <PlantillasListView tab={tab} onTabChange={setTab} />
      ) : (
        <EnviosListView tab={tab} onTabChange={setTab} />
      )}
    </div>
  );
}
