"use client";

/**
 * Las valoraciones, en una lista.
 *
 * Antes era un kanban de cinco columnas, heredado de Go High Level, donde cada
 * comensal era una tarjeta que se arrastraba. Con 8.849 valoraciones eso ya no
 * se puede leer: para comparar dos notas hay que buscarlas en columnas
 * distintas, y la mitad de la información —el desglose por áreas, la vía por la
 * que opinó, quién la gestionó— no cabía en una tarjeta.
 *
 * En una lista se ve de un golpe quién opinó, qué nota puso y por dónde entró, y
 * se puede ordenar y filtrar por cualquiera de esas cosas. La ficha completa,
 * con las tres preguntas y la respuesta, se abre al pulsar la fila.
 */

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { notaValoracion } from "@/features/sala/lib/clasificacion-cliente";
import {
  ESTADO_LABEL,
  ESTADOS_RESENA,
  ORIGEN_LABEL,
  ORIGENES_RESENA,
  type Resena,
} from "@/features/calidad/types/resenas";
import {
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";
import { formatearFechaEs } from "@/shared/lib/fecha";

/** Estrellas de una nota. Media estrella no se pinta: se redondea al pintar. */
function Estrellas({ nota, size = 13 }: { nota: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={
            i <= Math.round(nota)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/25"
          }
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}

/** Coma decimal, como el resto de los números del programa. */
function formatNota(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

/**
 * La nota que MANDA es la media de las tres preguntas, y solo si el cliente no
 * las contestó vale la global. Es el mismo criterio que usa la ficha del
 * cliente y la gráfica (`notaValoracion`): antes la tarjeta pintaba la global y
 * la columna del tablero se decidía por el desglose, así que dos valoraciones
 * con las mismas estrellas aparecían en sitios distintos y parecía un error.
 */
function notaDe(r: Resena): number | null {
  return notaValoracion({
    rating: r.rating,
    comida: r.rating_comida,
    servicio: r.rating_servicio,
    ambiente: r.rating_ambiente,
  });
}

/** Cuántas de las tres preguntas contestó. 0 = solo dio una nota global. */
function preguntasContestadas(r: Resena): number {
  return [r.rating_comida, r.rating_servicio, r.rating_ambiente].filter(
    (n) => typeof n === "number",
  ).length;
}

const COLOR_ESTADO: Record<string, string> = {
  excelente: "text-emerald-700",
  regular: "text-amber-700",
  malo: "text-rose-700",
  nuevo_comensal: "text-sky-700",
};

/**
 * Cómo se lee cada columna para filtrarla y ordenarla: lo que se compara es lo
 * que se VE, no el dato crudo —por origen se busca "Google", no "google", y por
 * nota el número, no las estrellas—.
 *
 * Vive fuera de la tabla porque el marcador de arriba tiene que filtrar
 * exactamente igual que la lista. Si cada uno interpretara las columnas a su
 * manera, la nota media de la cabecera no cuadraría con las filas de debajo.
 */
export function crearAccesoResena(
  nombreGestor: (userId: string | null) => string | null,
) {
  return (r: Resena, campo: string): unknown => {
    if (campo === "cliente") return r.nombre_comensal;
    if (campo === "nota") return notaDe(r) ?? 0;
    if (campo === "origen") return ORIGEN_LABEL[r.origen] ?? r.origen;
    if (campo === "estado") return ESTADO_LABEL[r.estado] ?? r.estado;
    if (campo === "preguntas") return preguntasContestadas(r) === 3 ? "Sí" : "No";
    if (campo === "fecha") return r.fecha_registro ?? r.fecha_reseña ?? "";
    if (campo === "comentario") return r.comentario ?? "";
    if (campo === "gestionada") return nombreGestor(r.gestionada_por) ?? "";
    return (r as unknown as Record<string, unknown>)[campo];
  };
}

export interface TablaResenasProps {
  /** Ya filtradas: el filtrado se hace en la vista, que es quien lo comparte
   *  con el marcador. Aquí solo se ordena y se pinta. */
  resenas: Resena[];
  loading: boolean;
  filtros: ToolbarFiltroActivo[];
  onFiltrosChange: (f: ToolbarFiltroActivo[]) => void;
  orden: ToolbarOrdenActivo | null;
  onOrdenChange: (o: ToolbarOrdenActivo | null) => void;
  nombreGestor: (userId: string | null) => string | null;
  onAbrir: (r: Resena) => void;
}

export function TablaResenas({
  resenas,
  loading,
  filtros,
  onFiltrosChange,
  orden,
  onOrdenChange,
  nombreGestor,
  onAbrir,
}: TablaResenasProps) {
  const acceso = crearAccesoResena(nombreGestor);

  const visibles = aplicarOrdenToolbar(resenas, orden, acceso);

  const cabecera = (
    campo: string,
    label: string,
    tipo: "texto" | "numero" | "lista" | "fecha",
    opciones?: string[],
  ) => (
    <TableColumnHeader
      key={campo}
      label={label}
      campo={campo}
      filtroTipo={tipo}
      opciones={opciones}
      filtros={filtros}
      onFiltrosChange={onFiltrosChange}
      ordenable
      orden={orden}
      onOrdenChange={onOrdenChange}
    />
  );

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* La tabla se desplaza dentro de su caja: con el comentario y las tres
          preguntas no cabe en un móvil, y el cuerpo de la página nunca debe
          moverse en horizontal. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              {cabecera("cliente", "Cliente", "texto")}
              {cabecera("nota", "Valoración", "numero")}
              {cabecera("preguntas", "Las 3 preguntas", "lista", ["Sí", "No"])}
              {cabecera(
                "origen",
                "Origen",
                "lista",
                ORIGENES_RESENA.map((o) => o.label),
              )}
              {cabecera(
                "estado",
                "Estado",
                "lista",
                ESTADOS_RESENA.map((e) => e.label),
              )}
              {cabecera("fecha", "Fecha de la visita", "fecha")}
              {cabecera("comentario", "Comentario", "texto")}
              {cabecera("gestionada", "Gestionada por", "texto")}
            </tr>
          </thead>
          <tbody>
            {loading && resenas.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && visibles.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Ninguna valoración con estos filtros
                </td>
              </tr>
            )}
            {visibles.map((r) => {
              const nota = notaDe(r);
              const tresPreguntas = preguntasContestadas(r) === 3;
              return (
                <tr
                  key={r.id}
                  onClick={() => onAbrir(r)}
                  className="border-t cursor-pointer hover:bg-muted/40"
                  title="Ver la valoración completa"
                >
                  <td className="p-3 font-medium whitespace-nowrap">
                    {r.nombre_comensal}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {nota === null ? (
                      <span className="text-muted-foreground">Sin nota</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Estrellas nota={nota} />
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {formatNota(nota)}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {/* Quién puntuó comida, servicio y ambiente por separado, que
                        es la valoración que de verdad dice algo. El detalle se
                        abre al pulsar la fila. */}
                    <span
                      className={cn(
                        "text-xs",
                        tresPreguntas
                          ? "text-emerald-700"
                          : "text-muted-foreground",
                      )}
                    >
                      {tresPreguntas ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {ORIGEN_LABEL[r.origen] ?? r.origen}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={cn("text-xs font-medium", COLOR_ESTADO[r.estado])}>
                      {ESTADO_LABEL[r.estado] ?? r.estado}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {r.fecha_registro
                      ? formatearFechaEs(r.fecha_registro)
                      : r.fecha_reseña
                        ? formatearFechaEs(r.fecha_reseña.slice(0, 10))
                        : "—"}
                  </td>
                  <td
                    className="p-3 max-w-[22rem] truncate text-muted-foreground"
                    title={r.comentario ?? undefined}
                  >
                    {r.comentario || "—"}
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {nombreGestor(r.gestionada_por) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
