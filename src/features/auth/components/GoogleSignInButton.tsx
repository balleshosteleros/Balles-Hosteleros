'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface GoogleSignInButtonProps {
  redirectTo?: string
  label?: string
}

interface GsiCredentialResponse {
  credential?: string
}

interface GsiInitOptions {
  client_id: string
  callback: (resp: GsiCredentialResponse) => void
  nonce?: string
  ux_mode?: 'popup' | 'redirect'
  auto_select?: boolean
  use_fedcm_for_prompt?: boolean
}

// Notificación que devuelve prompt() explicando si la tarjeta One Tap se pudo
// mostrar o no (y por qué). La usamos para caer al popup solo cuando Google
// confirma que la tarjeta no va a aparecer.
interface GsiPromptNotification {
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
  isDismissedMoment: () => boolean
  getNotDisplayedReason?: () => string
  getSkippedReason?: () => string
}

interface GoogleAccountsId {
  initialize: (opts: GsiInitOptions) => void
  prompt: (cb?: (notification: GsiPromptNotification) => void) => void
  cancel: () => void
}

declare global {
  interface Window {
    google?: {
      accounts?: { id?: GoogleAccountsId }
    }
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client'

function randomNonce(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'))
  if (window.google?.accounts?.id) return Promise.resolve()
  const existing = document.querySelector(
    `script[src="${GSI_SRC}"]`,
  ) as HTMLScriptElement | null
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('gsi_error')), {
        once: true,
      })
      if (window.google?.accounts?.id) resolve()
    })
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('gsi_error'))
    document.head.appendChild(s)
  })
}

export function GoogleSignInButton({
  redirectTo,
  label = 'Continuar con Google',
}: GoogleSignInButtonProps) {
  const router = useRouter()
  const gidRef = useRef<GoogleAccountsId | null>(null)
  const nonceRawRef = useRef<string>('')
  const [fallback, setFallback] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oauthLoading, setOauthLoading] = useState(false)

  const handleOAuthFallback = useCallback(async () => {
    setOauthLoading(true)
    const supabase = createClient()
    const callbackUrl = redirectTo
      ? `${window.location.origin}/callback?next=${encodeURIComponent(redirectTo)}`
      : `${window.location.origin}/callback`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    })
    if (oauthError) {
      setError('No se pudo iniciar sesión con Google.')
      setOauthLoading(false)
    }
  }, [redirectTo])

  // Al pulsar nuestro botón NO abrimos la ventana emergente: pedimos a Google que
  // muestre la tarjeta One Tap dentro de la misma página. Solo si Google confirma
  // que no puede mostrarla (navegador sin FedCM, cooldown por descartes previos,
  // dominio no autorizado…) caemos al flujo OAuth como último recurso.
  const handleClick = useCallback(() => {
    const gid = gidRef.current
    // Todavia no ha llegado el script de Google (tarda varios segundos en redes
    // lentas). El boton NO se bloquea por eso — ver `disabled` mas abajo —, asi
    // que aqui puede entrar sin `gid`: en ese caso vamos directos al acceso
    // normal de Google. Antes el boton salia gris y con el simbolo de prohibido
    // durante ~10s nada mas abrir la pantalla, y parecia que no dejaba entrar.
    if (!gid) {
      void handleOAuthFallback()
      return
    }
    setError(null)
    gid.prompt((notification) => {
      const noSale =
        notification.isNotDisplayed() || notification.isSkippedMoment()
      if (noSale) void handleOAuthFallback()
    })
  }, [handleOAuthFallback])

  useEffect(() => {
    const rawClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!rawClientId) {
      setFallback(true)
      return
    }
    const clientId: string = rawClientId

    let cancelled = false

    async function handleCredential(resp: GsiCredentialResponse) {
      if (!resp?.credential || cancelled) return
      setBusy(true)
      setError(null)
      try {
        const r = await fetch('/api/auth/signin-google', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: resp.credential,
            nonce: nonceRawRef.current,
            redirectTo: redirectTo ?? null,
          }),
        })
        const json = (await r.json()) as
          | { ok: true; target: string }
          | { ok: false; code?: string }
        if (json.ok && typeof json.target === 'string') {
          router.replace(json.target)
          router.refresh()
          return
        }
        const code = 'code' in json && json.code ? json.code : 'auth_callback_failed'
        if (!cancelled) setBusy(false)
        router.replace(`/?error=${encodeURIComponent(code)}`)
      } catch {
        if (!cancelled) {
          setError('No se pudo iniciar sesión. Inténtalo de nuevo.')
          setBusy(false)
        }
      }
    }

    async function init() {
      try {
        await loadGsiScript()
      } catch {
        if (!cancelled) setFallback(true)
        return
      }
      if (cancelled) return

      const gid = window.google?.accounts?.id
      if (!gid) {
        setFallback(true)
        return
      }

      const raw = randomNonce()
      nonceRawRef.current = raw
      const hashed = await sha256Hex(raw)
      if (cancelled) return

      // ux_mode NO se fija a 'popup': el selector de cuenta se muestra como
      // tarjeta One Tap DENTRO de la misma página (FedCM), no en ventana aparte.
      gid.initialize({
        client_id: clientId,
        callback: handleCredential,
        nonce: hashed,
        auto_select: false,
        use_fedcm_for_prompt: true,
      })
      gidRef.current = gid

      // Mostramos la tarjeta One Tap automáticamente al cargar. Si Google decide
      // no mostrarla (navegador sin FedCM, cooldown por descartes previos,
      // dominio no autorizado…), NO forzamos el popup aquí: dejamos el botón
      // "Continuar con Google", que al pulsarlo reintenta la tarjeta y solo
      // entonces cae al OAuth como último recurso.
      //
      // EXCEPCIÓN — venimos de cerrar sesión (`?logout=1`): NO se muestra sola.
      // Reportado por Iván (05-ago): cerraba sesión, el navegador volvía al login
      // y la tarjeta de Google lo reconectaba en el acto — en iPhone, con una sola
      // cuenta, basta un toque y a veces ni eso. Parecía que "no cerraba sesión"
      // cuando en realidad se cerraba y se volvía a abrir sola. Los registros de
      // auth lo confirmaron: cero cierres y un `Login` vía /authorize→/callback.
      // Con el parámetro presente el usuario ve el login y decide él si entra.
      const vengoDeCerrarSesion =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).has("logout")

      if (!vengoDeCerrarSesion) {
        try {
          gid.prompt()
        } catch {
          // Sin FedCM / cookies bloqueadas: el usuario usa el botón.
        }
      }
    }

    init()

    return () => {
      cancelled = true
      try {
        window.google?.accounts?.id?.cancel()
      } catch {
        // ignore
      }
    }
  }, [redirectTo, router])

  if (fallback) {
    return (
      <button
        type="button"
        onClick={handleOAuthFallback}
        disabled={oauthLoading}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {oauthLoading ? 'Redirigiendo...' : label}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {/* Botón propio: al pulsarlo pedimos la tarjeta One Tap en la misma página
          (no la ventana emergente de Google). Ver handleClick. */}
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || oauthLoading}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {oauthLoading ? 'Redirigiendo...' : label}
      </button>
      {error && (
        <p className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl bg-slate-900/90 px-6 py-5 shadow-2xl ring-1 ring-white/10">
            <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-white animate-spin" />
            <p className="text-sm font-medium text-slate-100">Iniciando sesión…</p>
          </div>
        </div>
      )}
    </div>
  )
}
