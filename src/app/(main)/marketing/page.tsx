"use client";

import { Megaphone } from "lucide-react";
import { MarketingDashboardView } from "@/features/marketing/components/MarketingDashboardView";
import { AccesosDirectos } from "@/features/contabilidad/components/AccesosDirectos";

export default function MarketingPage() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Megaphone className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">MARKETING</h1>
          <p className="text-sm text-muted-foreground">Analíticas, planificación de contenidos y campañas</p>
        </div>
      </div>
      <AccesosDirectos departamento="Marketing" />
      <MarketingDashboardView />
    </div>
  );
}
