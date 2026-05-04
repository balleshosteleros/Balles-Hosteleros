"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Columns3,
  Plus,
  ChevronLeft,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export type ToolbarFiltroTipo = "lista" | "numero" | "fecha" | "booleano";

export type ToolbarCampoFiltro = {
  campo: string;
  label: string;
  tipo: ToolbarFiltroTipo;
  opciones?: string[];
};

export type ToolbarFiltroActivo = {
  id: string;
  campo: string;
  etiqueta: string;
  valores?: string[];
  operador?: "mayor" | "menor" | "igual";
  numVal?: number;
  desde?: string;
  hasta?: string;
  bool?: boolean;
};

export type ToolbarOrdenOpcion = {
  campo: string;
  label: string;
};

export type ToolbarOrdenActivo = {
  campo: string;
  direccion: "asc" | "desc";
};

export type ToolbarColumna = {
  campo: string;
  label: string;
};

export type ToolbarColumnaVisible = Record<string, boolean>;

interface SubmoduleToolbarProps {
  // Búsqueda
  busqueda?: string;
  onBusquedaChange?: (v: string) => void;
  placeholderBusqueda?: string;

  // Acción nuevo
  onNuevo?: () => void;
  textoNuevo?: string;
  ocultarNuevo?: boolean;

  // Filtros avanzados
  campos?: ToolbarCampoFiltro[];
  filtros?: ToolbarFiltroActivo[];
  onFiltrosChange?: (f: ToolbarFiltroActivo[]) => void;

  // Ordenar
  ordenOpciones?: ToolbarOrdenOpcion[];
  orden?: ToolbarOrdenActivo | null;
  onOrdenChange?: (o: ToolbarOrdenActivo | null) => void;

  // Columnas / ajustes de vista
  columnas?: ToolbarColumna[];
  columnasVisibles?: ToolbarColumnaVisible;
  onColumnasVisiblesChange?: (v: ToolbarColumnaVisible) => void;

  // Slot para acciones extra (ej. importar, exportar)
  extraIzquierda?: ReactNode;
  extraDerecha?: ReactNode;

  className?: string;
}

export function SubmoduleToolbar({
  busqueda = "",
  onBusquedaChange,
  placeholderBusqueda = "Buscar...",
  onNuevo,
  textoNuevo = "Nuevo",
  ocultarNuevo = false,
  campos = [],
  filtros = [],
  onFiltrosChange,
  ordenOpciones = [],
  orden = null,
  onOrdenChange,
  columnas = [],
  columnasVisibles = {},
  onColumnasVisiblesChange,
  extraIzquierda,
  extraDerecha,
  className,
}: SubmoduleToolbarProps) {
  const tieneBusqueda = !!onBusquedaChange;
  const tieneFiltros = campos.length > 0 && !!onFiltrosChange;
  const tieneOrden = ordenOpciones.length > 0 && !!onOrdenChange;
  const tieneColumnas = columnas.length > 0 && !!onColumnasVisiblesChange;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {!ocultarNuevo && (
          <Button
            variant="primary"
            size="sm"
            onClick={onNuevo}
            disabled={!onNuevo}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {textoNuevo}
          </Button>
        )}
        {extraIzquierda}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {tieneBusqueda && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={placeholderBusqueda}
              value={busqueda}
              onChange={(e) => onBusquedaChange?.(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        )}

        {tieneFiltros && (
          <FiltrosPopover
            campos={campos}
            filtros={filtros}
            onChange={onFiltrosChange!}
          />
        )}

        {tieneOrden && (
          <OrdenPopover
            opciones={ordenOpciones}
            valor={orden}
            onChange={onOrdenChange!}
          />
        )}

        {tieneColumnas && (
          <ColumnasPopover
            columnas={columnas}
            visibles={columnasVisibles}
            onChange={onColumnasVisiblesChange!}
          />
        )}

        {extraDerecha}
      </div>

      {filtros.length > 0 && tieneFiltros && (
        <FiltrosChips filtros={filtros} onChange={onFiltrosChange!} />
      )}
    </div>
  );
}

function FiltrosPopover({
  campos,
  filtros,
  onChange,
}: {
  campos: ToolbarCampoFiltro[];
  filtros: ToolbarFiltroActivo[];
  onChange: (f: ToolbarFiltroActivo[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [paso, setPaso] = useState<"campo" | "valor">("campo");
  const [campoActual, setCampoActual] = useState<string | null>(null);
  const [tempValores, setTempValores] = useState<string[]>([]);
  const [tempOperador, setTempOperador] = useState<"mayor" | "menor" | "igual">(
    "mayor",
  );
  const [tempNum, setTempNum] = useState("");
  const [tempDesde, setTempDesde] = useState("");
  const [tempHasta, setTempHasta] = useState("");
  const [tempBool, setTempBool] = useState<"si" | "no">("si");

  const campoDef = useMemo(
    () => (campoActual ? campos.find((c) => c.campo === campoActual) : null),
    [campoActual, campos],
  );

  function abrirCampo(c: string) {
    setCampoActual(c);
    setTempValores([]);
    setTempOperador("mayor");
    setTempNum("");
    setTempDesde("");
    setTempHasta("");
    setTempBool("si");
    setPaso("valor");
  }

  function confirmar() {
    if (!campoActual || !campoDef) return;
    let nuevo: ToolbarFiltroActivo | null = null;
    if (campoDef.tipo === "lista" && tempValores.length > 0) {
      nuevo = {
        id: crypto.randomUUID(),
        campo: campoActual,
        etiqueta: campoDef.label,
        valores: tempValores,
      };
    } else if (campoDef.tipo === "numero" && tempNum) {
      nuevo = {
        id: crypto.randomUUID(),
        campo: campoActual,
        etiqueta: campoDef.label,
        operador: tempOperador,
        numVal: parseFloat(tempNum),
      };
    } else if (campoDef.tipo === "fecha" && (tempDesde || tempHasta)) {
      nuevo = {
        id: crypto.randomUUID(),
        campo: campoActual,
        etiqueta: campoDef.label,
        desde: tempDesde || undefined,
        hasta: tempHasta || undefined,
      };
    } else if (campoDef.tipo === "booleano") {
      nuevo = {
        id: crypto.randomUUID(),
        campo: campoActual,
        etiqueta: campoDef.label,
        bool: tempBool === "si",
      };
    }
    if (nuevo) onChange([...filtros, nuevo]);
    setOpen(false);
    setPaso("campo");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPaso("campo");
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <SlidersHorizontal className="h-4 w-4" />
          Filtrar
          {filtros.length > 0 && (
            <Badge className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px] rounded-full">
              {filtros.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        {paso === "campo" ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Filtrar por
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
              {campos.map((c) => (
                <button
                  key={c.campo}
                  onClick={() => abrirCampo(c.campo)}
                  className="text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors border border-transparent hover:border-border"
                >
                  {c.label}
                </button>
              ))}
              {campos.length === 0 && (
                <p className="text-xs text-muted-foreground col-span-2 text-center py-3">
                  No hay filtros disponibles
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPaso("campo")}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold">{campoDef?.label}</p>
            </div>

            {campoDef?.tipo === "lista" && (
              <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
                {(campoDef.opciones ?? []).map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 text-sm px-1.5 py-1 rounded hover:bg-muted cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={tempValores.includes(opt)}
                      onChange={(e) =>
                        setTempValores(
                          e.target.checked
                            ? [...tempValores, opt]
                            : tempValores.filter((v) => v !== opt),
                        )
                      }
                      className="rounded accent-primary"
                    />
                    {opt}
                  </label>
                ))}
                {(campoDef.opciones ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Sin opciones disponibles
                  </p>
                )}
              </div>
            )}

            {campoDef?.tipo === "numero" && (
              <div className="space-y-2">
                <Select
                  value={tempOperador}
                  onValueChange={(v) =>
                    setTempOperador(v as typeof tempOperador)
                  }
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
                  placeholder="Introducir valor..."
                  value={tempNum}
                  onChange={(e) => setTempNum(e.target.value)}
                  className="h-8"
                />
              </div>
            )}

            {campoDef?.tipo === "fecha" && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Desde</Label>
                  <Input
                    type="date"
                    value={tempDesde}
                    onChange={(e) => setTempDesde(e.target.value)}
                    className="h-8 mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hasta</Label>
                  <Input
                    type="date"
                    value={tempHasta}
                    onChange={(e) => setTempHasta(e.target.value)}
                    className="h-8 mt-0.5"
                  />
                </div>
              </div>
            )}

            {campoDef?.tipo === "booleano" && (
              <Select
                value={tempBool}
                onValueChange={(v) => setTempBool(v as "si" | "no")}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">Sí</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button size="sm" className="w-full" onClick={confirmar}>
              Aplicar filtro
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FiltrosChips({
  filtros,
  onChange,
}: {
  filtros: ToolbarFiltroActivo[];
  onChange: (f: ToolbarFiltroActivo[]) => void;
}) {
  function label(f: ToolbarFiltroActivo): string {
    if (f.valores?.length) return `${f.etiqueta}: ${f.valores.join(", ")}`;
    if (f.operador !== undefined) {
      const op = f.operador === "mayor" ? ">" : f.operador === "menor" ? "<" : "=";
      return `${f.etiqueta} ${op} ${f.numVal}`;
    }
    if (f.bool !== undefined) return `${f.etiqueta}: ${f.bool ? "Sí" : "No"}`;
    const partes: string[] = [];
    if (f.desde) partes.push(`desde ${f.desde}`);
    if (f.hasta) partes.push(`hasta ${f.hasta}`);
    return `${f.etiqueta}: ${partes.join(" ")}`;
  }
  return (
    <div className="basis-full flex flex-wrap items-center gap-1.5 pt-1">
      {filtros.map((f) => (
        <span
          key={f.id}
          className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5"
        >
          {label(f)}
          <button
            onClick={() => onChange(filtros.filter((x) => x.id !== f.id))}
            className="hover:text-destructive ml-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {filtros.length > 1 && (
        <button
          onClick={() => onChange([])}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}

function OrdenPopover({
  opciones,
  valor,
  onChange,
}: {
  opciones: ToolbarOrdenOpcion[];
  valor: ToolbarOrdenActivo | null;
  onChange: (v: ToolbarOrdenActivo | null) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 gap-1.5", valor && "border-primary text-primary")}
          aria-label="Ordenar"
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1.5 py-1">
          Ordenar por
        </p>
        <div className="space-y-0.5">
          {opciones.map((o) => {
            const activoAsc =
              valor?.campo === o.campo && valor.direccion === "asc";
            const activoDesc =
              valor?.campo === o.campo && valor.direccion === "desc";
            return (
              <div
                key={o.campo}
                className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-muted text-sm"
              >
                <span>{o.label}</span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() =>
                      onChange(
                        activoAsc ? null : { campo: o.campo, direccion: "asc" },
                      )
                    }
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs",
                      activoAsc
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-background",
                    )}
                  >
                    A→Z
                  </button>
                  <button
                    onClick={() =>
                      onChange(
                        activoDesc
                          ? null
                          : { campo: o.campo, direccion: "desc" },
                      )
                    }
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs",
                      activoDesc
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-background",
                    )}
                  >
                    Z→A
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {valor && (
          <button
            onClick={() => onChange(null)}
            className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground underline"
          >
            Quitar orden
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ColumnasPopover({
  columnas,
  visibles,
  onChange,
}: {
  columnas: ToolbarColumna[];
  visibles: ToolbarColumnaVisible;
  onChange: (v: ToolbarColumnaVisible) => void;
}) {
  function toggle(campo: string) {
    onChange({ ...visibles, [campo]: !(visibles[campo] ?? true) });
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0"
          aria-label="Ajustes de columnas"
        >
          <Columns3 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1.5 py-1">
          Columnas visibles
        </p>
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {columnas.map((c) => {
            const visible = visibles[c.campo] ?? true;
            return (
              <button
                key={c.campo}
                onClick={() => toggle(c.campo)}
                className="w-full flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-muted text-sm"
              >
                <span
                  className={cn(
                    !visible && "text-muted-foreground line-through",
                  )}
                >
                  {c.label}
                </span>
                {visible && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function aplicarFiltrosToolbar<T>(
  items: T[],
  filtros: ToolbarFiltroActivo[],
  acceso: (item: T, campo: string) => unknown,
): T[] {
  if (filtros.length === 0) return items;
  return items.filter((item) =>
    filtros.every((f) => {
      const valor = acceso(item, f.campo);
      if (f.valores?.length) {
        return f.valores.includes(String(valor ?? ""));
      }
      if (f.operador !== undefined && f.numVal !== undefined) {
        const num = typeof valor === "number" ? valor : parseFloat(String(valor ?? "NaN"));
        if (Number.isNaN(num)) return false;
        if (f.operador === "mayor") return num > f.numVal;
        if (f.operador === "menor") return num < f.numVal;
        return num === f.numVal;
      }
      if (f.desde || f.hasta) {
        const fecha = String(valor ?? "");
        if (!fecha) return false;
        if (f.desde && fecha < f.desde) return false;
        if (f.hasta && fecha > f.hasta) return false;
        return true;
      }
      if (f.bool !== undefined) {
        return Boolean(valor) === f.bool;
      }
      return true;
    }),
  );
}

export function aplicarOrdenToolbar<T>(
  items: T[],
  orden: ToolbarOrdenActivo | null,
  acceso: (item: T, campo: string) => unknown,
): T[] {
  if (!orden) return items;
  const copia = [...items];
  copia.sort((a, b) => {
    const va = acceso(a, orden.campo);
    const vb = acceso(b, orden.campo);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") {
      return orden.direccion === "asc" ? va - vb : vb - va;
    }
    const sa = String(va);
    const sb = String(vb);
    return orden.direccion === "asc"
      ? sa.localeCompare(sb, "es")
      : sb.localeCompare(sa, "es");
  });
  return copia;
}
