'use client'

import { useEffect, useState } from 'react'
import { resetPassword } from '@/actions/auth'

const LAST_EMAIL_KEY = 'bh:last-login-email'

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
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

    const result = await resetPassword(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-5 text-center">
        <p className="text-sm text-emerald-300">
          Revisa tu correo para ver el enlace de recuperación.
        </p>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* Email */}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
        {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
      </button>
    </form>
  )
}
