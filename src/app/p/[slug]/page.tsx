import { notFound } from "next/navigation";
import { fetchEstudioPorSlug } from "@/features/direccion/services/estudio-publico-fetch";
import { EstudioPublicoView } from "@/features/direccion/components/publico/EstudioPublicoView";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function EstudioPublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await fetchEstudioPorSlug(slug);
  if (!data) notFound();
  return <EstudioPublicoView data={data} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await fetchEstudioPorSlug(slug);
  if (!data) return { title: "Estudio no disponible" };
  return {
    title: data.estudio.datos.nombre,
    description: `Estudio de viabilidad para ${data.estudio.datos.nombre} en ${data.estudio.datos.ciudad}.`,
    robots: { index: false, follow: false },
  };
}
