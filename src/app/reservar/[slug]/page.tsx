import { notFound } from "next/navigation";
import type { Viewport } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReservaPublicaForm } from "@/features/reservar-publica/components/ReservaPublicaForm";

export const dynamic = "force-dynamic";

interface EmpresaMarca {
  id: string;
  nombre: string;
  slug: string;
  logoUrl: string | null;
  color: string | null;
  colorSecundario: string | null;
  colorTexto: string | null;
}

async function fetchEmpresaBySlug(slug: string): Promise<EmpresaMarca | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresas")
    .select("id, nombre, slug, logo_url, color, color_secundario, color_texto")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    nombre: data.nombre as string,
    slug: data.slug as string,
    logoUrl: (data.logo_url as string | null) ?? null,
    color: (data.color as string | null) ?? null,
    colorSecundario: (data.color_secundario as string | null) ?? null,
    colorTexto: (data.color_texto as string | null) ?? null,
  };
}

export default async function ReservarPublicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ o?: string }>;
}) {
  const { slug } = await params;
  const { o } = await searchParams;
  const empresa = await fetchEmpresaBySlug(slug);
  if (!empresa) notFound();

  const origenLimpio = o && /^[A-Z0-9_]+$/.test(o) && o.length <= 32 ? o : null;

  return (
    <ReservaPublicaForm
      empresaSlug={empresa.slug}
      empresaNombre={empresa.nombre}
      logoUrl={empresa.logoUrl}
      colorPrimario={empresa.color}
      colorTexto={empresa.colorTexto}
      origen={origenLimpio}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const empresa = await fetchEmpresaBySlug(slug);
  return {
    title: empresa ? `Reservar — ${empresa.nombre}` : "Reservar",
    description: empresa ? `Reserva tu mesa en ${empresa.nombre}` : undefined,
  };
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Viewport> {
  const { slug } = await params;
  const empresa = await fetchEmpresaBySlug(slug);
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: empresa?.color ?? "#0a0a0a",
  };
}
