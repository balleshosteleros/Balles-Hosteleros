"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2, Coffee, Play, CheckCircle2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { obtenerPosicionActual } from "@/features/rrhh/utils/geo";
import {
  ficharEntradaPersonal,
  ficharSalidaPersonal,
  iniciarPausaPersonal,
  finalizarPausaPersonal,
} from "@/features/mi-panel/actions/mi-panel-actions";
import { enqueue } from "../lib/offline-fichaje-db";
import { useOfflineFichajes } from "../hooks/use-offline-fichajes";

type Estado = "sin-fichar" | "trabajando" | "pausa" | "completado";

interface Props {
  fichajeId: string | null;
  estado: Estado;
}

const STYLES: Record<Estado, { label: string; bg: string; icon: typeof Fingerprint }> = {
  "sin-fichar": {
    label: "FICHAR ENTRADA",
    bg: "bg-emerald-500 active:bg-emerald-600 text-white",
    icon: Fingerprint,
  },
  trabajando: {
    label: "FICHAR SALIDA",
    bg: "bg-rose-500 active:bg-rose-600 text-white",
    icon: Fingerprint,
  },
  pausa: {
    label: "REANUDAR",
    bg: "bg-amber-500 active:bg-amber-600 text-white",
    icon: Play,
  },
  completado: {
    label: "JORNADA COMPLETA",
    bg: "bg-muted text-muted-foreground",
    icon: CheckCircle2,
  },
};

function monotonicNowMs(): number {
  if (typeof performance !== "undefined") return performance.timeOrigin + performance.now();
  return Date.now();
}

async function tryGetGeo() {
  try {
    return await obtenerPosicionActual();
  } catch {
    return null;
  }
}

export function BigClockButton({ fichajeId, estado }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const { online, pending: pendingOffline, flushing } = useOfflineFichajes(() => {
    startTransition(() => router.refresh());
  });

  const Icon = STYLES[estado].icon;
  const disabled = estado === "completado" || busy || pending || flushing;

  const enqueueOffline = async (
    kind: "entrada" | "salida" | "pausa_inicio" | "pausa_fin",
    geo: { lat: number; lng: number; precision: number } | null,
  ) => {
    await enqueue({
      kind,
      fichajeId: kind === "entrada" ? null : fichajeId,
      deviceTimestampIso: new Date().toISOString(),
      deviceMonotonicMs: monotonicNowMs(),
      geo,
    });
    toast.success("Sin conexión — guardado, se sincronizará cuando vuelva la señal");
  };

  const action = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      if (estado === "sin-fichar") {
        const geo = await tryGetGeo();
        if (!online) {
          await enqueueOffline("entrada", geo);
        } else {
          const res = await ficharEntradaPersonal(geo);
          if (!res.ok) toast.error(res.error || "No se pudo fichar la entrada");
          else toast.success("Entrada registrada");
        }
      } else if (estado === "trabajando" && fichajeId) {
        const geo = await tryGetGeo();
        if (!online) {
          await enqueueOffline("salida", geo);
        } else {
          const res = await ficharSalidaPersonal(fichajeId, geo);
          if (!res.ok) toast.error(res.error || "No se pudo fichar la salida");
          else toast.success("Salida registrada");
        }
      } else if (estado === "pausa" && fichajeId) {
        if (!online) {
          await enqueueOffline("pausa_fin", null);
        } else {
          const res = await finalizarPausaPersonal(fichajeId);
          if (!res.ok) toast.error(res.error || "No se pudo reanudar");
          else toast.success("Pausa finalizada");
        }
      }
    } finally {
      setBusy(false);
      startTransition(() => router.refresh());
    }
  };

  const onPausar = async () => {
    if (!fichajeId || estado !== "trabajando" || busy) return;
    setBusy(true);
    try {
      if (!online) {
        await enqueueOffline("pausa_inicio", null);
      } else {
        const res = await iniciarPausaPersonal(fichajeId);
        if (!res.ok) toast.error(res.error || "No se pudo iniciar pausa");
        else toast.success("En pausa");
      }
    } finally {
      setBusy(false);
      startTransition(() => router.refresh());
    }
  };

  return (
    <div className="px-5 pt-3">
      {(!online || pendingOffline > 0) && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span className="flex items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5" />
            {!online ? "Sin conexión" : "Sincronizando…"}
          </span>
          {pendingOffline > 0 && (
            <span className="font-semibold">
              {pendingOffline} pendiente{pendingOffline === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={action}
        disabled={disabled}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-3xl py-9 text-lg font-semibold shadow-lg transition-transform",
          STYLES[estado].bg,
          !disabled && "active:scale-[0.98]",
          disabled && "opacity-90",
        )}
      >
        {busy || pending ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <Icon className="h-10 w-10" strokeWidth={2.2} />
        )}
        <span className="tracking-wide">{STYLES[estado].label}</span>
      </button>

      {estado === "trabajando" && fichajeId && (
        <button
          type="button"
          onClick={onPausar}
          disabled={busy || pending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-medium text-muted-foreground active:bg-muted"
        >
          <Coffee className="h-4 w-4" /> Iniciar pausa
        </button>
      )}
    </div>
  );
}
