import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPedido } from "@/features/logistica/actions/pedidos-actions";
import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { RecepcionAlbaranMobile } from "@/features/logistica/mobile/components/RecepcionAlbaranMobile";

export const dynamic = "force-dynamic";

interface LineaPedidoRow {
  id: string;
  producto_id: string | null;
  producto_nombre: string | null;
  cantidad: number | string | null;
  unidad: string | null;
  precio_unitario: number | string | null;
}

export default async function RecibirPedidoPage({
  params,
}: {
  params: Promise<{ pedidoId: string }>;
}) {
  const { pedidoId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const res = await getPedido(pedidoId);
  if (!res.ok) notFound();
  const pedido = res.data as {
    id: string;
    proveedor_nombre: string | null;
    numero: string | null;
    numero_secuencial: number | null;
    estado: string | null;
    lineas: LineaPedidoRow[];
  };

  const referencia =
    pedido.numero ||
    (pedido.numero_secuencial != null ? `PED-${pedido.numero_secuencial}` : pedido.id.slice(0, 8));

  const lineas = (pedido.lineas ?? []).map((l) => ({
    id: l.id,
    productoId: l.producto_id,
    producto: l.producto_nombre ?? "—",
    cantidadPedida: Number(l.cantidad) || 0,
    unidad: l.unidad ?? "ud",
    precioUC: Number(l.precio_unitario) || 0,
  }));

  return (
    <>
      <MobilePageHeader
        title="Recibir mercancía"
        subtitle={`${pedido.proveedor_nombre ?? "Proveedor"} · ${referencia}`}
        backHref="/m/albaranes"
      />
      <div className="px-3 py-4">
        <RecepcionAlbaranMobile pedidoId={pedido.id} lineas={lineas} />
      </div>
    </>
  );
}
