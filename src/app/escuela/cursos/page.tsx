import type { Metadata } from "next";
import { cargarPortal } from "@/features/escuela/services/sesion-portal";
import { getCursosAlumno } from "@/features/escuela/services/portal-alumno";
import { AccesoAlumno } from "@/features/escuela/components/portal/AccesoAlumno";
import { PortalShell } from "@/features/escuela/components/portal/PortalShell";
import { CursosAlumno } from "@/features/escuela/components/portal/CursosAlumno";

export const metadata: Metadata = { title: "Cursos" };

export default async function EscuelaCursosPage() {
  const { marca, alumno } = await cargarPortal();
  if (!marca) return null;
  if (!alumno) return <AccesoAlumno />;

  const cursos = await getCursosAlumno(alumno);

  return (
    <PortalShell marca={marca} activa="cursos" nombreAlumno={alumno.nombre}>
      <h1 className="mb-4 text-xl font-semibold">Cursos</h1>
      <CursosAlumno cursos={cursos} />
    </PortalShell>
  );
}
