"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { toast } from "sonner";
import {
  getPushPermission,
  isPushSupported,
  isStandalone,
  subscribeForPush,
} from "../lib/push-client";
import { savePushSubscription } from "@/features/mi-panel/actions/push-subscription-actions";

const DISMISS_KEY = "bh_push_dismissed_at";
const DISMISS_DAYS = 14;

export function PushPermissionCard() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;

    const permission = getPushPermission();
    if (permission === "granted" || permission === "denied") return;

    // iOS: solo se pueden recibir push si la PWA está instalada (standalone)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = isStandalone();
    if (isIOS && !standalone) {
      // Mostrar solo el aviso de instalación
      setNeedsInstall(true);
    }

    // No mostrar si la persona lo descartó hace poco
    try {
      const ts = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
      if (ts > 0 && Date.now() - ts < DISMISS_DAYS * 86_400_000) return;
    } catch {
      /* localStorage no disponible */
    }

    setVisible(true);
  }, []);

  const onAccept = async () => {
    setBusy(true);
    try {
      const sub = await subscribeForPush();
      if (!sub) {
        toast.error(
          "No se pudieron activar los avisos (¿permiso bloqueado en el navegador?)",
        );
        setBusy(false);
        return;
      }
      const res = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        userAgent: navigator.userAgent,
      });
      if (!res.ok) {
        toast.error(res.error || "No se pudo guardar la suscripción");
      } else {
        toast.success("Avisos activados");
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const onDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignorar */
    }
    setVisible(false);
  };

  if (!visible) return null;

  if (needsInstall) {
    return (
      <div className="mx-5 mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-100">
            Activa los avisos
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-100/80">
            En iPhone los avisos solo llegan si añades esta app a tu pantalla de inicio:
            toca <strong>Compartir</strong> → <strong>Añadir a inicio</strong>.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-amber-700/70 active:text-amber-900"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-5 mt-4 flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Activar avisos</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Te avisamos cuando aprueben tu solicitud, llegue un comunicado o cambie tu turno.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={onAccept}
            disabled={busy}
            className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background active:opacity-80"
          >
            {busy ? "Activando…" : "Activar"}
          </button>
          <button
            onClick={onDismiss}
            className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground active:opacity-80"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
