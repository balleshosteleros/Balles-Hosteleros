/**
 * Landing pública /v/[slug]. Si la empresa NO tiene la landing activada,
 * redirige directamente a /carta/[slug].
 */

import { redirect } from "next/navigation";
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
  };
}
