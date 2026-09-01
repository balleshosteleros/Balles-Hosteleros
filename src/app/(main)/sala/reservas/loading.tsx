/**
 * Pantalla de carga PROPIA de Reservas.
 *
 * Sin este fichero, el segmento no tiene su propio `<Suspense>`: mientras se
 * descarga el bundle de la vista, Next deja en pantalla el hermano que ya
 * tuviera resuelto en caché — las gráficas de `/sala` —, y al pulsar RESERVAS
 * parecía que el software pasaba por otra pantalla antes de llegar (Iván,
 * 30-ago). Con el fallback aquí, se entra directo a Reservas: primero este
 * cargando y después la vista, sin pasar por ningún otro sitio.
 *
 * Se pinta en el azul marino de Reservas y sin barra superior, que es el
 * aspecto de la vista ya cargada: así el arranque no destella en claro.
 */
export default function LoadingReservas() {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-[#0f172a] text-slate-300">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-slate-200" />
      <span className="text-xs uppercase tracking-widest">Cargando reservas…</span>
    </div>
  );
}
