"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Star, StarOff, Pencil, Trash2, Tag } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  listTarifas,
  createTarifa,
  updateTarifa,
  setTarifaDefault,
  deleteTarifa,
  type Tarifa,
} from "@/features/logistica/actions/tarifas-actions";

export function TarifasView() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Tarifa | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [activa, setActiva] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listTarifas();
    if (res.ok) setTarifas(res.data);
    else toast.error(res.error ?? "Error cargando tarifas");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setNombre("");
    setDescripcion("");
    setActiva(true);
    setDlgOpen(true);
  };

  const openEdit = (t: Tarifa) => {
    setEditing(t);
    setNombre(t.nombre);
    setDescripcion(t.descripcion ?? "");
    setActiva(t.activa);
    setDlgOpen(true);
  };

  const handleSave = async () => {
    const n = nombre.trim();
    if (!n) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const desc = descripcion.trim() || null;
    if (editing) {
      const res = await updateTarifa(editing.id, { nombre: n, descripcion: desc, activa });
      if (!res.ok) {
        toast.error(res.error ?? "Error al guardar");
        return;
      }
      toast.success("Tarifa actualizada");
    } else {
      const res = await createTarifa({ nombre: n, descripcion: desc, activa });
      if (!res.ok) {
        toast.error(res.error ?? "Error al crear");
        return;
      }
      toast.success("Tarifa creada");
    }
    setDlgOpen(false);
    await load();
  };

  const handleSetDefault = async (t: Tarifa) => {
    if (t.esDefault) return;
    const res = await setTarifaDefault(t.id);
    if (!res.ok) {
      toast.error(res.error ?? "Error");
      return;
    }
    toast.success(`"${t.nombre}" es ahora la tarifa default`);
    await load();
  };

  const handleDelete = async (t: Tarifa) => {
    if (t.esDefault) {
      toast.error("No se puede eliminar la tarifa default");
      return;
    }
    if (!confirm(`¿Eliminar la tarifa "${t.nombre}"? Se borrarán también los precios asociados.`)) {
      return;
    }
    const res = await deleteTarifa(t.id);
    if (!res.ok) {
      toast.error(res.error ?? "Error al eliminar");
      return;
    }
    toast.success("Tarifa eliminada");
    await load();
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" /> TARIFAS DE VENTA
            <Badge variant="secondary" className="text-[10px]">
              {tarifas.length}
            </Badge>
          </CardTitle>
          <Button size="sm" className="gap-1" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Nueva tarifa
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSpinner className="py-6" />
          ) : tarifas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay tarifas. Crea la primera para empezar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 font-bold">NOMBRE</th>
                    <th className="text-left py-2 font-bold">DESCRIPCIÓN</th>
                    <th className="text-center py-2 font-bold">DEFAULT</th>
                    <th className="text-center py-2 font-bold">ACTIVA</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tarifas.map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="py-2 font-medium">{t.nombre}</td>
                      <td className="py-2 text-muted-foreground">
                        {t.descripcion ?? <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleSetDefault(t)}
                          title={t.esDefault ? "Tarifa default" : "Marcar como default"}
                        >
                          {t.esDefault ? (
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          ) : (
                            <StarOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </td>
                      <td className="py-2 text-center">
                        {t.activa ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px]">
                            Activa
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400 border-0 text-[10px]">
                            Inactiva
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(t)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(t)}
                            disabled={t.esDefault}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground italic">
            La tarifa marcada como <strong>default</strong> usa el precio de venta del producto. Las
            demás definen un precio específico desde la ficha de cada producto de venta.
          </p>
        </CardContent>
      </Card>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tarifa" : "Nueva tarifa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">Nombre *</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="p. ej. Terraza, Happy Hour, Grupos"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Descripción</Label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Cuándo o a quién se aplica esta tarifa"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label className="text-xs font-bold">Activa</Label>
                <p className="text-[11px] text-muted-foreground">
                  Las tarifas inactivas no se ofrecen al cobrar
                </p>
              </div>
              <Switch checked={activa} onCheckedChange={setActiva} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
