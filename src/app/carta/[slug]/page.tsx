import { notFound } from "next/navigation";
import { iconsDeUrl } from "@/shared/lib/favicon-empresa";
import { fetchCartaPorSlug } from "@/features/marketing/carta-digital/services/carta-fetch";
import { CartaPublicaShell } from "@/features/marketing/carta-digital/components/public/CartaPublicaShell";

export const dynamic = "force-dynamic";
export const revalidate = 60;

/**
 * `?web=1` = se ha llegado desde la página del restaurante, no desde el QR de
 * la mesa. Solo lo añade la web; los QR impresos apuntan al enlace pelado y no
 * hay que reimprimir ninguno.
 *
 * Cambia una cosa: las categorías con horario (el menú del día) se enseñan
 * siempre, con su horario escrito. Sentado en la mesa, en cambio, la carta
 * solo enseña lo que la cocina sirve en ese momento.
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
