"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Pencil, Trash2, Eye, EyeOff, Plus, ChevronUp, ChevronDown } from "lucide-react";
import type { CartaCategoria, CartaItem } from "../../types";
import {
  actualizarCategoria,
  borrarCategoria,
  reordenarCategorias,
  reordenarItems,
} from "../../actions/carta-admin-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import Image from "next/image";

export function CategoriaCard({
  cat,
  items,
  index,
  total,
  todasCategorias,
  onAddItem,
  onEditItem,
}: {
  cat: CartaCategoria;
  items: CartaItem[];
  index: number;
  total: number;
  todasCategorias: CartaCategoria[];
  onAddItem: (categoriaId: string) => void;
  onEditItem: (item: CartaItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(cat.nombre);
  const [pending, startTransition] = useTransition();
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const handleSaveNombre = () => {
    startTransition(async () => {
      await actualizarCategoria({ id: cat.id, nombre });
      setEditing(false);
    });
  };

  const handleToggleVisible = () => {
    startTransition(async () => {
      await actualizarCategoria({ id: cat.id, visible: !cat.visible });
    });
  };

  const handleBorrar = async () => {
    const ok = await confirmDelete({
      title: "Borrar categoría",
      description: `Se borrará la categoría "${cat.nombre}" y todos sus platos.`,
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    startTransition(async () => {
      await borrarCategoria(cat.id);
    });
  };

  const handleMove = (dir: -1 | 1) => {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= total) return;
    startTransition(async () => {
      const ordenList = [...todasCategorias];
      const [moved] = ordenList.splice(index, 1);
      ordenList.splice(newIdx, 0, moved);
      await reordenarCategorias(ordenList.map((c, i) => ({ id: c.id, orden: i })));
    });
  };

  const handleMoveItem = (itemIdx: number, dir: -1 | 1) => {
    const newIdx = itemIdx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    startTransition(async () => {
      const list = [...items];
      const [moved] = list.splice(itemIdx, 1);
      list.splice(newIdx, 0, moved);
      await reordenarItems(list.map((it, i) => ({ id: it.id, orden: i })));
    });
  };

  return (
    <Card className={cat.visible ? "" : "opacity-60"}>
      {confirmDeleteDialog}
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex flex-1 items-center gap-2">
          {editing ? (
            <div className="flex flex-1 gap-2">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} />
              <Button onClick={handleSaveNombre} disabled={pending} size="sm" variant="primary">
                Guardar
              </Button>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-semibold">{cat.nombre}</h3>
              <span className="text-sm text-stone-500">({items.length})</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            disabled={index === 0 || pending}
            onClick={() => handleMove(-1)}
            aria-label="Subir categoría"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={index === total - 1 || pending}
            onClick={() => handleMove(1)}
            aria-label="Bajar categoría"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setEditing((v) => !v)} aria-label="Renombrar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleToggleVisible}
            disabled={pending}
            aria-label={cat.visible ? "Ocultar" : "Mostrar"}
          >
            {cat.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleBorrar}
            disabled={pending}
            aria-label="Borrar"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm italic text-stone-500">Sin platos en esta categoría.</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {items.map((item, idx) => (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-stone-100">
                  {item.foto_url ? (
                    <Image
                      src={item.foto_url}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-stone-400">
                      🍽
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{item.nombre}</span>
                    {item.destacado ? (
                      <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">
                        Destacado
                      </span>
                    ) : null}
                    {!item.visible ? (
                      <span className="rounded-full bg-stone-200 px-2 text-xs text-stone-700">
                        Oculto
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-stone-500">
                    {item.precio.toFixed(2)} € · ❤ {item.likes_count}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === 0 || pending}
                    onClick={() => handleMoveItem(idx, -1)}
                    aria-label="Subir plato"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === items.length - 1 || pending}
                    onClick={() => handleMoveItem(idx, 1)}
                    aria-label="Bajar plato"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onEditItem(item)}>
                    Editar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={() => onAddItem(cat.id)}
          className="mt-2 flex w-full items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Añadir plato
        </Button>
      </CardContent>
    </Card>
  );
}
