import Link from 'next/link'
import { TITULAR } from '@/app/software/legal/datos-titular'

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

      {/* El botón abre el correo, pero la dirección NO se muestra escrita: en
          las pantallas de acceso no aparece ningún correo a la vista. Sale de
          los datos del titular (fuente única), nunca cableada aquí. */}
      <a
        href={`mailto:${TITULAR.email}?subject=${encodeURIComponent(
          'Solicitud de acceso a Balles Hosteleros',
        )}`}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-center text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition-all hover:bg-blue-500"
      >
        Solicitar acceso
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
