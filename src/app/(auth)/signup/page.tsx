import Link from 'next/link'

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Solicita acceso</h1>
        <p className="mt-2 text-sm text-slate-400">
          El alta en Balles Hosteleros es por invitación. Si quieres una cuenta,
          escríbenos y te damos de alta nosotros.
        </p>
      </div>

      <a
        href="mailto:balleshosteleros@gmail.com?subject=Solicitud%20de%20acceso%20a%20Balles%20Hosteleros"
        className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition-all hover:bg-blue-500"
      >
        Escribir a balleshosteleros@gmail.com
      </a>

      <p className="text-center text-sm text-slate-400">
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/"
          className="font-semibold text-blue-400 transition-colors hover:text-blue-300"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
