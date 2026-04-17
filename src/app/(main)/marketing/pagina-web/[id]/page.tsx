import { EditorShell } from "@/features/marketing/pagina-web/components/admin/editor/EditorShell";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaginaEditorPage({ params }: Props) {
  const { id } = await params;
  return <EditorShell paginaId={id} />;
}
