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

interface LinkInfo {
  vendeTickets: boolean;
}

async function fetchLinkInfo(empresaId: string, keyword: string): Promise<LinkInfo> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reserva_links")
    .select("vende_tickets")
    .eq("empresa_id", empresaId)
    .eq("palabra_clave", keyword.toUpperCase())
    .eq("activo", true)
    .maybeSingle();
  return { vendeTickets: Boolean(data?.vende_tickets) };
}

async function fetchProductosTicket(slug: string, keyword: string | null) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_ticket_productos_publicos", {
    p_empresa_slug: slug,
    p_keyword: keyword,
  });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    descripcion: (r.descripcion as string | null) ?? null,
    precio: Number(r.precio),
    iva: Number(r.iva),
    modoPrecio: r.modo_precio as "por_persona" | "por_reserva",
    stockModo: r.stock_modo as "ilimitado" | "limitado",
    stockTotal: (r.stock_total as number | null) ?? null,
    stockConsumido: (r.stock_consumido as number) ?? 0,
    ocultarAlAgotar: (r.ocultar_al_agotar as boolean) ?? true,
  }));
}

function normalizarOrigen(raw: string): string | null {
  const upper = decodeURIComponent(raw).toUpperCase();
  return /^[A-Z0-9_]+$/.test(upper) && upper.length <= 32 ? upper : null;
}

export default async function ReservarCortoPage({
  params,
}: {
  params: Promise<{ slug: string; keyword: string }>;
}) {
  const { slug, keyword } = await params;
  const empresa = await fetchEmpresaBySlug(slug);
  if (!empresa) notFound();

  const linkInfo = await fetchLinkInfo(empresa.id, keyword);
  const productosTicket = linkInfo.vendeTickets
    ? await fetchProductosTicket(slug, keyword.toUpperCase())
    : await fetchProductosTicket(slug, null);

  return (
    <ReservaPublicaForm
      empresaSlug={empresa.slug}
      empresaNombre={empresa.nombre}
      logoUrl={empresa.logoUrl}
      colorPrimario={empresa.color}
      colorTexto={empresa.colorTexto}
      origen={normalizarOrigen(keyword)}
      productosTicket={productosTicket}
      ticketOnly={linkInfo.vendeTickets}
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
