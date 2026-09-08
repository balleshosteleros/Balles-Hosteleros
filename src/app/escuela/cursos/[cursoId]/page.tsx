import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cargarPortal } from "@/features/escuela/services/sesion-portal";
import { getCursoDetalle } from "@/features/escuela/services/portal-alumno";
import { AccesoAlumno } from "@/features/escuela/components/portal/AccesoAlumno";
import { PortalShell } from "@/features/escuela/components/portal/PortalShell";
import { VisorCurso } from "@/features/escuela/components/portal/VisorCurso";

export const metadata: Metadata = { title: "Curso" };

export default async function EscuelaCursoPage({
  params,
}: {
  params: Promise<{ cursoId: string }>;
}) {
  const { cursoId } = await params;
  const { marca, alumno } = await cargarPortal();
  if (!marca) return null;
  if (!alumno) return <AccesoAlumno marca={marca} />;

  const curso = await getCursoDetalle(alumno, cursoId);
  // Un curso que no es suyo no existe para él: mismo resultado que uno borrado.
  if (!curso) notFound();

  return (
    <PortalShell marca={marca} activa="cursos" nombreAlumno={alumno.nombre}>
      <VisorCurso curso={curso} />
    </PortalShell>
  );
}
