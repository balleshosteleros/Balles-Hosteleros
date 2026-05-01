"use client";

import { FileArchive, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SubpageHeader } from "./SubpageHeader";

export function MisDocumentosView() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <SubpageHeader
        title="Documentos"
        subtitle="Tus contratos, nóminas y documentación laboral"
        icon={FileArchive}
      />

      <Card className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
        <Inbox className="h-8 w-8 mb-2" />
        <p className="text-sm font-medium">Sin documentos disponibles</p>
        <p className="text-xs mt-1">
          Cuando RRHH publique tu contrato, nóminas o cualquier documento personal,
          aparecerán aquí para descarga.
        </p>
      </Card>
    </div>
  );
}
