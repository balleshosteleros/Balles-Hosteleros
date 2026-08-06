"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { toast } from "sonner";
import {
  getDeviceId,
  getExistingPushEndpoint,
  getPushPermission,
  isPushSupported,
  isStandalone,
  subscribeForPush,
} from "../lib/push-client";
import {
  isPushSubscriptionSaved,
  savePushSubscription,
} from "@/features/mi-panel/actions/push-subscription-actions";

export function PushPermissionCard() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    let cancelado = false;

    void (async () => {
      // iOS: los push (y por tanto que suenen las llamadas) solo funcionan con la PWA
      // instalada en la pantalla de inicio. Mientras no lo esté, el navegador ni siquiera
      // expone Notification/PushManager, así que NO se puede gatear por isPushSupported():
      // hay que mostrar el aviso de instalar igualmente.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const iosNeedsInstall = isIOS && !isStandalone();

      if (iosNeedsInstall) {
        if (!cancelado) {
          setNeedsInstall(true);
          setVisible(true);
        }
        return;
      }

      // Resto de plataformas: si no hay soporte de push, no hay nada que ofrecer.
      if (!isPushSupported()) return;
      const permission = getPushPermission();
      // Denegado: el navegador ya no deja volver a preguntar desde la app.
      if (permission === "denied") return;

      // Permiso concedido NO significa que el dispositivo esté dado de alta: si el
      // guardado en servidor falló, queda mudo (no le llega nada) y antes la tarjeta
      // desaparecía para siempre, sin forma de reintentar. Así que con el permiso ya
      // dado se comprueba de verdad contra la BD y solo se calla si está registrado.
      if (permission === "granted") {
        const endpoint = await getExistingPushEndpoint();
        if (endpoint && (await isPushSubscriptionSaved(endpoint))) return;
      }

      // Sin avisos activados las llamadas no suenan, así que insistimos cada vez:
      // el botón de cerrar solo oculta la tarjeta en esta visita, vuelve a salir al entrar.
      if (!cancelado) setVisible(true);
    })();

    return () => {
      cancelado = true;
    };
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
        deviceId: getDeviceId() ?? undefined,
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
      <div className="mx-5 mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
          <BellOff className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">
            Añade la app a tu pantalla de inicio
          </p>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">
            Toca <strong>Compartir</strong> → <strong>Añadir a inicio</strong> y ábrela desde el
            icono. Es necesario para usar la app.
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
    <div className="mx-5 mt-4 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bell className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Activa las notificaciones</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Son necesarias para poder usar la app.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={onAccept}
            disabled={busy}
            className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background active:opacity-80 disabled:opacity-60"
          >
            {busy ? "Activando…" : "Activar ahora"}
          </button>
          <button
            onClick={onDismiss}
            className="rounded-full px-3 py-2 text-xs font-medium text-muted-foreground active:opacity-80"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
