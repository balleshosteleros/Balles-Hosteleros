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
  try {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || "Balles", {
        body: payload.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: payload.tag || "default",
        data: payload.data || {},
      }),
    );
  } catch (e) {
    // payload no-JSON: ignorar silenciosamente.
  }
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
