import Link from 'next/link'
import { SignupForm } from '@/features/auth/components'

export default function SignupPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Crear cuenta</h1>
        <p className="mt-2 text-sm text-slate-400">
          Empieza a gestionar tu negocio en minutos
        </p>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-slate-400">
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/login"
          className="font-semibold text-blue-400 transition-colors hover:text-blue-300"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
