"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Inbox, Plus, X, CalendarOff, Briefcase } from "lucide-react";
import { toast } from "sonner";
import {
  anularMiSolicitud,
  listarMisSolicitudes,
} from "@/features/mi-panel/actions/mi-panel-actions";
import type { SolicitudPersonal } from "@/features/mi-panel/types";
import { ESTADO_LABEL, SUBTIPO_LABEL } from "@/features/mi-panel/types";
import { SolicitudModal } from "@/features/mi-panel/components/SolicitudModal";
import { cn } from "@/shared/lib/utils";

const TABS: Array<{ key: "todas" | "ausencias" | "trabajos"; label: string }> = [
  { key: "todas", label: "Todas" },
  { key: "ausencias", label: "Ausencias" },
  { key: "trabajos", label: "Trabajos" },
];

const ESTADO_DOT: Record<string, string> = {
  pendiente: "bg-amber-500",
  aprobada: "bg-emerald-500",
  rechazada: "bg-rose-500",
  anulada: "bg-slate-400",
};

function formatFecha(s: string): string {
  try {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return s;
  }
}

export function MisSolicitudesMobile() {
  const [items, setItems] = useState<SolicitudPersonal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"todas" | "ausencias" | "trabajos">("todas");

  useEffect(() => {
    let cancel = false;
    listarMisSolicitudes(60).then((res) => {
      if (cancel) return;
      setItems(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (tab === "ausencias") return items.filter((s) => s.tipo === "ausencia");
    if (tab === "trabajos") return items.filter((s) => s.tipo === "trabajo");
    return items;
  }, [items, tab]);

  async function handleAnular(id: string) {
    const res = await anularMiSolicitud(id);
    if (!res.ok) {
      toast.error(res.error || "No se pudo anular");
      return;
    }
    toast.success("Solicitud anulada");
    setRefreshKey((k) => k + 1);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white shadow-md active:scale-[0.98] active:bg-emerald-600"
      >
        <Plus className="h-5 w-5" />
        Nueva solicitud
      </button>

      <div className="mt-4 flex gap-1.5 rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-full py-1.5 text-xs font-medium transition-colors",
              tab === t.key
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Inbox className="mb-2 h-8 w-8" />
            <p className="text-sm">No hay solicitudes en esta vista.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((s) => (
              <li
                key={s.id}
                className="rounded-2xl border border-border/60 bg-card p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          ESTADO_DOT[s.estado] ?? "bg-slate-400",
                        )}
                      />
                      <p className="truncate text-sm font-medium">
                        {s.tipo === "ausencia" ? (
                          <CalendarOff className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
                        ) : (
                          <Briefcase className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
                        )}
                        {SUBTIPO_LABEL[s.subtipo]}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatFecha(s.fechaInicio)}
                      {s.fechaFin && s.fechaFin !== s.fechaInicio &&
                        ` – ${formatFecha(s.fechaFin)}`}
                      {s.horas != null && ` · ${s.horas}h`}
                    </p>
                    {s.motivo && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                        {s.motivo}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {ESTADO_LABEL[s.estado]}
                    </span>
                    {s.estado === "pendiente" && (
                      <button
                        type="button"
                        onClick={() => handleAnular(s.id)}
                        className="rounded-full p-1.5 text-muted-foreground active:bg-muted active:text-rose-500"
                        aria-label="Anular solicitud"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SolicitudModal
        open={open}
        onOpenChange={setOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
