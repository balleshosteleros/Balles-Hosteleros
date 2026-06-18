"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Trash2,
  Loader2,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  History,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import {
  addPrecioCompra,
  deletePrecioCompra,
  listPreciosCompra,
  updatePrecioCompra,
  updatePrecioCompraFechaFin,
  type PrecioCompraRow,
} from "@/features/logistica/actions/precios-compra-actions";
import { ProveedorCombobox } from "@/features/logistica/components/productos/ProveedorCombobox";
import { useCatalogosLogistica } from "@/features/logistica/hooks/useCatalogosLogistica";
import { toast } from "sonner";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

interface Props {
  productoId: string;
  unidad?: string;
  onCurrentChange?: (current: PrecioCompraRow | null) => void;
  onItemsChange?: () => void;
}

const IVA_NONE = "__none__";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

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

function DiffBadge({ pct, label }: { pct: number; label: string }) {
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
      {pct.toFixed(1)}% {label}
    </span>
  );
}

export function PreciosCompraSection({ productoId, unidad, onCurrentChange, onItemsChange }: Props) {
  const [items, setItems] = useState<PrecioCompraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  useGlobalLoadingSync(loading || saving || deletingId !== null);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  // Form state (nuevo precio o edición de uno existente)
  const [precio, setPrecio] = useState("");
  const [iva, setIva] = useState<string>(IVA_NONE);
  const [proveedor, setProveedor] = useState<string>("");
  const [formato, setFormato] = useState<string>("");
  const [fechaInicio, setFechaInicio] = useState(todayIso());
  const [fechaFin, setFechaFin] = useState<string>("");

  const catalogos = useCatalogosLogistica();
  const formatosUnidad = useMemo(
    () => (unidad ? catalogos.formatosPorUnidad[unidad] ?? [] : []),
    [unidad, catalogos.formatosPorUnidad],
  );

  const cargar = async (notify = false) => {
    setLoading(true);
    const res = await listPreciosCompra(productoId);
    if (res.ok) setItems(res.data);
    setLoading(false);
    if (notify) onItemsChange?.();
  };

  useEffect(() => {
    if (productoId) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId]);

  // items viene en orden DESC por fecha_inicio. El [0] es el más reciente.
  const masReciente = items[0] ?? null;

  // Vigente = el primero por fecha_inicio descendente cuya fecha_inicio <= hoy
  // y que no haya expirado (fecha_fin null o >= hoy).
  const vigente = useMemo<PrecioCompraRow | null>(() => {
    const today = todayIso();
    for (const it of items) {
      if (it.fecha_inicio > today) continue;
      if (it.fecha_fin && it.fecha_fin < today) continue;
      return it;
    }
    return null;
  }, [items]);

  // Si no hay vigente porque la última entrada terminó (fecha_fin pasada).
  const ultimaExpirada = useMemo(() => {
    if (vigente) return null;
    if (!masReciente) return null;
    if (!masReciente.fecha_fin) return null;
    if (masReciente.fecha_fin >= todayIso()) return null;
    return masReciente;
  }, [vigente, masReciente]);

  // Notificar al padre del precio vigente para que lo refleje en otros sitios.
  useEffect(() => {
    onCurrentChange?.(vigente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vigente?.id]);

  // Variación contra el vigente.
  const diffsContraVigente = useMemo(() => {
    if (!vigente) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const it of items) {
      if (it.id === vigente.id) continue;
      m.set(it.id, pctChange(it.precio, vigente.precio));
    }
    return m;
  }, [items, vigente]);

  // Variación contra el siguiente precio comparable (mismo proveedor y mismo
  // formato, ya que comparar precios de distinto formato no tiene sentido para
  // saber si sube o baja). items está en DESC por fecha_inicio → "siguiente" en
  // el tiempo es el primer item con índice menor que comparta proveedor+formato.
  const diffsContraSiguiente = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < items.length; i++) {
      const cur = items[i];
      const curProv = cur.proveedor ?? null;
      const curFmt = cur.formato ?? null;
      for (let j = i - 1; j >= 0; j--) {
        const cand = items[j];
        if ((cand.proveedor ?? null) !== curProv) continue;
        if ((cand.formato ?? null) !== curFmt) continue;
        m.set(cur.id, pctChange(cur.precio, cand.precio));
        break;
      }
    }
    return m;
  }, [items]);

  const resetForm = () => {
    setPrecio("");
    setIva(IVA_NONE);
    setProveedor("");
    setFormato("");
    setFechaInicio(todayIso());
    setFechaFin("");
    setEditingId(null);
  };

  const openForm = () => {
    if (masReciente) {
      setPrecio(String(masReciente.precio).replace(".", ","));
      setIva(masReciente.iva ?? IVA_NONE);
      setProveedor(masReciente.proveedor ?? "");
      setFormato(masReciente.formato ?? "");
    } else {
      resetForm();
    }
    setFechaInicio(todayIso());
    setFechaFin("");
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (row: PrecioCompraRow) => {
    setEditingId(row.id);
    setPrecio(String(row.precio).replace(".", ","));
    setIva(row.iva ?? IVA_NONE);
    setProveedor(row.proveedor ?? "");
    setFormato(row.formato ?? "");
    setFechaInicio(row.fecha_inicio);
    setFechaFin(row.fecha_fin ?? "");
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    resetForm();
  };

  // Última entrada del mismo proveedor (incluye "sin proveedor" como su propia
  // cadena). Usada para validar fecha_inicio en modo "nuevo".
  const ultimaDelProveedor = useMemo<PrecioCompraRow | null>(() => {
    const prov = proveedor || null;
    return (
      items.find(
        (it) => (it.proveedor ?? null) === prov && it.id !== editingId
      ) ?? null
    );
  }, [items, proveedor, editingId]);

  // En modo edición se chequea colisión de fecha_inicio con cualquier otra
  // entrada del mismo proveedor (no sólo la última).
  const choqueEdicion = useMemo<PrecioCompraRow | null>(() => {
    if (!editingId || !fechaInicio) return null;
    const prov = proveedor || null;
    return (
      items.find(
        (it) =>
          (it.proveedor ?? null) === prov &&
          it.id !== editingId &&
          it.fecha_inicio === fechaInicio
      ) ?? null
    );
  }, [editingId, fechaInicio, items, proveedor]);

  // Validación inline (no agresiva): sólo si hay valor y es claramente inválido.
  const fechaInicioError = useMemo(() => {
    if (!fechaInicio) return null;
    if (editingId) {
      if (choqueEdicion) {
        const quien = proveedor ? `de ${proveedor}` : "sin proveedor";
        return `Ya existe un precio ${quien} con esa fecha de inicio`;
      }
      return null;
    }
    if (!ultimaDelProveedor) return null;
    if (fechaInicio <= ultimaDelProveedor.fecha_inicio) {
      const quien = proveedor ? `de ${proveedor}` : "sin proveedor";
      return `Debe ser posterior al último precio ${quien} (${formatFecha(ultimaDelProveedor.fecha_inicio)})`;
    }
    return null;
  }, [fechaInicio, ultimaDelProveedor, proveedor, editingId, choqueEdicion]);

  const fechaFinError = useMemo(() => {
    if (!fechaFin) return null;
    if (!fechaInicio) return null;
    if (fechaFin < fechaInicio) return "No puede ser anterior a la fecha de inicio";
    return null;
  }, [fechaFin, fechaInicio]);

  const handleSave = async () => {
    const precioNum = parseFloat(precio.replace(",", "."));
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      toast.error("Introduce un precio válido");
      return;
    }
    if (!proveedor.trim()) {
      toast.error("Selecciona un proveedor para el precio");
      return;
    }
    if (!fechaInicio) {
      toast.error("Introduce una fecha de inicio válida");
      return;
    }
    if (fechaInicioError) {
      toast.error(fechaInicioError);
      return;
    }
    if (fechaFinError) {
      toast.error(fechaFinError);
      return;
    }

    setSaving(true);
    const res = editingId
      ? await updatePrecioCompra({
          id: editingId,
          precio: precioNum,
          iva: iva === IVA_NONE ? null : iva,
          proveedor,
          formato: formato || null,
          fechaInicio,
        })
      : await addPrecioCompra({
          productoId,
          precio: precioNum,
          iva: iva === IVA_NONE ? null : iva,
          proveedor: proveedor || null,
          formato: formato || null,
          fechaInicio,
          fechaFin: fechaFin || null,
        });

    if (!res.ok) {
      setSaving(false);
      toast.error(res.error || "Error al guardar precio");
      return;
    }

    if (editingId && masReciente?.id === editingId) {
      const original = masReciente.fecha_fin ?? "";
      if ((fechaFin || "") !== original) {
        const finRes = await updatePrecioCompraFechaFin({
          id: editingId,
          fechaFin: fechaFin || null,
        });
        if (!finRes.ok) {
          setSaving(false);
          toast.error(finRes.error || "Error al actualizar la fecha hasta");
          return;
        }
      }
    }
    setSaving(false);

    toast.success(editingId ? "Precio actualizado" : "Precio añadido al histórico");
    setShowForm(false);
    resetForm();
    cargar(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDelete({
      title: "Eliminar entrada",
      description: "¿Eliminar esta entrada del histórico de precios?",
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    setDeletingId(id);
    const res = await deletePrecioCompra(id);
    setDeletingId(null);
    if (!res.ok) {
      toast.error(res.error || "Error al eliminar");
      return;
    }
    toast.success("Entrada eliminada");
    cargar(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Histórico de precios de compra
          </CardTitle>
          {!showForm && (
            <Button type="button" size="sm" className="gap-1" onClick={openForm}>
              <Plus className="h-4 w-4" />
              Añadir precio
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {ultimaExpirada && !showForm && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs leading-relaxed">
              <p className="text-amber-900 dark:text-amber-200 font-medium">
                No hay precio vigente
              </p>
              <p className="text-amber-800/80 dark:text-amber-200/80">
                El último precio terminó el {formatFecha(ultimaExpirada.fecha_fin!)}. Añade un nuevo precio para reanudar la vigencia.
              </p>
            </div>
          </div>
        )}

        {showForm && (
          <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-medium text-foreground/80">
              {editingId ? "Editando precio del histórico" : "Nuevo precio"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Precio (€) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 12,50"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">IVA</Label>
                <Select value={iva} onValueChange={setIva}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={IVA_NONE}>Sin IVA</SelectItem>
                    {catalogos.ivas.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Proveedor *</Label>
                <ProveedorCombobox value={proveedor} onChange={setProveedor} />
                {!proveedor && (
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    Obligatorio: cada precio va asociado a un proveedor.
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Formato</Label>
                <Select
                  value={formato || "none"}
                  onValueChange={(v) => setFormato(v === "none" ? "" : v)}
                  disabled={formatosUnidad.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        formatosUnidad.length === 0 ? "Elige unidad primero" : "Seleccionar"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin formato</SelectItem>
                    {formatosUnidad.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Fecha inicio *</Label>
                <Input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className={fechaInicioError ? "border-destructive" : ""}
                />
                {fechaInicioError && (
                  <p className="text-[11px] text-destructive mt-1">{fechaInicioError}</p>
                )}
              </div>
              {(!editingId || masReciente?.id === editingId) && (
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">
                    Fecha hasta <span className="text-muted-foreground/70">(opcional)</span>
                  </Label>
                  <Input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    min={fechaInicio || undefined}
                    className={fechaFinError ? "border-destructive" : ""}
                  />
                  {fechaFinError ? (
                    <p className="text-[11px] text-destructive mt-1">{fechaFinError}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      Vacío = indefinido
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={cancelForm} disabled={saving}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving || !proveedor.trim() || !!fechaInicioError || !!fechaFinError}
                className="gap-1"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {editingId ? "Guardar cambios" : "Guardar precio"}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Cargando histórico…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 py-6 text-center text-sm text-muted-foreground">
            Aún no hay precios registrados. Añade el primero con el botón &laquo;Añadir precio&raquo;.
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                  <th className="px-3 py-2 font-medium">Formato</th>
                  <th className="px-3 py-2 font-medium">Precio sin IVA</th>
                  <th className="px-3 py-2 font-medium">% IVA</th>
                  <th className="px-3 py-2 font-medium">Importe IVA</th>
                  <th className="px-3 py-2 font-medium">Precio total</th>
                  <th className="px-3 py-2 font-medium">Variación</th>
                  <th className="px-3 py-2 font-medium">Fecha inicio</th>
                  <th className="px-3 py-2 font-medium">Fecha hasta</th>
                  <th className="px-3 py-2 font-medium w-20" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const esVigente = vigente?.id === it.id;
                  const diffVig = diffsContraVigente.get(it.id);
                  const diffSig = diffsContraSiguiente.get(it.id);
                  const importeIva = calcularImporteIva(it.precio, it.iva);
                  const precioTotal = calcularPrecioTotal(it.precio, it.iva);

                  return (
                    <tr
                      key={it.id}
                      className={`border-b hover:bg-muted/30 transition-colors ${
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
                        {it.proveedor ?? <span className="italic">—</span>}
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
                        {esVigente ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {diffSig !== undefined && (
                              <DiffBadge pct={diffSig} label="vs. siguiente" />
                            )}
                            {diffVig !== undefined && (
                              <DiffBadge pct={diffVig} label="vs. vigente" />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                        {formatFecha(it.fecha_inicio)}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                        {it.fecha_fin ? (
                          formatFecha(it.fecha_fin)
                        ) : (
                          <span className="italic">Indefinido</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditForm(it)}
                            disabled={showForm}
                            title="Editar precio"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(it.id)}
                            disabled={deletingId === it.id}
                            title="Eliminar entrada"
                          >
                            {deletingId === it.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {confirmDeleteDialog}
    </Card>
  );
}
