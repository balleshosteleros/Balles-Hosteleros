"use client";

import { AccesosDirectos } from "@/features/contabilidad/components/AccesosDirectos";

export default function ContabilidadPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <AccesosDirectos departamento="Contabilidad" />
    </div>
  );
}
