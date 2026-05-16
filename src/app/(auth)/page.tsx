import { Suspense } from 'react'
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
    </div>
  )
}
