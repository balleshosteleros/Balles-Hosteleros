import { Suspense } from "react";
import { CronogramasView } from "@/features/direccion/components/cronogramas/CronogramasView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cronogramas | Balles-Hosteleros",
  description: "Gestión interactiva de cronogramas para los empleados de cada departamento.",
};

export default function CronogramasPage() {
  // Suspense: CronogramasView usa useSearchParams (?rol= para abrir directo
  // el cronograma de un puesto desde RRHH).
  return (
    <Suspense fallback={null}>
      <CronogramasView />
    </Suspense>
  );
}
