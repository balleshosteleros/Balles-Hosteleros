"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getDeviceId,
  getExistingPushEndpoint,
  getPushPermission,
  isPushSupported,
  subscribeForPush,
} from "@/features/mi-panel/mobile/lib/push-client";
import {
  isPushSubscriptionSaved,
  savePushSubscription,
} from "@/features/mi-panel/actions/push-subscription-actions";

// Aplazamiento tras un "Ahora no": no se vuelve a ofrecer hasta pasada una semana.
const POSPUESTO_KEY = "bh_push_escritorio_pospuesto";
const DIAS_ESPERA = 7;

/**
 * Reguarda en servidor la suscripción viva de este navegador, sin preguntar nada.
 *
 * Solo se llama con el permiso ya concedido y el aparato ya de alta: sirve para
 * que una renovación de endpoint hecha por el navegador no deje la fila de la BD
 * apuntando a una suscripción muerta. `savePushSubscription` desactiva por
 * `device_id` las filas viejas del mismo aparato, así que esto no acumula filas.
 */
async function refrescarSuscripcion(): Promise<void> {
  try {
    const sub = await subscribeForPush();
    if (!sub) return;
    await savePushSubscription({
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      userAgent: navigator.userAgent,
      deviceLabel: "Ordenador",
      deviceId: getDeviceId() ?? undefined,
    });
  } catch {
    /* silencioso: es mantenimiento en segundo plano, no una acción del usuario */
  }
}

/**
 * Ofrece activar los avisos del sistema en el ORDENADOR.
 *
 * Diferencias deliberadas con la tarjeta del móvil (PushPermissionCard):
 *
 *  - Tono: en el móvil los avisos son obligatorios (sin ellos las llamadas
 *    internas no suenan). En escritorio NO lo son —están la campana y los
 *    toasts del chat—, así que aquí se ofrece la ventaja real (enterarte con
 *    Balles detrás de otra ventana) en vez de exigirlo.
 *  - Insistencia: el móvil reaparece en cada visita. Aquí un "Ahora no" se
 *    respeta una semana, porque si el usuario acaba dándole a "Bloquear" en el
 *    navegador ya NO se puede volver a preguntar nunca más desde la app.
 */
export function PushEscritorioAviso() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelado = false;

    void (async () => {
      if (!isPushSupported()) return;

      // Denegado: el navegador ya no deja volver a preguntar desde la app.
      const permission = getPushPermission();
      if (permission === "denied") return;

      // Pospuesto hace poco: no volvemos a dar la lata todavía.
      try {
        const hasta = Number(localStorage.getItem(POSPUESTO_KEY) ?? "0");
        if (Date.now() < hasta) return;
      } catch {
        /* sin localStorage: se ofrece igualmente */
      }

      // Permiso concedido NO significa dispositivo dado de alta: si el guardado
      // en servidor falló, este ordenador queda mudo. Se comprueba de verdad
      // contra la BD y solo callamos si está realmente registrado.
      if (permission === "granted") {
        const endpoint = await getExistingPushEndpoint();
        const deviceId = getDeviceId();
        if (endpoint && (await isPushSubscriptionSaved(endpoint, deviceId))) {
          // El aparato consta de alta, pero el navegador pudo haber renovado su
          // suscripción por su cuenta: entonces la fila de la BD apunta a un
          // endpoint muerto y los avisos NO llegan aunque aquí callemos. Se
          // reguarda en silencio (ya hay permiso, no se pregunta nada) para que
          // el alta siga apuntando a la suscripción viva.
          void refrescarSuscripcion();
          return;
        }
      }

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
        return;
      }
      const res = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        userAgent: navigator.userAgent,
        deviceLabel: "Ordenador",
        deviceId: getDeviceId() ?? undefined,
      });
      if (!res.ok) {
        toast.error(res.error || "No se pudo guardar la suscripción");
      } else {
        toast.success("Avisos activados en este ordenador");
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const onDismiss = () => {
    try {
      localStorage.setItem(
        POSPUESTO_KEY,
        String(Date.now() + DIAS_ESPERA * 24 * 60 * 60 * 1000),
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border bg-card p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Activa los avisos en este ordenador</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Recibe los comunicados, mensajes y llamadas aunque tengas Balles en
            segundo plano o minimizado.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="rounded-full" onClick={onAccept} disabled={busy}>
              {busy ? "Activando…" : "Activar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-muted-foreground"
              onClick={onDismiss}
            >
              Ahora no
            </Button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
