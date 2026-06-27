import { Badge } from "@/components/ui/badge";
import type { EstadoPedido, EstadoAlbaran } from "@/features/logistica/data/pedidos";

// Mismo código de color por significado en los tres documentos:
//   Pendiente = ámbar (editable, recién creado) · intermedio = esmeralda (en curso) ·
//   Confirmado = azul (🔒 cerrado, tiene un hijo en la cadena).
const pedidoColors: Record<EstadoPedido, string> = {
  Pendiente: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  Enviado: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
  Confirmado: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
};

const albaranColors: Record<EstadoAlbaran, string> = {
  Pendiente: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  Entregado: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
  Confirmado: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
};

export function EstadoPedidoBadge({ value }: { value: EstadoPedido }) {
  return <Badge variant="outline" className={`text-[11px] font-bold px-2 py-0.5 ${pedidoColors[value]}`}>{value.toUpperCase()}</Badge>;
}

export function EstadoAlbaranBadge({ value }: { value: EstadoAlbaran }) {
  return <Badge variant="outline" className={`text-[11px] font-bold px-2 py-0.5 ${albaranColors[value]}`}>{value.toUpperCase()}</Badge>;
}
