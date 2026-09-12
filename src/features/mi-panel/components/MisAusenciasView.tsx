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
  HeartPulse,
  MessageSquareWarning,
  VenetianMask,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  anularMiSolicitud,
  listarMisSolicitudes,
} from "@/features/mi-panel/actions/mi-panel-actions";
import type { SolicitudPersonal } from "@/features/mi-panel/types";
import { ESTADO_LABEL, SUBTIPO_LABEL } from "@/features/mi-panel/types";
import {
  listMisDenuncias,
  type MiDenuncia,
} from "@/features/mi-panel/actions/denuncias-actions";
import {
  DENUNCIA_ESTADO_DOT,
  ESTADO_DOT,
  SOLICITUD_TABS,
  formatFechaSolicitud as formatFecha,
} from "@/features/mi-panel/lib/solicitudes-ui";
import { SolicitudModal } from "./SolicitudModal";
import { AltaMedicaModal } from "./AltaMedicaModal";
import {
  getMiBajaMedicaAbierta,
  type BajaMedicaAbierta,
} from "@/features/mi-panel/actions/comunicaciones-actions";
import {
  CATEGORIA_LABEL,
  DENUNCIA_ESTADO_LABEL,
  DenunciaModal,
} from "./DenunciaModal";
import { cn } from "@/shared/lib/utils";

/**
 * Las solicitudes del empleado en el ordenador, con la misma lectura que en el
 * móvil: una pestaña por tipo y una tarjeta por solicitud con su punto de
 * estado. Solo cambian las medidas y que aquí el ratón tiene hover.
 */
export function MisAusenciasView() {
  const [items, setItems] = useState<SolicitudPersonal[]>([]);
  const [quejas, setQuejas] = useState<MiDenuncia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [denunciaOpen, setDenunciaOpen] = useState(false);
  const [tab, setTab] = useState<(typeof SOLICITUD_TABS)[number]["key"]>("ausencias");
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

  // Mientras tenga una baja médica sin alta, el botón principal deja de ser
  // "Solicitar": lo que le toca es decir que ya está bien.
  const [bajaAbierta, setBajaAbierta] = useState<BajaMedicaAbierta | null>(null);
  const [altaOpen, setAltaOpen] = useState(false);

  useEffect(() => {
    let activo = true;
    getMiBajaMedicaAbierta().then((res) => {
      if (activo) setBajaAbierta(res.data);
    });
    return () => {
      activo = false;
    };
  }, [refreshKey]);

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
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Solicitudes</h1>
        {bajaAbierta ? (
          <Button variant="primary" size="lg" onClick={() => setAltaOpen(true)}>
            <HeartPulse className="mr-2 h-4 w-4" />
            Comunicar mi alta médica
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva solicitud
          </Button>
        )}
      </div>

      <div className="flex gap-1.5 rounded-full bg-muted p-1">
        {SOLICITUD_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : tab === "quejas" ? (
          quejas.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center text-muted-foreground">
              <MessageSquareWarning className="mb-2 h-8 w-8" />
              <p className="text-sm">No has presentado ninguna queja.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {quejas.map((d) => (
                <li
                  key={d.id}
                  className="rounded-xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/30"
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
                            Respuesta de RRHH:
                          </span>{" "}
                          {d.respuesta}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-right text-[11px] font-medium tracking-wide text-muted-foreground">
                      {DENUNCIA_ESTADO_LABEL[d.estado]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Inbox className="mb-2 h-8 w-8" />
            <p className="text-sm">No hay solicitudes en esta vista.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/30"
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
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={cn(
                        "text-right text-[11px] font-medium tracking-wide",
                        s.estado === "anulada"
                          ? "text-slate-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {ESTADO_LABEL[s.estado]}
                    </span>
                    {s.estado === "pendiente" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Anular solicitud"
                        onClick={() => setAAnular(s)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
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

      {bajaAbierta && (
        <AltaMedicaModal
          open={altaOpen}
          onOpenChange={setAltaOpen}
          solicitudId={bajaAbierta.solicitudId}
          fechaInicioBaja={bajaAbierta.fechaInicio}
          onComunicada={() => setRefreshKey((k) => k + 1)}
        />
      )}

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
              className="bg-rose-600 hover:bg-rose-700"
            >
              {anulando ? "Anulando…" : "Sí, anular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
