import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/supabase/get-context";
import { obtenerPagina } from "@/features/marketing/pagina-web/actions/paginas-actions";
import { PreviewClient } from "./PreviewClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaginaPreviewPage({ params }: Props) {
  const { id } = await params;

  // La ruta es pública EN EL PROXY a propósito (si no, abrir el botón «Ver» en
  // una pestaña nueva rebotaba al login y se quedaba cargando para siempre).
  // Pero lo que se enseña es la web SIN publicar de la empresa: material
  // interno. Así que el control de acceso se hace aquí.
  const { userId, empresaId } = await getAppContext();
  if (!userId || !empresaId) redirect("/?auth=1");

  // `obtenerPagina` ya filtra por la empresa activa: una página de otra empresa
  // no aparece, así que nadie puede ver el borrador ajeno cambiando el id.
  const res = await obtenerPagina(id);
  if (!res.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center p-10 text-center text-sm text-neutral-500">
        {res.error}
      </div>
    );
  }

  return <PreviewClient paginaId={id} bloquesIniciales={res.data.bloques ?? []} />;
}
