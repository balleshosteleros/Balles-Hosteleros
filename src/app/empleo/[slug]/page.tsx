import { notFound } from "next/navigation";
import { fetchPortalEmpleoPorSlug } from "@/features/empleo-publico/services/empleo-fetch";
import { EmpleoBrandingShell } from "@/features/empleo-publico/components/EmpleoBrandingShell";
import { ListadoOfertasPublico } from "@/features/empleo-publico/components/ListadoOfertasPublico";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function PortalEmpleoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const portal = await fetchPortalEmpleoPorSlug(slug);
  if (!portal) notFound();
  return (
    <EmpleoBrandingShell empresa={portal.empresa}>
      <ListadoOfertasPublico portal={portal} />
    </EmpleoBrandingShell>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const portal = await fetchPortalEmpleoPorSlug(slug);
  if (!portal) return { title: "Portal de empleo" };
  const desc =
    portal.ofertas.length > 0
      ? `${portal.ofertas.length} ofertas de empleo abiertas en ${portal.empresa.nombre}`
      : `Trabaja con ${portal.empresa.nombre}`;
  return {
    title: `Empleo · ${portal.empresa.nombre}`,
    description: desc,
    openGraph: {
      title: `Empleo en ${portal.empresa.nombre}`,
      description: desc,
      type: "website",
    },
  };
}
