import Link from "next/link";
import { Inbox, ChevronRight } from "lucide-react";

interface Props {
  pendientes: number;
  aprobadas: number;
}

export function SolicitudesQuickCard({ pendientes, aprobadas }: Props) {
  const hasNew = pendientes + aprobadas > 0;
  return (
    <div className="px-5 pt-4">
      <Link
        href="/m/solicitudes"
        className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4 active:opacity-70"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-muted p-2">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">Solicitudes</p>
            <p className="text-xs text-muted-foreground">
              {hasNew
                ? `${pendientes} pendiente${pendientes === 1 ? "" : "s"} · ${aprobadas} aprobada${aprobadas === 1 ? "" : "s"}`
                : "Sin novedades"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendientes > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
              {pendientes}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>
    </div>
  );
}
