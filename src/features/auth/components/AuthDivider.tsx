interface AuthDividerProps {
  label?: string
}

/**
 * Divisor «o inicia sesión con tu correo».
 *
 * Sin márgenes propios A PROPÓSITO. Antes llevaba `my-6` dentro de un padre con
 * `space-y-5`: margen y separación se pisaban, y el resultado dependía del orden
 * en que llegara el CSS — en local (servido al vuelo) y en producción
 * (minificado y reordenado) no salía el mismo hueco. Ahora la separación la pone
 * solo el padre, que es la única fuente, y el divisor mide igual en los dos
 * entornos.
 */
export function AuthDivider({ label = 'o' }: AuthDividerProps) {
  return (
    <div className="relative flex h-4 items-center">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-800" />
      </div>
      <div className="relative flex w-full justify-center text-xs uppercase tracking-wider">
        <span className="bg-slate-950 px-3 text-slate-500">{label}</span>
      </div>
    </div>
  )
}
