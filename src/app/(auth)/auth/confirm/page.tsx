/**
 * Página intermedia del enlace de correo (recovery / alta de contraseña).
 *
 * El correo enlaza AQUÍ con ?token_hash=...&type=recovery. NO canjeamos el token
 * al abrir (GET): los clientes de correo y antivirus hacen prefetch de los
 * enlaces al recibirlos y consumirían el token antes de tiempo → "enlace
 * caducado en menos de un minuto". En su lugar mostramos un botón; el canje
 * (verifyOtp) ocurre al pulsarlo (POST), algo que un escáner automático no hace.
 *
 * Así el enlace NO caduca hasta que la persona lo usa de verdad, y una vez usado
 * /update-password muestra "este enlace ya se ha usado".
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>
}) {
  const sp = await searchParams
  const tokenHash = sp.token_hash ?? ''
  const type = sp.type ?? 'recovery'
  const next = sp.next ?? '/update-password'

  if (!tokenHash) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Enlace no válido</h1>
          <p className="mt-2 text-sm text-slate-400">
            Este enlace no es correcto. Solicita uno nuevo desde
            «¿Has olvidado tu contraseña?».
          </p>
        </div>
        <a
          href="/forgot-password"
          className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-blue-500"
        >
          Solicitar enlace nuevo
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Crea tu contraseña</h1>
        <p className="mt-2 text-sm text-slate-400">
          Pulsa el botón para continuar y elegir tu PIN de acceso.
        </p>
      </div>

      <form action="/auth/confirm/verificar" method="POST" className="space-y-4">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition-all hover:bg-blue-500"
        >
          Crear mi contraseña
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Este enlace solo puede usarse una vez. Si ya creaste tu contraseña, entra
        con ella desde el inicio.
      </p>
    </div>
  )
}
