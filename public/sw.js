// Service worker mínimo para PWA Balles-Hosteleros.
// Fase 2: solo permite instalación (sin cache offline; eso llega en Fase 5).
// Estrategia por defecto: NetworkOnly — passthrough sin interceptar.

const SW_VERSION = "v1-fase2";

self.addEventListener("install", (event) => {
  // Activación inmediata en primer install.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // NetworkOnly: pasamos todas las requests directamente a la red.
  // Fase 5 reemplazará este handler con cola de fichaje offline + sync.
  return;
});

// Web Push: stub para Fase 6.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    return; // payload no-JSON: ignorar silenciosamente.
  }
  const esLlamada = !!(payload.data && payload.data.callId);
  event.waitUntil(
    (async () => {
      // Si es una llamada y la app ya está visible, el timbre in-app la gestiona:
      // no mostramos también la notificación del sistema (evita doble aviso).
      if (esLlamada) {
        const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        if (wins.some((c) => c.visibilityState === "visible")) return;
      }
      await self.registration.showNotification(payload.title || "Balles", {
        body: payload.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: payload.tag || "default",
        data: payload.data || {},
        // Campos opcionales: una llamada entrante vibra, insiste y no se
        // autodescarta hasta que el usuario interactúe (estilo WhatsApp).
        requireInteraction: payload.requireInteraction === true,
        renotify: payload.renotify === true,
        vibrate: payload.vibrate || undefined,
        actions: payload.actions || undefined,
        silent: false,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/m";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      }),
  );
});
