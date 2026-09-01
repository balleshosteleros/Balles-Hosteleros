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

// Reserva EXACTAMENTE la misma estructura y altura que <LoginForm>: mismos
// contenedores, mismos huecos (`space-y-5` / `space-y-4`) y mismas alturas
// (h-12 los controles, h-4 el divisor, h-5 la fila del enlace). Antes las cifras
// estaban puestas a ojo (50/52 px) y no coincidían con lo que medía el
// formulario real, así que al hidratar todo daba un salto. Si cambias una
// altura en LoginForm, cámbiala aquí también: son la misma pantalla.
function LoginFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      {/* Botón Google */}
      <div className="h-12 w-full rounded-lg bg-slate-900/60" />
      {/* Divisor */}
      <div className="h-4 w-full" />
      <div className="space-y-4">
        {/* Email */}
        <div className="h-12 w-full rounded-lg bg-slate-900/60" />
        {/* Contraseña */}
        <div className="h-12 w-full rounded-lg bg-slate-900/60" />
        {/* ¿Has olvidado tu contraseña? */}
        <div className="flex h-5 items-center justify-end">
          <div className="h-3 w-40 rounded bg-slate-900/40" />
        </div>
        {/* Botón iniciar sesión */}
        <div className="h-12 w-full rounded-lg bg-blue-600/40" />
      </div>
    </div>
  )
}
