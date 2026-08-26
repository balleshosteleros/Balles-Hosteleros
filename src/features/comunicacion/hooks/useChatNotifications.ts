"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { refreshDailyCounts } from "@/features/google-workspace/components/useDailyCounts";
import {
  listCanales,
  contarMensajesSinLeer,
} from "@/features/comunicacion/actions/comunicacion-actions";

interface MensajePayload {
  id: string;
  canal_id: string;
  autor_id: string | null;
  autor_nombre: string | null;
  texto: string | null;
  adjunto_tipo: string | null;
}

// Evento global que despacha el ChatDrawer al abrir/leer un canal para que otros
// consumidores (badge, hook) se refresquen sin recargar. Reutiliza el bus de
// refreshDailyCounts, pero exponemos también el canal activo por un ref global
// para poder silenciar el toast del canal que el usuario está mirando.
const CHAT_CANAL_ABIERTO_EVENT = "chat:canal-abierto";

/** El ChatDrawer avisa qué canal tiene abierto (o null si está cerrado). */
export function setChatCanalAbierto(canalId: string | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_CANAL_ABIERTO_EVENT, { detail: canalId }));
}

// Pitido sintético con Web Audio API — sin archivos ni descargas.
//
// Antes era UN solo seno a volumen 0,18: en un portátil con música de fondo o
// en una cocina no se oía. Ahora suena un aviso de DOS notas (como el de un
// móvil), mucho más alto y con un armónico encima para que corte por encima del
// ruido: un seno puro es la onda que peor se percibe a igualdad de volumen.
let audioCtx: AudioContext | null = null;

/** Una nota del aviso: fundamental + quinta, con ataque rápido. */
function nota(ctx: AudioContext, freq: number, inicio: number, dur: number, vol: number) {
  for (const [mult, peso] of [
    [1, 1],
    [2, 0.45], // armónico: da "cuerpo" y hace que se oiga más sin distorsionar
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Triangular en vez de senoidal: más presencia con el mismo volumen.
    osc.type = "triangle";
    osc.frequency.value = freq * mult;
    const t = ctx.currentTime + inicio;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol * peso, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

function reproducirPitido() {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    const ctx = audioCtx;
    // Algunos navegadores suspenden el contexto hasta la 1ª interacción.
    if (ctx.state === "suspended") void ctx.resume();
    // Dos notas ascendentes (Do#6 → Mi6): patrón reconocible de "mensaje".
    nota(ctx, 1109, 0, 0.16, 0.75);
    nota(ctx, 1319, 0.13, 0.3, 0.85);
  } catch {
    /* audio no disponible: el toast visual sigue funcionando */
  }
}

// ───────── Aviso del sistema (fuera del navegador) ─────────
//
// El toast solo se ve si el software está delante. Con esto salta el aviso
// nativo del sistema operativo (esquina del escritorio en Windows/Mac) aunque
// estés en otra pestaña o en otro programa, que es donde antes se perdía.

/** Pide permiso de avisos una sola vez, sin molestar si ya se decidió. */
export function pedirPermisoAvisosEscritorio(): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

function avisoEscritorio(titulo: string, cuerpo: string, canalId: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  // Si la pestaña está delante y visible, el toast ya cumple: no duplicamos.
  if (document.visibilityState === "visible") return;
  try {
    const n = new Notification(titulo, {
      body: cuerpo,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Un aviso por canal: los mensajes seguidos del mismo grupo se sustituyen
      // en vez de apilar diez globos en el escritorio.
      tag: `chat-${canalId}`,
      renotify: true,
    } as NotificationOptions & { renotify?: boolean });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* el navegador puede bloquearlo: el toast y el pitido siguen */
  }
}

// ───────── Punto verde en el icono de la barra de tareas ─────────
//
// Pinta el isotipo del chat con un punto verde encima y lo pone como favicon,
// que es el icono que se ve en la pestaña y en la barra de tareas. Así se nota
// que hay mensaje sin tener que entrar al software.

const FAVICON_ID = "bh-favicon-dinamico";
let faviconOriginal: string | null = null;

function getFaviconLink(): HTMLLinkElement | null {
  if (typeof document === "undefined") return null;
  let link = document.getElementById(FAVICON_ID) as HTMLLinkElement | null;
  if (link) return link;
  const existente = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (existente && faviconOriginal === null) faviconOriginal = existente.href;
  link = document.createElement("link");
  link.id = FAVICON_ID;
  link.rel = "icon";
  document.head.appendChild(link);
  return link;
}

/**
 * Dibuja el logotipo con (o sin) el punto verde de "mensaje nuevo".
 * Se usa también el Badging API cuando el navegador lo soporta: en Windows y
 * Mac eso pinta el globo directamente sobre el icono de la barra de tareas.
 */
function pintarFavicon(conPunto: boolean): void {
  if (typeof document === "undefined") return;

  // Badge nativo del sistema (PWA instalada / Chrome escritorio).
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (conPunto) void nav.setAppBadge?.().catch(() => {});
  else void nav.clearAppBadge?.().catch(() => {});

  const link = getFaviconLink();
  if (!link) return;

  const img = new Image();
  img.onload = () => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, size, size);
    if (conPunto) {
      // Punto verde abajo a la derecha, con borde blanco para que se despegue
      // del logotipo sea cual sea su color.
      const r = size * 0.22;
      const cx = size - r - 2;
      const cy = size - r - 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e"; // verde "en línea"
      ctx.fill();
    }
    link.href = canvas.toDataURL("image/png");
  };
  img.onerror = () => {
    /* sin logotipo cargable: dejamos el favicon como estaba */
  };
  img.src = "/icons/icon-192.png";
}

/** Quita el punto verde (el usuario ya ha visto el chat). */
export function limpiarAvisoVisual(): void {
  pintarFavicon(false);
}

function resumenTexto(m: MensajePayload): string {
  if (m.texto && m.texto.trim()) return m.texto.trim();
  switch (m.adjunto_tipo) {
    case "imagen":
      return "📷 Foto";
    case "audio":
      return "🎤 Mensaje de voz";
    case "archivo":
      return "📎 Archivo";
    default:
      return "Nuevo mensaje";
  }
}

/**
 * Suscripción global a mensajes nuevos del chat. Se monta una vez en el layout.
 * Por cada mensaje entrante que NO sea del propio usuario:
 *   - muestra un toast (abajo a la derecha) + pitido de aviso,
 *   - refresca el badge de mensajes sin leer.
 * No dispara toast si el usuario tiene ese mismo canal abierto en el chat.
 *
 * @param userId    usuario actual (para excluir los mensajes propios)
 * @param empresaId empresa activa (re-suscribe al cambiar de empresa)
 */
export function useChatNotifications(userId: string | null, empresaId: string | null) {
  const canalAbiertoRef = useRef<string | null>(null);
  // Caché canalId → nombre para el título del toast (se rellena una vez al montar).
  const nombresRef = useRef<Record<string, string>>({});

  const cargarNombres = useCallback(async () => {
    if (!empresaId) return;
    try {
      const res = await listCanales(empresaId);
      if (!res.ok) return;
      const map: Record<string, string> = {};
      for (const c of res.data as Array<{ id: string; nombre: string }>) {
        map[c.id] = c.nombre;
      }
      nombresRef.current = map;
    } catch {
      /* si falla, el toast sale sin nombre de canal */
    }
  }, [empresaId]);

  useEffect(() => {
    const onCanalAbierto = (e: Event) => {
      const canalId = (e as CustomEvent<string | null>).detail ?? null;
      canalAbiertoRef.current = canalId;
      // Al abrir un grupo el usuario ya está al tanto: fuera el punto verde.
      if (canalId) limpiarAvisoVisual();
    };
    window.addEventListener(CHAT_CANAL_ABIERTO_EVENT, onCanalAbierto);
    return () => window.removeEventListener(CHAT_CANAL_ABIERTO_EVENT, onCanalAbierto);
  }, []);

  // Pedimos el permiso de avisos del sistema una sola vez, al montar el layout.
  useEffect(() => {
    if (!userId) return;
    pedirPermisoAvisosEscritorio();
  }, [userId]);

  // El punto verde debe reflejar si QUEDAN mensajes sin leer de verdad, no solo
  // si llegó uno mientras esta pestaña estaba abierta: si los lees en el móvil,
  // el ordenador tiene que enterarse. Lo sincronizamos al montar y cada vez que
  // la pestaña vuelve a primer plano.
  useEffect(() => {
    if (!userId || !empresaId) return;
    let vivo = true;
    const sincronizar = async () => {
      try {
        const res = await contarMensajesSinLeer();
        if (!vivo) return;
        pintarFavicon((res.data?.totalGrupos ?? 0) > 0);
      } catch {
        /* si falla, el punto se queda como esté */
      }
    };
    void sincronizar();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sincronizar();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, empresaId]);

  useEffect(() => {
    if (!userId || !empresaId) return;
    void cargarNombres();
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-notif-${userId}-${empresaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        (payload: { new: unknown }) => {
          const m = payload.new as MensajePayload | null;
          if (!m) return;
          // Mensaje propio → nunca notifica.
          if (m.autor_id && m.autor_id === userId) return;

          // Siempre refresca el badge (aunque el toast se suprima).
          refreshDailyCounts();

          // Si el usuario está mirando justo ese canal, no lanzamos toast/pitido.
          if (canalAbiertoRef.current && canalAbiertoRef.current === m.canal_id) return;

          const nombre = nombresRef.current[m.canal_id];
          const autor = (m.autor_nombre ?? "").trim() || "Nuevo mensaje";
          const titulo = nombre ? `${autor} · ${nombre}` : autor;
          const cuerpo = resumenTexto(m);
          toast(titulo, { description: cuerpo, duration: 6000 });
          reproducirPitido();
          // Aviso del sistema (si estás en otra pestaña/programa) + punto verde
          // en el icono de la barra de tareas.
          avisoEscritorio(titulo, cuerpo, m.canal_id);
          pintarFavicon(true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, empresaId, cargarNombres]);
}
