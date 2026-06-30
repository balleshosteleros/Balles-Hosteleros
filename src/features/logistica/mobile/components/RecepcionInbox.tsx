"use client";

import Link from "next/link";
import { PackageCheck, ChevronRight, Inbox } from "lucide-react";
import { formatEur } from "@/shared/lib/numero";

export interface PedidoPorRecibir {
  id: string;
  referencia: string;
  proveedor: string;
  fechaEntrega: string | null;
  total: number;
}

export function RecepcionInbox({ pedidos }: { pedidos: PedidoPorRecibir[] }) {
  if (pedidos.length === 0) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
          <Inbox className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-base font-semibold">No hay pedidos por recibir</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Cuando se envíe un pedido a un proveedor, aparecerá aquí para que confirmes la recepción.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {pedidos.map((p) => (
        <li key={p.id}>
          <Link
            href={`/m/albaranes/recibir/${p.id}`}
            className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm transition-all active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
              <PackageCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{p.proveedor}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.referencia}
                {p.fechaEntrega ? ` · entrega ${p.fechaEntrega}` : ""} · {formatEur(p.total)}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
