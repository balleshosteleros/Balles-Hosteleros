"use client";

import { useState } from "react";
import { PlantillasListView } from "./PlantillasListView";
import { EnviosListView } from "./EnviosListView";
import { AuditoriasAnaliticaView, VolverAuditoriasButton } from "./AuditoriasAnaliticaView";

export type AuditoriasTab = "plantillas" | "envios" | "graficas";

export function CalidadAuditoriasView() {
  const [tab, setTab] = useState<AuditoriasTab>("envios");

  return (
    <div className="px-4 md:px-6 pt-2 pb-4 md:pb-6">
      {tab === "plantillas" ? (
        <PlantillasListView tab={tab} onTabChange={setTab} />
      ) : tab === "graficas" ? (
        <div className="space-y-4">
          <VolverAuditoriasButton onClick={() => setTab("envios")} />
          <AuditoriasAnaliticaView />
        </div>
      ) : (
        <EnviosListView tab={tab} onTabChange={setTab} />
      )}
    </div>
  );
}
