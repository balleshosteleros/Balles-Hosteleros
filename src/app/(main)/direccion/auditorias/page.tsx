import { AuditoriasView } from "@/features/direccion/components/auditorias/AuditoriasView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Auditorías | Balles-Hosteleros",
  description:
    "Auditoría mensual por departamento: incidencias, notificaciones, problemáticas y mejoras para la reunión.",
};

export default function AuditoriasPage() {
  return <AuditoriasView />;
}
