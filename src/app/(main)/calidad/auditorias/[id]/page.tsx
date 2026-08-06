import { AuditoriaRealizadaDetalle } from "@/features/calidad/components/AuditoriaRealizadaDetalle";

export default async function AuditoriaRealizadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AuditoriaRealizadaDetalle envioId={id} />;
}
