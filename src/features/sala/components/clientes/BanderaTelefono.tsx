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
import { ToolTooltip } from "@/components/ui/tool-tooltip";

export function BanderaTelefono({
  telefono,
  className,
}: {
  telefono: string | null | undefined;
  className?: string;
}) {
  const pais = paisDeTelefono(telefono);
  if (!pais) return null;

  return (
    <ToolTooltip label={pais.label}>
      <span
        className={cn("inline-flex shrink-0 items-center gap-1", className)}
      >
        <span aria-label={pais.label} role="img">
          {pais.flag}
        </span>
      </span>
    </ToolTooltip>
  );
}
