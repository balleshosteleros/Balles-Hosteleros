"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ImportadorIACatalogoDialog } from "@/features/logistica/components/ImportadorIACatalogoDialog";
import type { ImportadorEntityConfig } from "@/features/logistica/types/importador-catalogo-ia";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

interface CampoForm {
  key: string;
  label: string;
  obligatorio?: boolean;
  /** Ancho relativo (Tailwind flex/grid). Default "flex-1". */
  ancho?: string;
}

interface CatalogoItem {
  id: string;
}

interface GestorCatalogoEstandarProps<T extends CatalogoItem> {
  titulo: string;
  hint?: string;
  /** Definición de los campos del formulario de creación / edición inline. */
  campos: CampoForm[];
  /** Cómo extraer el texto principal para mostrar en la lista. */
  itemPrincipal: (item: T) => string;
  /** Texto secundario gris (opcional). Ej.: "0–8 °C". */
  itemSecundario?: (item: T) => string | null;
  /** Convierte un T en el patch para edición (key -> value string). */
  itemAPatch: (item: T) => Record<string, string>;
  list: () => Promise<{ ok: boolean; data: T[] }>;
  create: (input: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
  update: (id: string, patch: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
  remove: (id: string) => Promise<{ ok: boolean; error?: string }>;
  iaConfig?: ImportadorEntityConfig;
  onChanged?: () => void;
}

/**
 * Gestor CRUD genérico para catálogos estándar de logística.
 * - Formulario inline para añadir (1+ campos).
 * - Cada item: muestra texto principal + secundario (opcional), edita inline, borra con guardia.
 * - Botón "Importar con IA" opcional que abre el diálogo genérico.
 */
export function GestorCatalogoEstandar<T extends CatalogoItem>({
  titulo,
  hint,
  campos,
  itemPrincipal,
  itemSecundario,
  itemAPatch,
  list,
  create,
  update,
  remove,
  iaConfig,
  onChanged,
}: GestorCatalogoEstandarProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);
  const [nuevo, setNuevo] = useState<Record<string, string>>(() => emptyForm(campos));
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoForm, setEditandoForm] = useState<Record<string, string>>({});
  const [iaOpen, setIaOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const recargar = useCallback(() => {
    setCargando(true);
    list().then((res) => {
      setItems(res.ok ? res.data : []);
      setCargando(false);
    });
  }, [list]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const obligatoriosFaltan = campos.some(
    (c) => (c.obligatorio ?? false) && !(nuevo[c.key] ?? "").trim(),
  );

  const onAdd = useCallback(() => {
    if (obligatoriosFaltan) return;
    startTransition(async () => {
      const trimmed: Record<string, string> = {};
      for (const [k, v] of Object.entries(nuevo)) trimmed[k] = v.trim();
      const res = await create(trimmed);
      if (!res.ok) {
        toast.error(res.error ?? "Error al crear");
        return;
      }
      toast.success("Añadido");
      setNuevo(emptyForm(campos));
      recargar();
      onChanged?.();
    });
  }, [nuevo, obligatoriosFaltan, create, campos, recargar, onChanged]);

  const onRename = useCallback(
    (id: string) => {
      const trimmed: Record<string, string> = {};
      for (const [k, v] of Object.entries(editandoForm)) trimmed[k] = v.trim();
      const algunoObligatorioVacio = campos.some(
        (c) => (c.obligatorio ?? false) && !(trimmed[c.key] ?? "").trim(),
      );
      if (algunoObligatorioVacio) return;
      startTransition(async () => {
        const res = await update(id, trimmed);
        if (!res.ok) {
          toast.error(res.error ?? "Error al actualizar");
          return;
        }
        toast.success("Actualizado");
        setEditandoId(null);
        setEditandoForm({});
        recargar();
        onChanged?.();
      });
    },
    [editandoForm, campos, update, recargar, onChanged],
  );

  const onDelete = useCallback(
    (id: string, nombre: string) => {
      if (!confirm(`¿Borrar "${nombre}"?`)) return;
      startTransition(async () => {
        const res = await remove(id);
        if (!res.ok) {
          toast.error(res.error ?? "Error al borrar");
          return;
        }
        toast.success("Borrado");
        recargar();
        onChanged?.();
      });
    },
    [remove, recargar, onChanged],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <label className="text-xs font-semibold text-foreground block">{titulo}</label>
          {hint && (
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md">{hint}</p>
          )}
        </div>
        {iaConfig && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIaOpen(true)}
            className="gap-1 h-7 text-xs shrink-0"
          >
            <Sparkles className="h-3 w-3 text-amber-500" /> Importar con IA
          </Button>
        )}
      </div>

      {/* Formulario añadir */}
      <div className="flex gap-2">
        {campos.map((c) => (
          <Input
            key={c.key}
            value={nuevo[c.key] ?? ""}
            onChange={(e) => setNuevo((prev) => ({ ...prev, [c.key]: e.target.value }))}
            placeholder={c.label}
            className={`h-8 text-xs ${c.ancho ?? "flex-1"}`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
          />
        ))}
        <Button
          size="sm"
          onClick={onAdd}
          disabled={obligatoriosFaltan || isPending}
          className="gap-1 h-8 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir
        </Button>
      </div>

      {/* Lista */}
      <div className="rounded-lg border">
        {cargando ? (
          <div className="px-3 py-5 text-center text-xs text-muted-foreground">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="px-3 py-5 text-center text-xs text-muted-foreground">
            Sin elementos. Añade el primero arriba o importa con IA.
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((it) => {
              const principal = itemPrincipal(it);
              const secundario = itemSecundario?.(it) ?? null;
              return (
                <li key={it.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/30">
                  {editandoId === it.id ? (
                    <>
                      {campos.map((c) => (
                        <Input
                          key={c.key}
                          value={editandoForm[c.key] ?? ""}
                          onChange={(e) =>
                            setEditandoForm((prev) => ({ ...prev, [c.key]: e.target.value }))
                          }
                          placeholder={c.label}
                          className={`h-7 text-xs ${c.ancho ?? "flex-1"}`}
                          autoFocus={c.key === campos[0].key}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onRename(it.id);
                            } else if (e.key === "Escape") {
                              setEditandoId(null);
                              setEditandoForm({});
                            }
                          }}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => onRename(it.id)}
                        disabled={isPending}
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
                          setEditandoForm({});
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
                      <span className="flex-1 flex items-center gap-2">
                        <span className="font-medium">{principal}</span>
                        {secundario && (
                          <span className="text-[10px] text-muted-foreground">{secundario}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoId(it.id);
                          setEditandoForm(itemAPatch(it));
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Editar"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(it.id, principal)}
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
              );
            })}
          </ul>
        )}
      </div>

      {iaConfig && (
        <ImportadorIACatalogoDialog
          open={iaOpen}
          onOpenChange={setIaOpen}
          config={iaConfig}
          onImportSuccess={() => {
            recargar();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

function emptyForm(campos: CampoForm[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of campos) out[c.key] = "";
  return out;
}
