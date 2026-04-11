import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="space-y-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-blue-900/50 bg-blue-950/40">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white">Revisa tu correo</h1>
        <p className="mt-3 text-sm text-slate-400">
          Te hemos enviado un enlace de confirmación. Haz click en él para completar tu registro.
        </p>
      </div>

      <Link
        href="/"
        className="inline-block text-sm font-semibold text-blue-400 transition-colors hover:text-blue-300"
      >
        ← Volver al inicio de sesión
      </Link>
    </div>
  )
}
