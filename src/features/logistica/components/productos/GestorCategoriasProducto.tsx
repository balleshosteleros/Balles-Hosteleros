"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { TipoProducto } from "@/features/logistica/data/productos";
import {
  createCategoriaProducto,
  deleteCategoriaProducto,
  listCategoriasProducto,
  updateCategoriaProducto,
  type CategoriaProductoRow,
} from "@/features/logistica/actions/categorias-producto-actions";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GestorCategoriasProductoProps {
  tipo: TipoProducto;
  /** Se invoca después de cualquier CRUD para que el padre refresque su lista. */
  onChanged?: () => void;
}

/**
 * CRUD de categorías de producto contra la tabla `categorias_producto`
 * (fuente única: todo lo que lea categorías parte de aquí).
 * - Cabecera: solo el título + botón "Nuevo" a la derecha.
 * - Crear: el botón "Nuevo" revela un input inline.
 * - Editar: se clica el nombre y se edita directamente; al guardar, el nuevo
 *   nombre se propaga retroactivamente a todos los productos que la usan
 *   (cascade en el server action).
 * - Borrar: papelera con confirm; el server rechaza si hay productos usándola.
 */
export function GestorCategoriasProducto({
  tipo,
  onChanged,
}: GestorCategoriasProductoProps) {
  const [items, setItems] = useState<CategoriaProductoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoValor, setEditandoValor] = useState("");
  const [pendiente, setPendiente] = useState<{ id: string; nombre: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const recargar = useCallback(() => {
    setCargando(true);
    listCategoriasProducto(tipo).then((res) => {
      setItems(res.ok ? res.data : []);
      setCargando(false);
    });
  }, [tipo]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const onAdd = useCallback(() => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    startTransition(async () => {
      const res = await createCategoriaProducto({ tipo, nombre });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Categoría "${nombre}" creada`);
      setNuevoNombre("");
      setCreando(false);
      recargar();
      onChanged?.();
    });
  }, [nuevoNombre, tipo, recargar, onChanged]);

  const onRename = useCallback(
    (id: string) => {
      const nombre = editandoValor.trim();
      if (!nombre) return;
      startTransition(async () => {
        const res = await updateCategoriaProducto(id, { nombre });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Categoría actualizada");
        setEditandoId(null);
        setEditandoValor("");
        recargar();
        onChanged?.();
      });
    },
    [editandoValor, recargar, onChanged],
  );

  const onDelete = useCallback(
    (id: string, nombre: string) => {
      startTransition(async () => {
        const res = await deleteCategoriaProducto(id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(`Categoría "${nombre}" borrada`);
        recargar();
        onChanged?.();
      });
    },
    [recargar, onChanged],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground">Categorías</label>
        <Button
          size="sm"
          onClick={() => {
            setCreando((v) => !v);
            setNuevoNombre("");
          }}
          className="gap-1 h-8 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Nuevo
        </Button>
      </div>

      {creando && (
        <div className="flex gap-2">
          <Input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nombre de la nueva categoría"
            className="h-8 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              } else if (e.key === "Escape") {
                setCreando(false);
                setNuevoNombre("");
              }
            }}
          />
          <Button
            size="sm"
            onClick={onAdd}
            disabled={!nuevoNombre.trim() || isPending}
            className="gap-1 h-8 shrink-0"
          >
            <Check className="h-3.5 w-3.5" /> Añadir
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCreando(false);
              setNuevoNombre("");
            }}
            className="h-8 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        {cargando ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Cargando…
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No hay categorías. Crea la primera con el botón “Nuevo”.
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/30"
              >
                {editandoId === cat.id ? (
                  <>
                    <Input
                      value={editandoValor}
                      onChange={(e) => setEditandoValor(e.target.value)}
                      className="h-7 text-xs flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onRename(cat.id);
                        } else if (e.key === "Escape") {
                          setEditandoId(null);
                          setEditandoValor("");
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => onRename(cat.id)}
                      disabled={isPending || !editandoValor.trim()}
                      className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                      title="Guardar"
                      aria-label="Guardar"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoId(null);
                        setEditandoValor("");
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                      title="Cancelar"
                      aria-label="Cancelar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{cat.nombre}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoId(cat.id);
                        setEditandoValor(cat.nombre);
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Editar"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendiente({ id: cat.id, nombre: cat.nombre })}
                      disabled={isPending}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      title="Borrar"
                      aria-label="Borrar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={!!pendiente} onOpenChange={(o) => !o && setPendiente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar la categoría “{pendiente?.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendiente) onDelete(pendiente.id, pendiente.nombre);
                setPendiente(null);
              }}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
