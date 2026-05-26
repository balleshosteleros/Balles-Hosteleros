"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
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
import { ImportadorIACatalogoDialog } from "@/features/logistica/components/ImportadorIACatalogoDialog";
import {
  analizarCategoriasProductoIA,
  guardarCategoriasProductoIA,
} from "@/features/logistica/actions/importador-catalogos-ia-actions";
import type { ImportadorEntityConfig } from "@/features/logistica/types/importador-catalogo-ia";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

interface GestorCategoriasProductoProps {
  tipo: TipoProducto;
  /** Se invoca después de cualquier CRUD para que el padre refresque su lista. */
  onChanged?: () => void;
}

/**
 * CRUD de categorías de producto contra la tabla `categorias_producto`.
 * - Crear: input + botón "+ Añadir".
 * - Renombrar: click en lápiz, edita inline, Enter o ✓ confirma.
 * - Borrar: botón papelera con confirm; el server rechaza si hay productos
 *   usando la categoría.
 */
export function GestorCategoriasProducto({
  tipo,
  onChanged,
}: GestorCategoriasProductoProps) {
  const [items, setItems] = useState<CategoriaProductoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoValor, setEditandoValor] = useState("");
  const [iaDialogOpen, setIaDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const iaConfig: ImportadorEntityConfig = {
    titulo: `Importar categorías de ${labelTipo(tipo)} con IA`,
    subtitulo:
      "Sube un PDF, foto de carta o lista. La IA extraerá los nombres de categoría únicos y los podrás revisar antes de añadir al catálogo.",
    campos: [
      { key: "nombre", label: "Nombre de la categoría", obligatorio: true, tipo: "texto" },
    ],
    analyze: (payload) => analizarCategoriasProductoIA(payload, tipo),
    save: (rows) => guardarCategoriasProductoIA(rows, tipo),
  };

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
        toast.success("Categoría renombrada");
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
      if (!confirm(`¿Borrar la categoría "${nombre}"?`)) return;
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
      <div>
        <label className="text-xs font-semibold text-foreground mb-1.5 block">
          Categorías
        </label>
        <p className="text-[11px] text-muted-foreground mb-2">
          Las categorías aquí son las únicas que se pueden usar al crear o importar productos.
          Para añadir una nueva, créala desde esta pantalla.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          placeholder="Nombre de la nueva categoría"
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button
          size="sm"
          onClick={onAdd}
          disabled={!nuevoNombre.trim() || isPending}
          className="gap-1 h-8"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIaDialogOpen(true)}
          className="gap-1 h-8"
          title="Importar varias categorías desde un archivo"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Importar con IA
        </Button>
      </div>

      <div className="rounded-lg border">
        {cargando ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Cargando…
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No hay categorías creadas para este tipo de producto. Añade la primera arriba.
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
                      title="Renombrar"
                      aria-label="Renombrar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(cat.id, cat.nombre)}
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

      <ImportadorIACatalogoDialog
        open={iaDialogOpen}
        onOpenChange={setIaDialogOpen}
        config={iaConfig}
        onImportSuccess={() => {
          recargar();
          onChanged?.();
        }}
      />
    </div>
  );
}

function labelTipo(t: TipoProducto): string {
  switch (t) {
    case "compra":
      return "compra";
    case "venta":
      return "venta";
    case "elaboracion":
      return "elaboración";
  }
}
