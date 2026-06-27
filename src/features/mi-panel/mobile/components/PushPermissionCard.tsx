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

export function PushPermissionCard() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    // iOS: los push (y por tanto que suenen las llamadas) solo funcionan con la PWA
    // instalada en la pantalla de inicio. Mientras no lo esté, el navegador ni siquiera
    // expone Notification/PushManager, así que NO se puede gatear por isPushSupported():
    // hay que mostrar el aviso de instalar igualmente.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const iosNeedsInstall = isIOS && !isStandalone();

    if (iosNeedsInstall) {
      setNeedsInstall(true);
    } else {
      // Resto de plataformas: si no hay soporte de push, no hay nada que ofrecer.
      if (!isPushSupported()) return;
      const permission = getPushPermission();
      if (permission === "granted" || permission === "denied") return;
    }

    // Sin avisos activados las llamadas no suenan, así que insistimos cada vez:
    // el botón de cerrar solo oculta la tarjeta en esta visita, vuelve a salir al entrar.
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
    // Solo se oculta en esta visita; al volver a entrar reaparece hasta que active los avisos.
    setVisible(false);
  };

  if (!visible) return null;

  if (needsInstall) {
    return (
      <div className="mx-5 mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-100">
            Activa las llamadas y avisos
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-100/80">
            En iPhone, para que te suenen las llamadas y lleguen los avisos tienes que añadir
            esta app a tu pantalla de inicio: toca <strong>Compartir</strong> →{" "}
            <strong>Añadir a inicio</strong>. Después ábrela desde el icono y activa los avisos.
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
        <p className="text-sm font-medium">Activar llamadas y avisos</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Necesario para que te suenen las llamadas de tus compañeros, y para avisarte cuando
          aprueben tu solicitud, llegue un comunicado o cambie tu turno.
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
