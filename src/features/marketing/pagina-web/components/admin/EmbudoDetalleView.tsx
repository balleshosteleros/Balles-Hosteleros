"use client";

/**
 * Un embudo, de arriba abajo (PRP-088).
 *
 * Un embudo se entiende viendo por dónde entra la gente, cuánta llega a cada
 * paso y dónde se cae. Los pasos van en columna y cada uno lleva una barra
 * centrada cuyo ancho es su gente: al bajar se estrecha, y ese estrechamiento
 * ES lo que se pierde por el camino.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Eye, Pencil, TrendingDown } from "lucide-react";
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

      {/* Los pasos, en columna: el embudo se lee de arriba abajo. */}
      <div className="space-y-1">
        {embudo.pasos.map((paso, i) => {
          const anchoBarra = Math.max(6, (paso.visitas / masVisitado) * 100);
          const sigue = porcentajeQueSigue(paso, embudo.pasos[i - 1]);

          return (
            <div key={paso.id}>
              {/* Entre paso y paso, cuánta gente sigue y cuánta se cae. */}
              {i > 0 && (
                <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
                  <ChevronDown className="h-4 w-4" />
                  {sigue === null ? (
                    <span>Sin datos todavía</span>
                  ) : (
                    <>
                      <span className="tabular-nums font-medium text-foreground">
                        {formatPorcentaje(sigue, { max: 0 })} sigue
                      </span>
                      {sigue < 100 && (
                        <span className="tabular-nums">
                          · se caen {formatPorcentaje(100 - sigue, { max: 0 })}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                    {i + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" title={paso.nombre}>
                      {paso.nombre}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      /{paso.slug_interno}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-semibold leading-tight tabular-nums">
                      {formatNumero(paso.visitas)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatNumero(paso.visitas30)} en 30 días
                    </p>
                  </div>

                  <Badge
                    variant={paso.estado === "PUBLICADA" ? "secondary" : "outline"}
                    className="shrink-0 font-normal"
                  >
                    {ESTADO_LABEL[paso.estado] ?? paso.estado}
                  </Badge>

                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Ver la página"
                      onClick={() =>
                        window.open(`/pagina-web-preview/${paso.id}`, "_blank", "noopener,noreferrer")
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Link href={`/marketing/pagina-web/${paso.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* La barra, centrada: al bajar se estrecha. Eso es el embudo. */}
                <div className="mt-3 flex justify-center">
                  <div
                    className="h-3 rounded-full bg-primary transition-all"
                    style={{ width: `${anchoBarra}%` }}
                    title={`${formatNumero(paso.visitas)} visitas`}
                  />
                </div>
              </Card>
            </div>
          );
        })}
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
