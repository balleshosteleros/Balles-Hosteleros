import { Suspense } from 'react'
import Link from 'next/link'
import { LoginForm } from '@/features/auth/components'

export default function LoginPage() {
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
