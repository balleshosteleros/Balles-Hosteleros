import { PresentarView } from "@/features/direccion/presentaciones/components/PresentarView";

export default async function PresentarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PresentarView presentacionId={id} />;
}
