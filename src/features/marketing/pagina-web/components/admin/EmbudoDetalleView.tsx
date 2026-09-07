"use client";

/**
 * Un embudo, de izquierda a derecha (PRP-088).
 *
 * Un embudo se entiende viendo por dónde entra la gente, cuánta llega a cada
 * paso y dónde se cae. Por eso los pasos van en fila, con sus visitas, el
 * porcentaje que sigue respecto al paso anterior y una barra que se estrecha:
 * el hueco entre barras ES la gente que se ha perdido.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Eye, Pencil, TrendingDown, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { formatNumero, formatPorcentaje } from "@/shared/lib/numero";
import { obtenerEmbudo, type EmbudoConPasos, type PasoDeEmbudo } from "../../actions/embudos-actions";

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  PUBLICADA: "Publicada",
  ARCHIVADA: "Archivada",
};

/** Cuánta gente sigue desde el paso anterior. Sin visitas antes, no hay caída que contar. */
function porcentajeQueSigue(paso: PasoDeEmbudo, anterior?: PasoDeEmbudo): number | null {
  if (!anterior || anterior.visitas === 0) return null;
  return (paso.visitas / anterior.visitas) * 100;
}

export function EmbudoDetalleView({ embudoId }: { embudoId: string }) {
  const [embudo, setEmbudo] = useState<EmbudoConPasos | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await obtenerEmbudo(embudoId);
    if (res.ok) setEmbudo(res.data);
    else toast.error(res.error);
    setCargando(false);
  }, [embudoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!embudo) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Ese embudo ya no existe.</p>
      </div>
    );
  }

  const entradas = embudo.pasos[0]?.visitas ?? 0;
  const finales = embudo.pasos[embudo.pasos.length - 1]?.visitas ?? 0;
  const conversion = entradas > 0 ? (finales / entradas) * 100 : null;
  const masVisitado = Math.max(1, ...embudo.pasos.map((p) => p.visitas));

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-6 pb-28">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/marketing/pagina-web">
          <Button variant="ghost" size="icon" aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-xl font-semibold">{embudo.nombre}</h1>
          <p className="text-xs text-muted-foreground">
            {embudo.pasos.length} {embudo.pasos.length === 1 ? "paso" : "pasos"}
          </p>
        </div>

        <Resumen etiqueta="Entran" valor={formatNumero(entradas)} />
        <Resumen etiqueta="Llegan al final" valor={formatNumero(finales)} />
        <Resumen
          etiqueta="Del principio al final"
          valor={conversion === null ? "—" : formatPorcentaje(conversion, { max: 1 })}
        />
      </div>

      {/* Los pasos, en fila. En pantallas estrechas se desliza a lo ancho:
          la página nunca se desplaza entera. */}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-2">
          {embudo.pasos.map((paso, i) => {
            return (
              <div key={paso.id} className="flex items-center gap-2">
                <Card className="flex w-64 flex-col p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Paso {i + 1}
                  </span>
                  <p className="mt-0.5 truncate text-sm font-medium" title={paso.nombre}>
                    {paso.nombre}
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    /{paso.slug_interno}
                  </p>

                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold tabular-nums">
                      {formatNumero(paso.visitas)}
                    </span>
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatNumero(paso.visitas30)} en los últimos 30 días
                  </p>

                  {/* La barra es el embudo: se estrecha con la gente que queda. */}
                  <div className="mt-3 h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.max(4, (paso.visitas / masVisitado) * 100)}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center gap-1">
                    <Badge
                      variant={paso.estado === "PUBLICADA" ? "secondary" : "outline"}
                      className="font-normal"
                    >
                      {ESTADO_LABEL[paso.estado] ?? paso.estado}
                    </Badge>
                    <div className="ml-auto flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Ver la página"
                        onClick={() =>
                          window.open(`/pagina-web-preview/${paso.id}`, "_blank", "noopener,noreferrer")
                        }
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Link href={`/marketing/pagina-web/${paso.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>

                {i < embudo.pasos.length - 1 && (
                  <div className="flex w-16 shrink-0 flex-col items-center justify-center text-muted-foreground">
                    <ChevronRight className="h-5 w-5" />
                    {porcentajeQueSigue(embudo.pasos[i + 1], paso) !== null && (
                      <span className="mt-0.5 text-[11px] tabular-nums">
                        {formatPorcentaje(porcentajeQueSigue(embudo.pasos[i + 1], paso) ?? 0, { max: 0 })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {entradas === 0 && (
        <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <TrendingDown className="h-4 w-4 shrink-0" />
          Todavía no hay visitas. Los datos aparecen cuando el embudo esté publicado y su dominio
          apunte aquí.
        </Card>
      )}
    </div>
  );
}

function Resumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Card className="px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className="text-lg font-semibold tabular-nums">{valor}</p>
    </Card>
  );
}
