"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, PlayCircle, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { DIAS_SEMANA, diasDelMes, fechaConDia, tituloMes } from "../../lib/calendario";
import type { ClaseEscuela } from "../../types";
import { MiniaturaClase } from "./MiniaturaClase";

/**
 * CLASES del alumno: calendario del mes con la miniatura de cada día y, al
 * lado, las próximas en orden.
 *
 * Es solo lectura: aquí el alumno mira, entra a la clase y ve la grabación. Lo
 * que hay dentro se decide desde el back-office de la escuela.
 */
export function CalendarioClases({
  clases,
  hoy,
  isotipoUrl,
}: {
  clases: ClaseEscuela[];
  /** Hoy en la zona de la EMPRESA, no la del navegador. */
  hoy: string;
  isotipoUrl?: string | null;
}) {
  const [anio, setAnio] = useState(() => Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(hoy.slice(5, 7)) - 1);
  const [abierta, setAbierta] = useState<ClaseEscuela | null>(null);

  const porDia = useMemo(() => {
    const mapa = new Map<string, ClaseEscuela[]>();
    for (const c of clases) mapa.set(c.fecha, [...(mapa.get(c.fecha) ?? []), c]);
    return mapa;
  }, [clases]);

  const proximas = useMemo(
    () => clases.filter((c) => c.fecha >= hoy).slice(0, 8),
    [clases, hoy],
  );
  const pasadas = useMemo(
    () => clases.filter((c) => c.fecha < hoy).slice(-5).reverse(),
    [clases, hoy],
  );

  const dias = useMemo(() => diasDelMes(anio, mes), [anio, mes]);

  function mover(paso: number) {
    const total = mes + paso;
    setAnio(anio + Math.floor(total / 12));
    setMes(((total % 12) + 12) % 12);
  }

  function irAHoy() {
    setAnio(Number(hoy.slice(0, 4)));
    setMes(Number(hoy.slice(5, 7)) - 1);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Lateral: próximas clases en orden */}
      <aside className="space-y-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Próximas clases
          </h2>
          {proximas.length ? (
            <ul className="space-y-2">
              {proximas.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setAbierta(c)}
                    className="flex w-full gap-3 rounded-xl border bg-background p-2.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <div className="w-24 shrink-0">
                      <MiniaturaClase clase={c} isotipoUrl={isotipoUrl} compacta />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.titulo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fechaConDia(c.fecha)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.horaInicio}
                        {c.horaFin ? ` - ${c.horaFin}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No hay ninguna clase programada todavía.
            </p>
          )}
        </section>

        {pasadas.length ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Ya impartidas
            </h2>
            <ul className="space-y-1.5">
              {pasadas.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setAbierta(c)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                  >
                    {c.grabacionUrl ? (
                      <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Video className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{c.titulo}</span>
                      <span className="block text-xs text-muted-foreground">
                        {fechaConDia(c.fecha)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>

      {/* Calendario del mes */}
      <section className="rounded-2xl border bg-background p-3 sm:p-4">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          {/* `first-letter` y no `capitalize`: este último pone mayúscula en
              CADA palabra y salía «Septiembre De 2026». */}
          <h2 className="text-lg font-semibold first-letter:uppercase">{tituloMes(anio, mes)}</h2>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => mover(-1)} aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => mover(1)} aria-label="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={irAHoy}>
              Hoy
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-7 gap-px text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-border">
          {dias.map((d) => {
            const delDia = porDia.get(d.fecha) ?? [];
            const esHoy = d.fecha === hoy;
            return (
              <div
                key={d.fecha}
                className={cn(
                  "min-h-[92px] bg-background p-1.5 sm:min-h-[116px]",
                  !d.delMes && "bg-muted/40",
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                    d.delMes ? "text-muted-foreground" : "text-muted-foreground/50",
                    esHoy && "font-semibold text-white",
                  )}
                  style={esHoy ? { background: "var(--marca-primario)" } : undefined}
                >
                  {d.dia}
                </div>
                <div className="space-y-1">
                  {delDia.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAbierta(c)}
                      className="block w-full text-left transition-opacity hover:opacity-90"
                    >
                      <MiniaturaClase clase={c} isotipoUrl={isotipoUrl} compacta />
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                        {c.horaInicio}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={!!abierta} onOpenChange={(v) => !v && setAbierta(null)}>
        <DialogContent className="max-w-lg">
          {abierta ? (
            <>
              <DialogHeader>
                <DialogTitle>{abierta.titulo}</DialogTitle>
                <DialogDescription className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {fechaConDia(abierta.fecha)} · {abierta.horaInicio}
                  {abierta.horaFin ? ` - ${abierta.horaFin}` : ""}
                </DialogDescription>
              </DialogHeader>
              <MiniaturaClase clase={abierta} isotipoUrl={isotipoUrl} />
              {abierta.descripcion ? (
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {abierta.descripcion}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {abierta.enlace ? (
                  <a href={abierta.enlace} target="_blank" rel="noopener noreferrer">
                    <Button
                      size="sm"
                      style={{ background: "var(--marca-primario)", color: "var(--marca-texto)" }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Entrar en la clase
                    </Button>
                  </a>
                ) : null}
                {abierta.grabacionUrl ? (
                  <a href={abierta.grabacionUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Ver la grabación
                    </Button>
                  </a>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
