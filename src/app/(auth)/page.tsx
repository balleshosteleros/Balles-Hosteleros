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

      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}

// Reserva la MISMA altura/estructura que <LoginForm> para que, al hidratar y
// sustituir el fallback, el contenedor no cambie de tamaño (evita el "temblor"
// de layout que se veía al cargar el login).
function LoginFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      {/* Botón Google */}
      <div className="h-[52px] w-full rounded-lg bg-slate-900/60" />
      {/* Divisor */}
      <div className="h-4 w-full" />
      <div className="space-y-4">
        {/* Email */}
        <div className="h-[50px] w-full rounded-lg bg-slate-900/60" />
        {/* Password */}
        <div className="h-[50px] w-full rounded-lg bg-slate-900/60" />
        {/* Olvidé contraseña */}
        <div className="flex justify-end">
          <div className="h-5 w-40 rounded bg-slate-900/40" />
        </div>
        {/* Botón iniciar sesión */}
        <div className="h-[50px] w-full rounded-lg bg-blue-600/40" />
      </div>
    </div>
  )
}
