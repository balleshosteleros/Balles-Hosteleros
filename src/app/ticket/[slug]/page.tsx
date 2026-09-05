import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { iconsDeEmpresa } from "@/shared/lib/favicon-empresa";
import {
  TiendaTicketView,
  type ProductoTienda,
} from "@/features/tienda-ticket/components/TiendaTicketView";

export const dynamic = "force-dynamic";

interface EmpresaMarca {
  id: string;
  nombre: string;
  slug: string;
  logoUrl: string | null;
  color: string | null;
  colorTexto: string | null;
}

async function fetchEmpresa(slug: string): Promise<EmpresaMarca | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresas")
    .select("id, nombre, slug, logo_url, color, color_texto")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    nombre: data.nombre as string,
    slug: data.slug as string,
    logoUrl: (data.logo_url as string | null) ?? null,
    color: (data.color as string | null) ?? null,
    colorTexto: (data.color_texto as string | null) ?? null,
  };
}

/** Solo los productos marcados como venta directa al público. */
async function fetchProductos(empresaId: string): Promise<ProductoTienda[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reserva_ticket_productos")
    .select("id, nombre, descripcion, precio, iva, modo_precio, personas_por_unidad, cobro_modo, stock_modo, stock_total, stock_consumido, ocultar_al_agotar")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .eq("venta_publica", true)
    .order("orden", { ascending: true })
    .order("numero_secuencial", { ascending: true });

  if (!data) return [];

  return (data as Record<string, unknown>[])
    .filter((r) => {
      // Se ocultan los agotados solo si el producto lo pide.
      if (r.stock_modo !== "limitado" || r.stock_total == null) return true;
      if (!r.ocultar_al_agotar) return true;
      return Number(r.stock_consumido ?? 0) < Number(r.stock_total);
    })
    .map((r) => ({
      id: r.id as string,
      nombre: r.nombre as string,
      descripcion: (r.descripcion as string | null) ?? null,
      precio: Number(r.precio),
      iva: Number(r.iva ?? 0),
      modoPrecio: r.modo_precio as "por_persona" | "por_reserva",
      personasPorUnidad: Number(r.personas_por_unidad ?? 1),
      cobroModo: (r.cobro_modo as "revolut" | "gratis") ?? "revolut",
      stockModo: r.stock_modo as "ilimitado" | "limitado",
      stockTotal: (r.stock_total as number | null) ?? null,
      stockConsumido: Number(r.stock_consumido ?? 0),
    }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await fetchEmpresa(slug);
  if (!empresa) return { title: "Comprar" };
  return {
    title: `Comprar · ${empresa.nombre}`,
    icons: await iconsDeEmpresa({ id: empresa.id }),
  };
}

export default async function ComprarPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const empresa = await fetchEmpresa(slug);
  if (!empresa) notFound();

  const productos = await fetchProductos(empresa.id);

  return (
    <main className="min-h-screen bg-white">
      <TiendaTicketView
        empresaSlug={empresa.slug}
        empresaNombre={empresa.nombre}
        logoUrl={empresa.logoUrl}
        color={empresa.color}
        colorTexto={empresa.colorTexto}
        productos={productos}
      />
    </main>
  );
}
