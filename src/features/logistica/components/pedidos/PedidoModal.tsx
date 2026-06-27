import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatEur, formatNumero } from "@/shared/lib/numero";
import { ALMACENES, type Pedido, type LineaPedido, type RepartoProveedor, calcLineaTotal, evaluarReparto, sugerirEntregaDesdeReparto, describirReparto, formatoHoraReparto } from "@/features/logistica/data/pedidos";
import { listProveedores } from "@/features/logistica/actions/proveedores-actions";
import { listProductos } from "@/features/logistica/actions/producto-actions";
import type { Producto } from "@/features/logistica/data/productos";
import { Trash2, Plus, Check, ChevronsUpDown, Search, AlertTriangle } from "lucide-react";

/** Reparto vigente de un proveedor: negociado con nosotros con prioridad; si no, el genérico. */
type ProveedorOpcion = { id: string; nombre: string; reparto: RepartoProveedor };
function repartoDeRow(row: Record<string, unknown>): RepartoProveedor {
  const diasNeg = (row.dias_reparto_negociados as string[] | null) ?? [];
  const dias = diasNeg.length > 0 ? diasNeg : ((row.dias_reparto as string[] | null) ?? []);
  const horario = (diasNeg.length > 0
    ? (row.horario_reparto_negociado as Record<string, string> | null)
    : (row.horario_reparto as Record<string, string> | null)) ?? {};
  return { dias, horario, principal: (row.dia_reparto_principal as string | null) ?? null };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (p: Pedido) => void;
  item: Pedido | null;
  empresaId: string;
  empresaNombre: string;
}

const emptyLinea = (): LineaPedido => ({
  id: `lp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  productoId: "", producto: "", cantidad: 1, unidad: "kg", servida: 0,
  precioUC: 0, impuesto: 10, dtoPct: 0, dtoEur: 0, total: 0,
});

// ── Buscador de producto — dropdown nativo (sin portal, funciona dentro de Dialog) ──────
interface ProductoSearchProps {
  value: string;       // nombre del producto seleccionado
  productoId: string;  // id del producto ("" = sin seleccionar)
  onSelectProduct: (nombre: string, unidad: string, precio: number, id: string, iva: number) => void;
  onClear: () => void;
  proveedor: string;
  productos: Producto[];
}

function ProductoSearch({ value, productoId, onSelectProduct, onClear, proveedor, productos }: ProductoSearchProps) {
  const [open, setOpen] = useState(false);
  const [soloProveedor, setSoloProveedor] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    let list = productos;
    if (soloProveedor && proveedor) {
      list = list.filter((p) => p.proveedor?.toLowerCase() === proveedor.toLowerCase());
    }
    if (query.trim()) {
      const s = query.toLowerCase();
      list = list.filter((p) => p.nombre.toLowerCase().includes(s));
    }
    return list.slice(0, 30);
  }, [productos, soloProveedor, proveedor, query]);

  const isSelected = !!productoId;

  return (
    <div ref={containerRef} className="relative w-full min-w-[180px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-8 w-full items-center justify-between rounded-md border px-2 text-xs transition-colors
          ${isSelected ? "border-green-500 bg-green-50/30 dark:bg-green-950/20" : "border-input bg-background hover:bg-muted/30"}
        `}
      >
        <span className={`truncate ${!value ? "text-muted-foreground" : ""}`}>
          {value || "Seleccionar producto..."}
        </span>
        <span className="ml-1 shrink-0">
          {isSelected
            ? <Check className="h-3 w-3 text-green-500" />
            : <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
          }
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") { setOpen(false); }
              }}
              placeholder="Buscar producto..."
              className="flex h-9 w-full bg-transparent py-2 text-xs outline-none placeholder:text-muted-foreground"
              autoComplete="off"
            />
          </div>

          {proveedor && (
            <div className="border-b px-3 py-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={soloProveedor}
                  onChange={(e) => setSoloProveedor(e.target.checked)}
                  className="h-3 w-3"
                />
                <span>Solo de <span className="font-semibold text-foreground uppercase">{proveedor}</span></span>
              </label>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">Sin resultados</div>
            ) : (
              filtered.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    const precio = parseFloat(p.precioCompra ?? "0") || 0;
                    const iva = parseFloat(p.iva ?? "10") || 10;
                    onSelectProduct(p.nombre, p.medida, precio, p.id, iva);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  <span className="truncate font-medium">{p.nombre}</span>
                  <span className="text-muted-foreground shrink-0">{p.medida}</span>
                  {p.id === productoId && <Check className="h-3 w-3 text-green-500 shrink-0" />}
                </button>
              ))
            )}
          </div>

          {isSelected && (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={() => { onClear(); setOpen(false); }}
                className="w-full rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left"
              >
                Quitar producto
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal principal ────────────────────────────────────────────────────────────
export function PedidoModal({ open, onClose, onSave, item, empresaId, empresaNombre }: Props) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const isEdit = !!item;
  const almacenes = ALMACENES[empresaId] || ALMACENES.habana || ["COCINA", "BARRA"];
  const [proveedores, setProveedores] = useState<ProveedorOpcion[]>([]);
  const [productosList, setProductosList] = useState<Producto[]>([]);

  useEffect(() => {
    listProveedores().then((res) => {
      if (res.ok) {
        const opts = (res.data as unknown as Array<Record<string, unknown>>)
          .map((r) => ({
            id: (r.id as string) ?? "",
            nombre: ((r.nombre_comercial as string) ?? (r.nombre as string) ?? ""),
            reparto: repartoDeRow(r),
          }))
          .filter((o) => !!o.nombre)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        setProveedores(opts);
      }
    });
    listProductos().then((list) => {
      setProductosList(list);
      // Backfill productoId en líneas existentes que no lo tengan
      setForm((prev) => ({
        ...prev,
        lineas: prev.lineas.map((l) => {
          if (l.productoId) return l;
          const match = list.find((p) => p.nombre.toLowerCase() === l.producto.toLowerCase());
          return match ? { ...l, productoId: match.id } : l;
        }),
      }));
    });
  }, []);

  const [form, setForm] = useState(() => item ? { ...item } : {
    id: `ped-${Date.now()}`, numero: `PED-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    empresaId, empresa: empresaNombre, proveedor: "", proveedorId: "",
    almacen: almacenes[0] ?? "", fecha: new Date().toISOString().slice(0, 10),
    fechaEntrega: "", horaEntrega: "", horaEntregaHasta: "", estado: "Borrador" as const,
    lineas: [emptyLinea()], dtoPct: 0, dtoEur: 0, notas: "",
    albaranId: null, creador: "Usuario actual", ultimaActualizacion: new Date().toISOString().slice(0, 10),
  });

  // Proveedor seleccionado (para su reparto) + evaluación día/hora vs. lo estipulado.
  const proveedorSel = useMemo(
    () => proveedores.find((p) => p.nombre === form.proveedor) ?? null,
    [proveedores, form.proveedor],
  );
  const evalReparto = useMemo(
    () => evaluarReparto(form.fechaEntrega, form.horaEntrega, form.horaEntregaHasta, proveedorSel?.reparto),
    [form.fechaEntrega, form.horaEntrega, form.horaEntregaHasta, proveedorSel],
  );

  /** Al elegir proveedor: fija id y auto-rellena día + rango de hora desde su reparto (si no hay valores ya). */
  const onSelectProveedor = (nombre: string) => {
    const prov = proveedores.find((p) => p.nombre === nombre) ?? null;
    setForm((p) => {
      const next = { ...p, proveedor: nombre, proveedorId: prov?.id ?? "" };
      const sug = prov ? sugerirEntregaDesdeReparto(prov.reparto, p.fecha) : null;
      // Solo auto-rellena si el usuario no ha fijado ya una fecha/hora manualmente.
      if (sug && !p.fechaEntrega) next.fechaEntrega = sug.fecha;
      if (sug && !p.horaEntrega) next.horaEntrega = sug.horaDesde;
      if (sug && !p.horaEntregaHasta) next.horaEntregaHasta = sug.horaHasta;
      return next;
    });
    setSaveError(null);
  };

  const setField = (f: string, v: string | number) => setForm((p) => ({ ...p, [f]: v }));

  const updateLinea = (idx: number, field: string, val: string | number) => {
    setForm((prev) => {
      const lineas = [...prev.lineas];
      const l = { ...lineas[idx], [field]: val };
      l.total = calcLineaTotal(l);
      lineas[idx] = l;
      return { ...prev, lineas };
    });
  };

  const updateLineaFields = (idx: number, fields: Partial<LineaPedido>) => {
    setForm((prev) => {
      const lineas = [...prev.lineas];
      const l = { ...lineas[idx], ...fields };
      l.total = calcLineaTotal(l);
      lineas[idx] = l;
      return { ...prev, lineas };
    });
  };

  const addLinea = () => setForm((p) => ({ ...p, lineas: [...p.lineas, emptyLinea()] }));
  const removeLinea = (idx: number) => setForm((p) => ({ ...p, lineas: p.lineas.filter((_, i) => i !== idx) }));

  // ── Resumen IVA ──────────────────────────────────────────────────────────────
  const resumenIva = useMemo(() => {
    const byRate: Record<number, { base: number; cuota: number }> = {};
    for (const l of form.lineas) {
      if (!l.productoId) continue;
      const base = calcLineaTotal(l);
      const rate = l.impuesto ?? 0;
      if (!byRate[rate]) byRate[rate] = { base: 0, cuota: 0 };
      byRate[rate].base += base;
      byRate[rate].cuota += Math.round(base * (rate / 100) * 100) / 100;
    }
    // Descuentos globales sobre base total
    const baseTotal = Object.values(byRate).reduce((s, v) => s + v.base, 0);
    const dtoGlobal = Math.round((baseTotal * ((form.dtoPct ?? 0) / 100) + (form.dtoEur ?? 0)) * 100) / 100;
    const baseConDto = Math.round((baseTotal - dtoGlobal) * 100) / 100;
    const cuotaTotal = Object.values(byRate).reduce((s, v) => s + v.cuota, 0);
    const totalConIva = Math.round((baseConDto + cuotaTotal) * 100) / 100;
    return { byRate, baseTotal, dtoGlobal, baseConDto, cuotaTotal, totalConIva };
  }, [form.lineas, form.dtoPct, form.dtoEur]);

  const handleSave = () => {
    setSaveError(null);
    if (!form.proveedor) {
      setSaveError("Debes seleccionar un proveedor antes de guardar el pedido.");
      return;
    }
    const invalidLines = form.lineas.filter((l) => !l.productoId || !l.producto.trim());
    if (invalidLines.length > 0) {
      setSaveError(`Hay ${invalidLines.length} línea(s) sin producto válido. Selecciona productos de la lista.`);
      return;
    }
    const updated = { ...form, ultimaActualizacion: new Date().toISOString().slice(0, 10) };
    onSave(updated as Pedido);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{isEdit ? `Editar Pedido ${form.numero}` : "Nuevo Pedido"}</DialogTitle>
        </DialogHeader>

        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-semibold">
              Proveedor <span className="text-destructive">*</span>
            </Label>
            <Select value={form.proveedor} onValueChange={onSelectProveedor}>
              <SelectTrigger className={`uppercase ${!form.proveedor ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Seleccionar proveedor..." />
              </SelectTrigger>
              <SelectContent>{proveedores.map((p) => <SelectItem key={p.id || p.nombre} value={p.nombre} className="uppercase">{p.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs font-semibold">Almacén</Label>
            <Select value={form.almacen} onValueChange={(v) => setField("almacen", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{almacenes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs font-semibold">Fecha</Label><Input type="date" value={form.fecha} onChange={(e) => setField("fecha", e.target.value)} /></div>
          <div><Label className="text-xs font-semibold">Día de reparto (entrega)</Label><Input type="date" value={form.fechaEntrega} onChange={(e) => setField("fechaEntrega", e.target.value)} /></div>
          <div>
            <Label className="text-xs font-semibold">Hora de reparto (entre dos horas)</Label>
            <div className="flex items-center gap-1.5">
              <Input type="time" value={form.horaEntrega ?? ""} onChange={(e) => setField("horaEntrega", e.target.value)} />
              <span className="text-muted-foreground text-xs">a</span>
              <Input type="time" value={form.horaEntregaHasta ?? ""} onChange={(e) => setField("horaEntregaHasta", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Aviso: día/hora de entrega fuera del reparto estipulado por el proveedor */}
        {proveedorSel && (evalReparto.fueraDia || evalReparto.fueraHora) && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Reparto fuera de lo estipulado con el proveedor</p>
              <p>
                {evalReparto.fueraDia && <>Has marcado entrega en <span className="font-semibold">{evalReparto.diaSemana}</span>. </>}
                {evalReparto.fueraHora && <>El horario <span className="font-semibold">{formatoHoraReparto(form.horaEntrega, form.horaEntregaHasta)}</span> está fuera de su franja. </>}
                El proveedor reparte: <span className="font-semibold">{describirReparto(proveedorSel.reparto)}</span>.
              </p>
              <p className="opacity-80">Puedes guardar igualmente; quedará marcado como aviso en el pedido y en el PDF.</p>
            </div>
          </div>
        )}

        {/* Lineas */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-foreground">PRODUCTOS</h3>
            <Button size="sm" variant="outline" onClick={addLinea} className="gap-1"><Plus className="h-3 w-3" /> Añadir línea</Button>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-muted/50 border-b">
                {["Producto", "Cant.", "Ud.", "Precio U.C.", "% Imp.", "Dto %", "Dto €", "Total €", ""].map((h) => (
                  <th key={h || "act"} className="px-2 py-2 text-left font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {form.lineas.map((l, i) => (
                  <tr key={l.id} className="border-b">
                    <td className="px-2 py-1">
                      <ProductoSearch
                        value={l.producto}
                        productoId={l.productoId}
                        onSelectProduct={(nombre, unidad, precio, id, iva) =>
                          updateLineaFields(i, { producto: nombre, unidad, precioUC: precio, productoId: id, impuesto: iva })
                        }
                        onClear={() => updateLineaFields(i, { producto: "", productoId: "", impuesto: 0 })}
                        proveedor={form.proveedor}
                        productos={productosList}
                      />
                    </td>
                    <td className="px-2 py-1"><Input className="h-8 text-xs w-16" type="number" value={l.cantidad} onChange={(e) => updateLinea(i, "cantidad", +e.target.value)} /></td>
                    <td className="px-2 py-1"><Input className="h-8 text-xs w-14" value={l.unidad} onChange={(e) => updateLinea(i, "unidad", e.target.value)} /></td>
                    <td className="px-2 py-1"><Input className="h-8 text-xs w-20" type="number" step="0.01" value={l.precioUC} onChange={(e) => updateLinea(i, "precioUC", +e.target.value)} /></td>
                    <td className="px-2 py-1">
                      <span className="inline-flex h-8 w-14 items-center justify-center rounded-md bg-muted/50 text-xs font-medium text-muted-foreground border border-border">
                        {l.impuesto}%
                      </span>
                    </td>
                    <td className="px-2 py-1"><Input className="h-8 text-xs w-14" type="number" value={l.dtoPct} onChange={(e) => updateLinea(i, "dtoPct", +e.target.value)} /></td>
                    <td className="px-2 py-1"><Input className="h-8 text-xs w-16" type="number" step="0.01" value={l.dtoEur} onChange={(e) => updateLinea(i, "dtoEur", +e.target.value)} /></td>
                    <td className="px-2 py-1 font-semibold text-foreground">{formatNumero(calcLineaTotal(l), { min: 2, max: 2 })}</td>
                    <td className="px-2 py-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLinea(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie — descuentos globales + notas + resumen IVA */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Izquierda: descuentos y notas */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold">Dto % global</Label><Input type="number" value={form.dtoPct} onChange={(e) => setField("dtoPct", +e.target.value)} /></div>
              <div><Label className="text-xs font-semibold">Dto € global</Label><Input type="number" step="0.01" value={form.dtoEur} onChange={(e) => setField("dtoEur", +e.target.value)} /></div>
            </div>
            <div><Label className="text-xs font-semibold">Notas</Label><Textarea value={form.notas} onChange={(e) => setField("notas", e.target.value)} rows={3} /></div>
          </div>

          {/* Derecha: resumen IVA */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-1.5 text-xs self-start">
            <p className="font-bold text-sm mb-2">Resumen</p>

            {/* Base bruta */}
            <div className="flex justify-between text-muted-foreground">
              <span>Base imponible</span>
              <span className="font-medium text-foreground">{formatEur(resumenIva.baseTotal)}</span>
            </div>

            {/* Descuentos globales */}
            {resumenIva.dtoGlobal > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Descuentos globales</span>
                <span className="font-medium text-destructive">-{formatEur(resumenIva.dtoGlobal)}</span>
              </div>
            )}

            {/* IVA desglosado por tipo */}
            {Object.entries(resumenIva.byRate)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([rate, { cuota }]) => (
                <div key={rate} className="flex justify-between text-muted-foreground">
                  <span>IVA {rate}%</span>
                  <span className="font-medium text-foreground">{cuota.toFixed(2)} €</span>
                </div>
              ))
            }

            {/* Separador */}
            <div className="border-t my-1.5" />

            {/* Total con IVA */}
            <div className="flex justify-between text-base font-bold">
              <span>TOTAL</span>
              <span>{resumenIva.totalConIva.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col items-end gap-2">
          {saveError && (
            <p className="text-xs text-destructive w-full text-right">{saveError}</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave}>{isEdit ? "Guardar cambios" : "Crear pedido"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
