"use client";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const DEVICE_ID_KEY = "bh_push_device_id";

/**
 * Identificador estable de ESTE navegador.
 *
 * El endpoint de push no sirve para reconocer un aparato: el navegador lo renueva
 * por su cuenta y cada renovación genera uno nuevo, así que sin esto cada
 * renovación creaba una fila más y las viejas quedaban vivas para siempre
 * (6 filas para 2 aparatos reales). El user_agent tampoco vale: el mismo iPhone
 * cambia de "Safari 26.5" a "26.5.2" al actualizarse.
 *
 * Se guarda en localStorage, así que sobrevive a las renovaciones y se pierde si
 * el usuario borra los datos del navegador — que es justo cuando su suscripción
 * también muere, así que el par vuelve a nacer junto y coherente.
 */
export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const guardado = localStorage.getItem(DEVICE_ID_KEY);
    if (guardado) return guardado;
    const nuevo = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, nuevo);
    return nuevo;
  } catch {
    // Modo incógnito / almacenamiento bloqueado: sin id estable. El guardado
    // cae al comportamiento anterior (una fila por endpoint), que sigue siendo
    // correcto, solo que sin poder unir renovaciones.
    return null;
  }
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Asegura que el service worker está registrado ANTES de usar `serviceWorker.ready`.
 *
 * Ojo: `ready` no rechaza nunca, se queda colgado indefinidamente si nadie ha
 * registrado el SW. En el móvil siempre lo registra la instalación de la PWA,
 * pero en el escritorio se entra por una URL normal y no hay registro previo:
 * sin esto, activar los avisos desde el ordenador se quedaba esperando en
 * silencio para siempre.
 */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const existente = await navigator.serviceWorker.getRegistration();
    if (existente) return existente;
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

/**
 * Endpoint de la suscripción que YA tiene este navegador, sin pedir permiso ni
 * crear ninguna. Sirve para comprobar contra el servidor si este dispositivo
 * está realmente dado de alta, o si solo tiene el permiso concedido "a medias".
 */
export async function getExistingPushEndpoint(): Promise<string | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await ensureServiceWorker();
    if (!reg) return null;
    const sub = await reg.pushManager.getSubscription();
    return sub?.endpoint ?? null;
  } catch {
    return null;
  }
}

export async function subscribeForPush(): Promise<{
  endpoint: string;
  p256dh: string;
  auth: string;
} | null> {
  if (!isPushSupported() || !VAPID_PUBLIC) return null;

  // El registro va ANTES de pedir permiso: si el SW no se puede registrar, no
  // tiene sentido quemar la única pregunta que el navegador nos deja hacer.
  const reg = await ensureServiceWorker();
  if (!reg) return null;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = urlBase64ToUint8Array(VAPID_PUBLIC);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer as ArrayBuffer,
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;

  return {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  };
}

export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const reg = await ensureServiceWorker();
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
