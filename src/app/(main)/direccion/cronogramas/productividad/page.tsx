import { Metadata } from "next";
import { DashboardProductividad } from "@/features/direccion/components/cronogramas/DashboardProductividad";

export const metadata: Metadata = {
  title: "Productividad | Cronogramas | Balles-Hosteleros",
  description: "Dashboard de productividad por departamento y empleado.",
};

export default function ProductividadPage() {
  return <DashboardProductividad />;
}
