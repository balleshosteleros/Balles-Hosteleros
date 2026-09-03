import { Clock3, FileWarning } from "lucide-react";
import { formatearFechaEs } from "@/shared/lib/fecha";

export interface AlbaranEnRevisionRow {
  id: string;
  numero: string;
  proveedor: string;
  fecha: string | null;
  /** Se guardó sabiendo que le falta al menos una página: no se podrá confirmar hasta completarlo. */
  incompleto?: boolean;
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
            className={`flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm ${
              a.incompleto ? "border-red-300 dark:border-red-800" : ""
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                a.incompleto
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
              }`}
            >
              {a.incompleto ? <FileWarning className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{a.proveedor}</p>
              <p className="truncate text-xs text-muted-foreground">
                {a.numero}
                {a.fecha ? ` · ${formatearFechaEs(a.fecha)}` : ""}
                {a.incompleto ? " · falta una página: hazle foto y súbela" : " · se resuelve desde el ordenador"}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                a.incompleto
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
              }`}
            >
              {a.incompleto ? "INCOMPLETO" : "REVISIÓN"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
