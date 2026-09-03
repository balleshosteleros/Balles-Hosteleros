"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { listProductos } from "@/features/logistica/actions/producto-actions";

interface Opcion {
  id: string;
  nombre: string;
}

interface Props {
  value: string;
  onChange: (productoId: string, nombre: string) => void;
  /** Productos ya usados en el acuerdo: se ocultan para no repetir referencia. */
  excluir?: string[];
  placeholder?: string;
}

/** Elige una referencia de compra del catálogo para vincularla a la marca. */
export function ProductoCompraCombobox({
  value,
  onChange,
  excluir = [],
  placeholder = "Seleccionar referencia",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [searchName] = useState(() => `producto-search-${Math.random().toString(36).slice(2, 8)}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listProductos("compra").then((rows) => {
      const lista = (rows ?? [])
        .map((r) => ({ id: r.id, nombre: r.nombre }))
        .filter((o) => o.id && o.nombre)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setOpciones(lista);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const seleccionado = opciones.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const excluidos = new Set(excluir);
    const base = opciones.filter((o) => !excluidos.has(o.id) || o.id === value);
    const s = query.trim().toLowerCase();
    if (!s) return base.slice(0, 50);
    return base.filter((o) => o.nombre.toLowerCase().includes(s)).slice(0, 50);
  }, [opciones, query, excluir, value]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-muted/30"
      >
        <span className={`truncate ${!seleccionado ? "text-muted-foreground" : ""}`}>
          {seleccionado?.nombre || placeholder}
        </span>
        <span className="ml-2 shrink-0">
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              type="search"
              name={searchName}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Buscar referencia..."
              className="flex h-10 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                {opciones.length === 0 ? "Sin referencias de compra" : "Sin resultados"}
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => {
                    onChange(o.id, o.nombre);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  <span className="truncate">{o.nombre}</span>
                  {o.id === value && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
