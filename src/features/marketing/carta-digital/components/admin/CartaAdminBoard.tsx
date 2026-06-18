"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Palette,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import type { CartaAdminData, CartaCategoria, CartaItem } from "../../types";
import {
  crearCategoria,
  actualizarCategoria,
  borrarCategoria,
  reordenarCategorias,
  reordenarItems,
} from "../../actions/carta-admin-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { ItemEditorModal } from "./ItemEditorModal";
import { SlugConfigCard } from "./SlugConfigCard";
import { QrDownloadButton } from "./QrDownloadButton";
import { CartaTemaCard } from "./CartaTemaCard";

export function CartaAdminBoard({
  data,
  baseUrl,
}: {
  data: CartaAdminData;
  baseUrl: string;
}) {
  const [nuevaCat, setNuevaCat] = useState("");
  const [pending, startTransition] = useTransition();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CartaItem | null>(null);
  const [defaultCatId, setDefaultCatId] = useState<string | null>(null);

  // Selector de categoría activa.
  const [activeCatId, setActiveCatId] = useState<string | null>(data.categorias[0]?.id ?? null);

  // Si las categorías cambian (crear/borrar) y la activa desaparece, fijamos otra.
  useEffect(() => {
    if (data.categorias.length === 0) {
      setActiveCatId(null);
      return;
    }
    if (!activeCatId || !data.categorias.some((c) => c.id === activeCatId)) {
      setActiveCatId(data.categorias[0].id);
    }
  }, [data.categorias, activeCatId]);

  if (!data.empresa) {
    return (
      <div className="p-6 text-center text-stone-600">
        Tu usuario no tiene empresa asignada.
      </div>
    );
  }

  const slug = data.empresa.carta_slug;
  const urlPublica = slug ? `${baseUrl}/carta/${slug}` : null;

  const handleCreateCat = () => {
    if (!nuevaCat.trim()) return;
    startTransition(async () => {
      const res = await crearCategoria({ nombre: nuevaCat.trim() });
      if (res.ok) setNuevaCat("");
    });
  };

  const openNewItem = (categoriaId: string) => {
    setEditingItem(null);
    setDefaultCatId(categoriaId);
    setEditorOpen(true);
  };

  const openEditItem = (item: CartaItem) => {
    setEditingItem(item);
    setDefaultCatId(item.categoria_id);
    setEditorOpen(true);
  };

  const activeCat = data.categorias.find((c) => c.id === activeCatId) ?? null;
  const activeItems = activeCat
    ? data.items.filter((i) => i.categoria_id === activeCat.id)
    : [];
  const activeIndex = activeCat ? data.categorias.findIndex((c) => c.id === activeCat.id) : -1;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex justify-end">
        <Link
          href="/ajustes?tab=imagen-marca"
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
        >
          <Palette className="h-4 w-4" />
          Editar imagen de marca
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SlugConfigCard empresa={data.empresa} baseUrl={baseUrl} />

        <Card>
          <CardHeader>
            <CardTitle>Compartir con clientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {urlPublica ? (
              <>
                <div className="flex items-center gap-2 rounded-md bg-stone-50 p-3 text-sm">
                  <span className="flex-1 truncate font-mono">{urlPublica}</span>
                  <a
                    href={urlPublica}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </a>
                </div>
                <QrDownloadButton url={urlPublica} fileName={`carta-${slug}`} />
                {!data.empresa.carta_publicada ? (
                  <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    La carta aún no está publicada. Actívala en el panel de la izquierda.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-stone-600">
                Define un slug en el panel de la izquierda para generar tu URL pública y QR.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {data.empresa.slug ? (
        <CartaTemaCard empresaSlug={data.empresa.slug} nombreEmpresa={data.empresa.nombre} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Nueva categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Ej.: Entrantes, Principales, Postres..."
              value={nuevaCat}
              onChange={(e) => setNuevaCat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCat()}
              maxLength={60}
            />
            <Button
              variant="primary"
              size="lg"
              onClick={handleCreateCat}
              disabled={pending || !nuevaCat.trim()}
              className="flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Crear
            </Button>
          </div>
        </CardContent>
      </Card>

      {data.categorias.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-stone-500">
          Aún no tienes categorías. Crea la primera arriba.
        </p>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CategoriaSelector
              categorias={data.categorias}
              items={data.items}
              activeId={activeCat?.id ?? null}
              onSelect={setActiveCatId}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {activeCat ? (
              <CategoriaPanel
                cat={activeCat}
                items={activeItems}
                index={activeIndex}
                total={data.categorias.length}
                todasCategorias={data.categorias}
                pending={pending}
                startTransition={startTransition}
                onAddItem={openNewItem}
                onEditItem={openEditItem}
              />
            ) : null}
          </CardContent>
        </Card>
      )}

      <ItemEditorModal
        open={editorOpen}
        empresaId={data.empresa.id}
        categorias={data.categorias}
        item={editingItem}
        defaultCategoriaId={defaultCatId}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  );
}

function CategoriaSelector({
  categorias,
  items,
  activeId,
  onSelect,
}: {
  categorias: CartaCategoria[];
  items: CartaItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const navRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>(`[data-cat-id="${activeId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  return (
    <ul
      ref={navRef}
      className="-mx-2 flex gap-1 overflow-x-auto px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categorias.map((c) => {
        const active = c.id === activeId;
        const count = items.filter((i) => i.categoria_id === c.id).length;
        return (
          <li key={c.id}>
            <button
              type="button"
              data-cat-id={c.id}
              onClick={() => onSelect(c.id)}
              aria-pressed={active}
              className={
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                (active
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50")
              }
            >
              <span className="whitespace-nowrap">{c.nombre}</span>
              <span
                className={
                  "rounded-full px-1.5 text-[10px] tabular-nums " +
                  (active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500")
                }
              >
                {count}
              </span>
              {!c.visible ? <EyeOff className="h-3 w-3 opacity-70" /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CategoriaPanel({
  cat,
  items,
  index,
  total,
  todasCategorias,
  pending,
  startTransition,
  onAddItem,
  onEditItem,
}: {
  cat: CartaCategoria;
  items: CartaItem[];
  index: number;
  total: number;
  todasCategorias: CartaCategoria[];
  pending: boolean;
  startTransition: (fn: () => void) => void;
  onAddItem: (categoriaId: string) => void;
  onEditItem: (item: CartaItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(cat.nombre);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  // Sincroniza el nombre editable cuando cambia la categoría activa.
  useEffect(() => {
    setNombre(cat.nombre);
    setEditing(false);
  }, [cat.id, cat.nombre]);

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
    <div className={cat.visible ? "space-y-3" : "space-y-3 opacity-60"}>
      {confirmDeleteDialog}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
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
            disabled={index <= 0 || pending}
            onClick={() => handleMove(-1)}
            aria-label="Mover izquierda"
          >
            <ChevronUp className="h-4 w-4 -rotate-90" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={index === total - 1 || pending}
            onClick={() => handleMove(1)}
            aria-label="Mover derecha"
          >
            <ChevronDown className="h-4 w-4 -rotate-90" />
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
      </div>

      {items.length === 0 ? (
        <p className="text-sm italic text-stone-500">Sin platos en esta categoría.</p>
      ) : (
        <ul className="divide-y divide-stone-200">
          {items.map((item, idx) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-stone-100">
                {item.foto_url ? (
                  <Image src={item.foto_url} alt="" fill sizes="48px" className="object-cover" />
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
        className="flex w-full items-center justify-center gap-2"
      >
        <Plus className="h-5 w-5" />
        Añadir plato
      </Button>
    </div>
  );
}
