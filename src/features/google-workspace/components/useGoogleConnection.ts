"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Lee el estado de conexión con Google y el roster multi-cuenta.
 *
 * El callback de Supabase guarda los tokens en cookies httpOnly y los datos
 * "públicos" del usuario en cookies no-httpOnly (`g_email`, `g_picture`,
 * `g_name`). Adicionalmente mantiene un roster de todas las cuentas
 * conectadas en `g_accounts_meta` (sin refresh tokens, solo metadata).
 */
export type CuentaGoogle = {
  email: string;
  name: string;
  picture: string;
};

function leerCookie(nombre: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${nombre}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.split("=")[1] ?? "");
  return value || null;
}

function leerRoster(): CuentaGoogle[] {
  const raw = leerCookie("g_accounts_meta");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CuentaGoogle[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useGoogleConnection() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<CuentaGoogle[]>([]);
  const [switching, setSwitching] = useState(false);

  const refresh = useCallback(() => {
    const correo = leerCookie("g_email");
    setEmail(correo);
    setConnected(!!correo);
    setPicture(leerCookie("g_picture"));
    setName(leerCookie("g_name"));
    setAccounts(leerRoster());
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // Backfill: si hay cuenta activa pero el roster está vacío (caso legacy de
  // cuentas conectadas antes del switcher multi-cuenta), llamamos al server
  // para que copie la cuenta activa al roster. Así el usuario no necesita
  // volver a pasar por Google.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const correo = leerCookie("g_email");
    if (!correo) return;
    const roster = leerRoster();
    if (roster.some((a) => a.email.toLowerCase() === correo.toLowerCase())) {
      return;
    }
    fetch("/api/google/sync", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.synced) refresh();
      })
      .catch(() => {});
  }, [refresh]);

  const connect = useCallback(async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback?next=${window.location.pathname}`,
        scopes: [
          "email",
          "profile",
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/gmail.settings.basic",
          "https://www.googleapis.com/auth/calendar.readonly",
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/contacts.readonly",
          "https://www.googleapis.com/auth/contacts.other.readonly",
        ].join(" "),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  }, []);

  const disconnect = useCallback(
    async (correo?: string) => {
      const res = await fetch("/api/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: correo ? JSON.stringify({ email: correo }) : "{}",
      });
      // Refrescamos desde cookies: el server ya dejó el estado correcto
      // (puede haber promovido otra cuenta como activa).
      refresh();
      return res.ok;
    },
    [refresh],
  );

  /**
   * Cambia de cuenta sin volver a logear. Si Google rechaza el refresh
   * token guardado (consentimiento revocado, etc.), recarga el roster y
   * devuelve false para que la UI invite a reconectar.
   */
  const switchTo = useCallback(
    async (correo: string) => {
      if (correo.toLowerCase() === (email ?? "").toLowerCase()) return true;
      setSwitching(true);
      try {
        const res = await fetch("/api/google/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: correo }),
        });
        refresh();
        return res.ok;
      } finally {
        setSwitching(false);
      }
    },
    [email, refresh],
  );

  return {
    connected,
    email,
    picture,
    name,
    accounts,
    switching,
    connect,
    disconnect,
    switchTo,
    refresh,
  };
}
