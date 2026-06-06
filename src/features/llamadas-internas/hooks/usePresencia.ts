"use client";

/**
 * PRP-054 · Fase 2 — Presencia: quién está conectado en la empresa.
 *
 * Canal Presence PRIVADO por empresa (`llamadas:presencia:<uuid>`), autorizado por
 * la misma RLS de `realtime.messages`. Cada cliente publica (track) su userId,
 * nombre y avatar; el hook devuelve la lista de conectados en tiempo real para
 * pintar el directorio de llamables con su estado.
 */

import { useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useAuth } from "@/features/auth/contexts/auth-context";
import type { PresenciaUsuario } from "@/features/llamadas-internas/types";

export function usePresencia() {
  const { empresaActual } = useEmpresa();
  const { user, profile } = useAuth();
  const empresaDbId = empresaActual?.dbId ?? null;
  const userId = user?.id ?? null;
  const nombre = `${profile?.nombre ?? ""} ${profile?.apellidos ?? ""}`.trim() || "Empleado";
  const avatarUrl = profile?.avatar_url ?? null;

  const [conectados, setConectados] = useState<PresenciaUsuario[]>([]);

  useEffect(() => {
    if (!empresaDbId || !userId) {
      setConectados([]);
      return;
    }
    const supabase = createClient();
    let active = true;
    let channel: RealtimeChannel | null = null;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (!active) return;

      channel = supabase.channel(`llamadas:presencia:${empresaDbId}`, {
        config: { private: true, presence: { key: userId } },
      });

      channel.on("presence", { event: "sync" }, () => {
        if (!channel) return;
        const state = channel.presenceState<PresenciaUsuario>();
        const lista: PresenciaUsuario[] = [];
        for (const key of Object.keys(state)) {
          const metas = state[key];
          if (metas && metas[0]) {
            lista.push({
              userId: metas[0].userId,
              nombre: metas[0].nombre,
              avatarUrl: metas[0].avatarUrl ?? null,
              onlineAt: metas[0].onlineAt,
            });
          }
        }
        setConectados(lista);
      });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" && channel) {
          void channel.track({ userId, nombre, avatarUrl, onlineAt: new Date().toISOString() });
        }
      });
    })();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [empresaDbId, userId, nombre, avatarUrl]);

  const conectadosIds = useMemo(() => new Set(conectados.map((c) => c.userId)), [conectados]);

  return { conectados, conectadosIds };
}
