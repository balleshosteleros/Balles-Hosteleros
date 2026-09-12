import { notFound } from "next/navigation";
import { iconsDeUrl } from "@/shared/lib/favicon-empresa";
import { fetchCartaPorSlug } from "@/features/marketing/carta-digital/services/carta-fetch";
import { CartaPublicaShell } from "@/features/marketing/carta-digital/components/public/CartaPublicaShell";

export const dynamic = "force-dynamic";
export const revalidate = 60;

/**
 * Un solo enlace para la carta: el del QR de la mesa y el de la web del
 * restaurante son el mismo. Lo que se ve a cada hora lo decide el horario de
 * cada categoría, no por dónde haya entrado el cliente.
 */
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
    // Favicon = isotipo de ESTA empresa. Sin esto heredaba `src/app/icon.png`,
    // que es el del software: la carta de cada restaurante salía en la pestaña
    // con el logo de Balles Hosteleros.
    icons: iconsDeUrl(
      carta.empresa.isotipo_url || carta.empresa.logo_alt_url || carta.empresa.logo_url || null,
      carta.empresa.color_primario,
    ),
  };
}
