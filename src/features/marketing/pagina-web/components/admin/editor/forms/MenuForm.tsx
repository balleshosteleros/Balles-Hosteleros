"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import {
  listarCategoriasDisponibles,
  type CategoriaPickable,
} from "../../../../services/carta-items-fetch";
import type { Bloque, MenuDatos } from "../../../../types";

export function MenuForm({ bloque }: { bloque: Extract<Bloque, { tipo: "menu" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<MenuDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  const [categorias, setCategorias] = useState<CategoriaPickable[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  useEffect(() => {
    if (datos.fuente !== "carta_items") return;
    let cancel = false;
    setLoadingCats(true);
    listarCategoriasDisponibles().then((data) => {
      if (cancel) return;
      setCategorias(data);
      setLoadingCats(false);
    });
    return () => {
      cancel = true;
    };
  }, [datos.fuente]);

  const toggleCategoria = (id: string) => {
    const actuales = datos.categoria_ids ?? [];
    const nuevas = actuales.includes(id)
      ? actuales.filter((x) => x !== id)
      : [...actuales, id];
    set({ categoria_ids: nuevas });
  };

  const manuales = datos.items_manual ?? [];
  const seleccionadas = new Set(datos.categoria_ids ?? []);

  return (
    <div className="space-y-5">
      <Section title="Fuente del menú">
        <Field label="De dónde vienen los platos">
          <Select value={datos.fuente} onValueChange={(v) => set({ fuente: v as MenuDatos["fuente"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="carta_items">Carta digital (sincronizado)</SelectItem>
              <SelectItem value="manual">Manual (exclusivo de esta web)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      {datos.fuente === "carta_items" && (
        <Section title="Categorías a mostrar">
          {loadingCats && (
            <p className="text-xs text-muted-foreground">Cargando categorías…</p>
          )}
          {!loadingCats && categorias.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay categorías en tu carta digital todavía.
            </p>
          )}
          {!loadingCats &&
            categorias.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={seleccionadas.has(c.id)}
                  onCheckedChange={() => toggleCategoria(c.id)}
                />
                <span className="flex-1">{c.nombre}</span>
                <span className="text-xs text-muted-foreground">
                  {c.total_items} plato{c.total_items !== 1 ? "s" : ""}
                </span>
              </label>
            ))}
          <p className="text-[11px] text-muted-foreground pt-1">
            Si no marcas ninguna, se mostrarán todas las categorías visibles.
          </p>
        </Section>
      )}

      {datos.fuente === "manual" && (
        <Section title={`Platos manuales (${manuales.length}/200)`}>
          {manuales.map((item, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Plato #{i + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-600"
                  onClick={() =>
                    set({ items_manual: manuales.filter((_, idx) => idx !== i) })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-[1fr_100px] gap-2">
                <Field label="Nombre">
                  <Input
                    value={item.nombre}
                    onChange={(e) => {
                      const arr = [...manuales];
                      arr[i] = { ...arr[i], nombre: e.target.value };
                      set({ items_manual: arr });
                    }}
                  />
                </Field>
                <Field label="Precio €">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={item.precio}
                    onChange={(e) => {
                      const arr = [...manuales];
                      arr[i] = { ...arr[i], precio: Number(e.target.value) || 0 };
                      set({ items_manual: arr });
                    }}
                  />
                </Field>
              </div>
              <Field label="Descripción">
                <Textarea
                  value={item.descripcion ?? ""}
                  onChange={(e) => {
                    const arr = [...manuales];
                    arr[i] = { ...arr[i], descripcion: e.target.value || undefined };
                    set({ items_manual: arr });
                  }}
                  rows={2}
                />
              </Field>
            </div>
          ))}
          {manuales.length < 200 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                set({
                  items_manual: [...manuales, { nombre: "Nuevo plato", precio: 0 }],
                })
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Añadir plato
            </Button>
          )}
        </Section>
      )}
    </div>
  );
}
