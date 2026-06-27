"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { Trash } from "lucide-react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SubmoduleToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { listProductos } from "@/features/logistica/actions/producto-actions";
import type { Producto, TipoProducto } from "@/features/logistica/data/productos";
import { listMermas, createMerma, type MermaRow } from "@/features/cocina/actions/mermas-actions";

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export function MermasView() {
  const { empresaActual } = useEmpresa();
  const [mermas, setMermas] = useState<MermaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);

  const recargar = useCallback(async () => {
    setLoading(true);
    const res = await listMermas();
    setMermas(res.ok ? res.data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar, empresaActual?.id]);

  // ─── Modal nueva merma ───
  const [open, setOpen] = useState(false);
  const [tipoProd, setTipoProd] = useState<TipoProducto>("compra");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Cargar productos del tipo elegido (solo compra y elaboración guardan stock).
  useEffect(() => {
    if (!open) return;
    listProductos(tipoProd).then((data) => setProductos(data));
    setProductoId("");
  }, [tipoProd, open]);

  const productoSel = productos.find((p) => p.id === productoId);
  const unidad = productoSel?.medida ?? "";

  function abrirNueva() {
    setTipoProd("compra");
    setProductoId("");
    setCantidad("");
    setMotivo("");
    setOpen(true);
  }

  async function guardar() {
    if (!productoId || !cantidad.trim() || !motivo.trim()) return;
    setGuardando(true);
    const res = await createMerma({
      productoId,
      cantidad,
      unidad,
      motivo: motivo.trim(),
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo registrar la merma");
      return;
    }
    toast.success("Merma registrada");
    setOpen(false);
    await recargar();
  }

  const filtered = useMemo(() => {
    if (!search) return mermas;
    const s = search.toLowerCase();
    return mermas.filter(
      (m) =>
        (m.producto_nombre ?? "").toLowerCase().includes(s) ||
        m.motivo.toLowerCase().includes(s),
    );
  }, [mermas, search]);

  const columnasDef: ToolbarColumna[] = [
    { campo: "fecha", label: "Fecha", bloqueada: true },
    { campo: "producto", label: "Producto" },
    { campo: "cantidad", label: "Cantidad" },
    { campo: "motivo", label: "Motivo" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (m: MermaRow) => ReactNode }> = {
    fecha: {
      th: <TableHead key="fecha" className="text-xs">Fecha</TableHead>,
      td: (m) => <TableCell key="fecha" className="whitespace-nowrap text-sm">{fmtFecha(m.created_at)}</TableCell>,
    },
    producto: {
      th: <TableHead key="producto" className="text-xs min-w-[180px]">Producto</TableHead>,
      td: (m) => <TableCell key="producto" className="font-medium">{m.producto_nombre ?? "—"}</TableCell>,
    },
    cantidad: {
      th: <TableHead key="cantidad" className="text-xs text-right">Cantidad</TableHead>,
      td: (m) => (
        <TableCell key="cantidad" className="text-right tabular-nums">
          {m.cantidad.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
          {m.unidad ? ` ${m.unidad}` : ""}
        </TableCell>
      ),
    },
    motivo: {
      th: <TableHead key="motivo" className="text-xs">Motivo</TableHead>,
      td: (m) => <TableCell key="motivo" className="text-sm text-muted-foreground">{m.motivo}</TableCell>,
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        textoNuevo="Nueva merma"
        onNuevo={abrirNueva}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>{columnasRender.map((c) => columnDefs[c.campo]?.th)}</TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={20} className="py-12 text-center text-muted-foreground">
                  {loading ? "Cargando mermas…" : "Todavía no hay mermas registradas."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((m) => (
              <TableRow key={m.id}>{columnasRender.map((c) => columnDefs[c.campo]?.td(m))}</TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash className="h-4 w-4 text-rose-600" /> Nueva merma
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de producto</Label>
              <Select value={tipoProd} onValueChange={(v) => setTipoProd(v as TipoProducto)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compra">Compra</SelectItem>
                  <SelectItem value="elaboracion">Elaboración</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Producto</Label>
              <Select value={productoId} onValueChange={setProductoId}>
                <SelectTrigger><SelectValue placeholder="Elige un producto" /></SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cantidad a descontar</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Unidad</Label>
                <Input value={unidad} readOnly disabled placeholder="—" />
              </div>
            </div>
            <div>
              <Label>
                Motivo <span className="text-destructive">*</span>
              </Label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                placeholder="Por qué se descarta (rotura, caducidad, error…)"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">El motivo es obligatorio.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={guardando}>Cancelar</Button>
            <Button
              onClick={guardar}
              disabled={guardando || !productoId || !cantidad.trim() || !motivo.trim()}
            >
              {guardando ? "Guardando…" : "Registrar merma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
