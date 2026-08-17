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
  return {
    title: match.seo?.title ?? `${match.nombre_empresa} — ${match.nombre_pagina}`,
    description: match.seo?.description,
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
      contexto={{
        empresaId: match.empresa_id,
        paginaId: match.pagina_id,
        empresaSlug: match.empresa_slug,
      }}
      hrefPoliticaCookies="/politica-de-cookies"
    />
  );
}
