import Link from 'next/link'
import { ForgotPasswordForm } from '@/features/auth/components'

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-slate-400">
          Te enviaremos un enlace a tu correo para restablecerla
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-sm text-slate-400">
        <Link
          href="/"
          className="font-semibold text-blue-400 transition-colors hover:text-blue-300"
        >
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  )
}
