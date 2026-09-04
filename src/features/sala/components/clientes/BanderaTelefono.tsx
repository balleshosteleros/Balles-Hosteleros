/**
 * Banderita del país de un teléfono, para pintarla junto al número.
 *
 * Existe porque hasta ahora todos los clientes parecían españoles: el país se
 * perdió al migrar desde CoverManager y nadie en sala podía saber, mirando el
 * listado, que un cliente era de fuera. Con la bandera se ve de un vistazo
 * antes de llamar o de mandarle un WhatsApp.
 *
 * Si el prefijo no está catalogado no se pinta nada: enseñar la bandera
 * equivocada es peor que no enseñar ninguna.
 */

import { paisDeTelefono } from "@/features/sala/data/prefijos-telefono";
import { cn } from "@/lib/utils";

export function BanderaTelefono({
  telefono,
  className,
  /** Enseña también el nombre del país al lado, no solo la bandera. */
  conNombre = false,
}: {
  telefono: string | null | undefined;
  className?: string;
  conNombre?: boolean;
}) {
  const pais = paisDeTelefono(telefono);
  if (!pais) return null;

  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1", className)}
      title={pais.label}
    >
      <span aria-label={pais.label} role="img">
        {pais.flag}
      </span>
      {conNombre && <span className="truncate">{pais.label}</span>}
    </span>
  );
}
