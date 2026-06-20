"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { cn } from "@/lib/utils";
import { useResizableColumn } from "@/shared/components/ResizableColumns";
import type {
  ToolbarFiltroActivo,
  ToolbarFiltroTipo,
  ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";

export interface TableColumnHeaderProps {
  label: string;
  campo?: string;

  // Filtro (opcional)
  filtroTipo?: ToolbarFiltroTipo;
  opciones?: string[];
  filtros?: ToolbarFiltroActivo[];
  onFiltrosChange?: (f: ToolbarFiltroActivo[]) => void;

  // Orden (opcional)
  ordenable?: boolean;
  orden?: ToolbarOrdenActivo | null;
  onOrdenChange?: (o: ToolbarOrdenActivo | null) => void;
  ordenLabelAsc?: string;
  ordenLabelDesc?: string;

  align?: "left" | "right" | "center";
  className?: string;
}

export function TableColumnHeader({
  label,
  campo,
  filtroTipo,
  opciones = [],
  filtros = [],
  onFiltrosChange,
  ordenable = false,
  orden = null,
  onOrdenChange,
  ordenLabelAsc = "A→Z",
  ordenLabelDesc = "Z→A",
  align = "left",
  className,
}: TableColumnHeaderProps) {
  const filtroActivo = useMemo(
    () => (campo ? filtros.find((f) => f.campo === campo) : undefined),
    [filtros, campo],
  );

  const tieneFiltro = !!filtroTipo && !!campo && !!onFiltrosChange;
  const tieneOrden = ordenable && !!campo && !!onOrdenChange;
  const ordenActivo = !!campo && orden?.campo === campo;

  const colKey = campo ?? label;
  const resize = useResizableColumn(colKey);
  const thRef = useRef<HTMLTableCellElement | null>(null);
  const thStyle =
    resize.enabled && resize.width
      ? { width: resize.width, minWidth: resize.width }
      : undefined;

  function onResizeMouseDown(e: React.MouseEvent) {
    const current = thRef.current?.getBoundingClientRect().width ?? 100;
    resize.startResize(e, current);
  }

  const resizeHandle = resize.enabled && colKey ? (
    <span
      onMouseDown={onResizeMouseDown}
      onClick={(e) => e.stopPropagation()}
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar columna"
      className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize select-none bg-transparent opacity-0 transition-opacity hover:bg-primary/50 hover:opacity-100"
    />
  ) : null;

  const justify =
    align === "right"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";
  const textAlign =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  if (!tieneFiltro && !tieneOrden) {
    return (
      <th
        ref={thRef}
        style={thStyle}
        className={cn(
          "relative px-3 py-1.5 text-xs font-bold text-muted-foreground whitespace-nowrap",
          textAlign,
          className,
        )}
      >
        {label}
        {resizeHandle}
      </th>
    );
  }

  return (
    <th
      ref={thRef}
      style={thStyle}
      className={cn(
        "relative px-3 py-1.5 text-xs font-bold text-muted-foreground whitespace-nowrap",
        textAlign,
        className,
      )}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 hover:text-foreground transition-colors group",
              justify,
              (filtroActivo || ordenActivo) && "text-primary",
            )}
          >
            <span>{label}</span>
            <span className="inline-flex items-center gap-0.5">
              {ordenActivo &&
                (orden!.direccion === "asc" ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                ))}
              {filtroActivo && (
                <Filter className="h-3 w-3 fill-current" />
              )}
              {!filtroActivo && !ordenActivo && (
                <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              )}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          {tieneOrden && (
            <div className="flex items-center gap-1 pb-2 mb-2 border-b">
              <button
                type="button"
                onClick={() =>
                  onOrdenChange!(
                    ordenActivo && orden!.direccion === "asc"
                      ? null
                      : { campo: campo!, direccion: "asc" },
                  )
                }
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted transition-colors",
                  ordenActivo &&
                    orden!.direccion === "asc" &&
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                <ArrowUp className="h-3 w-3" /> {ordenLabelAsc}
              </button>
              <button
                type="button"
                onClick={() =>
                  onOrdenChange!(
                    ordenActivo && orden!.direccion === "desc"
                      ? null
                      : { campo: campo!, direccion: "desc" },
                  )
                }
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted transition-colors",
                  ordenActivo &&
                    orden!.direccion === "desc" &&
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                <ArrowDown className="h-3 w-3" /> {ordenLabelDesc}
              </button>
            </div>
          )}

          {tieneFiltro && filtroTipo === "lista" && (
            <ListaFilter
              campo={campo!}
              label={label}
              opciones={opciones}
              filtros={filtros}
              onFiltrosChange={onFiltrosChange!}
              filtroActivo={filtroActivo}
            />
          )}
          {tieneFiltro && filtroTipo === "numero" && (
            <NumeroFilter
              campo={campo!}
              label={label}
              filtros={filtros}
              onFiltrosChange={onFiltrosChange!}
              filtroActivo={filtroActivo}
            />
          )}
          {tieneFiltro && filtroTipo === "fecha" && (
            <FechaFilter
              campo={campo!}
              label={label}
              filtros={filtros}
              onFiltrosChange={onFiltrosChange!}
              filtroActivo={filtroActivo}
            />
          )}
          {tieneFiltro && filtroTipo === "booleano" && (
            <BooleanoFilter
              campo={campo!}
              label={label}
              filtros={filtros}
              onFiltrosChange={onFiltrosChange!}
              filtroActivo={filtroActivo}
            />
          )}
        </PopoverContent>
      </Popover>
      {resizeHandle}
    </th>
  );
}

function reemplazarFiltro(
  filtros: ToolbarFiltroActivo[],
  campo: string,
  nuevo: ToolbarFiltroActivo | null,
): ToolbarFiltroActivo[] {
  const otros = filtros.filter((f) => f.campo !== campo);
  return nuevo ? [...otros, nuevo] : otros;
}

function ListaFilter({
  campo,
  label,
  opciones,
  filtros,
  onFiltrosChange,
  filtroActivo,
}: {
  campo: string;
  label: string;
  opciones: string[];
  filtros: ToolbarFiltroActivo[];
  onFiltrosChange: (f: ToolbarFiltroActivo[]) => void;
  filtroActivo?: ToolbarFiltroActivo;
}) {
  const [busqueda, setBusqueda] = useState("");
  const seleccionadas = filtroActivo?.valores ?? [];

  const opcionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) => o.toLowerCase().includes(q));
  }, [opciones, busqueda]);

  function aplicar(nuevasValores: string[]) {
    onFiltrosChange(
      reemplazarFiltro(
        filtros,
        campo,
        nuevasValores.length === 0
          ? null
          : {
              id: filtroActivo?.id ?? crypto.randomUUID(),
              campo,
              etiqueta: label,
              valores: nuevasValores,
            },
      ),
    );
  }

  function toggle(opt: string, checked: boolean) {
    aplicar(
      checked
        ? [...seleccionadas, opt]
        : seleccionadas.filter((v) => v !== opt),
    );
  }

  const todasVisiblesSeleccionadas =
    opcionesFiltradas.length > 0 &&
    opcionesFiltradas.every((o) => seleccionadas.includes(o));

  function toggleTodas() {
    if (todasVisiblesSeleccionadas) {
      aplicar(seleccionadas.filter((v) => !opcionesFiltradas.includes(v)));
    } else {
      const set = new Set([...seleccionadas, ...opcionesFiltradas]);
      aplicar(Array.from(set));
    }
  }

  return (
    <div className="space-y-2">
      {opciones.length > 6 && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] px-1">
        <button
          type="button"
          onClick={toggleTodas}
          className="text-primary hover:underline"
        >
          {todasVisiblesSeleccionadas ? "Limpiar todo" : "Seleccionar todo"}
        </button>
        {seleccionadas.length > 0 && (
          <span className="text-muted-foreground">
            {seleccionadas.length} seleccionad
            {seleccionadas.length === 1 ? "a" : "as"}
          </span>
        )}
      </div>

      <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
        {opcionesFiltradas.map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-2 text-sm px-1.5 py-1 rounded hover:bg-muted cursor-pointer select-none font-normal"
          >
            <input
              type="checkbox"
              checked={seleccionadas.includes(opt)}
              onChange={(e) => toggle(opt, e.target.checked)}
              className="rounded accent-primary"
            />
            <span className="truncate">{opt}</span>
          </label>
        ))}
        {opcionesFiltradas.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Sin opciones
          </p>
        )}
      </div>
    </div>
  );
}

function NumeroFilter({
  campo,
  label,
  filtros,
  onFiltrosChange,
  filtroActivo,
}: {
  campo: string;
  label: string;
  filtros: ToolbarFiltroActivo[];
  onFiltrosChange: (f: ToolbarFiltroActivo[]) => void;
  filtroActivo?: ToolbarFiltroActivo;
}) {
  const [operador, setOperador] = useState<"mayor" | "menor" | "igual">(
    (filtroActivo?.operador as "mayor" | "menor" | "igual") ?? "mayor",
  );
  const [valor, setValor] = useState(
    filtroActivo?.numVal !== undefined ? String(filtroActivo.numVal) : "",
  );

  useEffect(() => {
    setOperador(
      (filtroActivo?.operador as "mayor" | "menor" | "igual") ?? "mayor",
    );
    setValor(
      filtroActivo?.numVal !== undefined ? String(filtroActivo.numVal) : "",
    );
  }, [filtroActivo]);

  function aplicar() {
    const num = parseFloat(valor);
    if (Number.isNaN(num)) {
      onFiltrosChange(reemplazarFiltro(filtros, campo, null));
      return;
    }
    onFiltrosChange(
      reemplazarFiltro(filtros, campo, {
        id: filtroActivo?.id ?? crypto.randomUUID(),
        campo,
        etiqueta: label,
        operador,
        numVal: num,
      }),
    );
  }

  function limpiar() {
    setValor("");
    onFiltrosChange(reemplazarFiltro(filtros, campo, null));
  }

  return (
    <div className="space-y-2">
      <Select
        value={operador}
        onValueChange={(v) => setOperador(v as typeof operador)}
      >
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mayor">Mayor que (&gt;)</SelectItem>
          <SelectItem value="menor">Menor que (&lt;)</SelectItem>
          <SelectItem value="igual">Igual a (=)</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="number"
        placeholder="Valor..."
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="h-8"
      />
      <div className="flex gap-1">
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={aplicar}>
          Aplicar
        </Button>
        {filtroActivo && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={limpiar}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function FechaFilter({
  campo,
  label,
  filtros,
  onFiltrosChange,
  filtroActivo,
}: {
  campo: string;
  label: string;
  filtros: ToolbarFiltroActivo[];
  onFiltrosChange: (f: ToolbarFiltroActivo[]) => void;
  filtroActivo?: ToolbarFiltroActivo;
}) {
  const [desde, setDesde] = useState(filtroActivo?.desde ?? "");
  const [hasta, setHasta] = useState(filtroActivo?.hasta ?? "");

  useEffect(() => {
    setDesde(filtroActivo?.desde ?? "");
    setHasta(filtroActivo?.hasta ?? "");
  }, [filtroActivo]);

  function aplicar() {
    if (!desde && !hasta) {
      onFiltrosChange(reemplazarFiltro(filtros, campo, null));
      return;
    }
    onFiltrosChange(
      reemplazarFiltro(filtros, campo, {
        id: filtroActivo?.id ?? crypto.randomUUID(),
        campo,
        etiqueta: label,
        desde: desde || undefined,
        hasta: hasta || undefined,
      }),
    );
  }

  function limpiar() {
    setDesde("");
    setHasta("");
    onFiltrosChange(reemplazarFiltro(filtros, campo, null));
  }

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs text-muted-foreground">Desde</Label>
        <Input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="h-8 mt-0.5"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Hasta</Label>
        <Input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="h-8 mt-0.5"
        />
      </div>
      <div className="flex gap-1">
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={aplicar}>
          Aplicar
        </Button>
        {filtroActivo && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={limpiar}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function BooleanoFilter({
  campo,
  label,
  filtros,
  onFiltrosChange,
  filtroActivo,
}: {
  campo: string;
  label: string;
  filtros: ToolbarFiltroActivo[];
  onFiltrosChange: (f: ToolbarFiltroActivo[]) => void;
  filtroActivo?: ToolbarFiltroActivo;
}) {
  const valor: "todos" | "si" | "no" =
    filtroActivo?.bool === undefined
      ? "todos"
      : filtroActivo.bool
        ? "si"
        : "no";

  function aplicar(v: "todos" | "si" | "no") {
    if (v === "todos") {
      onFiltrosChange(reemplazarFiltro(filtros, campo, null));
      return;
    }
    onFiltrosChange(
      reemplazarFiltro(filtros, campo, {
        id: filtroActivo?.id ?? crypto.randomUUID(),
        campo,
        etiqueta: label,
        bool: v === "si",
      }),
    );
  }

  return (
    <Select
      value={valor}
      onValueChange={(v) => aplicar(v as "todos" | "si" | "no")}
    >
      <SelectTrigger className="h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos</SelectItem>
        <SelectItem value="si">Sí</SelectItem>
        <SelectItem value="no">No</SelectItem>
      </SelectContent>
    </Select>
  );
}
