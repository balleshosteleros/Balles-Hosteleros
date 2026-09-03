"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { NumberInput } from "@/shared/components/NumberInput";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { ProductoCompraCombobox } from "@/features/logistica/components/acuerdos/ProductoCompraCombobox";
import {
  listMarcas,
  createMarca,
  updateMarca,
  deleteMarca,
  listReferencias,
  addReferencia,
  updateReferencia,
  deleteReferencia,
  type MarcaRow,
  type ReferenciaRow,
} from "@/features/logistica/actions/marcas-actions";

interface Props {
  onBack: () => void;
  /** Se llama al cerrar para que la tabla recargue las marcas y sus referencias. */
  onChanged?: () => void;
}

export function AcuerdosConfigView({ onBack, onChanged }: Props) {
  const [marcas, setMarcas] = useState<MarcaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tocado, setTocado] = useState(false);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<MarcaRow | null>(null);
  const [nombre, setNombre] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [cif, setCif] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [visibilidad, setVisibilidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [activa, setActiva] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Panel de referencias de la marca abierta.
  const [refsDe, setRefsDe] = useState<MarcaRow | null>(null);
  const [refs, setRefs] = useState<ReferenciaRow[]>([]);
  const [refsLoading, setRefsLoading] = useState(false);
  const [nuevoProductoId, setNuevoProductoId] = useState("");
  const [nuevoRapel, setNuevoRapel] = useState(0);
  const [nuevoObjetivo, setNuevoObjetivo] = useState(0);

  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listMarcas();
    if (res.ok) setMarcas(res.data);
    else toast.error(res.error ?? "Error cargando marcas");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cargarRefs = useCallback(async (marcaId: string) => {
    setRefsLoading(true);
    const res = await listReferencias(marcaId);
    if (res.ok) setRefs(res.data);
    else toast.error(res.error ?? "Error cargando referencias");
    setRefsLoading(false);
  }, []);

  function openNew() {
    setEditing(null);
    setNombre("");
    setRazonSocial("");
    setCif("");
    setFechaInicio("");
    setFechaFin("");
    setVisibilidad("");
    setObservaciones("");
    setActiva(true);
    setDlgOpen(true);
  }

  function openEdit(m: MarcaRow) {
    setEditing(m);
    setNombre(m.nombre);
    setRazonSocial(m.razonSocial ?? "");
    setCif(m.cif ?? "");
    setFechaInicio(m.fechaInicio ?? "");
    setFechaFin(m.fechaFin ?? "");
    setVisibilidad(m.visibilidad ?? "");
    setObservaciones(m.observaciones ?? "");
    setActiva(m.estado === "Activo");
    setDlgOpen(true);
  }

  async function guardar() {
    if (!nombre.trim()) {
      toast.error("El nombre de la marca es obligatorio.");
      return;
    }
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      toast.error("La fecha de fin no puede ser anterior a la de comienzo.");
      return;
    }
    setGuardando(true);
    const payload = {
      nombre: nombre.trim(),
      razonSocial: razonSocial.trim() || null,
      cif: cif.trim() || null,
      fechaInicio: fechaInicio || null,
      fechaFin: fechaFin || null,
      visibilidad: visibilidad.trim() || null,
      observaciones: observaciones.trim() || null,
      estado: activa ? "Activo" : "Inactivo",
    };
    const res = editing
      ? await updateMarca(editing.id, payload)
      : await createMarca(payload);
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se ha podido guardar");
      return;
    }
    toast.success(editing ? "Marca actualizada" : "Marca creada");
    setDlgOpen(false);
    setTocado(true);
    load();
  }

  async function borrar(m: MarcaRow) {
    const ok = await confirmDelete({
      title: "Eliminar marca",
      description: `Se eliminará "${m.nombre}" y sus ${m.referencias} referencias vinculadas. Los albaranes y las compras no se tocan.`,
    });
    if (!ok) return;
    const res = await deleteMarca(m.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se ha podido eliminar");
      return;
    }
    toast.success("Marca eliminada");
    if (refsDe?.id === m.id) setRefsDe(null);
    setTocado(true);
    load();
  }

  async function anadirReferencia() {
    if (!refsDe) return;
    if (!nuevoProductoId) {
      toast.error("Elige una referencia.");
      return;
    }
    const res = await addReferencia({
      marcaId: refsDe.id,
      productoId: nuevoProductoId,
      rapelUnidad: nuevoRapel,
      objetivo: nuevoObjetivo,
    });
    if (!res.ok) {
      toast.error(res.error ?? "No se ha podido añadir");
      return;
    }
    setNuevoProductoId("");
    setNuevoRapel(0);
    setNuevoObjetivo(0);
    setTocado(true);
    cargarRefs(refsDe.id);
    load();
  }

  async function guardarRef(r: ReferenciaRow, campo: "rapelUnidad" | "objetivo", valor: number) {
    setRefs((prev) => prev.map((x) => (x.id === r.id ? { ...x, [campo]: valor } : x)));
    const res = await updateReferencia(r.id, { [campo]: valor });
    if (!res.ok) {
      toast.error(res.error ?? "No se ha podido guardar");
      if (refsDe) cargarRefs(refsDe.id);
      return;
    }
    setTocado(true);
  }

  async function borrarRef(r: ReferenciaRow) {
    const ok = await confirmDelete({
      title: "Quitar referencia",
      description: `"${r.producto}" dejará de contar para este acuerdo.`,
    });
    if (!ok) return;
    const res = await deleteReferencia(r.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se ha podido quitar");
      return;
    }
    setTocado(true);
    if (refsDe) cargarRefs(refsDe.id);
    load();
  }

  function volver() {
    if (tocado) onChanged?.();
    onBack();
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={volver} title="Volver">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">Marcas con acuerdo</h2>
          <p className="text-xs text-muted-foreground">
            Una marca no es un proveedor: pactas el rapel con ella, pero le compras a través de
            proveedores. Vincula aquí las referencias que entran en cada acuerdo.
          </p>
        </div>
        <Button className="ml-auto" onClick={openNew}>
          Nueva marca
        </Button>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2.5 text-left font-medium">Marca</th>
              <th className="px-3 py-2.5 text-left font-medium">Razón social</th>
              <th className="px-3 py-2.5 text-left font-medium">Vigencia</th>
              <th className="px-3 py-2.5 text-right font-medium">Referencias</th>
              <th className="px-3 py-2.5 text-left font-medium">Estado</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && marcas.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10">
                  <LoadingSpinner />
                </td>
              </tr>
            )}
            {!loading && marcas.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  No hay marcas. Crea la primera para empezar.
                </td>
              </tr>
            )}
            {marcas.map((m) => (
              <tr key={m.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-medium">{m.nombre}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{m.razonSocial || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">
                  {m.fechaInicio || m.fechaFin
                    ? `${m.fechaInicio ?? "—"} → ${m.fechaFin ?? "—"}`
                    : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{m.referencias}</td>
                <td className="px-3 py-2.5">
                  {m.estado === "Activo" ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px]">
                      Activo
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400 border-0 text-[10px]">
                      Inactivo
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant={refsDe?.id === m.id ? "default" : "ghost"}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        if (refsDe?.id === m.id) {
                          setRefsDe(null);
                          return;
                        }
                        setRefsDe(m);
                        setNuevoProductoId("");
                        setNuevoRapel(0);
                        setNuevoObjetivo(0);
                        cargarRefs(m.id);
                      }}
                    >
                      Referencias
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(m)}
                      title="Editar"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => borrar(m)}
                      title="Eliminar"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {refsDe && (
        <div className="bg-card rounded-lg border">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <span className="text-sm font-semibold">Referencias de {refsDe.nombre}</span>
            <span className="text-xs text-muted-foreground">
              El rapel es lo que abona la marca por cada unidad comprada.
            </span>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_140px_auto] md:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Referencia</Label>
                <ProductoCompraCombobox
                  value={nuevoProductoId}
                  onChange={(id) => setNuevoProductoId(id)}
                  excluir={refs.map((r) => r.productoId)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rapel por unidad (€)</Label>
                <NumberInput value={nuevoRapel} onValueChange={setNuevoRapel} min={0} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Objetivo (unidades)</Label>
                <NumberInput value={nuevoObjetivo} onValueChange={setNuevoObjetivo} min={0} />
              </div>
              <Button onClick={anadirReferencia} className="h-9">
                <Plus className="h-4 w-4 mr-1" strokeWidth={1.75} />
                Añadir
              </Button>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Referencia</th>
                    <th className="px-3 py-2 text-right font-medium">Rapel por unidad (€)</th>
                    <th className="px-3 py-2 text-right font-medium">Objetivo</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {refsLoading && refs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8">
                        <LoadingSpinner />
                      </td>
                    </tr>
                  )}
                  {!refsLoading && refs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-muted-foreground">
                        Esta marca aún no tiene referencias vinculadas.
                      </td>
                    </tr>
                  )}
                  {refs.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="px-3 py-2">{r.producto}</td>
                      <td className="px-3 py-2">
                        <NumberInput
                          className="h-8 text-right"
                          value={r.rapelUnidad}
                          onValueChange={(v) => guardarRef(r, "rapelUnidad", v)}
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NumberInput
                          className="h-8 text-right"
                          value={r.objetivo}
                          onValueChange={(v) => guardarRef(r, "objetivo", v)}
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => borrarRef(r)}
                          title="Quitar"
                          aria-label="Quitar"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar marca" : "Nueva marca"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Razón social</Label>
                <Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CIF</Label>
                <Input value={cif} onChange={(e) => setCif(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha de comienzo</Label>
                <Input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha de fin</Label>
                <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Visibilidad</Label>
              <Textarea
                rows={2}
                value={visibilidad}
                onChange={(e) => setVisibilidad(e.target.value)}
                placeholder="Contrapartidas pactadas: material, activaciones, presencia en carta..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observaciones</Label>
              <Textarea
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={activa} onCheckedChange={setActiva} id="marca-activa" />
              <Label htmlFor="marca-activa" className="text-xs">
                {activa ? "Activo" : "Inactivo"}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDeleteDialog}
    </div>
  );
}
