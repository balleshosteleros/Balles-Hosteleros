import { AuditoriaRellenarView } from "@/features/calidad/components/AuditoriaRellenarView";

export default async function AuditoriaRellenarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AuditoriaRellenarView envioId={id} />;
}
