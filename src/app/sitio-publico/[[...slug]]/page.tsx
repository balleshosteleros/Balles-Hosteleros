import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolverHostname } from "@/features/marketing/pagina-web/services/hostname-resolver";
import { PaginaPublicaShell } from "@/features/marketing/pagina-web/components/public/PaginaPublicaShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function obtenerHost(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-host") ??
    h.get("x-paginas-web-host") ??
    h.get("host") ??
    null
  );
}

/** La ruta decide QUÉ página se sirve: "" = portada, "menu" = /menu, etc. */
function slugDeParams(slug: string[] | undefined): string {
  return (slug ?? []).join("/");
}

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const host = await obtenerHost();
  if (!host) return {};
  const { slug } = await params;
  const match = await resolverHostname(host, slugDeParams(slug));
  if (!match) return {};
  // Logo de la empresa: es el icono que queda al guardar la web en la pantalla
  // de inicio del móvil. En GoHighLevel sale un icono genérico porque no declara
  // ni manifest propio ni apple-touch-icon.
  // Favicon y apple-touch-icon: SIEMPRE el isotipo, nunca el logotipo con texto
  // (a 32px las letras no se leen). Vale para cualquier empresa futura.
  const logo = match.isotipo_url;

  return {
    title: match.seo?.title ?? `${match.nombre_empresa} — ${match.nombre_pagina}`,
    description: match.seo?.description,
    manifest: "/sitio-publico/manifest-web",
    applicationName: match.nombre_empresa,
    appleWebApp: {
      capable: true,
      title: match.nombre_empresa,
      statusBarStyle: "black-translucent",
    },
    // iOS ignora el manifest para el icono: usa apple-touch-icon.
    icons: logo
      ? { icon: logo, shortcut: logo, apple: logo }
      : undefined,
    openGraph: {
      title: match.seo?.title,
      description: match.seo?.description,
      images: match.seo?.og_image ? [{ url: match.seo.og_image }] : undefined,
    },
    robots: match.seo?.robots ?? "index,follow",
  };
}

export default async function PublicCatchAllPage({ params }: PageProps) {
  const host = await obtenerHost();
  if (!host) notFound();
  const { slug } = await params;
  const match = await resolverHostname(host, slugDeParams(slug));
  if (!match) notFound();

  return (
    <PaginaPublicaShell
      bloques={match.bloques}
      branding={match.branding}
      contexto={{
        empresaId: match.empresa_id,
        paginaId: match.pagina_id,
        empresaSlug: match.empresa_slug,
        logoUrl: match.isotipo_url,
        redes: match.redes,
        empleoActivo: match.empleo_activo,
      }}
      hrefPoliticaCookies="/politica-de-cookies"
    />
  );
}
