"use client";

import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  SlidersHorizontal,
  ArrowDownWideNarrow,
  Columns3,
  Plus,
  ChevronLeft,
  X,
  Check,
  Lock,
  Save,
  Loader2,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  loadViewPreferences,
  saveViewPreferences,
} from "@/shared/io/view-preferences";

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
  bloqueada?: boolean;
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
  /**
   * Filtros "por defecto" que SÍ se aplican pero NO se muestran como indicador
   * (ni en el badge numérico ni como chip) mientras coincidan exactamente con
   * lo seleccionado. Sirve para defaults silenciosos como Estado = solo Activo:
   * la tabla arranca filtrada pero sin que parezca que el usuario puso un filtro.
   * En cuanto el usuario cambia ese filtro (otros valores), deja de coincidir y
   * vuelve a aparecer como indicador normal.
   */
  filtrosDefault?: ToolbarFiltroActivo[];

  // Ordenar
  ordenOpciones?: ToolbarOrdenOpcion[];
  orden?: ToolbarOrdenActivo | null;
  onOrdenChange?: (o: ToolbarOrdenActivo | null) => void;

  // Columnas / ajustes de vista
  columnas?: ToolbarColumna[];
  columnasVisibles?: ToolbarColumnaVisible;
  onColumnasVisiblesChange?: (v: ToolbarColumnaVisible) => void;
  /**
   * Orden personalizado de columnas no bloqueadas (lista de `campo`).
   * Si se pasa, se respeta tras hidratación; si no, el orden viene del código.
   * Las columnas bloqueadas siempre van primero, en el orden del código.
   */
  columnasOrden?: string[];
  onColumnasOrdenChange?: (orden: string[]) => void;

  /**
   * Identificador estable de esta vista para persistir preferencias
   * (visibilidad de columnas) por usuario × empresa × vista.
   * Si se omite, se deriva del `pathname` actual (recomendado: cada
   * submódulo vive en una ruta única).
   */
  viewKey?: string;

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
  filtrosDefault = [],
  ordenOpciones = [],
  orden = null,
  onOrdenChange,
  columnas = [],
  columnasVisibles = {},
  onColumnasVisiblesChange,
  columnasOrden,
  onColumnasOrdenChange,
  viewKey,
  extraIzquierda,
  extraDerecha,
  className,
}: SubmoduleToolbarProps) {
  const tieneBusqueda = !!onBusquedaChange;
  const tieneFiltros = campos.length > 0 && !!onFiltrosChange;
  // Filtros que cuentan como "indicador visible": se ocultan los que coinciden
  // exactamente con un filtro por defecto (mismo campo + mismos valores). El
  // filtro sigue aplicándose a los datos; solo no se pinta como chip/badge.
  const filtrosVisibles =
    filtrosDefault.length === 0
      ? filtros
      : filtros.filter((f) => !filtrosDefault.some((d) => filtrosEquivalentes(f, d)));
  const tieneOrden = ordenOpciones.length > 0 && !!onOrdenChange;
  const tieneColumnas = columnas.length > 0 && !!onColumnasVisiblesChange;

  // Persistencia de visibilidad de columnas por usuario × empresa × vista.
  // El viewKey por defecto es el pathname (sin slashes laterales) — cada
  // submódulo tiene su propia ruta, así que es un identificador natural.
  const pathname = usePathname();
  const resolvedViewKey =
    viewKey ?? (pathname ?? "").replace(/^\/+|\/+$/g, "");
  const { user } = useAuth();
  const { empresaActual } = useEmpresa();
  const empresaDbId = empresaActual?.dbId ?? null;
  const userId = user?.id ?? null;
  const persistKey = `${userId ?? ""}|${empresaDbId ?? ""}|${resolvedViewKey}`;
  const hydratedRef = useRef<string | null>(null);

  // Hidratar visibilidad guardada cuando cambia (usuario × empresa × vista).
  // Solo se aplica una vez por combinación para no pisar cambios locales del usuario.
  useEffect(() => {
    if (!tieneColumnas) return;
    if (!userId || !empresaDbId || !resolvedViewKey) return;
    if (hydratedRef.current === persistKey) return;
    hydratedRef.current = persistKey;

    let cancelled = false;
    loadViewPreferences(resolvedViewKey, empresaDbId, userId)
      .then((prefs) => {
        if (cancelled) return;
        const hidden = prefs?.columnsHidden;
        if (hidden) {
          // Reconstruimos el record { campo: visible } a partir del subset oculto.
          const next: ToolbarColumnaVisible = {};
          for (const col of columnas) {
            next[col.campo] = !hidden[col.campo];
          }
          onColumnasVisiblesChange?.(next);
        }
        const ordenGuardado = prefs?.columnsOrder;
        if (ordenGuardado && ordenGuardado.length > 0) {
          // Solo emitimos campos que existen y no son bloqueados.
          const camposNoBloqueados = new Set(
            columnas.filter((c) => !c.bloqueada).map((c) => c.campo),
          );
          const filtrado = ordenGuardado.filter((c) => camposNoBloqueados.has(c));
          if (filtrado.length > 0) {
            onColumnasOrdenChange?.(filtrado);
          }
        }
      })
      .catch((err) => {
        console.error("[SubmoduleToolbar] hidratar prefs falló", err);
      });
    return () => {
      cancelled = true;
    };
    // columnas se referencia por sus campos; evitamos re-fetch en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey, tieneColumnas]);

  const puedeGuardar =
    tieneColumnas && !!userId && !!empresaDbId && !!resolvedViewKey;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {!ocultarNuevo && onNuevo && (
          <Button
            variant="primary"
            size="sm"
            onClick={onNuevo}
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
            conteoIndicador={filtrosVisibles.length}
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
            orden={columnasOrden}
            onOrdenChange={onColumnasOrdenChange}
            viewKey={resolvedViewKey}
            empresaDbId={empresaDbId}
            userId={userId}
            puedeGuardar={puedeGuardar}
          />
        )}

        {extraDerecha}
      </div>

      {filtrosVisibles.length > 0 && !!onFiltrosChange && (
        <FiltrosChips
          filtros={filtrosVisibles}
          filtrosCompletos={filtros}
          onChange={onFiltrosChange}
        />
      )}
    </div>
  );
}

function FiltrosPopover({
  campos,
  filtros,
  conteoIndicador,
  onChange,
}: {
  campos: ToolbarCampoFiltro[];
  filtros: ToolbarFiltroActivo[];
  // Nº de filtros que cuentan como indicador (excluye los default silenciosos).
  // Se usa solo para el badge; las operaciones siguen sobre `filtros` completo.
  conteoIndicador: number;
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
          {conteoIndicador > 0 && (
            <Badge className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px] rounded-full">
              {conteoIndicador}
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
  filtrosCompletos,
  onChange,
}: {
  // Filtros a pintar como chip (excluye los default silenciosos).
  filtros: ToolbarFiltroActivo[];
  // Array real completo (incluye defaults); base para quitar/limpiar sin
  // perder los filtros por defecto que no se muestran.
  filtrosCompletos: ToolbarFiltroActivo[];
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
            onClick={() => onChange(filtrosCompletos.filter((x) => x.id !== f.id))}
            className="hover:text-destructive ml-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {filtros.length > 1 && (
        <button
          onClick={() =>
            // "Limpiar todo" quita los chips visibles pero conserva los filtros
            // por defecto silenciosos (p. ej. Estado = Activo).
            onChange(filtrosCompletos.filter((f) => !filtros.some((v) => v.id === f.id)))
          }
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
          className={cn("h-9 w-9 p-0", valor && "border-primary text-primary")}
          aria-label="Ordenar"
          title="Ordenar"
        >
          <ArrowDownWideNarrow className="h-4 w-4" />
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
  orden,
  onOrdenChange,
  viewKey,
  empresaDbId,
  userId,
  puedeGuardar,
}: {
  columnas: ToolbarColumna[];
  visibles: ToolbarColumnaVisible;
  onChange: (v: ToolbarColumnaVisible) => void;
  orden: string[] | undefined;
  onOrdenChange: ((orden: string[]) => void) | undefined;
  viewKey: string;
  empresaDbId: string | null;
  userId: string | null;
  puedeGuardar: boolean;
}) {
  const [guardando, setGuardando] = useState(false);

  const bloqueadas = useMemo(
    () => columnas.filter((c) => c.bloqueada),
    [columnas],
  );
  const noBloqueadas = useMemo(
    () => columnas.filter((c) => !c.bloqueada),
    [columnas],
  );

  // Orden efectivo de las no bloqueadas: respeta `orden` cuando existe,
  // y añade al final cualquier columna nueva que aún no esté en `orden`.
  const ordenEfectivo = useMemo(() => {
    if (!orden || orden.length === 0) return noBloqueadas.map((c) => c.campo);
    const set = new Set(noBloqueadas.map((c) => c.campo));
    const usadas = new Set<string>();
    const result: string[] = [];
    for (const campo of orden) {
      if (set.has(campo) && !usadas.has(campo)) {
        result.push(campo);
        usadas.add(campo);
      }
    }
    for (const c of noBloqueadas) {
      if (!usadas.has(c.campo)) result.push(c.campo);
    }
    return result;
  }, [orden, noBloqueadas]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function toggle(campo: string) {
    onChange({ ...visibles, [campo]: !(visibles[campo] ?? true) });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordenEfectivo.indexOf(String(active.id));
    const newIndex = ordenEfectivo.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ordenEfectivo, oldIndex, newIndex);
    onOrdenChange?.(next);
  }

  async function handleGuardar() {
    if (!puedeGuardar || guardando) return;
    setGuardando(true);
    try {
      // Persistimos solo las columnas explícitamente OCULTAS.
      // Así, columnas nuevas que se añadan al código en el futuro aparecen
      // por defecto visibles para todos los usuarios.
      const columnsHidden: Record<string, boolean> = {};
      for (const c of columnas) {
        if (c.bloqueada) continue;
        if (visibles[c.campo] === false) {
          columnsHidden[c.campo] = true;
        }
      }
      await saveViewPreferences(viewKey, empresaDbId, userId, {
        columnsHidden,
        columnsOrder: ordenEfectivo,
      });
      toast.success("Configuración de columnas guardada");
    } catch (err) {
      console.error("[ColumnasPopover] guardar prefs falló", err);
      toast.error("No se pudo guardar la configuración");
    } finally {
      setGuardando(false);
    }
  }

  const labelDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of columnas) m.set(c.campo, c.label);
    return m;
  }, [columnas]);

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
      <PopoverContent className="w-64 p-2" align="end">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1.5 py-1">
          Columnas visibles
        </p>
        <div className="space-y-0.5 max-h-80 overflow-y-auto">
          {bloqueadas.map((c) => (
            <div
              key={c.campo}
              className="w-full flex items-center justify-between gap-2 px-1.5 py-1 rounded text-sm cursor-not-allowed opacity-70"
              title="Esta columna no puede ocultarse ni reordenarse"
            >
              <span className="text-foreground">{c.label}</span>
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ))}
          {onOrdenChange ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={ordenEfectivo}
                strategy={verticalListSortingStrategy}
              >
                {ordenEfectivo.map((campo) => (
                  <SortableColumnItem
                    key={campo}
                    campo={campo}
                    label={labelDe.get(campo) ?? campo}
                    visible={visibles[campo] ?? true}
                    onToggle={() => toggle(campo)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            ordenEfectivo.map((campo) => {
              const visible = visibles[campo] ?? true;
              return (
                <button
                  key={campo}
                  onClick={() => toggle(campo)}
                  className="w-full flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-muted text-sm"
                >
                  <span
                    className={cn(
                      !visible && "text-muted-foreground line-through",
                    )}
                  >
                    {labelDe.get(campo) ?? campo}
                  </span>
                  {visible && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })
          )}
        </div>
        {onOrdenChange && (
          <p className="mt-1 px-1.5 text-[10px] text-muted-foreground leading-tight">
            Arrastra para reordenar.
          </p>
        )}
        <div className="mt-2 border-t pt-2">
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={handleGuardar}
            disabled={!puedeGuardar || guardando}
            title={
              puedeGuardar
                ? "Guardar esta configuración para esta vista"
                : "Inicia sesión y selecciona una empresa para guardar"
            }
          >
            {guardando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Guardar configuración
          </Button>
          <p className="mt-1 text-[10px] text-muted-foreground text-center leading-tight">
            Se guarda solo para tu usuario en esta empresa.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortableColumnItem({
  campo,
  label,
  visible,
  onToggle,
}: {
  campo: string;
  label: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: campo });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-full flex items-center gap-1 px-1 py-1 rounded text-sm",
        isDragging ? "bg-muted" : "hover:bg-muted",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${label}`}
        className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 flex items-center justify-between gap-2 text-left"
      >
        <span
          className={cn(!visible && "text-muted-foreground line-through")}
        >
          {label}
        </span>
        {visible && <Check className="h-3.5 w-3.5 text-primary" />}
      </button>
    </div>
  );
}

/**
 * Devuelve true si la columna está visible (por defecto sí).
 * Las columnas con `bloqueada: true` siempre se muestran, sin importar el estado.
 */
export function colVisible(
  visibles: ToolbarColumnaVisible,
  campo: string,
): boolean {
  return visibles[campo] ?? true;
}

/**
 * Devuelve la lista de columnas en el orden efectivo:
 * 1. Columnas bloqueadas primero, en el orden del código.
 * 2. Columnas no bloqueadas en el orden de `orden` (si se pasó).
 * 3. Columnas no bloqueadas que no estén en `orden` se añaden al final
 *    en el orden del código (caso típico: columna nueva añadida en código
 *    posterior a la última vez que el usuario guardó su orden).
 *
 * Esta es la función que cada vista debe usar para iterar sus headers
 * y celdas, garantizando que el reordenamiento del usuario se respete.
 */
export function ordenarColumnas(
  columnas: ToolbarColumna[],
  orden: string[] | undefined,
): ToolbarColumna[] {
  const bloqueadas = columnas.filter((c) => c.bloqueada);
  const noBloqueadas = columnas.filter((c) => !c.bloqueada);
  if (!orden || orden.length === 0) return [...bloqueadas, ...noBloqueadas];
  const map = new Map(noBloqueadas.map((c) => [c.campo, c]));
  const ordenadas: ToolbarColumna[] = [];
  const usadas = new Set<string>();
  for (const campo of orden) {
    const col = map.get(campo);
    if (col && !usadas.has(campo)) {
      ordenadas.push(col);
      usadas.add(campo);
    }
  }
  for (const col of noBloqueadas) {
    if (!usadas.has(col.campo)) ordenadas.push(col);
  }
  return [...bloqueadas, ...ordenadas];
}

// Dos filtros son equivalentes (a efectos de "indicador") si filtran lo mismo:
// mismo campo y mismo criterio. El `id` se ignora — los filtros por defecto se
// crean con ids fijos y los del usuario con uuids aleatorios.
function filtrosEquivalentes(a: ToolbarFiltroActivo, b: ToolbarFiltroActivo): boolean {
  if (a.campo !== b.campo) return false;
  const valsA = [...(a.valores ?? [])].sort();
  const valsB = [...(b.valores ?? [])].sort();
  if (valsA.length !== valsB.length || valsA.some((v, i) => v !== valsB[i])) return false;
  return (
    a.operador === b.operador &&
    a.numVal === b.numVal &&
    a.desde === b.desde &&
    a.hasta === b.hasta &&
    a.bool === b.bool
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

export function coincideBusquedaUniversal(item: unknown, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const visit = (value: unknown, depth: number): boolean => {
    if (value == null) return false;
    if (depth > 4) return false;
    if (typeof value === "string") return value.toLowerCase().includes(q);
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value).toLowerCase().includes(q);
    }
    if (Array.isArray(value)) return value.some((v) => visit(v, depth + 1));
    if (typeof value === "object") {
      return Object.values(value as Record<string, unknown>).some((v) =>
        visit(v, depth + 1),
      );
    }
    return false;
  };

  return visit(item, 0);
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
