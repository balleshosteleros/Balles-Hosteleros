"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ClipboardCheck } from "lucide-react";
import { PlantillasListView } from "./PlantillasListView";
import { EnviosListView } from "./EnviosListView";

type Tab = "plantillas" | "envios";

export function CalidadAuditoriasView() {
  const [tab, setTab] = useState<Tab>("plantillas");

  return (
    <div className="p-4 md:p-6 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={tab === "plantillas" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setTab("plantillas")}
        >
          <FileText className="h-4 w-4" />
          PLANTILLAS
        </Button>
        <Button
          variant={tab === "envios" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setTab("envios")}
        >
          <ClipboardCheck className="h-4 w-4" />
          AUDITORÍAS REALIZADAS
        </Button>
      </div>

      {tab === "plantillas" ? <PlantillasListView /> : <EnviosListView />}
    </div>
  );
}
