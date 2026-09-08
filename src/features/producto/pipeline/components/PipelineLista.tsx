"use client";

/**
 * El mismo embudo, en lista. Para cuando hay que leer mil seiscientas
 * oportunidades seguidas en vez de mirarlas repartidas por columnas.
 *
 * Los filtros y el orden son los MISMOS que los del tablero (el estado vive en
 * la vista): aquí se pinchan en la cabecera de cada columna, como en el resto
 * de tablas del software.
 */
import { Badge } from "@/components/ui/badge";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import type {
  ToolbarFiltroActivo,
  ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";
import { formatearFechaEs } from "@/shared/lib/fecha";
import { formatEur } from "@/shared/lib/numero";
import { cn } from "@/lib/utils";
import type { Oportunidad, OportunidadEstado, PipelineFase } from "../types";
import { OPORTUNIDAD_ESTADO_LABEL } from "../types";

const ESTADO_CLASE: Record<OportunidadEstado, string> = {
  ABIERTA: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  GANADA: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  PERDIDA: "bg-red-500/10 text-red-700 border-red-500/30",
  ABANDONADA: "bg-muted text-muted-foreground border-border",
};

interface Props {
  oportunidades: Oportunidad[];
  fasePorId: Map<string, PipelineFase>;
  /** Opciones de cada filtro: salen de lo que se está viendo, sin repetir. */
  opciones: { fase: string[]; estado: string[]; fuente: string[]; asignado: string[] };
  filtros: ToolbarFiltroActivo[];
  onFiltrosChange: (f: ToolbarFiltroActivo[]) => void;
  orden: ToolbarOrdenActivo | null;
  onOrdenChange: (o: ToolbarOrdenActivo | null) => void;
  onAbrir: (o: Oportunidad) => void;
}

export function PipelineLista({
  oportunidades,
  fasePorId,
  opciones,
  filtros,
  onFiltrosChange,
  orden,
  onOrdenChange,
  onAbrir,
}: Props) {
  const filtro = { filtros, onFiltrosChange };
  const ord = { ordenable: true, orden, onOrdenChange };

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <TableColumnHeader label="Nombre" campo="nombre" {...ord} />
            <TableColumnHeader
              label="Fase"
              campo="fase"
              filtroTipo="lista"
              opciones={opciones.fase}
              {...filtro}
              {...ord}
            />
            <TableColumnHeader
              label="Estado"
              campo="estado"
              filtroTipo="lista"
              opciones={opciones.estado}
              {...filtro}
              {...ord}
            />
            <TableColumnHeader
              label="Fuente"
              campo="fuente"
              filtroTipo="lista"
              opciones={opciones.fuente}
              {...filtro}
              {...ord}
            />
            <TableColumnHeader
              label="Asignada a"
              campo="asignado_a"
              filtroTipo="lista"
              opciones={opciones.asignado}
              {...filtro}
              {...ord}
            />
            <TableColumnHeader label="Teléfono" campo="telefono" />
            <TableColumnHeader label="Correo" campo="email" />
            <TableColumnHeader
              label="Valor"
              campo="valor"
              align="right"
              ordenLabelAsc="Menor"
              ordenLabelDesc="Mayor"
              {...ord}
            />
            <TableColumnHeader
              label="Alta"
              campo="created_at"
              ordenLabelAsc="Antes"
              ordenLabelDesc="Después"
              {...ord}
            />
          </tr>
        </thead>
        <tbody>
          {oportunidades.map((o) => (
            <tr
              key={o.id}
              onClick={() => onAbrir(o)}
              className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
            >
              <td className="px-3 py-1.5 font-medium">{o.nombre}</td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {fasePorId.get(o.fase_id)?.nombre ?? "—"}
              </td>
              <td className="px-3 py-1.5">
                <Badge
                  variant="outline"
                  className={cn("h-5 px-1.5 text-[10px] font-medium", ESTADO_CLASE[o.estado])}
                >
                  {OPORTUNIDAD_ESTADO_LABEL[o.estado]}
                </Badge>
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">{o.fuente || "—"}</td>
              <td className="px-3 py-1.5 text-muted-foreground">{o.asignado_a || "—"}</td>
              <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                {o.telefono || "—"}
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">{o.email || "—"}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatEur(o.valor)}</td>
              <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                {formatearFechaEs(o.created_at)}
              </td>
            </tr>
          ))}
          {oportunidades.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                No hay oportunidades que cumplan lo que has pedido.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
