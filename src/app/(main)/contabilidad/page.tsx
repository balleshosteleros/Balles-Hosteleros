"use client";

import { Calculator } from "lucide-react";
import { AccesosDirectos } from "@/features/contabilidad/components/AccesosDirectos";

export default function ContabilidadPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">CONTABILIDAD</h1>
          <p className="text-sm text-muted-foreground">Control contable, facturas y balances</p>
        </div>
      </div>
      <AccesosDirectos departamento="Contabilidad" />
    </div>
  );
}
