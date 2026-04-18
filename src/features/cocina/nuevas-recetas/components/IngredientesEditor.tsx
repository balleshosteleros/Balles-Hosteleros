"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Sparkles, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { listProductosCompra, type ProductoCompraSimple } from "../actions/compra-actions";
import type { PrioridadIngrediente } from "../types";

export interface IngredienteLinea {
  tempId: string;
  producto_id: string | null;   // si null → es una propuesta (se creará al publicar oficial)
  nombre_libre: string | null;   // si producto_id null, aquí va el nombre propuesto
  cantidad: number | null;
  unidad: string;
  prioridad: PrioridadIngrediente;
}

export function nuevaLinea(): IngredienteLinea {
  return {
    tempId: crypto.randomUUID(),
    producto_id: null,
    nombre_libre: "",
    cantidad: null,
    unidad: "g",
    prioridad: "secundario",
  };
}

// Unidades permitidas para productos PROPUESTOS (aún no dados de alta)
// Se limita a formatos estándar — no se permite texto libre.
const UNIDADES_PROPUESTA = ["g", "kg", "ml", "L", "ud", "caja", "docena"];

interface Props {
  value: IngredienteLinea[];
  onChange: (next: IngredienteLinea[]) => void;
}

export function IngredientesEditor({ value, onChange }: Props) {
  const [productos, setProductos] = useState<ProductoCompraSimple[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await listProductosCompra();
      if (res.ok) setProductos(res.data);
      setLoading(false);
    })();
  }, []);

  function update(tempId: string, patch: Partial<IngredienteLinea>) {
    onChange(value.map((i) => (i.tempId === tempId ? { ...i, ...patch } : i)));
  }

  function remove(tempId: string) {
    onChange(value.filter((i) => i.tempId !== tempId));
  }

  function addExistente() {
    onChange([...value, nuevaLinea()]);
  }

  function addPropuesta() {
    onChange([
      ...value,
      { ...nuevaLinea(), producto_id: null, nombre_libre: "" },
    ]);
  }

  // Opciones de unidad para una línea concreta
  function opcionesUnidad(linea: IngredienteLinea): string[] {
    if (!linea.producto_id) return UNIDADES_PROPUESTA;
    const prod = productos.find((p) => p.id === linea.producto_id);
    if (!prod) return UNIDADES_PROPUESTA;
    // Unidad de uso (en escandallo) + unidad de compra (si distinta)
    const opts = new Set<string>();
    if (prod.unidad_uso) opts.add(prod.unidad_uso);
    opts.add(prod.unidad);
    return Array.from(opts);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Ingredientes</Label>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={addExistente}
            className="h-7 gap-1 text-xs"
          >
            <Plus className="h-3 w-3" /> Producto de compra
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={addPropuesta}
            className="h-7 gap-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <Sparkles className="h-3 w-3" /> Propuesto nuevo
          </Button>
        </div>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground italic">Cargando productos...</p>
      )}

      {!loading && value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Sin ingredientes. Añade uno existente de Logística o propón uno nuevo.
        </p>
      )}

      {value.map((ing) => {
        const esPropuesta = !ing.producto_id;
        const unidades = opcionesUnidad(ing);
        return (
          <div
            key={ing.tempId}
            className={cn(
              "flex gap-1.5 items-center p-2 rounded-md border",
              esPropuesta ? "bg-amber-50/40 border-amber-200" : "bg-card border-border",
            )}
          >
            {/* Selector producto o input propuesta */}
            <div className="flex-1 min-w-0">
              {esPropuesta ? (
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-amber-100 text-amber-800 border-0 text-[9px] h-4 px-1.5 shrink-0">
                    PROPUESTO
                  </Badge>
                  <Input
                    placeholder="Nombre del producto propuesto"
                    value={ing.nombre_libre ?? ""}
                    onChange={(e) => update(ing.tempId, { nombre_libre: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              ) : (
                <Select
                  value={ing.producto_id ?? ""}
                  onValueChange={(v) => {
                    const prod = productos.find((p) => p.id === v);
                    update(ing.tempId, {
                      producto_id: v || null,
                      nombre_libre: null,
                      unidad: prod?.unidad_uso || prod?.unidad || "g",
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Elige producto de compra" /></SelectTrigger>
                  <SelectContent>
                    {productos.length === 0 && (
                      <div className="p-2 text-xs text-muted-foreground">
                        No hay productos de compra en Logística
                      </div>
                    )}
                    {productos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}{" "}
                        <span className="text-muted-foreground text-xs">· {p.categoria}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Cantidad */}
            <Input
              type="number"
              step="0.01"
              placeholder="Cant."
              value={ing.cantidad ?? ""}
              onChange={(e) =>
                update(ing.tempId, {
                  cantidad: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              className="w-20 h-8 text-sm"
            />

            {/* Unidad — dropdown cerrado, no texto libre */}
            <Select
              value={ing.unidad}
              onValueChange={(v) => update(ing.tempId, { unidad: v })}
            >
              <SelectTrigger className="w-20 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Prioridad */}
            <Select
              value={ing.prioridad}
              onValueChange={(v) =>
                update(ing.tempId, { prioridad: v as PrioridadIngrediente })
              }
            >
              <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="principal">Principal</SelectItem>
                <SelectItem value="secundario">Secundario</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive shrink-0"
              onClick={() => remove(ing.tempId)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}

      <Link
        href="/logistica/productos"
        target="_blank"
        className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
      >
        <ExternalLink className="h-3 w-3" /> Gestionar productos de compra en Logística
      </Link>
    </div>
  );
}
