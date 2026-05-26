import { PlantillaEditor } from "@/features/calidad/components/PlantillaEditor";

export default async function PlantillaEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id } = await params;
  const { v } = await searchParams;
  return <PlantillaEditor plantillaId={id} versionIdInicial={v} />;
}
