import { Badge } from "@/components/ui/badge";
import type { EstadoPedido, EstadoAlbaran } from "@/features/logistica/data/pedidos";

const pedidoColors: Record<EstadoPedido, string> = {
  Borrador: "bg-muted text-muted-foreground border-border",
  Pendiente: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  Confirmado: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  Enviado: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
  Servido: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700",
  Cancelado: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  Archivado: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-600",
};

const albaranColors: Record<EstadoAlbaran, string> = {
  Pendiente: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  Confirmado: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  Recibido: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
  Facturado: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700",
  Archivado: "bg-muted text-muted-foreground border-border",
};

export function EstadoPedidoBadge({ value }: { value: EstadoPedido }) {
  return <Badge variant="outline" className={`text-[11px] font-bold px-2 py-0.5 ${pedidoColors[value]}`}>{value.toUpperCase()}</Badge>;
}

export function EstadoAlbaranBadge({ value }: { value: EstadoAlbaran }) {
  return <Badge variant="outline" className={`text-[11px] font-bold px-2 py-0.5 ${albaranColors[value]}`}>{value.toUpperCase()}</Badge>;
}
