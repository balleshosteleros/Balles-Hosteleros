"use client";

/**
 * Botón «Entrar con Google» del portal del alumno.
 *
 * Es el mismo gesto que el del software, pero por dentro no tiene nada que ver:
 * aquí NO se crea ninguna cuenta. Google solo dice qué correo es, y con ese
 * correo se busca al alumno. Por eso no hay respaldo por OAuth de Supabase — ese
 * camino daría de alta como usuario del sistema a cualquiera que pulsara.
 *
 * Si Google no puede enseñar su tarjeta (navegador antiguo, cookies bloqueadas,
 * el propio Google en pausa tras varios descartes), no se deja al alumno tirado:
 * se le dice que use el código por correo, que sigue debajo.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { entrarConGoogle } from "../../actions/portal-actions";

interface RespuestaGsi {
  credential?: string;
}

interface AvisoGsi {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
}

interface GoogleId {
  initialize: (opts: {
    client_id: string;
    callback: (r: RespuestaGsi) => void;
    nonce?: string;
    auto_select?: boolean;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  prompt: (cb?: (aviso: AvisoGsi) => void) => void;
  cancel: () => void;
}

/**
 * `window.google` ya lo declara el botón del software. Se lee con un ayudante en
 * vez de volver a declararlo: dos declaraciones del mismo global con formas
 * distintas no compilan.
 */
function googleId(): GoogleId | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { google?: { accounts?: { id?: GoogleId } } };
  return w.google?.accounts?.id ?? null;
}

const GSI = "https://accounts.google.com/gsi/client";

function nonceAlAzar(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cargarGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (googleId()) return Promise.resolve();
  const ya = document.querySelector(`script[src="${GSI}"]`) as HTMLScriptElement | null;
  if (ya) {
    return new Promise((resolve, reject) => {
      ya.addEventListener("load", () => resolve(), { once: true });
      ya.addEventListener("error", () => reject(new Error("gsi")), { once: true });
      if (googleId()) resolve();
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GSI;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gsi"));
    document.head.appendChild(s);
  });
}

export function GoogleAlumno({ onError }: { onError: (mensaje: string) => void }) {
  const router = useRouter();
  const idRef = useRef<GoogleId | null>(null);
  const nonceRef = useRef("");
  const [entrando, setEntrando] = useState(false);
  const [disponible, setDisponible] = useState(true);

  const pulsar = useCallback(() => {
    const gid = idRef.current;
    if (!gid) {
      onError("Google está tardando. Entra con el código que te mandamos por correo.");
      return;
    }
    gid.prompt((aviso) => {
      if (aviso.isNotDisplayed() || aviso.isSkippedMoment()) {
        onError("Google no ha podido abrirse. Entra con el código que te mandamos por correo.");
      }
    });
  }, [onError]);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setDisponible(false);
      return;
    }
    let cancelado = false;

    async function conCredencial(r: RespuestaGsi) {
      if (!r?.credential || cancelado) return;
      setEntrando(true);
      const res = await entrarConGoogle(r.credential, nonceRef.current);
      if (cancelado) return;
      if (!res.ok) {
        setEntrando(false);
        onError(res.error ?? "No se pudo entrar con Google.");
        return;
      }
      router.refresh();
    }

    (async () => {
      try {
        await cargarGsi();
      } catch {
        if (!cancelado) setDisponible(false);
        return;
      }
      const gid = googleId();
      if (!gid || cancelado) {
        if (!cancelado) setDisponible(false);
        return;
      }
      const crudo = nonceAlAzar();
      nonceRef.current = crudo;
      const cifrado = await sha256Hex(crudo);
      if (cancelado) return;
      gid.initialize({
        client_id: clientId as string,
        callback: conCredencial,
        nonce: cifrado,
        auto_select: false,
        use_fedcm_for_prompt: true,
      });
      idRef.current = gid;
    })();

    return () => {
      cancelado = true;
      try {
        googleId()?.cancel();
      } catch {
        // Da igual: la pantalla se está cerrando.
      }
    };
  }, [onError, router]);

  if (!disponible) return null;

  return (
    <button
      type="button"
      onClick={pulsar}
      disabled={entrando}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-black/10 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      {entrando ? "Entrando…" : "Entrar con Google"}
    </button>
  );
}
