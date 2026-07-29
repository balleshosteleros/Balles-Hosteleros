import { Clock3 } from "lucide-react";

export interface AlbaranEnRevisionRow {
  id: string;
  numero: string;
  proveedor: string;
  fecha: string | null;
}

/**
 * Solo lectura: da feedback de que el albarán subido por foto quedó guardado.
 * La resolución (vincular/crear/ignorar líneas) se hace desde el ordenador.
 */
export function AlbaranesEnRevision({ albaranes }: { albaranes: AlbaranEnRevisionRow[] }) {
  if (albaranes.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        En revisión
      </p>
      <ul className="space-y-2.5">
        {albaranes.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <Clock3 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{a.proveedor}</p>
              <p className="truncate text-xs text-muted-foreground">
                {a.numero}
                {a.fecha ? ` · ${a.fecha}` : ""} · se resuelve desde el ordenador
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              REVISIÓN
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
