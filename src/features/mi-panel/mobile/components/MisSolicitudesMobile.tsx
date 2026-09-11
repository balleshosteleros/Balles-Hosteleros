"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Inbox,
  Plus,
  X,
  CalendarOff,
  Briefcase,
  PackageCheck,
  MessageSquareWarning,
  VenetianMask,
} from "lucide-react";
import { toast } from "sonner";
import {
  anularMiSolicitud,
  listarMisSolicitudes,
} from "@/features/mi-panel/actions/mi-panel-actions";
import type { SolicitudPersonal } from "@/features/mi-panel/types";
import { ESTADO_LABEL, SUBTIPO_LABEL } from "@/features/mi-panel/types";
import {
  listMisDenuncias,
  type EstadoDenuncia,
  type MiDenuncia,
} from "@/features/mi-panel/actions/denuncias-actions";
import { SolicitudModal } from "@/features/mi-panel/components/SolicitudModal";
import {
  CATEGORIA_LABEL,
  DenunciaModal,
} from "@/features/mi-panel/components/DenunciaModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { cn } from "@/shared/lib/utils";

/**
 * Los cuatro tipos que puede pedir un empleado, cada uno en su pestaña. No hay
 * vista «todas» a propósito: mezclarlos no dice nada, se miran por tipo.
 */
const TABS: Array<{
  key: "ausencias" | "trabajos" | "entregas" | "quejas";
  label: string;
}> = [
  { key: "ausencias", label: "Ausencias" },
  { key: "trabajos", label: "Trabajos" },
  { key: "entregas", label: "Entregas" },
  { key: "quejas", label: "Quejas" },
];

const ESTADO_DOT: Record<string, string> = {
  pendiente: "bg-amber-500",
  aprobada: "bg-emerald-500",
  rechazada: "bg-rose-500",
  anulada: "bg-slate-400",
};

/**
 * Una queja sigue su propio ciclo (recibida → investigación → resuelta), así
 * que no se traduce al estado de una solicitud: se muestra el suyo.
 */
const DENUNCIA_ESTADO_LABEL: Record<EstadoDenuncia, string> = {
  recibida: "Recibida",
  en_investigacion: "En investigación",
  informacion_solicitada: "Información solicitada",
  resuelta: "Resuelta",
  archivada: "Archivada",
};

const DENUNCIA_ESTADO_DOT: Record<EstadoDenuncia, string> = {
  recibida: "bg-blue-500",
  en_investigacion: "bg-amber-500",
  informacion_solicitada: "bg-purple-500",
  resuelta: "bg-emerald-500",
  archivada: "bg-slate-400",
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
  const [quejas, setQuejas] = useState<MiDenuncia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [denunciaOpen, setDenunciaOpen] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ausencias");
  const [aAnular, setAAnular] = useState<SolicitudPersonal | null>(null);
  const [anulando, setAnulando] = useState(false);

  useEffect(() => {
    let cancel = false;
    // Las quejas viven en su propia tabla por confidencialidad. Salen todas
    // las suyas, anónimas incluidas: de esas la empresa no ve quién las puso.
    Promise.all([listarMisSolicitudes(60), listMisDenuncias()]).then(
      ([sol, den]) => {
        if (cancel) return;
        setItems(sol.ok ? sol.data : []);
        setQuejas(den.ok ? den.data : []);
        setLoading(false);
      },
    );
    return () => {
      cancel = true;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (tab === "ausencias") return items.filter((s) => s.tipo === "ausencia");
    if (tab === "trabajos") return items.filter((s) => s.tipo === "trabajo");
    if (tab === "entregas") return items.filter((s) => s.tipo === "entrega");
    return [];
  }, [items, tab]);

  async function handleAnular() {
    if (!aAnular) return;
    setAnulando(true);
    const res = await anularMiSolicitud(aAnular.id);
    setAnulando(false);
    setAAnular(null);
    if (!res.ok) {
      toast.error(res.error || "No se pudo anular");
      setRefreshKey((k) => k + 1);
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
        ) : tab === "quejas" ? (
          quejas.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground">
              <MessageSquareWarning className="mb-2 h-8 w-8" />
              <p className="text-sm">No has presentado ninguna queja.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {quejas.map((d) => (
                <li
                  key={d.id}
                  className="rounded-2xl border border-border/60 bg-card p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            DENUNCIA_ESTADO_DOT[d.estado],
                          )}
                        />
                        <p className="truncate text-sm font-medium">
                          <MessageSquareWarning className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
                          {d.asunto}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {CATEGORIA_LABEL[d.categoria]}
                        {` · presentada el ${formatFecha(d.created_at.slice(0, 10))}`}
                      </p>
                      {d.modalidad === "anonima" && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          <VenetianMask className="h-3 w-3" />
                          Anónima
                        </span>
                      )}
                      {d.respuesta && (
                        <p className="mt-1.5 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Respuesta de recursos humanos:
                          </span>{" "}
                          {d.respuesta}
                        </p>
                      )}
                    </div>
                    <span className="text-right text-[10px] font-medium tracking-wide text-muted-foreground">
                      {DENUNCIA_ESTADO_LABEL[d.estado]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )
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
                        ) : s.tipo === "entrega" ? (
                          <PackageCheck className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
                        ) : (
                          <Briefcase className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
                        )}
                        {SUBTIPO_LABEL[s.subtipo]}
                      </p>
                    </div>
                    {/* En una petición de material lo primero es la prenda; la
                        fecha es la del día en que se pidió, para dejar constancia. */}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.tipo === "entrega" ? (
                        <>
                          {s.entregaTipoNombre ?? "—"}
                          {s.entregaTalla && ` · talla ${s.entregaTalla}`}
                          {` · pedida el ${formatFecha(s.fechaInicio)}`}
                        </>
                      ) : (
                        <>
                          {formatFecha(s.fechaInicio)}
                          {s.fechaFin && s.fechaFin !== s.fechaInicio &&
                            ` – ${formatFecha(s.fechaFin)}`}
                          {s.horas != null && ` · ${s.horas}h`}
                        </>
                      )}
                    </p>
                    {s.motivo && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                        {s.motivo}
                      </p>
                    )}
                    {s.revisadoPor && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {s.estado === "rechazada" ? "Denegada" : "Validada"} por{" "}
                        <span className="text-foreground">{s.revisadoPor}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={cn(
                        "text-right text-[10px] font-medium tracking-wide",
                        s.estado === "anulada"
                          ? "text-slate-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {ESTADO_LABEL[s.estado]}
                    </span>
                    {s.estado === "pendiente" && (
                      <button
                        type="button"
                        onClick={() => setAAnular(s)}
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
        onElegirDenuncia={() => setDenunciaOpen(true)}
      />

      <DenunciaModal
        open={denunciaOpen}
        onOpenChange={setDenunciaOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      <AlertDialog
        open={!!aAnular}
        onOpenChange={(v) => {
          if (!v) setAAnular(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular esta solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo puedes anularla mientras está pendiente, antes de que tu
              responsable la conteste. Quedará registrada como «anulada por el
              empleado». Si ya ha recibido respuesta, no se podrá anular y se
              llevará a cabo lo que indica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anulando}>
              No, mantener
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleAnular();
              }}
              disabled={anulando}
              className="bg-rose-600 hover:bg-rose-700 active:bg-blue-600"
            >
              {anulando ? "Anulando…" : "Sí, anular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
