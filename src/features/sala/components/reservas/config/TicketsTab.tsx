"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  TICKET_MODO_PRECIO_LABELS,
  estaAgotado,
  stockDisponible,
  type ReservaTicketProducto,
} from "@/features/sala/data/ticket-productos";
import {
  archiveTicketProducto,
  deleteTicketProducto,
  listTicketProductos,
  unarchiveTicketProducto,
} from "@/features/sala/actions/ticket-productos-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { TicketProductoForm } from "./TicketProductoForm";

function fmtEuro(n: number, iva: number): string {
  const total = n * (1 + iva / 100);
  return `${total.toFixed(2)} € (IVA incl.)`;
}

export function TicketsTab() {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const [productos, setProductos] = useState<ReservaTicketProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<ReservaTicketProducto | null>(null);
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await listTicketProductos();
    if (r.ok) setProductos(r.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [productos, busqueda]);

  async function handleArchive(p: ReservaTicketProducto) {
    const r = p.activo
      ? await archiveTicketProducto(p.id)
      : await unarchiveTicketProducto(p.id);
    if (!r.ok) {
      toast.error(r.error ?? "No se pudo guardar");
      return;
    }
    toast.success(p.activo ? "Producto archivado" : "Producto reactivado");
    cargar();
  }

  async function handleDelete(p: ReservaTicketProducto) {
    const ok = await confirmDelete({
      title: "Borrar producto",
      description: `¿Borrar el producto "${p.nombre}"?`,
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    const r = await deleteTicketProducto(p.id);
    if (!r.ok) {
      toast.error(r.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Producto borrado");
    cargar();
  }

  const dialogOpen = creando || editando !== null;

  return (
    <div className="space-y-3">
      {confirmDeleteDialog}
      <div className="flex items-center justify-between gap-3">
        <Button size="sm" onClick={() => setCreando(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo
        </Button>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar"
            className="h-8 pl-7"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Productos que el cliente compra al reservar (cenas evento, brunch, cubierto fijo…). El cobro
        queda pendiente de pasarela: por ahora la reserva se guarda con precio e IVA, sin cargo automático.
      </p>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : visibles.length === 0 ? (
        <div className="border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
          {productos.length === 0
            ? <>Aún no hay productos. Crea el primero con <span className="font-medium">+ Nuevo</span>.</>
            : "Ningún producto coincide con la búsqueda."}
        </div>
      ) : (
        <div className="border rounded-md divide-y">
          {visibles.map((p) => {
            const disponible = stockDisponible(p);
            const agotado = estaAgotado(p);
            return (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{p.nombre}</span>
                    {p.activo ? (
                      <Badge variant="default" className="h-5 text-[10px]">Activo</Badge>
                    ) : (
                      <Badge variant="secondary" className="h-5 text-[10px]">Archivado</Badge>
                    )}
                    {agotado && (
                      <Badge variant="destructive" className="h-5 text-[10px]">Agotado</Badge>
                    )}
                    {p.stockModo === "limitado" && !agotado && disponible !== null && disponible <= 5 && (
                      <Badge variant="outline" className="h-5 text-[10px]">Quedan {disponible}</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{fmtEuro(p.precio, p.iva)}</span>
                    <span>{TICKET_MODO_PRECIO_LABELS[p.modoPrecio]}</span>
                    <span>
                      Stock:{" "}
                      {p.stockModo === "ilimitado"
                        ? "Ilimitado"
                        : `${p.stockConsumido} / ${p.stockTotal} vendidos`}
                    </span>
                    {p.stockModo === "limitado" && p.ocultarAlAgotar && (
                      <span>Se oculta al agotar</span>
                    )}
                    {p.descripcion && <span className="truncate">{p.descripcion}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setEditando(p)}
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => handleArchive(p)}
                  title={p.activo ? "Archivar" : "Reactivar"}
                >
                  {p.activo ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(p)}
                  title="Borrar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCreando(false);
            setEditando(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar producto" : "Nuevo producto"}
            </DialogTitle>
          </DialogHeader>
          <TicketProductoForm
            producto={editando}
            onSaved={() => {
              setCreando(false);
              setEditando(null);
              cargar();
            }}
            onCancel={() => {
              setCreando(false);
              setEditando(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
