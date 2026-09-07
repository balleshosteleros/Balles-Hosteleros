import { EmbudoDetalleView } from "@/features/marketing/pagina-web/components/admin/EmbudoDetalleView";

// Los datos del embudo (visitas de cada paso) cambian solos: nunca cacheado.
export const dynamic = "force-dynamic";

export default async function EmbudoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmbudoDetalleView embudoId={id} />;
}
