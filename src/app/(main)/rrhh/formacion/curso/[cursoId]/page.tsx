import { CursoVista } from "@/features/formacion/components/CursoVista";

// Vista de curso para el ADMIN (RRHH). Misma vista classroom que el empleado,
// pero accesible desde el grid de gestión. El modo edición se activa dentro.
export default async function CursoAdminPage({
  params,
}: {
  params: Promise<{ cursoId: string }>;
}) {
  const { cursoId } = await params;
  return <CursoVista cursoId={cursoId} admin />;
}
