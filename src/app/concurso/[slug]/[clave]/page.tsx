import { notFound } from "next/navigation";
import type { Viewport } from "next";
import { iconsDeEmpresa } from "@/shared/lib/favicon-empresa";
import { getEdicionPublica } from "@/features/marketing/services/concurso";
import { ConcursoForm } from "@/features/marketing/concurso/components/ConcursoForm";

// El estado del concurso cambia con cada persona que juega: las plazas libres
// que se pintan tienen que ser las de este segundo, no las de la última compilación.
export const dynamic = "force-dynamic";

export default async function ConcursoPage({
  params,
}: {
  params: Promise<{ slug: string; clave: string }>;
}) {
  const { slug, clave } = await params;
  const edicion = await getEdicionPublica(slug, clave);
  if (!edicion) notFound();

  // Una edición que aún no se ha abierto no existe para el público: si el
  // concurso se pudiera jugar antes de que salga el correo, quien adivinara la
  // dirección se llevaría los tres premios sin haber recibido nada.
  if (!edicion.abierta) notFound();

  return <ConcursoForm empresaSlug={slug} edicion={edicion} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; clave: string }>;
}) {
  const { slug, clave } = await params;
  const edicion = await getEdicionPublica(slug, clave);
  return {
    icons: await iconsDeEmpresa({ slug }),
    title: edicion ? `Concurso — ${edicion.empresaNombre}` : "Concurso",
    description: edicion
      ? `Cinco preguntas y ${edicion.premio} en juego en ${edicion.empresaNombre}`
      : undefined,
    // Un concurso con tres plazas no se anuncia en Google: quien no viene del
    // correo no debería llegar antes que quien sí lo recibió.
    robots: { index: false, follow: false },
  };
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string; clave: string }>;
}): Promise<Viewport> {
  const { slug, clave } = await params;
  const edicion = await getEdicionPublica(slug, clave);
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: edicion?.color ?? "#0a0a0a",
  };
}
