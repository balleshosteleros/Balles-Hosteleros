"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { refreshDailyCounts } from "@/features/google-workspace/components/useDailyCounts";
import { listCanales } from "@/features/comunicacion/actions/comunicacion-actions";

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

// Pitido sintético corto con Web Audio API — sin archivos ni descargas.
let audioCtx: AudioContext | null = null;
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
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880; // La5, "bip" nítido
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    /* audio no disponible: el toast visual sigue funcionando */
  }
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
      canalAbiertoRef.current = (e as CustomEvent<string | null>).detail ?? null;
    };
    window.addEventListener(CHAT_CANAL_ABIERTO_EVENT, onCanalAbierto);
    return () => window.removeEventListener(CHAT_CANAL_ABIERTO_EVENT, onCanalAbierto);
  }, []);

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
          toast(nombre ? `${autor} · ${nombre}` : autor, {
            description: resumenTexto(m),
            duration: 6000,
          });
          reproducirPitido();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, empresaId, cargarNombres]);
}
