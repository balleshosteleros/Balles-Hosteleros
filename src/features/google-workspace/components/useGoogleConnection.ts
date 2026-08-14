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

/**
 * Aviso global de "la cuenta de Google activa ha cambiado".
 *
 * Cada componente que llama a `useGoogleConnection` tiene su PROPIA copia del
 * estado, leída de las cookies `g_*`. Al cambiar de cuenta el servidor
 * reescribe esas cookies, pero las copias ya montadas no se enteran: solo se
 * releían al montar o al recuperar el foco de la ventana. Resultado: el badge
 * de la barra seguía contando la cuenta ANTERIOR (marcaba 2 con la bandeja
 * nueva vacía) hasta que salías y volvías del navegador.
 */
export const GOOGLE_ACCOUNT_CHANGED_EVENT = "google-account:changed";

export function notifyGoogleAccountChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GOOGLE_ACCOUNT_CHANGED_EVENT));
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
    // Todas las copias del hook se resincronizan cuando cualquiera cambia la
    // cuenta activa, sin esperar a que la ventana pierda y recupere el foco.
    window.addEventListener(GOOGLE_ACCOUNT_CHANGED_EVENT, onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(GOOGLE_ACCOUNT_CHANGED_EVENT, onFocus);
    };
  }, [refresh]);

  // Backfill: si hay cuenta activa pero el roster está vacío (caso legacy de
  // cuentas conectadas antes del switcher multi-cuenta), llamamos al server
  // para que copie la cuenta activa al roster. Así el usuario no necesita
  // volver a pasar por Google.
  // También rehidrata tras cerrar sesión: el signout borra las cookies `g_*`,
  // pero el roster sigue en BD (`google_cuentas_usuario`). Si no hay cuenta
  // activa, /sync reactiva la guardada y el usuario no reconecta cada día.
  useEffect(() => {
    if (typeof document === "undefined") return;
    // Se llama SIEMPRE al montar: /sync es idempotente y es lo que vuelca a BD
    // las cuentas que solo viven en cookie (conectadas antes de existir la
    // persistencia). Si se salta cuando ya están en el roster, esas cuentas no
    // se respaldan nunca y se pierden al cerrar sesión.
    fetch("/api/google/sync", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.synced) refresh();
      })
      .catch(() => {});
  }, [refresh]);

  /**
   * Vincula una cuenta de Google para correo y calendario.
   *
   * Delega en `/api/google/connect`, que va DIRECTO a Google sin pasar por
   * Supabase Auth. Antes esto llamaba a `signInWithOAuth`, o sea intentaba
   * INICIAR SESIÓN en el software con el correo que solo se quería vincular:
   * si ese correo no era un usuario invitado, salía el aviso de «no tienes
   * acceso» y la vinculación no llegaba a hacerse.
   */
  const connect = useCallback(() => {
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/api/google/connect?next=${next}`;
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
      notifyGoogleAccountChanged();
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
        // Avisa al resto de copias del hook (badge de la barra, drawers…) de
        // que la cuenta activa es otra. Sin esto seguían con la anterior y el
        // contador mostraba correos de una bandeja que ya no era la visible.
        notifyGoogleAccountChanged();
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
