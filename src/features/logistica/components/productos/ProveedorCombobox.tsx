"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { listProveedores } from "@/features/logistica/actions/proveedores-actions";

interface Props {
  value: string;
  onChange: (nombre: string) => void;
  placeholder?: string;
}

export function ProveedorCombobox({
  value,
  onChange,
  placeholder = "Seleccionar proveedor",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [opciones, setOpciones] = useState<string[]>([]);
  // `name` aleatorio fijo al montar para evitar autocomplete del navegador.
  const [searchName] = useState(() => `proveedor-search-${Math.random().toString(36).slice(2, 8)}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listProveedores().then((res) => {
      if (!res.ok) return;
      const activos = (res.data as unknown as Array<Record<string, unknown>>)
        .filter((r) => (r.estado as string) === "Activo")
        .map((r) => (r.nombre_comercial as string) ?? "")
        .filter((n) => !!n)
        .sort((a, b) => a.localeCompare(b, "es"));
      setOpciones(Array.from(new Set(activos)));
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return opciones.slice(0, 50);
    return opciones.filter((n) => n.toLowerCase().includes(s)).slice(0, 50);
  }, [opciones, query]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-muted/30"
      >
        <span className={`truncate ${!value ? "text-muted-foreground" : ""}`}>
          {value || placeholder}
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
              placeholder="Buscar proveedor..."
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
                {opciones.length === 0 ? "Sin proveedores activos" : "Sin resultados"}
              </div>
            ) : (
              filtered.map((nombre) => (
                <button
                  type="button"
                  key={nombre}
                  onClick={() => {
                    onChange(nombre);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  <span className="truncate">{nombre}</span>
                  {nombre === value && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                </button>
              ))
            )}
          </div>
          {value && (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="w-full rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left"
              >
                Quitar proveedor
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
