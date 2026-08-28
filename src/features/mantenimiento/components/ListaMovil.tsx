import {
  type Incidencia,
  diasSinActualizar,
} from "@/features/empresa/data/mantenimiento";
import { StatusBadge, GravedadBadge } from "@/features/mantenimiento/components/Badges";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MapPin, Clock } from "lucide-react";

interface Props {
  items: Incidencia[];
  hoy: string;
  /** Abre la ficha para LEER los datos y el historial. */
  onVerDatos: (item: Incidencia) => void;
  /** Abre directamente el formulario de actualizar. */
  onActualizar: (item: Incidencia) => void;
}

/**
 * Lista de desperfectos para movil.
 *
 * En el movil no cabe la tabla: se sustituye por una tarjeta por desperfecto
 * con solo lo que hace falta para decidir (que es, donde, como esta de grave y
 * cuanto lleva sin noticias). Editar campos sueltos se deja para el escritorio;
 * desde el movil lo que se hace es ACTUALIZAR, que es un solo boton.
 */
export function ListaMovil({ items, hoy, onVerDatos, onActualizar }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">
        No hay desperfectos que mostrar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const dias = diasSinActualizar(item.ultimaActualizacion, hoy);
        const nunca = item.actualizaciones.length === 0;
        const terminado = item.estado === "TERMINADO";
        const color =
          dias >= 90 ? "text-severity-critical"
          : dias >= 30 ? "text-severity-serious"
          : "text-muted-foreground";

        return (
          <div
            key={item.id}
            className="rounded-lg border bg-card p-4 space-y-3 cursor-pointer"
            onClick={() => onVerDatos(item)}
          >
            <div>
              <span className={cn("block text-[11px] font-bold leading-tight", color)}>
                {dias === 0 ? "Actualizado hoy" : `${dias} ${dias === 1 ? "día" : "días"} sin actualizar`}
              </span>
              <h3 className="font-bold text-foreground text-[15px] leading-snug mt-0.5">
                {item.desperfecto}
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge value={item.estado} />
              <GravedadBadge value={item.gravedad} />
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {item.local}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {item.ultimaActualizacion}
                {nunca && " (alta)"}
              </span>
            </div>

            {/* Botón a lo ancho: es la acción principal desde el móvil. Un
                desperfecto terminado ya no se actualiza. */}
            <Button
              variant={terminado ? "secondary" : "exito"}
              disabled={terminado}
              className="w-full h-11"
              onClick={(e) => { e.stopPropagation(); onActualizar(item); }}
            >
              {terminado ? "Terminado" : "Actualizar"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
