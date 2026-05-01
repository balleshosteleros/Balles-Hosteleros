"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Lee el estado de conexión con Google.
 *
 * El callback de Supabase guarda los tokens en cookies httpOnly y el email
 * del usuario en una cookie no-httpOnly llamada `g_email`. Aquí leemos esa
 * cookie para saber si está conectado.
 */
export function useGoogleConnection() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (typeof document === "undefined") return;
    const match = document.cookie
      .split("; ")
      .find((c) => c.startsWith("g_email="));
    if (match) {
      const value = decodeURIComponent(match.split("=")[1] ?? "");
      setEmail(value || null);
      setConnected(!!value);
    } else {
      setConnected(false);
      setEmail(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Si el usuario vuelve del OAuth, refresca al recuperar foco
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const connect = useCallback(async () => {
    // Importación dinámica del cliente Supabase para evitar hydration issues
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback?next=${window.location.pathname}`,
        scopes: [
          "email",
          "profile",
          "https://mail.google.com/",
          "https://www.googleapis.com/auth/gmail.settings.basic",
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/calendar.events",
        ].join(" "),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  }, []);

  const disconnect = useCallback(async () => {
    await fetch("/api/google/disconnect", { method: "POST" });
    setConnected(false);
    setEmail(null);
  }, []);

  return { connected, email, connect, disconnect, refresh };
}
