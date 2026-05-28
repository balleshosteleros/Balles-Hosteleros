"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, ExternalLink, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  listTarifas,
  listPreciosByProducto,
  upsertPrecioTarifa,
  deletePrecioTarifa,
  type Tarifa,
  type ProductoTarifaPrecio,
} from "@/features/logistica/actions/tarifas-actions";

function parseImporte(s: string | number | null | undefined): number {
  if (s === null || s === undefined || s === "") return NaN;
  if (typeof s === "number") return Number.isFinite(s) ? s : NaN;
  const n = parseFloat(String(s).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function TarifaPreciosSection({
  productoId,
}: {
  productoId: string;
}) {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [precios, setPrecios] = useState<ProductoTarifaPrecio[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, pRes] = await Promise.all([
      listTarifas({ soloActivas: true }),
      listPreciosByProducto(productoId),
    ]);
    if (tRes.ok) setTarifas(tRes.data);
    if (pRes.ok) setPrecios(pRes.data);
    setLoading(false);
  }, [productoId]);

  useEffect(() => {
    load();
  }, [load]);

  const precioMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of precios) m.set(p.tarifaId, p.precio);
    return m;
  }, [precios]);

  const tarifaDefault = useMemo(() => tarifas.find((t) => t.esDefault), [tarifas]);
  const precioBase = tarifaDefault ? precioMap.get(tarifaDefault.id) ?? NaN : NaN;

  const handleSave = async (tarifa: Tarifa) => {
    const raw = (draft[tarifa.id] ?? "").trim();
    if (!raw) {
      toast.error("Introduce un precio");
      return;
    }
    const precio = parseImporte(raw);
    if (!Number.isFinite(precio) || precio < 0) {
      toast.error("Precio inválido");
      return;
    }
    setSavingId(tarifa.id);
    const res = await upsertPrecioTarifa({
      productoId,
      tarifaId: tarifa.id,
      precio,
    });
    setSavingId(null);
    if (!res.ok) {
      toast.error(res.error ?? "Error al guardar");
      return;
    }
    toast.success(`Precio para "${tarifa.nombre}" guardado`);
    setDraft((d) => {
      const next = { ...d };
      delete next[tarifa.id];
      return next;
    });
    await load();
  };

  const handleClear = async (tarifa: Tarifa) => {
    setSavingId(tarifa.id);
    const res = await deletePrecioTarifa({ productoId, tarifaId: tarifa.id });
    setSavingId(null);
    if (!res.ok) {
      toast.error(res.error ?? "Error al eliminar");
      return;
    }
    toast.success(`Precio específico de "${tarifa.nombre}" eliminado`);
    setDraft((d) => {
      const next = { ...d };
      delete next[tarifa.id];
      return next;
    });
    await load();
  };

  const margenDelta = (precio: number) => {
    if (!Number.isFinite(precioBase) || precioBase <= 0 || !Number.isFinite(precio)) return null;
    return ((precio - precioBase) / precioBase) * 100;
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="h-4 w-4" /> TARIFA
          <Badge variant="secondary" className="text-[10px]">
            {tarifas.length}
          </Badge>
        </CardTitle>
        <Link
          href="/sala/tarifas"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Configurar tarifas <ExternalLink className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSpinner className="py-6" />
        ) : tarifas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay tarifas activas.{" "}
            <Link href="/sala/tarifas" className="underline">
              Crear la primera
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 font-bold">TARIFA</th>
                  <th className="text-right py-2 font-bold">PRECIO</th>
                  <th className="text-right py-2 font-bold">Δ vs BASE</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {tarifas.map((t) => {
                  const efectivo = precioMap.get(t.id) ?? null;
                  const tieneEspecifico = precioMap.has(t.id);
                  const draftVal = draft[t.id];
                  const delta =
                    !t.esDefault && efectivo !== null
                      ? margenDelta(efectivo)
                      : null;
                  return (
                    <tr key={t.id} className="border-b">
                      <td className="py-2 font-medium">
                        <span className="flex items-center gap-2">
                          {t.nombre}
                          {t.esDefault && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </span>
                        {t.descripcion && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {t.descripcion}
                          </p>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            value={
                              draftVal ??
                              (precioMap.has(t.id) ? String(precioMap.get(t.id)) : "")
                            }
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, [t.id]: e.target.value }))
                            }
                            placeholder="0,00"
                            className="h-8 w-24 text-right"
                          />
                          <span className="text-xs text-muted-foreground">€</span>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        {t.esDefault ? (
                          <span className="text-[10px] uppercase text-muted-foreground">base</span>
                        ) : delta === null ? (
                          <span className="text-muted-foreground/50">—</span>
                        ) : Math.abs(delta) < 0.01 ? (
                          <span className="text-muted-foreground">0%</span>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              delta > 0
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                : "bg-red-500/10 text-red-600 border-red-500/30"
                            }`}
                          >
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(1)}%
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleSave(t)}
                            disabled={savingId === t.id || draftVal === undefined}
                          >
                            {savingId === t.id ? "..." : "Guardar"}
                          </Button>
                          {tieneEspecifico && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleClear(t)}
                              disabled={savingId === t.id}
                              title="Eliminar precio"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground italic">
          Cada tarifa tiene su propio precio de venta. La marcada como base sirve de referencia para calcular el Δ del resto.
        </p>
      </CardContent>
    </Card>
  );
}
