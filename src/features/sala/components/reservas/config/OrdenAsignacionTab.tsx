"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Info, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@/components/ui/popover";

import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import { listPlanos } from "@/features/sala/planos/actions/planos-actions";
import { listMesas } from "@/features/sala/planos/actions/mesas-actions";
import { listZonas } from "@/features/sala/planos/actions/zonas-actions";
import {
  listCombinaciones,
  listComponentesTodas,
} from "@/features/sala/planos/actions/combinaciones-actions";
import {
  guardarOrdenAsignacion,
  limpiarOrdenAsignacion,
  listOrdenCompleto,
  type DestinoOrden,
  type OrdenPorComensales,
} from "@/features/sala/planos/actions/orden-asignacion-actions";
import {
  COMENSALES_MAX,
  COMENSALES_MIN,
} from "@/features/sala/data/capacidad-grupos";
import type { Mesa, Plano, Zona } from "@/features/sala/planos/data/planos";

interface Local {
  id: string;
  nombre: string;
}

/** Una opción asignable: mesa suelta o combinación. */
interface Opcion {
  /** Clave estable para el DnD: id de mesa, o "c:<id>" si es combinación. */
  clave: string;
  mesaId: string | null;
  combinacionId: string | null;
  codigo: string;
  zonaNombre: string;
  capacidadMin: number;
  capacidadMax: number;
  esCombinacion: boolean;
}

function claveDe(d: DestinoOrden): string {
  return d.mesaId ?? `c:${d.combinacionId}`;
}

function destinoDe(o: Opcion): DestinoOrden {
  return { mesaId: o.mesaId, combinacionId: o.combinacionId };
}

export function OrdenAsignacionTab() {
  const [locales, setLocales] = useState<Local[]>([]);
  const [localId, setLocalId] = useState<string>("");
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoId, setPlanoId] = useState<string>("");

  const [opciones, setOpciones] = useState<Opcion[]>([]);
  /** Orden por tamaño de grupo. Clave = nº comensales, valor = claves ordenadas. */
  const [orden, setOrden] = useState<Record<number, string[]>>({});
  const [ordenGuardado, setOrdenGuardado] = useState<Record<number, string[]>>({});

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    (async () => {
      const r = await listLocalesEmpresa();
      if (r.ok && r.data.length > 0) {
        setLocales(r.data);
        setLocalId((prev) => prev || r.data[0].id);
      }
      setLoading(false);
    })();
  }, []);

  /** Mesas, zonas, combinaciones y planos del local. */
  const cargarLocal = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    const [p, m, z, c, comp] = await Promise.all([
      listPlanos(id),
      listMesas(id),
      listZonas(id),
      listCombinaciones(id),
      listComponentesTodas(id),
    ]);

    if (p.ok) {
      setPlanos(p.data);
      const principal = p.data.find((x) => x.esPrincipal && x.activo) ?? p.data[0];
      setPlanoId(principal?.id ?? "");
    }

    const zonaNombre = new Map<string, string>();
    if (z.ok) for (const zz of z.data) zonaNombre.set(zz.id, zz.nombre);

    const mesasList: Mesa[] = m.ok ? m.data : [];
    const opcs: Opcion[] = [];

    for (const mm of mesasList) {
      if (!mm.activa) continue;
      opcs.push({
        clave: mm.id,
        mesaId: mm.id,
        combinacionId: null,
        codigo: mm.codigo,
        zonaNombre: zonaNombre.get(mm.zonaId) ?? "",
        capacidadMin: mm.capacidadMin,
        capacidadMax: mm.capacidadMax,
        esCombinacion: false,
      });
    }

    if (c.ok) {
      // La zona de la combinación puede venir por zona_id o por sus mesas.
      const zonaDeCombi = new Map<string, string>();
      if (comp.ok) {
        const zonaDeMesa = new Map(mesasList.map((x) => [x.id, x.zonaId]));
        for (const cc of comp.data) {
          if (zonaDeCombi.has(cc.combinacionId)) continue;
          const zid = zonaDeMesa.get(cc.mesaId);
          if (zid) zonaDeCombi.set(cc.combinacionId, zonaNombre.get(zid) ?? "");
        }
      }
      for (const cb of c.data) {
        if (!cb.activa) continue;
        opcs.push({
          clave: `c:${cb.id}`,
          mesaId: null,
          combinacionId: cb.id,
          codigo: cb.codigo,
          zonaNombre:
            (cb.zonaId ? zonaNombre.get(cb.zonaId) : undefined) ??
            zonaDeCombi.get(cb.id) ??
            "",
          capacidadMin: cb.capacidadMin,
          capacidadMax: cb.capacidadMax,
          esCombinacion: true,
        });
      }
    }

    setOpciones(opcs);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (localId) cargarLocal(localId);
  }, [localId, cargarLocal]);

  /** Orden completo del plano: los 20 tamaños de una sola consulta. */
  const cargarOrden = useCallback(async (pid: string) => {
    if (!pid) return;
    const r = await listOrdenCompleto(pid);
    const mapa: Record<number, string[]> = {};
    if (r.ok) {
      const datos = r.data as OrdenPorComensales;
      for (const [n, destinos] of Object.entries(datos)) {
        mapa[Number(n)] = destinos.map(claveDe);
      }
    }
    setOrden(mapa);
    setOrdenGuardado(mapa);
  }, []);

  useEffect(() => {
    if (planoId) cargarOrden(planoId);
  }, [planoId, cargarOrden]);

  const porClave = useMemo(() => {
    const m = new Map<string, Opcion>();
    for (const o of opciones) m.set(o.clave, o);
    return m;
  }, [opciones]);

  /** Opciones que admiten ese número exacto de comensales. */
  const candidatasDe = useCallback(
    (n: number): Opcion[] =>
      opciones
        .filter((o) => n >= o.capacidadMin && n <= o.capacidadMax)
        .sort((a, b) => {
          // Mesas sueltas primero, luego combinaciones; dentro, por zona y código.
          if (a.esCombinacion !== b.esCombinacion) return a.esCombinacion ? 1 : -1;
          if (a.zonaNombre !== b.zonaNombre) return a.zonaNombre.localeCompare(b.zonaNombre);
          return a.codigo.localeCompare(b.codigo, "es", { numeric: true });
        }),
    [opciones],
  );

  const tamanos = useMemo(
    () =>
      Array.from(
        { length: COMENSALES_MAX - COMENSALES_MIN + 1 },
        (_, i) => COMENSALES_MIN + i,
      ),
    [],
  );

  function cambiado(n: number): boolean {
    return (orden[n] ?? []).join(",") !== (ordenGuardado[n] ?? []).join(",");
  }

  function onDragEnd(n: number, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrden((prev) => {
      const lista = prev[n] ?? [];
      const from = lista.indexOf(String(active.id));
      const to = lista.indexOf(String(over.id));
      if (from === -1 || to === -1) return prev;
      return { ...prev, [n]: arrayMove(lista, from, to) };
    });
  }

  async function guardarFila(n: number) {
    setGuardando(n);
    const destinos = (orden[n] ?? [])
      .map((k) => porClave.get(k))
      .filter((o): o is Opcion => Boolean(o))
      .map(destinoDe);
    const res = await guardarOrdenAsignacion({ planoId, comensales: n, destinos });
    setGuardando(null);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    setOrdenGuardado((prev) => ({ ...prev, [n]: orden[n] ?? [] }));
    toast.success(
      destinos.length === 0
        ? `${n} comensales: vuelve al orden por defecto`
        : `Orden guardado para ${n} comensales`,
    );
  }

  async function limpiarFila(n: number) {
    const res = await limpiarOrdenAsignacion(planoId, n);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo restablecer");
      return;
    }
    setOrden((prev) => ({ ...prev, [n]: [] }));
    setOrdenGuardado((prev) => ({ ...prev, [n]: [] }));
    toast.success(`${n} comensales: orden por defecto`);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (planos.length === 0) {
    return (
      <div className="border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium mb-1">Sin planos</p>
        <p>Crea un plano en la pestaña Estructura para poder definir el orden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            Para cada tamaño de grupo, ordena las mesas y combinaciones por preferencia. Al
            entrar una reserva se asigna la primera de la lista que esté entera libre.
          </p>
          <p>
            Lo que no ordenes usa el criterio por defecto: primero mesas sueltas por número, y
            si no hay ninguna libre, la combinación más ajustada al grupo.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {locales.length > 1 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Local</label>
            <Select value={localId} onValueChange={setLocalId}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {planos.length > 1 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Plano</label>
            <Select value={planoId} onValueChange={setPlanoId}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {planos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                    {p.esPrincipal ? " (principal)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Tabla: una fila por tamaño de grupo. */}
      <div className="rounded-md border overflow-hidden">
        <div className="grid grid-cols-[64px_1fr_auto] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Grupo</span>
          <span>Orden de preferencia</span>
          <span />
        </div>

        <div className="divide-y">
          {tamanos.map((n) => {
            const candidatas = candidatasDe(n);
            const lista = orden[n] ?? [];
            const elegidas = lista
              .map((k) => porClave.get(k))
              .filter((o): o is Opcion => Boolean(o));
            const disponibles = candidatas.filter((c) => !lista.includes(c.clave));
            const hayCambio = cambiado(n);

            return (
              <div
                key={n}
                className="grid grid-cols-[64px_1fr_auto] gap-2 px-3 py-2.5 items-start hover:bg-muted/20"
              >
                {/* Tamaño del grupo. */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-sm font-semibold tabular-nums">{n}</span>
                  {(ordenGuardado[n] ?? []).length > 0 && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                      title="Orden personalizado"
                    />
                  )}
                </div>

                {/* Lista ordenable. */}
                <div className="min-w-0">
                  {candidatas.length === 0 ? (
                    <p className="text-xs text-muted-foreground pt-1.5">
                      Ninguna mesa ni combinación admite {n}{" "}
                      {n === 1 ? "comensal" : "comensales"}.
                    </p>
                  ) : elegidas.length === 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        Orden por defecto
                      </span>
                      <SelectorOpcion
                        disponibles={disponibles}
                        onElegir={(o) =>
                          setOrden((prev) => ({ ...prev, [n]: [...(prev[n] ?? []), o.clave] }))
                        }
                        onTodas={() =>
                          setOrden((prev) => ({
                            ...prev,
                            [n]: candidatas.map((c) => c.clave),
                          }))
                        }
                      />
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => onDragEnd(n, e)}
                    >
                      <SortableContext
                        items={elegidas.map((o) => o.clave)}
                        strategy={horizontalListSortingStrategy}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          {elegidas.map((o, i) => (
                            <Chip
                              key={o.clave}
                              opcion={o}
                              posicion={i + 1}
                              onQuitar={() =>
                                setOrden((prev) => ({
                                  ...prev,
                                  [n]: (prev[n] ?? []).filter((k) => k !== o.clave),
                                }))
                              }
                            />
                          ))}
                          {disponibles.length > 0 && (
                            <SelectorOpcion
                              disponibles={disponibles}
                              onElegir={(o) =>
                                setOrden((prev) => ({
                                  ...prev,
                                  [n]: [...(prev[n] ?? []), o.clave],
                                }))
                              }
                              onTodas={() =>
                                setOrden((prev) => ({
                                  ...prev,
                                  [n]: candidatas.map((c) => c.clave),
                                }))
                              }
                            />
                          )}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>

                {/* Acciones de la fila. */}
                <div className="flex items-center gap-1 pt-0.5">
                  {hayCambio && (
                    <>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={guardando === n}
                        onClick={() => guardarFila(n)}
                      >
                        {guardando === n ? "…" : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() =>
                          setOrden((prev) => ({ ...prev, [n]: ordenGuardado[n] ?? [] }))
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {!hayCambio && (ordenGuardado[n] ?? []).length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => limpiarFila(n)}
                      title="Volver al orden por defecto"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground pb-28">
        Las combinaciones aparecen con sus mesas (por ejemplo TE1+TE2) y solo se asignan si
        todas sus mesas están libres.
      </p>
    </div>
  );
}

function Chip({
  opcion,
  posicion,
  onQuitar,
}: {
  opcion: Opcion;
  posicion: number;
  onQuitar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opcion.clave,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <span
      ref={setNodeRef}
      style={style}
      className={[
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs",
        opcion.esCombinacion ? "bg-accent/40 border-dashed" : "bg-card",
        isDragging ? "opacity-80 shadow-lg" : "",
      ].join(" ")}
      title={`${opcion.zonaNombre} — ${opcion.capacidadMin}–${opcion.capacidadMax} plazas`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        aria-label={`Reordenar ${opcion.codigo}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
        {posicion}
      </span>
      <span className="font-medium">{opcion.codigo}</span>
      <button
        type="button"
        onClick={onQuitar}
        className="text-muted-foreground/50 hover:text-foreground"
        aria-label={`Quitar ${opcion.codigo}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function SelectorOpcion({
  disponibles,
  onElegir,
  onTodas,
}: {
  disponibles: Opcion[];
  onElegir: (o: Opcion) => void;
  onTodas: () => void;
}) {
  const [abierto, setAbierto] = useState(false);

  const porZona = useMemo(() => {
    const m = new Map<string, Opcion[]>();
    for (const o of disponibles) {
      const z = o.zonaNombre || "Sin zona";
      const lista = m.get(z);
      if (lista) lista.push(o);
      else m.set(z, [o]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [disponibles]);

  if (disponibles.length === 0) return null;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Añadir
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="max-h-72 overflow-y-auto p-1">
          {porZona.map(([zona, lista]) => (
            <div key={zona} className="mb-1">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {zona}
              </p>
              {lista.map((o) => (
                <button
                  key={o.clave}
                  type="button"
                  onClick={() => {
                    onElegir(o);
                    setAbierto(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                >
                  <span className="font-medium">{o.codigo}</span>
                  {o.esCombinacion && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal">
                      unión
                    </Badge>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {o.capacidadMin === o.capacidadMax
                      ? `${o.capacidadMax}`
                      : `${o.capacidadMin}–${o.capacidadMax}`}{" "}
                    plazas
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t p-1">
          <button
            type="button"
            onClick={() => {
              onTodas();
              setAbierto(false);
            }}
            className="w-full rounded px-2 py-1.5 text-left text-xs font-medium hover:bg-accent"
          >
            Añadir todas
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
