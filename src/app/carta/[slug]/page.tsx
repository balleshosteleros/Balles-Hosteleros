import { notFound } from "next/navigation";
import { fetchCartaPorSlug } from "@/features/marketing/carta-digital/services/carta-fetch";
import { CartaPublicaShell } from "@/features/marketing/carta-digital/components/public/CartaPublicaShell";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function CartaPublicaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const carta = await fetchCartaPorSlug(slug);
  if (!carta) notFound();
  return <CartaPublicaShell carta={carta} />;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const carta = await fetchCartaPorSlug(slug);
  if (!carta) return { title: "Carta no encontrada" };
  return {
    title: `Carta · ${carta.empresa.nombre}`,
    description: carta.empresa.carta_descripcion ?? `Carta digital de ${carta.empresa.nombre}`,
  };
}
