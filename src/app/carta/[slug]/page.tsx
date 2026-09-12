import { notFound } from "next/navigation";
import { iconsDeUrl } from "@/shared/lib/favicon-empresa";
import { fetchCartaPorSlug } from "@/features/marketing/carta-digital/services/carta-fetch";
import { CartaPublicaShell } from "@/features/marketing/carta-digital/components/public/CartaPublicaShell";

export const dynamic = "force-dynamic";
export const revalidate = 60;

/**
 * Un solo enlace para la carta: el del QR de la mesa y el de la web del
 * restaurante son el mismo, y los QR impresos siguen valiendo.
 *
 * Lo único que cambia es `?web=1`, que solo añade la web: con esa marca las
 * categorías con horario (el menú del día) se enseñan siempre, con su franja
 * escrita. Sin ella —el QR pelado de la mesa— se enseña solo lo que la cocina
 * está sirviendo. Por la noche, que es cuando la gente consulta la carta desde
 * casa para decidir, el menú del día tiene que estar ahí (Iván).
 */
export default async function CartaPublicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ web?: string }>;
}) {
  const { slug } = await params;
  const { web } = await searchParams;
  const carta = await fetchCartaPorSlug(slug, web === "1" ? "web" : "local");
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
    // Favicon = isotipo de ESTA empresa. Sin esto heredaba `src/app/icon.png`,
    // que es el del software: la carta de cada restaurante salía en la pestaña
    // con el logo de Balles Hosteleros.
    icons: iconsDeUrl(
      carta.empresa.isotipo_url || carta.empresa.logo_alt_url || carta.empresa.logo_url || null,
      carta.empresa.color_primario,
    ),
  };
}
