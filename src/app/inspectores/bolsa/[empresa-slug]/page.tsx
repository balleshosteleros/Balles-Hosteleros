import { notFound } from "next/navigation";
import { fetchBolsaPublicaEmpresa } from "@/features/calidad/inspecciones/inspectores/public-data";
import { BolsaPublicaShell } from "@/features/calidad/inspecciones/inspectores/components/BolsaPublicaShell";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ "empresa-slug": string }>;
}

export default async function BolsaInspectoresPage({ params }: Props) {
  const { "empresa-slug": slug } = await params;
  const data = await fetchBolsaPublicaEmpresa(slug);
  if (!data) notFound();
  return <BolsaPublicaShell data={data} />;
}

export async function generateMetadata({ params }: Props) {
  const { "empresa-slug": slug } = await params;
  const data = await fetchBolsaPublicaEmpresa(slug);
  if (!data) return { title: "Bolsa no encontrada" };
  return {
    title: `Bolsa de inspectores · ${data.empresa.nombre}`,
    description: `Únete como inspector externo en ${data.empresa.nombre}`,
  };
}
