import { CampanaDetalleView } from "@/features/calidad/cuestionarios/components/CampanaDetalleView";

export default async function CampanaPage({
  params,
}: {
  params: Promise<{ campanaId: string }>;
}) {
  const { campanaId } = await params;
  return <CampanaDetalleView campanaId={campanaId} />;
}
