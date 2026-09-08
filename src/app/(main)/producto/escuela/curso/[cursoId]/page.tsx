import { CursoVista } from "@/features/formacion/components/CursoVista";

/**
 * Editor de un curso de LA ESCUELA. Es la misma vista que ve el alumno, con el
 * índice editable: así lo que se monta aquí es exactamente lo que se verá allí.
 */
export default async function CursoEscuelaPage({
  params,
}: {
  params: Promise<{ cursoId: string }>;
}) {
  const { cursoId } = await params;
  return <CursoVista cursoId={cursoId} admin ambito="escuela" />;
}
