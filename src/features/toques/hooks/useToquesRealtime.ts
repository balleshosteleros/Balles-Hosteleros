"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/client";

interface MovimientoPayload {
  id: string;
  user_id: string;
  toques: number;
  origen: string;
  motivo: string;
  fecha: string;
}

/**
 * Suscribe al usuario a inserts en `toques_movimientos` y muestra un toast.
 * RLS limita lo que ve, pero filtramos por `user_id` además para eficiencia.
 */
export function useToquesRealtime(userId: string | null, onNewMovement?: () => void) {
  const onNewMovementRef = useRef(onNewMovement);
  onNewMovementRef.current = onNewMovement;

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`toques-mov-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "toques_movimientos",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: unknown }) => {
          const m = payload.new as MovimientoPayload | null;
          if (!m) return;
          const positivo = m.toques > 0;
          const titulo = positivo
            ? `+${m.toques} point${Math.abs(m.toques) === 1 ? "" : "s"}`
            : `${m.toques} points`;
          toast(titulo, {
            description: m.motivo || m.origen,
            icon: createElement(Trophy, { className: "h-4 w-4 text-amber-500" }),
            duration: 5000,
          });
          onNewMovementRef.current?.();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
