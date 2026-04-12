"use client";

import { MarketingDashboardView } from "@/features/marketing/components/MarketingDashboardView";
import { AccesosDirectos } from "@/features/contabilidad/components/AccesosDirectos";

export default function MarketingPage() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <AccesosDirectos departamento="Marketing" />
      <MarketingDashboardView />
    </div>
  );
}
