"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Truck,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import {
  listPreciosCompra,
  type PrecioCompraRow,
} from "@/features/logistica/actions/precios-compra-actions";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

interface Props {
  productoId: string;
  refreshKey?: number;
}

const SIN_PROVEEDOR = "__sin_proveedor__";

function formatEur(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function pctChange(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

function ivaPorcentaje(iva: string | null | undefined): number {
  if (!iva) return 0;
  const n = parseFloat(iva.replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function calcularImporteIva(precio: number, iva: string | null | undefined): number {
  return precio * (ivaPorcentaje(iva) / 100);
}

function calcularPrecioTotal(precio: number, iva: string | null | undefined): number {
  return precio + calcularImporteIva(precio, iva);
}

function DiffBadge({ pct }: { pct: number }) {
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const tone =
    pct > 0
      ? "text-rose-600 dark:text-rose-400"
      : pct < 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] tabular-nums ${tone}`}>
      <Icon className="h-3 w-3" />
      {pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

export function PreciosPorProveedorSection({ productoId, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<PrecioCompraRow[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!productoId) return;
    setLoading(true);
    listPreciosCompra(productoId).then((res) => {
      if (res.ok) setItems(res.data);
      setLoading(false);
    });
  }, [productoId, refreshKey]);

  // Agrupar por proveedor (incluye "sin proveedor" como su propia clave).
  const grupos = useMemo(() => {
    const map = new Map<string, PrecioCompraRow[]>();
    for (const it of items) {
      const key = it.proveedor ?? SIN_PROVEEDOR;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    // Ordenar cada grupo DESC por fecha_inicio (ya viene así de listPreciosCompra,
    // pero garantizamos orden por si acaso).
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.fecha_inicio < b.fecha_inicio ? 1 : -1));
    }
    // Ordenar proveedores alfabéticamente, dejando "sin proveedor" al final.
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === SIN_PROVEEDOR) return 1;
      if (b === SIN_PROVEEDOR) return -1;
      return a.localeCompare(b, "es");
    });
  }, [items]);

  const today = todayIso();

  function vigenteDeGrupo(filas: PrecioCompraRow[]): PrecioCompraRow | null {
    for (const it of filas) {
      if (it.fecha_inicio > today) continue;
      if (it.fecha_fin && it.fecha_fin < today) continue;
      return it;
    }
    return null;
  }

  function toggle(prov: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(prov)) next.delete(prov);
      else next.add(prov);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          Histórico por proveedor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Cargando…
          </div>
        ) : grupos.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 py-6 text-center text-sm text-muted-foreground">
            Aún no se ha registrado ningún precio para este producto.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden divide-y">
            {grupos.map(([provKey, filas]) => {
              const proveedor = provKey === SIN_PROVEEDOR ? "Sin proveedor" : provKey;
              const isOpen = expanded.has(provKey);
              const vig = vigenteDeGrupo(filas);
              const total = filas.length;

              return (
                <div key={provKey} className="bg-card">
                  <button
                    type="button"
                    onClick={() => toggle(provKey)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={`font-medium truncate ${
                          provKey === SIN_PROVEEDOR ? "italic text-muted-foreground" : ""
                        }`}
                      >
                        {proveedor}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {total} {total === 1 ? "precio" : "precios"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {vig ? (
                        <Badge className="text-[10px] bg-primary text-primary-foreground">Vigente</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400"
                        >
                          Sin precio vigente
                        </Badge>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="bg-muted/10 border-t overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Estado</th>
                            <th className="px-3 py-2 font-medium">Formato</th>
                            <th className="px-3 py-2 font-medium">Precio sin IVA</th>
                            <th className="px-3 py-2 font-medium">% IVA</th>
                            <th className="px-3 py-2 font-medium">Importe IVA</th>
                            <th className="px-3 py-2 font-medium">Precio total</th>
                            <th className="px-3 py-2 font-medium">Variación</th>
                            <th className="px-3 py-2 font-medium">Fecha inicio</th>
                            <th className="px-3 py-2 font-medium">Fecha hasta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filas.map((it, i) => {
                            const esVigente = vig?.id === it.id;
                            const importeIva = calcularImporteIva(it.precio, it.iva);
                            const precioTotal = calcularPrecioTotal(it.precio, it.iva);

                            // Variación contra el siguiente comparable del MISMO
                            // proveedor + MISMO formato.
                            let diff: number | null = null;
                            const curFmt = it.formato ?? null;
                            for (let j = i - 1; j >= 0; j--) {
                              const cand = filas[j];
                              if ((cand.formato ?? null) !== curFmt) continue;
                              diff = pctChange(it.precio, cand.precio);
                              break;
                            }

                            return (
                              <tr
                                key={it.id}
                                className={`border-b last:border-b-0 ${
                                  esVigente ? "bg-primary/5" : ""
                                }`}
                              >
                                <td className="px-3 py-1.5 whitespace-nowrap">
                                  {esVigente ? (
                                    <Badge className="text-[10px] bg-primary text-primary-foreground">
                                      Vigente
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                      Inactivo
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                                  {it.formato ?? <span className="italic">—</span>}
                                </td>
                                <td className="px-3 py-1.5 font-medium text-foreground tabular-nums whitespace-nowrap">
                                  {formatEur(it.precio)}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                                  {it.iva ?? "—"}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground tabular-nums whitespace-nowrap">
                                  {it.iva ? formatEur(importeIva) : "—"}
                                </td>
                                <td className="px-3 py-1.5 font-bold text-foreground tabular-nums whitespace-nowrap">
                                  {formatEur(precioTotal)}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap">
                                  {diff != null ? (
                                    <DiffBadge pct={diff} />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                                  {formatFecha(it.fecha_inicio)}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                                  {it.fecha_fin ? formatFecha(it.fecha_fin) : <span className="italic">Indefinido</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground/70 px-1">
          Para añadir o editar precios usa &laquo;Histórico de precios de compra&raquo; arriba.
          La variación se calcula contra la entrada anterior del mismo proveedor y formato.
        </p>
      </CardContent>
    </Card>
  );
}
