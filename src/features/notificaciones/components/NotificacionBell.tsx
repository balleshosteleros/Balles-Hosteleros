"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { HERRAMIENTA, toolTextColor } from "@/features/layout/data/herramientas";
import {
  listMisNotificaciones,
  marcarNotificacionVista,
  accionarLiquidacion,
  type NotificacionApp,
} from "@/features/notificaciones/actions/notificaciones-actions";
import { getTipoMeta } from "@/features/notificaciones/lib/catalogo";
import { getIconoTipo } from "@/features/notificaciones/lib/catalogo-iconos";

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

// Campana + círculo de no vistas + bandeja (Sheet) con acuse por notificación.
// variant="panel" → botón redondo con borde (Mi Panel / móvil).
// variant="toolbar" → icono ghost integrado en la barra de herramientas superior.
export function NotificacionBell({
  className,
  variant = "panel",
}: {
  className?: string;
  variant?: "panel" | "toolbar";
}) {
  const [items, setItems] = useState<NotificacionApp[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [liquidando, setLiquidando] = useState<NotificacionApp | null>(null);

  const cargar = useCallback(() => {
    listMisNotificaciones().then(setItems);
  }, []);

  useEffect(() => {
    cargar();
    // Refresco periódico para que las alertas lleguen sin recargar la página.
    const id = setInterval(cargar, 60_000);
    return () => clearInterval(id);
  }, [cargar]);

  const sinVer = items.filter((n) => !n.vistaAt).length;

  const onVisto = async (n: NotificacionApp) => {
    setBusyId(n.id);
    const r = await marcarNotificacionVista(n.id);
    setBusyId(null);
    if (r.ok) setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, vistaAt: new Date().toISOString() } : x)));
  };

  const onConfirmLiquidar = async () => {
    if (!liquidando) return;
    setBusyId(liquidando.id);
    const r = await accionarLiquidacion(liquidando.id, liquidando.refId as string);
    setBusyId(null);
    if (r.ok) {
      const nowIso = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === liquidando.id ? { ...x, vistaAt: nowIso, accionadaAt: nowIso } : x)));
    }
    setLiquidando(null);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) cargar(); }}>
        <SheetTrigger asChild>
          {variant === "toolbar" ? (
            <button
              type="button"
              className={`relative inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors ${className ?? ""}`}
              aria-label="Notificaciones"
              title="Notificaciones"
            >
              <Bell className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.notificaciones.colorKey)}`} />
              {sinVer > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card">
                  {sinVer > 9 ? "9+" : sinVer}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background text-foreground/80 ${className ?? ""}`}
              aria-label="Notificaciones"
            >
              <Bell className="h-5 w-5" strokeWidth={1.75} />
              {sinVer > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {sinVer > 9 ? "9+" : sinVer}
                </span>
              )}
            </button>
          )}
        </SheetTrigger>
        <SheetContent side="right" className="w-full max-w-sm p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Notificaciones</SheetTitle>
          </SheetHeader>
          <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No tienes notificaciones.</p>
            ) : (
              <ul className="divide-y">
                {items.map((n) => {
                  const esLiquidacion = n.tipo === "liquidacion" && n.requiereAccion && !!n.refId && !n.vistaAt;
                  const meta = getTipoMeta(n.tipo);
                  const Icono = getIconoTipo(meta.icono);
                  return (
                    <li key={n.id} className={`flex gap-3 p-4 ${n.vistaAt ? "" : "bg-primary/5"}`}>
                      <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${meta.color}`}>
                        <Icono className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">{n.titulo}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{fmtFecha(n.createdAt)}</span>
                        </div>
                        {n.mensaje && <p className="mt-0.5 text-xs text-muted-foreground">{n.mensaje}</p>}
                        <div className="mt-2">
                          {n.vistaAt ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {n.accionadaAt ? "Aprobada" : "Vista"}
                            </span>
                          ) : esLiquidacion ? (
                            <Button size="sm" className="h-7" disabled={busyId === n.id} onClick={() => setLiquidando(n)}>
                              {busyId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "LIQUIDAR"}
                            </Button>
                          ) : (
                            <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-white" disabled={busyId === n.id} onClick={() => void onVisto(n)}>
                              {busyId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (n.accionLabel || "Visto")}
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!liquidando} onOpenChange={(o) => !o && setLiquidando(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Aprobar liquidación</AlertDialogTitle>
            <AlertDialogDescription>
              {(liquidando?.payload.textoLiquidar as string) ||
                "Las liquidaciones se emiten siempre el primer miércoles del mes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void onConfirmLiquidar(); }} disabled={busyId === liquidando?.id}>
              {busyId === liquidando?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "LIQUIDAR"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
