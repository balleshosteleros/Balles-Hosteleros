"use client";

/**
 * El marcador de reputación, encima de la lista de valoraciones.
 *
 * Contesta de un vistazo lo que antes había que sacar contando filas: qué nota
 * tenemos, cuántas opiniones la sostienen y cómo se reparten las estrellas. Y
 * lo hace **sobre lo que está filtrado**, que es la gracia: al marcar Google en
 * la columna de origen, el marcador pasa a ser el de Google, no el del
 * histórico entero.
 *
 * Cuando en el filtro hay valoraciones de una plataforma pública se añade el
 * estado de las respuestas: cuántas quedan sin contestar es la única cifra de
 * esta pantalla sobre la que se puede actuar hoy mismo.
 */

import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ESTRELLAS_REPARTO,
  type ResumenResenas as Resumen,
} from "@/features/calidad/lib/resumen-resenas";

/** Coma decimal, como el resto de los números del programa. */
function formatNota(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

function formatDias(n: number): string {
  if (n < 1) return "menos de un día";
  const redondeado = Math.round(n);
  return `${redondeado} ${redondeado === 1 ? "día" : "días"}`;
}

function Estrellas({ nota }: { nota: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i <= Math.round(nota)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/25",
          )}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}

export function ResumenResenas({
  resumen,
  filtrado,
}: {
  resumen: Resumen;
  /** Hay algún filtro puesto: el marcador no es el del histórico completo. */
  filtrado: boolean;
}) {
  const { notaMedia, conNota, reparto, publicas, respondidas, sinResponder } =
    resumen;

  return (
    <Card className="p-4">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-8">
        {/* Nota media */}
        <div className="flex flex-col justify-center gap-1">
          {notaMedia === null ? (
            <>
              <span className="text-3xl font-semibold tracking-tight text-muted-foreground">
                —
              </span>
              <p className="text-xs text-muted-foreground">
                Ninguna valoración con nota en lo que estás viendo.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">
                  {formatNota(notaMedia)}
                </span>
                <span className="text-base text-muted-foreground">/ 5</span>
              </div>
              <Estrellas nota={notaMedia} />
              <p className="text-xs text-muted-foreground">
                {conNota.toLocaleString("es-ES")}{" "}
                {conNota === 1 ? "valoración" : "valoraciones"}
                {filtrado ? " con los filtros puestos" : ""}
              </p>
            </>
          )}
        </div>

        {/* Reparto de estrellas */}
        <div className="space-y-1.5 self-center">
          {ESTRELLAS_REPARTO.map((estrella) => {
            const n = reparto[estrella] ?? 0;
            const pct = conNota > 0 ? (n / conNota) * 100 : 0;
            return (
              <div key={estrella} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right tabular-nums text-muted-foreground">
                  {estrella}
                </span>
                <Star
                  className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right tabular-nums text-muted-foreground">
                  {conNota > 0 ? `${Math.round(pct)} %` : "—"}
                </span>
                <span className="hidden w-14 text-right tabular-nums text-muted-foreground/70 sm:inline">
                  {n.toLocaleString("es-ES")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Respuestas: solo tiene sentido donde la respuesta se publica */}
      {publicas > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-xs">
          <Dato
            valor={respondidas.toLocaleString("es-ES")}
            etiqueta={`de ${publicas.toLocaleString("es-ES")} respondidas`}
          />
          <Dato
            valor={sinResponder.toLocaleString("es-ES")}
            etiqueta="sin responder"
            alerta={sinResponder > 0}
          />
          {resumen.diasMediaRespuesta !== null && (
            <Dato
              valor={formatDias(resumen.diasMediaRespuesta)}
              etiqueta="se tarda en contestar"
            />
          )}
        </div>
      )}
    </Card>
  );
}

function Dato({
  valor,
  etiqueta,
  alerta,
}: {
  valor: string;
  etiqueta: string;
  alerta?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          alerta && "text-amber-600",
        )}
      >
        {valor}
      </span>
      <span className="text-muted-foreground">{etiqueta}</span>
    </span>
  );
}
