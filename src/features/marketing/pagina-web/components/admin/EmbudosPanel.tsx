"use client";

/**
 * Los embudos de la empresa, uno por tarjeta (PRP-088).
 *
 * Aquí solo el NOMBRE y cómo va: cuánta gente entra, cuánta llega al final y
 * cuántos pasos tiene. El recorrido paso a paso se ve al entrar.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatNumero, formatPorcentaje } from "@/shared/lib/numero";
import { listarEmbudos, type EmbudoConPasos } from "../../actions/embudos-actions";

export function EmbudosPanel({ recargar }: { recargar?: number }) {
  const router = useRouter();
  const [embudos, setEmbudos] = useState<EmbudoConPasos[]>([]);

  const cargar = useCallback(async () => {
    const res = await listarEmbudos();
    if (res.ok) setEmbudos(res.data);
    else toast.error(res.error);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar, recargar]);

  if (embudos.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {embudos.map((embudo) => {
        const entran = embudo.pasos[0]?.visitas ?? 0;
        const final = embudo.pasos[embudo.pasos.length - 1]?.visitas ?? 0;
        const conversion = entran > 0 ? (final / entran) * 100 : null;
        const publicados = embudo.pasos.filter((p) => p.estado === "PUBLICADA").length;

        return (
          <Card
            key={embudo.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/marketing/pagina-web/embudo/${embudo.id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/marketing/pagina-web/embudo/${embudo.id}`);
              }
            }}
            className="cursor-pointer p-4 transition-colors hover:border-foreground/25 hover:bg-muted/40"
          >
            <div className="flex items-start gap-2">
              <Filter className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" title={embudo.nombre}>
                  {embudo.nombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  {embudo.pasos.length} {embudo.pasos.length === 1 ? "paso" : "pasos"}
                  {publicados > 0 ? ` · ${publicados} en directo` : " · sin publicar"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>

            <div className="mt-3 flex items-end gap-5">
              <Dato etiqueta="Entran" valor={formatNumero(entran)} />
              <Dato etiqueta="Al final" valor={formatNumero(final)} />
              <Dato
                etiqueta="Convierte"
                valor={conversion === null ? "—" : formatPorcentaje(conversion, { max: 1 })}
              />
            </div>

            {/* El recorrido, en pequeño: cada barra es un paso y su altura, su gente. */}
            <div className="mt-3 flex items-end gap-1">
              {embudo.pasos.map((p) => {
                const alto = entran > 0 ? Math.max(8, (p.visitas / entran) * 100) : 8;
                return (
                  <div
                    key={p.id}
                    className="h-10 flex-1 rounded-sm bg-muted"
                    title={`${p.nombre}: ${formatNumero(p.visitas)}`}
                  >
                    <div
                      className="w-full rounded-sm bg-primary/70"
                      style={{ height: `${alto}%`, marginTop: `${100 - alto}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className="text-base font-semibold tabular-nums leading-tight">{valor}</p>
    </div>
  );
}
