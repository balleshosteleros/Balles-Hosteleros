import { notFound } from "next/navigation";
import { obtenerPagina } from "@/features/marketing/pagina-web/actions/paginas-actions";
import { DominiosPanel } from "@/features/marketing/pagina-web/components/admin/dominios/DominiosPanel";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaginaDominiosPage({ params }: Props) {
  const { id } = await params;
  const res = await obtenerPagina(id);
  if (!res.ok) notFound();
  return <DominiosPanel paginaId={id} nombrePagina={res.data.nombre} />;
}
