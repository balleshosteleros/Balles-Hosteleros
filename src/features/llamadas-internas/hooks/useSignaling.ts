"use client";

/**
 * PRP-054 · Fase 2 — Señalización WebRTC por Supabase Realtime.
 *
 * Un canal Broadcast PRIVADO por empresa (`llamadas:empresa:<uuid>`). La RLS de
 * `realtime.messages` (migración 20260606210000) garantiza que solo empleados con
 * acceso a esa empresa pueden enviar/recibir. Los mensajes son dirigidos: cada
 * uno lleva `to` (userId) y el receptor filtra los que no son para él.
 *
 * Este hook NO toca WebRTC todavía (eso es Fase 3): solo transporta señales.
 */

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useAuth } from "@/features/auth/contexts/auth-context";
import type { SignalMessage } from "@/features/llamadas-internas/types";

const EVENT = "signal";

export function useSignaling(onSignal: (msg: SignalMessage) => void) {
  const { empresaActual } = useEmpresa();
  const { user } = useAuth();
  const empresaDbId = empresaActual?.dbId ?? null;
  const userId = user?.id ?? null;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const onSignalRef = useRef(onSignal);
  onSignalRef.current = onSignal;

  useEffect(() => {
    if (!empresaDbId || !userId) return;
    const supabase = createClient();
    let active = true;
    let channel: RealtimeChannel | null = null;

    void (async () => {
      // Realtime necesita el token de sesión para autorizar el canal privado.
      const { data } = await supabase.auth.getSession();
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (!active) return;

      channel = supabase.channel(`llamadas:empresa:${empresaDbId}`, {
        config: { private: true, broadcast: { self: false, ack: false } },
      });
      channel.on("broadcast", { event: EVENT }, ({ payload }) => {
        const msg = payload as SignalMessage;
        if (msg && msg.to === userId) onSignalRef.current(msg);
      });
      channel.subscribe();
      channelRef.current = channel;
    })();

    return () => {
      active = false;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [empresaDbId, userId]);

  /** Envía una señal dirigida. `from` se rellena con el usuario actual. */
  const sendSignal = useCallback(
    async (msg: Omit<SignalMessage, "from">): Promise<boolean> => {
      const channel = channelRef.current;
      if (!channel || !userId) return false;
      const full: SignalMessage = { ...msg, from: userId };
      const res = await channel.send({ type: "broadcast", event: EVENT, payload: full });
      return res === "ok";
    },
    [userId],
  );

  return { sendSignal, ready: !!empresaDbId && !!userId };
}
