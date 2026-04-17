"use client";

import { useState, useTransition } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Plus, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import type { CartaAdminData, CartaItem } from "../../types";
import { crearCategoria } from "../../actions/carta-admin-actions";
import { CategoriaCard } from "./CategoriaCard";
import { ItemEditorModal } from "./ItemEditorModal";
import { SlugConfigCard } from "./SlugConfigCard";
import { QrDownloadButton } from "./QrDownloadButton";

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

  return (
    <div className="space-y-6 p-4 sm:p-6">
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
                <QrDownloadButton
                  url={urlPublica}
                  fileName={`carta-${slug}`}
                />
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

      <div className="grid gap-4">
        {data.categorias.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-stone-500">
            Aún no tienes categorías. Crea la primera arriba.
          </p>
        ) : (
          data.categorias.map((c, idx) => (
            <CategoriaCard
              key={c.id}
              cat={c}
              items={data.items.filter((i) => i.categoria_id === c.id)}
              index={idx}
              total={data.categorias.length}
              todasCategorias={data.categorias}
              onAddItem={openNewItem}
              onEditItem={openEditItem}
            />
          ))
        )}
      </div>

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
