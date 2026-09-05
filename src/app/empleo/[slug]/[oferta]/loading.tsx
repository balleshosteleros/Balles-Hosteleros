import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

/**
 * Pantalla de carga PROPIA de la vacante.
 *
 * La página de la oferta es `force-dynamic`: el prefetch de Next no se trae el
 * contenido, así que TODO (empresa + vacante + cuestionario + formulario) se
 * pedía al pulsar. Sin este fichero el segmento no tiene su `<Suspense>` y el
 * navegador se quedaba en la lista, quieto y sin ninguna señal, hasta 4
 * segundos en un móvil con datos: los candidatos tocaban la vacante, no se
 * abría nada y se iban (Iván, 05-sep).
 *
 * Con el fallback aquí la navegación responde al instante: se entra en la
 * vacante y se ve el cargando mientras llegan los datos.
 */
export default function LoadingOfertaPublica() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <LoadingSpinner size="lg" className="py-0" />
      <span className="text-xs uppercase tracking-widest">Cargando…</span>
    </div>
  );
}
