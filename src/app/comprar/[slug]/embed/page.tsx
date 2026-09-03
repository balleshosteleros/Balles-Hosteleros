/**
 * La tienda de Tickets, para incrustar en la web del restaurante.
 *
 * Misma vista que `/comprar/[slug]`, pero sin cabecera ni fondo propio: se
 * mete dentro de la página como una sección más, igual que el formulario de
 * reservas. Los Tickets van APARTE de las reservas —una cosa es reservar mesa
 * y otra comprar una experiencia por adelantado— pero pueden convivir en la
 * misma web.
 */

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TiendaTicketView,
  type ProductoTienda,
} from "@/features/tienda-ticket/components/TiendaTicketView";

export const dynamic = "force-dynamic";

async function fetchEmpresa(slug: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresas")
    .select("id, nombre, slug, color, color_texto")
    .eq("slug", slug)
    .maybeSingle();
  return data ?? null;
}

/** Solo los productos marcados como venta directa al público. */
async function fetchProductos(empresaId: string): Promise<ProductoTienda[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reserva_ticket_productos")
    .select(
      "id, nombre, descripcion, precio, iva, modo_precio, personas_por_unidad, cobro_modo, stock_modo, stock_total, stock_consumido, ocultar_al_agotar",
    )
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

export default async function ComprarEmbedPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const empresa = await fetchEmpresa(slug);
  if (!empresa) notFound();

  const productos = await fetchProductos(empresa.id as string);

  return (
    <TiendaTicketView
      empresaSlug={empresa.slug as string}
      empresaNombre={empresa.nombre as string}
      // Sin logo ni fondo: la web que lo incrusta ya pone los suyos.
      logoUrl={null}
      color={(empresa.color as string | null) ?? null}
      colorTexto={(empresa.color_texto as string | null) ?? null}
      productos={productos}
      embedded
    />
  );
}
