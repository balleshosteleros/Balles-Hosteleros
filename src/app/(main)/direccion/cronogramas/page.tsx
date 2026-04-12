import { CronogramasView } from "@/features/direccion/components/cronogramas/CronogramasView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cronogramas | Balles-Hosteleros",
  description: "Gestión interactiva de cronogramas para los empleados de cada departamento.",
};

export default function CronogramasPage() {
  return <CronogramasView />;
}
