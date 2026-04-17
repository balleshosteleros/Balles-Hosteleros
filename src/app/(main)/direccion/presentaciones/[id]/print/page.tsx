import { PrintView } from "@/features/direccion/presentaciones/components/PrintView";

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PrintView presentacionId={id} />;
}
