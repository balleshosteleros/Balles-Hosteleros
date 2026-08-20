"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Shirt, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import {
  listTiposMaterial,
  createTipoMaterial,
  updateTipoMaterial,
  deleteTipoMaterial,
} from "@/features/rrhh/actions/entregas-tipos-actions";
import {
  CATEGORIA_LABEL,
  type CategoriaMaterial,
  type TipoMaterial,
} from "@/features/rrhh/data/entregas";

/**
 * Catálogo de tipos de uniforme y material.
 *
 * Cada empresa se crea aquí sus propias palabras: "Chaquetilla de cocina",
 * "Llaves del local"... Luego se eligen al registrar una entrega.
 */

interface FormState {
  nombre: string;
  categoria: CategoriaMaterial;
  requiereTalla: boolean;
  requiereDevolucion: boolean;
}

const EMPTY_FORM: FormState = {
  nombre: "",
  categoria: "uniforme",
  requiereTalla: false,
  requiereDevolucion: false,
};

/** Una de las dos columnas del catálogo: uniforme o material. */
function GrupoTipos({
  categoria, items, onNuevo, onEditar, onAlternar, onBorrar,
}: {
  categoria: CategoriaMaterial;
  items: TipoMaterial[];
  onNuevo: (c: CategoriaMaterial) => void;
  onEditar: (t: TipoMaterial) => void;
  onAlternar: (t: TipoMaterial) => void;
  onBorrar: (t: TipoMaterial) => void;
}) {
  const Icono = categoria === "uniforme" ? Shirt : Package;
  return (
    <Card>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Icono className="h-4 w-4 text-primary" />
            {CATEGORIA_LABEL[categoria]}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {categoria === "uniforme"
              ? "Ropa de trabajo que se entrega al trabajador."
              : "Llaves, taquillas, EPI y dispositivos."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => onNuevo(categoria)}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo
        </Button>
      </div>

      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay tipos aquí.
          </p>
        ) : (
          items.map((t) => (
            <div key={t.id} className="px-5 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm ${t.activo ? "text-foreground" : "text-muted-foreground line-through"}`}>
                    {t.nombre}
                  </span>
                  {t.requiereTalla && (
                    <Badge variant="outline" className="text-[10px]">Con talla</Badge>
                  )}
                  {t.requiereDevolucion && (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                      Hay que devolverlo
                    </Badge>
                  )}
                </div>
              </div>
              <Switch
                checked={t.activo}
                onCheckedChange={() => onAlternar(t)}
                aria-label={t.activo ? "Desactivar" : "Activar"}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEditar(t)} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onBorrar(t)}
                title="Borrar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export function TiposMaterialConfig() {
  const [tipos, setTipos] = useState<TipoMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<TipoMaterial | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const { confirm, dialog } = useConfirmDelete();
  useGlobalLoadingSync(loading);

  useEffect(() => {
    let cancel = false;
    void listTiposMaterial(true).then((data) => {
      if (!cancel) {
        setTipos(data);
        setLoading(false);
      }
    });
    return () => { cancel = true; };
  }, []);

  const grupos = useMemo(
    () => ({
      uniforme: tipos.filter((t) => t.categoria === "uniforme"),
      material: tipos.filter((t) => t.categoria === "material"),
    }),
    [tipos],
  );

  function abrirNuevo(categoria: CategoriaMaterial) {
    setEditando(null);
    setForm({ ...EMPTY_FORM, categoria });
    setDialogOpen(true);
  }

  function abrirEdicion(t: TipoMaterial) {
    setEditando(t);
    setForm({
      nombre: t.nombre,
      categoria: t.categoria,
      requiereTalla: t.requiereTalla,
      requiereDevolucion: t.requiereDevolucion,
    });
    setDialogOpen(true);
  }

  async function guardar() {
    const nombre = form.nombre.trim();
    if (!nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setGuardando(true);

    if (editando) {
      const res = await updateTipoMaterial(editando.id, {
        nombre,
        categoria: form.categoria,
        requiereTalla: form.requiereTalla,
        requiereDevolucion: form.requiereDevolucion,
      });
      setGuardando(false);
      if (!res.ok) { toast.error(res.error); return; }
      setTipos((prev) =>
        prev.map((t) =>
          t.id === editando.id
            ? { ...t, nombre, categoria: form.categoria, requiereTalla: form.requiereTalla, requiereDevolucion: form.requiereDevolucion }
            : t,
        ),
      );
      toast.success("Tipo guardado");
    } else {
      const res = await createTipoMaterial({
        nombre,
        categoria: form.categoria,
        requiereTalla: form.requiereTalla,
        requiereDevolucion: form.requiereDevolucion,
      });
      setGuardando(false);
      if (!res.ok) { toast.error(res.error); return; }
      setTipos((prev) => [...prev, res.tipo]);
      toast.success("Tipo añadido");
    }
    setDialogOpen(false);
  }

  async function alternar(t: TipoMaterial) {
    const activo = !t.activo;
    setTipos((prev) => prev.map((x) => (x.id === t.id ? { ...x, activo } : x)));
    const res = await updateTipoMaterial(t.id, { activo });
    if (!res.ok) {
      toast.error(res.error);
      setTipos((prev) => prev.map((x) => (x.id === t.id ? { ...x, activo: !activo } : x)));
    }
  }

  async function borrar(t: TipoMaterial) {
    const ok = await confirm({
      title: "Borrar tipo",
      description: `Se eliminará "${t.nombre}" del catálogo. Las entregas ya registradas no cambian: siguen mostrando lo que se entregó.`,
    });
    if (!ok) return;
    const res = await deleteTipoMaterial(t.id);
    if (!res.ok) { toast.error(res.error); return; }
    setTipos((prev) => prev.filter((x) => x.id !== t.id));
    toast.success("Tipo borrado");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dialog}

      <div>
        <h2 className="text-base font-semibold text-foreground">Tipos de uniforme y material</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Lo que tu empresa entrega a los trabajadores. Al registrar una entrega
          se eligen de esta lista.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["uniforme", "material"] as const).map((cat) => (
          <GrupoTipos
            key={cat}
            categoria={cat}
            items={grupos[cat]}
            onNuevo={abrirNuevo}
            onEditar={abrirEdicion}
            onAlternar={(t) => void alternar(t)}
            onBorrar={(t) => void borrar(t)}
          />
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar tipo" : "Nuevo tipo"}</DialogTitle>
            <DialogDescription>
              Define qué es y cómo se comporta al entregarlo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tipo-nombre">Nombre</Label>
              <Input
                id="tipo-nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Camiseta, llaves del local…"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo-categoria">Categoría</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm({ ...form, categoria: v as CategoriaMaterial })}
              >
                <SelectTrigger id="tipo-categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uniforme">Uniforme</SelectItem>
                  <SelectItem value="material">Material</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-foreground">Pedir talla</p>
                <p className="text-xs text-muted-foreground">
                  Al entregarlo se elige la talla.
                </p>
              </div>
              <Switch
                checked={form.requiereTalla}
                onCheckedChange={(v) => setForm({ ...form, requiereTalla: v })}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-foreground">Hay que devolverlo</p>
                <p className="text-xs text-muted-foreground">
                  Al dar de baja al trabajador habrá que confirmar que lo devuelve.
                </p>
              </div>
              <Switch
                checked={form.requiereDevolucion}
                onCheckedChange={(v) => setForm({ ...form, requiereDevolucion: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={guardando}>
              {guardando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
