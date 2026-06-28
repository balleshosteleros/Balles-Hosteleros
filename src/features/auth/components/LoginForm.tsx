'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/actions/auth'
import { GoogleSignInButton } from './GoogleSignInButton'
import { AuthDivider } from './AuthDivider'

const LAST_EMAIL_KEY = 'bh:last-login-email'

const GENERIC_ACCESS_MESSAGE = 'Usuario o contraseña incorrectos.'

// Cuenta válida pero sin contraseña elegida: guiamos al empleado al correo
// "Crea tu contraseña" en lugar de ocultarlo como credencial incorrecta.
const SIN_PASSWORD_MESSAGE =
  'Tienes una cuenta, pero primero debes elegir tu contraseña. Revisa el correo «Crea tu contraseña» que te enviamos.'

// Sesión caducada por seguridad (8h en ordenador): no es un error de
// credenciales, así que lo explicamos para que el usuario sepa que es normal.
const SESION_EXPIRADA_MESSAGE =
  'Tu sesión ha caducado por seguridad. Vuelve a iniciar sesión.'

const ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed: GENERIC_ACCESS_MESSAGE,
  cuenta_inactiva: GENERIC_ACCESS_MESSAGE,
  sin_perfil: GENERIC_ACCESS_MESSAGE,
  sin_empresa: GENERIC_ACCESS_MESSAGE,
  sin_rol: GENERIC_ACCESS_MESSAGE,
  sin_password: SIN_PASSWORD_MESSAGE,
  sesion_expirada: SESION_EXPIRADA_MESSAGE,
}

export function LoginForm() {
  const searchParams = useSearchParams()
  const oauthError = searchParams.get('error')
  const passwordCreada = searchParams.get('password_creada') === '1'
  const [error, setError] = useState<string | null>(
    oauthError ? ERROR_MESSAGES[oauthError] ?? null : null,
  )
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const stored = window.localStorage.getItem(LAST_EMAIL_KEY)
    if (stored) setEmail(stored)
  }, [])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const submittedEmail = String(formData.get('email') ?? '').trim()
    if (submittedEmail) {
      window.localStorage.setItem(LAST_EMAIL_KEY, submittedEmail)
    }

    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {passwordCreada && (
        <p className="rounded-md border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          Tu contraseña ya está creada. Inicia sesión con tu correo o con Google.
        </p>
      )}

      <GoogleSignInButton />

      <AuthDivider label="o inicia sesión con tu correo" />

      <form action={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </span>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full rounded-lg border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </span>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="Contraseña"
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

        {/* Forgot password */}
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-blue-400 transition-colors hover:text-blue-300"
          >
            ¿Has olvidado tu contraseña?
          </Link>
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  )
}
