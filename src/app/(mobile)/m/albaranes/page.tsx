import { redirect } from "next/navigation";
import Link from "next/link";
import { Camera, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listPedidos } from "@/features/logistica/actions/pedidos-actions";
import { listAlbaranes } from "@/features/logistica/actions/albaranes-actions";
import { ESTADO_REVISION } from "@/features/logistica/data/albaranes";
import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { RecepcionInbox } from "@/features/logistica/mobile/components/RecepcionInbox";
import { AlbaranesEnRevision } from "@/features/logistica/mobile/components/AlbaranesEnRevision";

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

interface AlbaranRow {
  id: string;
  numero?: string | null;
  numero_proveedor?: string | null;
  proveedor_nombre?: string | null;
  fecha?: string | null;
  estado?: string | null;
}

export default async function MobileAlbaranesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [resPedidos, resAlbaranes] = await Promise.all([listPedidos(), listAlbaranes()]);

  const pedidos = ((resPedidos.data ?? []) as PedidoRow[])
    .filter((p) => p.estado === "Enviado")
    .map((p) => ({
      id: p.id,
      referencia:
        p.numero || (p.numero_secuencial != null ? `PED-${p.numero_secuencial}` : p.id.slice(0, 8)),
      proveedor: p.proveedor_nombre ?? "Proveedor",
      fechaEntrega: p.fecha_entrega ?? null,
      total: Number(p.total) || 0,
    }));

  const enRevision = ((resAlbaranes.data ?? []) as AlbaranRow[])
    .filter((a) => a.estado === ESTADO_REVISION)
    .map((a) => ({
      id: a.id,
      numero: a.numero || (a.numero_proveedor ? `Nº ${a.numero_proveedor}` : a.id.slice(0, 8)),
      proveedor: a.proveedor_nombre ?? "Proveedor",
      fecha: a.fecha ?? null,
    }));

  return (
    <>
      <MobilePageHeader title="Recepción de albaranes" subtitle="Pedidos pendientes de recibir" />
      {/* pb-6 al final: si no, la barra de navegación tapaba los últimos albaranes
          en revisión (no se podían ni ver ni pulsar). El hueco de la barra ya lo
          reserva el layout; esto es solo el aire para que no queden pegados. */}
      <div className="space-y-5 px-3 py-4 pb-6">
        <Link
          href="/m/albaranes/subir"
          className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-3.5 transition-all active:scale-[0.98]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Camera className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">Subir albarán por foto</p>
            <p className="text-xs text-muted-foreground">OCR automático, se guarda en Revisión</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>

        {/* Revisión PRIMERO: son los que piden acción de una persona. Debajo de la lista
            de pedidos por recibir quedaban tan abajo que no se veían. */}
        <AlbaranesEnRevision albaranes={enRevision} />

        <RecepcionInbox pedidos={pedidos} />
      </div>
    </>
  );
}
