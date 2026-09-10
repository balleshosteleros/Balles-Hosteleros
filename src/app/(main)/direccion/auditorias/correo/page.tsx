import type { Metadata } from "next";
import { CorreoAuditoriaView } from "@/features/direccion/correo-auditoria/components/CorreoAuditoriaView";

export const metadata: Metadata = {
  title: "Correo | Balles-Hosteleros",
  description:
    "Cuánto correo mueve cada buzón de la empresa y con quién: volumen por día, semana y mes, y ranking de contactos.",
};

export default function CorreoAuditoriaPage() {
  return <CorreoAuditoriaView />;
}
