import { obtenerPagina } from "@/features/marketing/pagina-web/actions/paginas-actions";
import { PreviewClient } from "./PreviewClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaginaPreviewPage({ params }: Props) {
  const { id } = await params;
  const res = await obtenerPagina(id);
  const bloquesInicial = res.ok ? res.data.bloques : [];
  return <PreviewClient paginaId={id} bloquesIniciales={bloquesInicial} />;
}
