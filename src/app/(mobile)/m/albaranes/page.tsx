import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPedidos } from "@/features/logistica/actions/pedidos-actions";
import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { RecepcionInbox } from "@/features/logistica/mobile/components/RecepcionInbox";

export const dynamic = "force-dynamic";

interface PedidoRow {
  id: string;
  estado?: string | null;
  numero?: string | null;
  numero_secuencial?: number | null;
  proveedor_nombre?: string | null;
  fecha?: string | null;
  fecha_entrega?: string | null;
  total?: number | string | null;
}

export default async function MobileAlbaranesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const res = await listPedidos();
  const pedidos = ((res.data ?? []) as PedidoRow[])
    .filter((p) => p.estado === "Enviado")
    .map((p) => ({
      id: p.id,
      referencia:
        p.numero || (p.numero_secuencial != null ? `PED-${p.numero_secuencial}` : p.id.slice(0, 8)),
      proveedor: p.proveedor_nombre ?? "Proveedor",
      fechaEntrega: p.fecha_entrega ?? null,
      total: Number(p.total) || 0,
    }));

  return (
    <>
      <MobilePageHeader title="Recepción de albaranes" subtitle="Pedidos pendientes de recibir" />
      <div className="px-3 py-4">
        <RecepcionInbox pedidos={pedidos} />
      </div>
    </>
  );
}
