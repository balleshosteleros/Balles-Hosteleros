"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, ChevronDown, ChevronRight, RefreshCw, TriangleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import {
  getCapacidadPorGrupo,
  type CapacidadGruposResult,
} from "@/features/sala/actions/capacidad-grupos-actions";

interface Local {
  id: string;
  nombre: string;
}

function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Color según cuántas opciones quedan LIBRES:
 *   rojo  = ninguna (agotado)
 *   ámbar = queda poco, y solo si había margen (5+ opciones): con 2 o 3 en
 *           total, que quede 1 es normal, no una alarma
 *   normal = hay sitio
 */
function tonoLibres(libres: number, total: number): string {
  if (total === 0) return "text-muted-foreground/50";
  if (libres === 0) return "text-destructive font-semibold";
  if (total >= 5 && libres <= Math.round(total * 0.2)) return "text-amber-600 font-medium";
  return "text-foreground";
}

/**
 * Capacidad por tamaño de grupo: cuántas mesas y combinaciones admiten cada
 * número de comensales, y cuántas siguen libres en la fecha elegida.
 *
 * Sirve para ver de un vistazo si un tamaño se ha quedado sin hueco — por
 * ejemplo, que para 7 personas ya no queda nada libre el sábado.
 */
export function CapacidadGruposPanel() {
  const [locales, setLocales] = useState<Local[]>([]);
  const [localId, setLocalId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(hoyISO());
  const [data, setData] = useState<CapacidadGruposResult | null>(null);
  const [expandida, setExpandida] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      const r = await listLocalesEmpresa();
      if (r.ok && r.data.length > 0) {
        setLocales(r.data);
        setLocalId((prev) => prev || r.data[0].id);
      }
    })();
  }, []);

  const recargar = useCallback(() => {
    if (!localId) return;
    startTransition(async () => {
      const r = await getCapacidadPorGrupo({ localId, fecha });
      setData(r);
    });
  }, [localId, fecha]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const filas = data?.filas ?? [];
  const zonas = data?.zonas ?? [];

  /** Tamaños que se han quedado sin ninguna opción libre. */
  const sinHueco = useMemo(
    () => filas.filter((f) => f.total > 0 && f.libres === 0).map((f) => f.personas),
    [filas],
  );

  /** Tamaños que ni siquiera tienen opción posible en el local. */
  const imposibles = useMemo(
    () => filas.filter((f) => f.total === 0).map((f) => f.personas),
    [filas],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Capacidad por tamaño de grupo</h2>
          <p className="text-xs text-muted-foreground">
            Qué mesas y combinaciones admiten cada número de comensales, y cuántas siguen
            libres.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {locales.length > 1 && (
            <Select value={localId} onValueChange={setLocalId}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-9 w-40 pl-8 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={recargar}
            disabled={pending}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Avisos: lo que de verdad quieres ver de un vistazo. */}
      {(sinHueco.length > 0 || imposibles.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {sinHueco.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
              <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" />
              <span>
                <span className="font-medium">Sin hueco este día</span> para grupos de{" "}
                <span className="font-semibold">{sinHueco.join(", ")}</span>{" "}
                {sinHueco.length === 1 ? "persona" : "personas"}.
              </span>
            </div>
          )}
          {imposibles.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span>
                El local no admite grupos de{" "}
                <span className="font-medium">{imposibles.join(", ")}</span> en ningún caso.
              </span>
            </div>
          )}
        </div>
      )}

      <Card className="overflow-hidden">
        {!data ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium w-16">Grupo</th>
                  <th className="px-3 py-2 text-right font-medium w-24">Libres</th>
                  <th className="px-3 py-2 text-right font-medium w-20">Total</th>
                  {zonas.map((z) => (
                    <th key={z} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                      {z}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filas.map((f) => {
                  const abierta = expandida === f.personas;
                  return (
                    <Fragment key={f.personas}>
                      <tr
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() =>
                          setExpandida(abierta ? null : f.personas)
                        }
                      >
                        <td className="px-3 py-2 font-semibold tabular-nums">{f.personas}</td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${tonoLibres(f.libres, f.total)}`}
                        >
                          {f.total === 0 ? "—" : f.libres}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {f.total === 0 ? "—" : f.total}
                        </td>
                        {zonas.map((z) => {
                          const dz = f.porZona.find((x) => x.zona === z);
                          if (!dz) {
                            return (
                              <td
                                key={z}
                                className="px-3 py-2 text-right text-muted-foreground/30"
                              >
                                ·
                              </td>
                            );
                          }
                          return (
                            <td key={z} className="px-3 py-2 text-right tabular-nums">
                              {/* Solo se colorea lo que quede LIBRE. El total va
                                  siempre en gris: si no, un "0/1" pintaba el 1 de
                                  rojo y parecía que el error era ese 1. */}
                              <span className={tonoLibres(dz.libres, dz.total)}>
                                {dz.libres}
                              </span>
                              <span className="text-muted-foreground/60">/{dz.total}</span>
                            </td>
                          );
                        })}
                        <td className="px-2 text-muted-foreground">
                          {f.total > 0 &&
                            (abierta ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            ))}
                        </td>
                      </tr>

                      {abierta && f.total > 0 && (
                        <tr className="bg-muted/20">
                          <td colSpan={zonas.length + 4} className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              {f.opciones.map((o) => (
                                <span
                                  key={o.codigo}
                                  className={[
                                    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]",
                                    o.libre
                                      ? "bg-card"
                                      : "bg-destructive/5 border-destructive/20 text-muted-foreground line-through",
                                    o.esCombinacion ? "border-dashed" : "",
                                  ].join(" ")}
                                  title={
                                    o.libre
                                      ? `${o.zona} — ${o.capacidadMin}–${o.capacidadMax} plazas`
                                      : `Ocupada por: ${o.bloqueadaPor.join(", ")}`
                                  }
                                >
                                  {o.codigo}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Una combinación solo cuenta como libre si lo están todas sus mesas. Pulsa una fila para
        ver el detalle; las tachadas están ocupadas.
      </p>
    </div>
  );
}
