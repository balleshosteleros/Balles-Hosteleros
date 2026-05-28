import { Suspense } from 'react'
import { LoginForm } from '@/features/auth/components'

// PRP-045: la home raíz no debe pre-renderizarse estáticamente; si lo hace,
// el redirect móvil aplicado vía User-Agent quedaría enmascarado por el cache edge.
export const dynamic = 'force-dynamic'

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
