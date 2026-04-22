import { Suspense } from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { DemoLoginForm, LoginForm } from '@/features/auth/components'

function esHostDemo(host: string): boolean {
  const h = host.toLowerCase().split(':')[0]
  return h === 'demo.balleshosteleros.com' || h.startsWith('demo.')
}

export default async function LoginPage() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const isDemo = esHostDemo(host)

  if (isDemo) {
    return (
      <div className="space-y-8">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-900/50 bg-blue-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Modo demo
          </span>
          <h1 className="mt-3 text-3xl font-bold text-white">
            Prueba Balles Hosteleros
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Una experiencia completa del software sin registro real.
          </p>
        </div>

        <Suspense fallback={<div className="h-64" />}>
          <DemoLoginForm />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-slate-400">
          Accede a tu panel de gestión
        </p>
      </div>

      <Suspense fallback={<div className="h-64" />}>
        <LoginForm />
      </Suspense>

      <p className="text-center text-sm text-slate-400">
        ¿No tienes cuenta?{' '}
        <Link
          href="/signup"
          className="font-semibold text-blue-400 transition-colors hover:text-blue-300"
        >
          Regístrate
        </Link>
      </p>
    </div>
  )
}
