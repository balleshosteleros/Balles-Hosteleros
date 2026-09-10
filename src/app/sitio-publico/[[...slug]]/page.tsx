import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { iconsDeUrl } from "@/shared/lib/favicon-empresa";
import type { Metadata } from "next";
import { resolverHostname } from "@/features/marketing/pagina-web/services/hostname-resolver";
import { schemaNegocioDeEmpresa } from "@/features/marketing/pagina-web/services/schema-negocio";
import { PaginaPublicaShell } from "@/features/marketing/pagina-web/components/public/PaginaPublicaShell";
import { registrarVisita, esRobot } from "@/features/marketing/pagina-web/services/visitas";
import { clasificarOrigen, registrarOrigen } from "@/features/marketing/pagina-web/services/analitica";

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
  /** `utm_source` de los enlaces propios (el QR de la mesa, una campaña). */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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

  // URL canónica SIN `www`. El dominio responde por las dos vías (con y sin),
  // y para Google eso son dos webs distintas con el mismo contenido: reparte la
  // fuerza entre ambas y decide por su cuenta cuál enseñar. El canónico le dice
  // cuál es la buena, que es la que el restaurante pone en sus carteles.
  const hostCanonico = match.hostname.replace(/^www\./, "");
  const rutaCanonica = slugDeParams(slug);
  const canonical = `https://${hostCanonico}${rutaCanonica ? `/${rutaCanonica}` : "/"}`;

  return {
    title: match.seo?.title ?? `${match.nombre_empresa} — ${match.nombre_pagina}`,
    description: match.seo?.description,
    alternates: { canonical },
    manifest: "/sitio-publico/manifest-web",
    applicationName: match.nombre_empresa,
    appleWebApp: {
      capable: true,
      title: match.nombre_empresa,
      statusBarStyle: "black-translucent",
    },
    // Pestaña y marcadores: el isotipo recortado en CÍRCULO (norma: ningún
    // favicon nuestro sale cuadrado). iOS va aparte con el cuadrado de siempre,
    // porque la pantalla de inicio lo recorta ella y pinta de negro lo
    // transparente — ver `iconsDeUrl` en `favicon-empresa`.
    icons: iconsDeUrl(logo, match.branding?.color_primario),
    openGraph: {
      url: canonical,
      title: match.seo?.title,
      description: match.seo?.description,
      images: match.seo?.og_image ? [{ url: match.seo.og_image }] : undefined,
    },
    robots: match.seo?.robots ?? "index,follow",
  };
}

export default async function PublicCatchAllPage({ params, searchParams }: PageProps) {
  const host = await obtenerHost();
  if (!host) notFound();
  const { slug } = await params;
  const match = await resolverHostname(host, slugDeParams(slug));
  if (!match) notFound();

  // La visita se apunta aquí y no en `generateMetadata`, que Next ejecuta
  // aparte en la misma petición: contar en los dos sitios duplicaría cada
  // visita. Sin `await`: la web no espera a la estadística.
  // La ficha del negocio solo se declara en la portada.
  const esPortada = !slugDeParams(slug);
  const cabeceras = await headers();
  const userAgent = cabeceras.get("user-agent");
  void registrarVisita(match.pagina_id, userAgent);

  // De dónde llega la gente. Se lee en el SERVIDOR, del `referer` de la
  // petición: el navegador solo lo manda en la primera carga, así que hacerlo
  // desde el cliente perdería el dato en cuanto la página se hidrata.
  if (!esRobot(userAgent)) {
    const query = await searchParams;
    const utm = query?.utm_source;
    void registrarOrigen(
      match.pagina_id,
      clasificarOrigen(
        cabeceras.get("referer"),
        typeof utm === "string" ? utm : null,
        host,
      ),
    );
  }

  // Datos estructurados del local (schema.org). Van en el cuerpo a propósito:
  // Next no deja meter JSON-LD por `generateMetadata`, y Google lo lee igual.
  // Solo en la portada: repetir la ficha del negocio en cada página no aporta y
  // duplica la misma entidad.
  const schema = esPortada
    ? await schemaNegocioDeEmpresa(
        match.empresa_id,
        `https://${match.hostname.replace(/^www\./, "")}`,
        match.isotipo_url,
        match.seo?.description ?? null,
      )
    : null;

  return (
    <>
      {schema && (
        <script
          type="application/ld+json"
          // El contenido es un objeto que construimos nosotros desde la ficha de
          // la empresa, no entrada de usuario libre.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}
    <PaginaPublicaShell
      bloques={match.bloques}
      branding={match.branding}
      contexto={{
        empresaId: match.empresa_id,
        paginaId: match.pagina_id,
        empresaSlug: match.empresa_slug,
        empresaNombre: match.nombre_empresa,
        logoUrl: match.isotipo_url,
        redes: match.redes,
        empleoActivo: match.empleo_activo,
        reservasActivas: match.reservas_activas,
      }}
      hrefPoliticaCookies="/politica-de-cookies"
    />
    </>
  );
}
