"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  listElaboraciones,
  listProductosElaboracion,
  createElaboracion,
  updateElaboracion,
  deleteElaboracion,
  confirmarElaboracion,
  revertirElaboracion,
} from "@/features/cocina/actions/elaboraciones-actions";
import { ESTADO_ELABORACION_COLOR, ESTADO_ELABORACION_LABEL, type EstadoElaboracion } from "@/features/logistica/data/elaboraciones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
  type ToolbarFiltroActivo,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";

type ProductoElab = { id: string; nombre: string; unidad: string };

type ElaboracionRow = {
  id: string;
  productoElaboracionId: string;
  productoNombre: string;
  productoUnidad: string;
  cantidadProducida: number;
  unidad: string;
  fecha: string;
  fechaCaducidad: string | null;
  almacen: "COCINA" | "BARRA";
  estado: EstadoElaboracion;
  descripcion: string;
};

function mapRow(r: Record<string, unknown>): ElaboracionRow {
  const p = r.productos as { nombre?: string; unidad?: string } | null;
  return {
    id: r.id as string,
    productoElaboracionId: (r.producto_elaboracion_id as string) ?? "",
    productoNombre: p?.nombre ?? (r.nombre as string) ?? "—",
    productoUnidad: p?.unidad ?? "",
    cantidadProducida: Number(r.cantidad_producida ?? 0),
    unidad: (r.unidad as string) ?? "",
    fecha: ((r.fecha as string) ?? "").slice(0, 10),
    fechaCaducidad: r.fecha_caducidad ? String(r.fecha_caducidad).slice(0, 10) : null,
    almacen: ((r.almacen as string) ?? "COCINA") as "COCINA" | "BARRA",
    estado: ((r.estado as string) ?? "borrador") as EstadoElaboracion,
    descripcion: (r.descripcion as string) ?? "",
  };
}

/* ════════════════════════════════════════════════════════════
   MODAL: NUEVA / EDITAR ELABORACIÓN (registro de producción)
   ════════════════════════════════════════════════════════════ */
function ElaboracionModal({
  open, onClose, onSaved, productos, existing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  productos: ProductoElab[];
  existing?: ElaboracionRow | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [productoId, setProductoId] = useState(existing?.productoElaboracionId || "");
  const [cantidad, setCantidad] = useState(existing?.cantidadProducida?.toString() || "");
  const [unidad, setUnidad] = useState(existing?.unidad || "kg");
  const [fecha, setFecha] = useState(existing?.fecha || today);
  const [fechaCaducidad, setFechaCaducidad] = useState(existing?.fechaCaducidad || "");
  const [almacen, setAlmacen] = useState<"COCINA" | "BARRA">(existing?.almacen || "COCINA");
  const [descripcion, setDescripcion] = useState(existing?.descripcion || "");
  const [saving, setSaving] = useState(false);

  // Cuando se selecciona producto, hereda su unidad y propone caducidad +5 días
  useEffect(() => {
    if (!productoId || existing) return;
    const p = productos.find(x => x.id === productoId);
    if (p?.unidad) setUnidad(p.unidad);
    if (!fechaCaducidad) {
      const d = new Date(); d.setDate(d.getDate() + 5);
      setFechaCaducidad(d.toISOString().slice(0, 10));
    }
  }, [productoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!productoId || !cantidad || !fecha || !fechaCaducidad) {
      toast.error("Completa producto, cantidad, fecha y caducidad");
      return;
    }
    const cant = parseFloat(cantidad);
    if (isNaN(cant) || cant <= 0) { toast.error("Cantidad no válida"); return; }
    if (fechaCaducidad < fecha) { toast.error("La caducidad no puede ser anterior a la producción"); return; }

    setSaving(true);
    const res = existing
      ? await updateElaboracion(existing.id, {
          productoElaboracionId: productoId,
          cantidadProducida: cant,
          unidad,
          fecha,
          fechaCaducidad,
          almacen,
          descripcion,
        })
      : await createElaboracion({
          productoElaboracionId: productoId,
          cantidadProducida: cant,
          unidad,
          fecha,
          fechaCaducidad,
          almacen,
          descripcion,
        });
    setSaving(false);
    if (res.ok) {
      toast.success(existing ? "Elaboración actualizada" : "Elaboración registrada");
      onSaved();
    } else {
      toast.error("Error al guardar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Editar elaboración" : "Nueva elaboración"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-bold">Elaboración a preparar</Label>
            <Select value={productoId} onValueChange={setProductoId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar elaboración..." /></SelectTrigger>
              <SelectContent>
                {productos.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-bold">Cantidad producida</Label>
              <Input type="number" step="0.01" value={cantidad} onChange={e => setCantidad(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-bold">Unidad</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["kg", "L", "ud"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Almacén</Label>
              <Select value={almacen} onValueChange={(v) => setAlmacen(v as "COCINA" | "BARRA")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COCINA">COCINA</SelectItem>
                  <SelectItem value="BARRA">BARRA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold">Fecha producción</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-bold">Fecha caducidad</Label>
              <Input type="date" value={fechaCaducidad} onChange={e => setFechaCaducidad(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">Observaciones</Label>
            <Textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{existing ? "Guardar" : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL — registros de producción
   ════════════════════════════════════════════════════════════ */
export function ElaboracionesView() {
  useEmpresa();
  const [rows, setRows] = useState<ElaboracionRow[]>([]);
  const [productos, setProductos] = useState<ProductoElab[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [elabRes, prodRes] = await Promise.all([listElaboraciones(), listProductosElaboracion()]);
    if (elabRes.ok) setRows((elabRes.data as Record<string, unknown>[]).map(mapRow));
    if (prodRes.ok) setProductos((prodRes.data as Record<string, unknown>[]).map(p => ({
      id: p.id as string, nombre: p.nombre as string, unidad: (p.unidad as string) ?? "kg",
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ElaboracionRow | null>(null);

  const filtered = useMemo(() => {
    let lista = rows.filter(r => !search || r.productoNombre.toLowerCase().includes(search.toLowerCase()));
    lista = aplicarFiltrosToolbar(lista, filtros, (r, campo) => {
      if (campo === "estado") return ESTADO_ELABORACION_LABEL[r.estado];
      if (campo === "almacen") return r.almacen;
      return (r as unknown as Record<string, unknown>)[campo];
    });
    return lista;
  }, [rows, search, filtros]);

  const handleConfirm = async (id: string) => {
    const res = await confirmarElaboracion(id);
    if (res.ok) { toast.success("Confirmada — sumada al stock"); load(); }
    else toast.error(res.error ?? "Error al confirmar");
  };

  const handleRevert = async (id: string) => {
    const res = await revertirElaboracion(id);
    if (res.ok) { toast.success("Reversión hecha — descontada del stock"); load(); }
    else toast.error(res.error ?? "Error al revertir");
  };

  const handleDelete = async (id: string) => {
    const r = rows.find(x => x.id === id);
    if (!r || r.estado === "confirmado") { toast.error("No se puede borrar una confirmada"); return; }
    const res = await deleteElaboracion(id);
    if (res.ok) { toast.success("Eliminada"); load(); }
    else toast.error("Error al eliminar");
  };

  if (loading) return <LoadingSpinner className="p-4 md:p-6 min-h-[300px]" size="lg" />;

  const today = new Date().toISOString().slice(0, 10);
  const dosDias = new Date(new Date().getTime() + 2 * 86400000).toISOString().slice(0, 10);

  const columnasDef: ToolbarColumna[] = [
    { campo: "producto", label: "Elaboración", bloqueada: true },
    { campo: "cantidad", label: "Cantidad" },
    { campo: "fecha", label: "Producción" },
    { campo: "caducidad", label: "Caducidad" },
    { campo: "almacen", label: "Almacén" },
    { campo: "estado", label: "Estado" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (r: ElaboracionRow) => ReactNode }> = {
    producto: {
      th: <TableColumnHeader key="producto" label="Elaboración" />,
      td: (r) => <td key="producto" className="px-4 py-3 font-semibold text-foreground">{r.productoNombre}</td>,
    },
    cantidad: {
      th: <TableColumnHeader key="cantidad" label="Cantidad" />,
      td: (r) => <td key="cantidad" className="px-4 py-3">{r.cantidadProducida} {r.unidad}</td>,
    },
    fecha: {
      th: <TableColumnHeader key="fecha" label="Producción" />,
      td: (r) => <td key="fecha" className="px-4 py-3 text-muted-foreground">{r.fecha}</td>,
    },
    caducidad: {
      th: <TableColumnHeader key="caducidad" label="Caducidad" />,
      td: (r) => {
        if (!r.fechaCaducidad) return <td key="caducidad" className="px-4 py-3 text-muted-foreground">—</td>;
        const vencida = r.fechaCaducidad < today;
        const pronto = !vencida && r.fechaCaducidad <= dosDias;
        return (
          <td key="caducidad" className="px-4 py-3">
            <span className={vencida ? "text-destructive font-semibold" : pronto ? "text-amber-600 font-semibold" : "text-foreground"}>
              {r.fechaCaducidad}
            </span>
          </td>
        );
      },
    },
    almacen: {
      th: (
        <TableColumnHeader
          key="almacen"
          label="Almacén"
          campo="almacen"
          filtroTipo="lista"
          opciones={["COCINA", "BARRA"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (r) => <td key="almacen" className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{r.almacen}</Badge></td>,
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
          label="Estado"
          campo="estado"
          filtroTipo="lista"
          opciones={["Borrador", "En proceso", "Confirmado", "Archivado"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (r) => (
        <td key="estado" className="px-4 py-3">
          <Badge variant="outline" className={`text-[10px] font-bold ${ESTADO_ELABORACION_COLOR[r.estado]}`}>
            {ESTADO_ELABORACION_LABEL[r.estado]}
          </Badge>
        </td>
      ),
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
        textoNuevo="Nuevo"
        onNuevo={() => { setEditing(null); setModalOpen(true); }}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
      />

      <ResizableColumnsProvider storageKey="cocina-elaboraciones">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                <TableColumnHeader label="" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                  {columnasRender.map((c) => columnDefs[c.campo]?.td(r))}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {r.estado !== "confirmado" && r.estado !== "archivado" && (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleConfirm(r.id)} title="Confirmar y sumar a stock">
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(r); setModalOpen(true); }} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(r.id)} title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                      {r.estado === "confirmado" && (
                        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => handleRevert(r.id)} title="Revertir y descontar del stock">
                          Deshacer
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={20} className="text-center py-12 text-muted-foreground">Sin elaboraciones registradas. Pulsa <strong>+ Nuevo</strong> para añadir la primera.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>

      {modalOpen && (
        <ElaboracionModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); load(); }}
          productos={productos}
          existing={editing}
        />
      )}
    </div>
  );
}
