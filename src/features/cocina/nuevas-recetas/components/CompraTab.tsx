"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  listCompras, upsertCompra, deleteCompra,
  listProveedoresEmpresa, listProductosCompra,
} from "../actions/compra-actions";
import type { Compra } from "../types";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

interface Props {
  recetaId: string;
}

interface ComprasDraft {
  id?: string;
  proveedor_id: string | null;
  proveedor_nombre_libre: string;
  producto_id: string | null;
  producto_nombre_propuesto: string;
  cantidad: string;
  unidad: string;
  precio_propuesto: string;
  fecha_recepcion_prevista: string;
  notas: string;
}

const empty: ComprasDraft = {
  proveedor_id: null,
  proveedor_nombre_libre: "",
  producto_id: null,
  producto_nombre_propuesto: "",
  cantidad: "",
  unidad: "kg",
  precio_propuesto: "",
  fecha_recepcion_prevista: "",
  notas: "",
};

export function CompraTab({ recetaId }: Props) {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Array<{ id: string; nombre_comercial: string }>>([]);
  const [productos, setProductos] = useState<Array<{ id: string; nombre: string; categoria: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ComprasDraft>(empty);
  const [showForm, setShowForm] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const [cRes, pRes, prRes] = await Promise.all([
      listCompras(recetaId),
      listProveedoresEmpresa(),
      listProductosCompra(),
    ]);
    if (cRes.ok) setCompras(cRes.data);
    if (pRes.ok) setProveedores(pRes.data);
    if (prRes.ok) setProductos(prRes.data);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recetaId]);

  async function guardar() {
    const nombreProd = draft.producto_id
      ? productos.find((p) => p.id === draft.producto_id)?.nombre ?? ""
      : draft.producto_nombre_propuesto.trim();
    if (!nombreProd) {
      toast.error("Falta producto");
      return;
    }
    const res = await upsertCompra({
      id: draft.id,
      receta_id: recetaId,
      proveedor_id: draft.proveedor_id,
      proveedor_nombre_libre: draft.proveedor_id ? null : draft.proveedor_nombre_libre.trim() || null,
      producto_id: draft.producto_id,
      producto_nombre_propuesto: draft.producto_id ? null : draft.producto_nombre_propuesto.trim(),
      cantidad: draft.cantidad ? parseFloat(draft.cantidad) : null,
      unidad: draft.unidad,
      precio_propuesto: draft.precio_propuesto ? parseFloat(draft.precio_propuesto) : null,
      fecha_recepcion_prevista: draft.fecha_recepcion_prevista || null,
      notas: draft.notas.trim() || null,
    });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(draft.id ? "Compra actualizada" : "Compra añadida");
    setDraft(empty);
    setShowForm(false);
    await cargar();
  }

  async function eliminar(id: string) {
    const res = await deleteCompra(id);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Eliminada");
    await cargar();
  }

  function editar(c: Compra) {
    setDraft({
      id: c.id,
      proveedor_id: c.proveedor_id,
      proveedor_nombre_libre: c.proveedor_nombre_libre ?? "",
      producto_id: c.producto_id,
      producto_nombre_propuesto: c.producto_nombre_propuesto ?? "",
      cantidad: c.cantidad?.toString() ?? "",
      unidad: c.unidad,
      precio_propuesto: c.precio_propuesto?.toString() ?? "",
      fecha_recepcion_prevista: c.fecha_recepcion_prevista ?? "",
      notas: c.notas ?? "",
    });
    setShowForm(true);
  }

  function nombreProveedor(c: Compra): string {
    if (c.proveedor_id) {
      return proveedores.find((p) => p.id === c.proveedor_id)?.nombre_comercial ?? "—";
    }
    return c.proveedor_nombre_libre ?? "—";
  }
  function nombreProducto(c: Compra): string {
    if (c.producto_id) {
      return productos.find((p) => p.id === c.producto_id)?.nombre ?? "—";
    }
    return c.producto_nombre_propuesto ?? "—";
  }

  if (loading) return <LoadingSpinner className="p-4" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Vincula productos y proveedores existentes en Logística, o añade nuevos.
        </p>
        <Button size="sm" onClick={() => { setDraft(empty); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Añadir compra
        </Button>
      </div>

      {/* Listado */}
      {compras.length === 0 && !showForm && (
        <Card className="bg-muted/30">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Sin compras registradas.
          </CardContent>
        </Card>
      )}

      {compras.map((c) => (
        <Card key={c.id} className="cursor-pointer hover:border-primary/40" onClick={() => editar(c)}>
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{nombreProducto(c)}</p>
                <p className="text-xs text-muted-foreground">
                  {nombreProveedor(c)}
                  {c.cantidad ? ` · ${c.cantidad} ${c.unidad}` : ""}
                  {c.precio_propuesto ? ` · ${c.precio_propuesto.toFixed(2)} €` : ""}
                  {c.fecha_recepcion_prevista ? ` · recibe ${c.fecha_recepcion_prevista}` : ""}
                </p>
                {c.notas && <p className="text-xs text-muted-foreground italic mt-1">{c.notas}</p>}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={(e) => { e.stopPropagation(); eliminar(c.id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Formulario alta/edición */}
      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">{draft.id ? "Editar compra" : "Nueva compra"}</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Proveedor</Label>
                <Select
                  value={draft.proveedor_id ?? ""}
                  onValueChange={(v) => setDraft({ ...draft, proveedor_id: v || null })}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Elige proveedor" /></SelectTrigger>
                  <SelectContent>
                    {proveedores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre_comercial}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!draft.proveedor_id && (
                  <Input
                    placeholder="o escribe nombre"
                    value={draft.proveedor_nombre_libre}
                    onChange={(e) => setDraft({ ...draft, proveedor_nombre_libre: e.target.value })}
                    className="mt-1 h-8 text-xs"
                  />
                )}
                <Link
                  href="/logistica/proveedores"
                  target="_blank"
                  className="text-[11px] text-primary hover:underline mt-1 inline-flex items-center gap-0.5"
                >
                  <ExternalLink className="h-3 w-3" /> Gestionar proveedores
                </Link>
              </div>

              <div>
                <Label className="text-xs">Producto</Label>
                <Select
                  value={draft.producto_id ?? ""}
                  onValueChange={(v) => setDraft({ ...draft, producto_id: v || null })}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Elige producto" /></SelectTrigger>
                  <SelectContent>
                    {productos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre} <span className="text-muted-foreground text-xs">· {p.categoria}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!draft.producto_id && (
                  <Input
                    placeholder="o escribe nombre nuevo"
                    value={draft.producto_nombre_propuesto}
                    onChange={(e) => setDraft({ ...draft, producto_nombre_propuesto: e.target.value })}
                    className="mt-1 h-8 text-xs"
                  />
                )}
              </div>

              <div>
                <Label className="text-xs">Cantidad</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.cantidad}
                  onChange={(e) => setDraft({ ...draft, cantidad: e.target.value })}
                  className="h-9"
                />
              </div>

              <div>
                <Label className="text-xs">Unidad</Label>
                <Input
                  value={draft.unidad}
                  onChange={(e) => setDraft({ ...draft, unidad: e.target.value })}
                  placeholder="kg, g, l..."
                  className="h-9"
                />
              </div>

              <div>
                <Label className="text-xs">Precio proveedor (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.precio_propuesto}
                  onChange={(e) => setDraft({ ...draft, precio_propuesto: e.target.value })}
                  className="h-9"
                />
              </div>

              <div>
                <Label className="text-xs">Fecha recepción prevista</Label>
                <Input
                  type="date"
                  value={draft.fecha_recepcion_prevista}
                  onChange={(e) => setDraft({ ...draft, fecha_recepcion_prevista: e.target.value })}
                  className="h-9"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-xs">Notas</Label>
                <Input
                  value={draft.notas}
                  onChange={(e) => setDraft({ ...draft, notas: e.target.value })}
                  placeholder="Condiciones, pedido mínimo, alternativas..."
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => { setDraft(empty); setShowForm(false); }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={guardar}>Guardar</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
