'use client'

import { useEffect, useState } from 'react'
import { loginAsDemo } from '@/actions/auth'

const LAST_EMAIL_KEY = 'bh:last-login-email'

export function DemoLoginForm() {
  const [error, setError] = useState<string | null>(null)
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

    const result = await loginAsDemo(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-900/40 bg-blue-950/30 px-4 py-3 text-sm text-blue-200">
        Rellena tus datos para entrar al demo. Podrás navegar por todo el
        software como si fueras un cliente real. Nada de lo que introduzcas
        aquí se guarda.
      </div>

      <form action={handleSubmit} className="space-y-4">
        {/* Nombre */}
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
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
          </span>
          <input
            id="demo-nombre"
            name="nombre"
            type="text"
            required
            minLength={2}
            autoComplete="name"
            placeholder="Nombre y apellidos"
            className="block w-full rounded-lg border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Empresa */}
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
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
              />
            </svg>
          </span>
          <input
            id="demo-empresa"
            name="empresa"
            type="text"
            required
            minLength={2}
            autoComplete="organization"
            placeholder="Nombre del restaurante o empresa"
            className="block w-full rounded-lg border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

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
            id="demo-email"
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

        {/* Teléfono */}
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
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
              />
            </svg>
          </span>
          <input
            id="demo-telefono"
            name="telefono"
            type="tel"
            required
            minLength={6}
            autoComplete="tel"
            placeholder="Teléfono"
            className="block w-full rounded-lg border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
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
          {loading ? 'Entrando al demo...' : 'Entrar al demo'}
        </button>
      </form>
    </div>
  )
}
