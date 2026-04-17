import { EditorView } from "@/features/direccion/presentaciones/components/EditorView";

export default async function PresentacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorView presentacionId={id} />;
}
