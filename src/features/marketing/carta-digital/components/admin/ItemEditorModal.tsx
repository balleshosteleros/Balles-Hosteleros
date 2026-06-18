"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { ALERGENOS_UE, type CartaCategoria, type CartaItem, type Alergeno } from "../../types";
import { crearItem, actualizarItem, borrarItem } from "../../actions/carta-admin-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { FotoUploader } from "./FotoUploader";

const ALERGENO_LABEL: Record<string, string> = {
  gluten: "Gluten",
  crustaceos: "Crustáceos",
  huevos: "Huevos",
  pescado: "Pescado",
  cacahuetes: "Cacahuetes",
  soja: "Soja",
  lacteos: "Lácteos",
  frutos_cascara: "Frutos cáscara",
  apio: "Apio",
  mostaza: "Mostaza",
  sesamo: "Sésamo",
  sulfitos: "Sulfitos",
  altramuces: "Altramuces",
  moluscos: "Moluscos",
};

export function ItemEditorModal({
  open,
  empresaId,
  categorias,
  item,
  defaultCategoriaId,
  onClose,
}: {
  open: boolean;
  empresaId: string;
  categorias: CartaCategoria[];
  item: CartaItem | null;
  defaultCategoriaId: string | null;
  onClose: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("0");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [alergenos, setAlergenos] = useState<Set<Alergeno>>(new Set());
  const [destacado, setDestacado] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  useEffect(() => {
    if (item) {
      setNombre(item.nombre);
      setDescripcion(item.descripcion ?? "");
      setPrecio(String(item.precio ?? 0));
      setCategoriaId(item.categoria_id);
      setAlergenos(new Set(item.alergenos));
      setDestacado(item.destacado);
      setVisible(item.visible);
      setFotoUrl(item.foto_url);
    } else {
      setNombre("");
      setDescripcion("");
      setPrecio("0");
      setCategoriaId(defaultCategoriaId ?? categorias[0]?.id ?? "");
      setAlergenos(new Set());
      setDestacado(false);
      setVisible(true);
      setFotoUrl(null);
    }
    setError(null);
  }, [item, open, defaultCategoriaId, categorias]);

  const toggleAlergeno = (a: Alergeno) => {
    setAlergenos((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  const handleSave = () => {
    setError(null);
    const precioNum = parseFloat(precio.replace(",", "."));
    if (!nombre.trim()) return setError("El nombre es obligatorio.");
    if (!categoriaId) return setError("Selecciona una categoría.");
    if (Number.isNaN(precioNum) || precioNum < 0) return setError("Precio inválido.");

    startTransition(async () => {
      const payload = {
        nombre,
        descripcion,
        precio: precioNum,
        alergenos: Array.from(alergenos),
        destacado,
      };
      const res = item
        ? await actualizarItem({
            id: item.id,
            categoriaId,
            visible,
            ...payload,
          })
        : await crearItem({ categoriaId, ...payload });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
    });
  };

  const handleDelete = async () => {
    if (!item) return;
    const ok = await confirmDelete({
      title: "Borrar plato",
      description: `Se borrará "${item.nombre}". Esta acción no se puede deshacer.`,
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await borrarItem(item.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {confirmDeleteDialog}
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Editar plato" : "Nuevo plato"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          {item ? (
            <FotoUploader
              empresaId={empresaId}
              itemId={item.id}
              fotoUrl={fotoUrl}
              onUploaded={(url, path) => {
                setFotoUrl(url);
                actualizarItem({ id: item.id, fotoUrl: url, fotoStoragePath: path }).catch(() => {});
              }}
            />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg bg-stone-100 text-center text-xs text-stone-500">
              Guarda primero el plato para poder añadir foto.
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="cat">Categoría</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger id="cat">
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="nom">Nombre</Label>
              <Input id="nom" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
            </div>

            <div>
              <Label htmlFor="desc">Descripción</Label>
              <textarea
                id="desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="precio">Precio (€)</Label>
                <Input
                  id="precio"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 pt-6 text-sm">
                  <Checkbox
                    checked={destacado}
                    onCheckedChange={(v) => setDestacado(v === true)}
                  />
                  Destacado
                </label>
                {item ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={visible}
                      onCheckedChange={(v) => setVisible(v === true)}
                    />
                    Visible
                  </label>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Alérgenos</Label>
          <div className="flex flex-wrap gap-2">
            {ALERGENOS_UE.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAlergeno(a)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                  alergenos.has(a)
                    ? "bg-amber-500 text-white ring-amber-500"
                    : "bg-white text-stone-700 ring-stone-300 hover:bg-stone-50"
                }`}
              >
                {ALERGENO_LABEL[a] ?? a}
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {item ? (
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              Borrar plato
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="primary" size="lg" onClick={handleSave} disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

