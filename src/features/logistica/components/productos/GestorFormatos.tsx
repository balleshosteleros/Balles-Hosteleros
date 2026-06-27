"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  listUnidadesMedida,
  listFormatosMedida,
  createFormatoMedida,
  updateFormatoMedida,
  deleteFormatoMedida,
  type UnidadMedidaRow,
  type FormatoMedidaRow,
} from "@/features/logistica/actions/catalogos-estandar-actions";
import { parseDecimal } from "@/shared/lib/numero";
import type { TipoProducto } from "@/features/logistica/data/productos";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Gestor de FORMATOS por MEDIDA.
 * - Cada formato pertenece a UNA medida (Kilogramos/Litros/Unidades) → unión medida↔formato.
 * - Cada formato tiene una EQUIVALENCIA: cuánto vale en la medida base (p.ej. "24 Ud" = 24,
 *   "0,5 Kg" = 0,5). Es lo que permite que stock e inventarios cuadren.
 * - El envase es independiente (no se gestiona aquí).
 */
export function GestorFormatos({ tipo, onChanged, refreshKey }: { tipo: TipoProducto; onChanged?: () => void; refreshKey?: number }) {
  const [medidas, setMedidas] = useState<UnidadMedidaRow[]>([]);
  const [formatos, setFormatos] = useState<FormatoMedidaRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Alta inline por medida
  const [creandoEn, setCreandoEn] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaEquiv, setNuevaEquiv] = useState("");

  // Edición inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editEquiv, setEditEquiv] = useState("");

  const [pendiente, setPendiente] = useState<{ id: string; nombre: string } | null>(null);

  const recargar = useCallback(() => {
    setCargando(true);
    Promise.all([listUnidadesMedida(tipo), listFormatosMedida(tipo)]).then(([m, f]) => {
      setMedidas(m.ok ? m.data : []);
      setFormatos(f.ok ? f.data : []);
      setCargando(false);
    });
  }, [tipo]);

  useEffect(() => { recargar(); }, [recargar]);

  // Recargar cuando cambian las medidas en la sección hermana "Unidades de medida".
  useEffect(() => { if (refreshKey !== undefined) recargar(); }, [refreshKey, recargar]);

  const parseEquiv = (s: string): number | null => parseDecimal(s);

  // La equivalencia es OBLIGATORIA y debe ser un número > 0: sin ella el stock
  // y los inventarios no cuadran (ej.: "0,5 Kg" = 0,5, "24 Ud" = 24).
  const equivValida = (s: string): boolean => {
    const n = parseEquiv(s);
    return n != null && n > 0;
  };

  const cerrarNuevo = () => { setCreandoEn(null); setNuevoNombre(""); setNuevaEquiv(""); };

  const onAdd = (unidadId: string) => {
    if (!nuevoNombre.trim()) return;
    if (!equivValida(nuevaEquiv)) { toast.error("La equivalencia es obligatoria y debe ser un número mayor que 0"); return; }
    startTransition(async () => {
      const res = await createFormatoMedida({ unidadId, nombre: nuevoNombre.trim(), equivalencias: parseEquiv(nuevaEquiv), tipo });
      if (!res.ok) { toast.error(res.error ?? "Error al crear"); return; }
      toast.success("Formato añadido");
      cerrarNuevo();
      recargar();
      onChanged?.();
    });
  };

  const onSaveEdit = (id: string) => {
    if (!editNombre.trim()) return;
    if (!equivValida(editEquiv)) { toast.error("La equivalencia es obligatoria y debe ser un número mayor que 0"); return; }
    startTransition(async () => {
      const res = await updateFormatoMedida(id, { nombre: editNombre.trim(), equivalencias: parseEquiv(editEquiv) });
      if (!res.ok) { toast.error(res.error ?? "Error al actualizar"); return; }
      toast.success("Actualizado");
      setEditId(null);
      recargar();
      onChanged?.();
    });
  };

  const onDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteFormatoMedida(id);
      if (!res.ok) { toast.error(res.error ?? "Error al borrar"); return; }
      toast.success("Borrado");
      recargar();
      onChanged?.();
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-foreground">Formatos por medida</label>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Cada formato pertenece a una medida y lleva su <span className="font-medium">equivalencia</span> en la base (ej.: “24 Ud” = 24, “0,5 Kg” = 0,5). Así stock e inventarios cuadran.
        </p>
      </div>

      {cargando ? (
        <div className="rounded-lg border px-3 py-5 text-center text-xs text-muted-foreground">Cargando…</div>
      ) : (
        medidas.map((m) => {
          const suyos = formatos.filter((f) => f.unidad_id === m.id);
          return (
            <div key={m.id} className="rounded-lg border">
              <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
                <span className="text-xs font-bold">{m.codigo}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => { setCreandoEn(creandoEn === m.id ? null : m.id); setNuevoNombre(""); setNuevaEquiv(""); }}
                >
                  <Plus className="h-3.5 w-3.5" /> Formato
                </Button>
              </div>

              {creandoEn === m.id && (
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <Input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Formato (ej: 24 Ud)" className="h-8 text-xs flex-1" autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(m.id); } else if (e.key === "Escape") cerrarNuevo(); }} />
                  <span className="text-[11px] text-muted-foreground">=</span>
                  <Input value={nuevaEquiv} onChange={(e) => setNuevaEquiv(e.target.value)} placeholder="equiv." className="h-8 text-xs w-24"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(m.id); } else if (e.key === "Escape") cerrarNuevo(); }} />
                  <Button size="sm" onClick={() => onAdd(m.id)} disabled={isPending || !nuevoNombre.trim() || !equivValida(nuevaEquiv)} className="h-8 gap-1 shrink-0"><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={cerrarNuevo} className="h-8 shrink-0"><X className="h-3.5 w-3.5" /></Button>
                </div>
              )}

              {suyos.length === 0 ? (
                <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">Sin formatos. Añade uno con “+ Formato”.</div>
              ) : (
                <ul className="divide-y">
                  {suyos.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/30">
                      {editId === f.id ? (
                        <>
                          <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="h-7 text-xs flex-1" autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSaveEdit(f.id); } else if (e.key === "Escape") setEditId(null); }} />
                          <span className="text-[11px] text-muted-foreground">=</span>
                          <Input value={editEquiv} onChange={(e) => setEditEquiv(e.target.value)} placeholder="equiv." className="h-7 text-xs w-24"
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSaveEdit(f.id); } else if (e.key === "Escape") setEditId(null); }} />
                          <button type="button" onClick={() => onSaveEdit(f.id)} disabled={isPending || !editNombre.trim() || !equivValida(editEquiv)} className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40" title="Guardar"><Check className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => setEditId(null)} className="rounded p-1 text-muted-foreground hover:bg-muted" title="Cancelar"><X className="h-3.5 w-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 font-medium">{f.nombre}</span>
                          <span className="text-[10px] text-muted-foreground">= {f.equivalencias ?? "—"}</span>
                          <button type="button" onClick={() => { setEditId(f.id); setEditNombre(f.nombre); setEditEquiv(f.equivalencias != null ? String(f.equivalencias).replace(".", ",") : ""); }} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => setPendiente({ id: f.id, nombre: f.nombre })} disabled={isPending} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40" title="Borrar"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}

      <AlertDialog open={!!pendiente} onOpenChange={(o) => !o && setPendiente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar el formato “{pendiente?.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>No se puede borrar si hay productos que lo usan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendiente) onDelete(pendiente.id); setPendiente(null); }}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
