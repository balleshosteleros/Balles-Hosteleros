import { UpdatePasswordForm } from '@/features/auth/components'

export default function UpdatePasswordPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Nueva contraseña</h1>
        <p className="mt-2 text-sm text-slate-400">
          Introduce una nueva contraseña para tu cuenta
        </p>
      </div>

      <UpdatePasswordForm />
    </div>
  )
}
