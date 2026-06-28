'use client'

import { useEffect, useState } from 'react'
import { updatePassword } from '@/actions/auth'
import { createClient } from '@/lib/supabase/client'

/**
 * Esta pantalla SOLO debe permitir cambiar la contraseña cuando se llega desde
 * un enlace de correo (recuperación o alta inicial). Supabase emite el evento
 * `PASSWORD_RECOVERY` al canjear ese enlace. Si un usuario YA logueado abre esta
 * URL (p.ej. un enlace viejo o tecleando la dirección), NO debe poder cambiar su
 * contraseña por error: bloqueamos el formulario hasta confirmar el recovery.
 */
export function UpdatePasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // null = comprobando; true = vino de enlace de correo; false = sesión normal.
  const [esRecovery, setEsRecovery] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setEsRecovery(false)
      return
    }

    // Si el enlace de correo es válido, Supabase dispara PASSWORD_RECOVERY al
    // procesar el hash de la URL. Solo entonces habilitamos el formulario.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') setEsRecovery(true)
      },
    )

    // Margen para que se procese el enlace; si no llegó el evento, es una
    // sesión normal (o sin sesión) → bloqueamos.
    const t = setTimeout(() => {
      setEsRecovery((prev) => (prev === null ? false : prev))
    }, 2500)

    return () => {
      subscription.unsubscribe()
      clearTimeout(t)
    }
  }, [])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await updatePassword(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  if (esRecovery === null) {
    return (
      <p className="text-sm text-slate-400">Validando el enlace…</p>
    )
  }

  if (esRecovery === false) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-amber-900/50 bg-amber-950/40 px-3 py-3 text-sm text-amber-200">
          Este enlace no es válido o ha caducado. Para cambiar tu contraseña,
          solicita un correo nuevo desde <strong>«¿Has olvidado tu contraseña?»</strong>.
        </p>
        <a
          href="/forgot-password"
          className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-blue-500"
        >
          Solicitar enlace nuevo
        </a>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </span>
        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          required
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          minLength={6}
          autoComplete="new-password"
          placeholder="Contraseña: 6 dígitos (ej. 042815)"
          className="block w-full rounded-lg border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-11 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 transition-colors hover:text-slate-300"
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {showPassword ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        6 dígitos numéricos. Fácil de recordar y de teclear. La necesitarás para
        entrar y para ver datos protegidos.
      </p>

      {error && (
        <p className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Guardando...' : 'Guardar contraseña'}
      </button>
    </form>
  )
}
