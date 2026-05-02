import { CursoVista } from "@/features/formacion/components/CursoVista";

export default async function CursoPage({
  params,
}: {
  params: Promise<{ cursoId: string }>;
}) {
  const { cursoId } = await params;
  return <CursoVista cursoId={cursoId} />;
}
