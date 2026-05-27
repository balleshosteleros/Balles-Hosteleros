/**
 * Landing pública /v/[slug]. Si la empresa NO tiene la landing activada,
 * redirige directamente a /carta/[slug] (escape silencioso).
 *
 * Define metadatos app-like (theme-color del color de marca, viewport-fit
 * cover) para que la pantalla se sienta como una app integrada en el móvil.
 */

import { redirect } from "next/navigation";
import type { Viewport } from "next";
import { fetchVisitaPorSlug } from "@/features/visita/services/visita-fetch";
import { VisitaLanding } from "@/features/visita/components/VisitaLanding";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function VisitaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const visita = await fetchVisitaPorSlug(slug);
  if (!visita) redirect(`/carta/${slug}`);
  return <VisitaLanding visita={visita} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const visita = await fetchVisitaPorSlug(slug);
  if (!visita) return { title: "Bienvenido" };
  return {
    title: visita.empresa.nombre,
    description:
      visita.empresa.descripcion ?? `Bienvenido a ${visita.empresa.nombre}`,
    appleWebApp: {
      capable: true,
      title: visita.empresa.nombre,
      statusBarStyle: "black-translucent",
    },
  };
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Viewport> {
  const { slug } = await params;
  const visita = await fetchVisitaPorSlug(slug);
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
    themeColor: visita?.empresa.colorPrimario ?? "#000000",
  };
}
