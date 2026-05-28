"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EtiquetaChip } from "@/features/sala/components/reservas/config/EtiquetaChip";
import {
  listEtiquetaCategorias,
  listEtiquetas,
  listEtiquetasDeReserva,
  listEtiquetasDeCliente,
  setEtiquetasReserva,
  setEtiquetasCliente,
  type Etiqueta,
  type EtiquetaCategoria,
  type EtiquetaScope,
} from "@/features/sala/actions/sala-etiquetas-actions";

interface Props {
  /**
   * 'reserva' → gestiona la lista exclusiva de esta reserva. Si además
   * pasas `clienteVinculadoId`, las etiquetas heredadas del cliente se
   * muestran en read-only (no se pueden quitar desde aquí; se editan en
   * la ficha del cliente).
   *
   * 'cliente' → gestiona las etiquetas persistentes del cliente. Solo
   * se ofrecen etiquetas con scope='cliente'.
   */
  scope: EtiquetaScope;
  entityId: string;
  clienteVinculadoId?: string | null;
  onChange?: () => void;
}

export function EtiquetasPanel({
  scope,
  entityId,
  clienteVinculadoId,
  onChange,
}: Props) {
  const [todasCategorias, setTodasCategorias] = useState<EtiquetaCategoria[]>([]);
  const [todasEtiquetas, setTodasEtiquetas] = useState<Etiqueta[]>([]);
  const [propias, setPropias] = useState<Etiqueta[]>([]);
  const [heredadasCliente, setHeredadasCliente] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    const [cats, etiqs, propiasRes, heredadasRes] = await Promise.all([
      listEtiquetaCategorias(),
      listEtiquetas({ soloActivas: true }),
      scope === "reserva"
        ? listEtiquetasDeReserva(entityId)
        : listEtiquetasDeCliente(entityId),
      scope === "reserva" && clienteVinculadoId
        ? listEtiquetasDeCliente(clienteVinculadoId)
        : Promise.resolve({ ok: true, data: [] as Etiqueta[] }),
    ]);
    if (cats.ok) setTodasCategorias(cats.data);
    if (etiqs.ok) setTodasEtiquetas(etiqs.data);
    if (propiasRes.ok) setPropias(propiasRes.data);
    if (heredadasRes.ok) setHeredadasCliente(heredadasRes.data);
    setLoading(false);
  }, [scope, entityId, clienteVinculadoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const propiasIds = useMemo(() => new Set(propias.map((e) => e.id)), [propias]);
  const heredadasIds = useMemo(
    () => new Set(heredadasCliente.map((e) => e.id)),
    [heredadasCliente],
  );

  // Etiquetas ofrecidas en el picker según el scope del panel.
  const ofrecidas = useMemo(() => {
    if (scope === "cliente") {
      // En la ficha del cliente solo tiene sentido asignar etiquetas de cliente.
      return todasEtiquetas.filter((e) => e.scope === "cliente");
    }
    // En la reserva ofrecemos ambos scopes: las de reserva van a esta reserva,
    // las de cliente se propagan al cliente vinculado (si existe).
    return todasEtiquetas;
  }, [todasEtiquetas, scope]);

  const ofrecidasPorCategoria = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtradas = ofrecidas.filter(
      (e) => !q || e.nombre.toLowerCase().includes(q),
    );
    const map = new Map<string, Etiqueta[]>();
    for (const e of filtradas) {
      const key = e.categoriaId ?? "__sin_categoria__";
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [ofrecidas, busqueda]);

  function estaSeleccionada(e: Etiqueta): boolean {
    if (e.scope === "cliente" && scope === "reserva") {
      return heredadasIds.has(e.id);
    }
    return propiasIds.has(e.id);
  }

  async function toggle(e: Etiqueta) {
    if (e.scope === "cliente" && scope === "reserva") {
      // Modifica la lista del cliente vinculado.
      if (!clienteVinculadoId) {
        toast.error(
          "Vincula primero un cliente a la reserva para poder marcarle etiquetas persistentes.",
        );
        return;
      }
      const set = new Set(heredadasIds);
      if (set.has(e.id)) set.delete(e.id);
      else set.add(e.id);
      const res = await setEtiquetasCliente(clienteVinculadoId, Array.from(set));
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar");
        return;
      }
      cargar();
      onChange?.();
      return;
    }

    // Etiqueta del scope propio del panel.
    const set = new Set(propiasIds);
    if (set.has(e.id)) set.delete(e.id);
    else set.add(e.id);
    const res =
      scope === "reserva"
        ? await setEtiquetasReserva(entityId, Array.from(set))
        : await setEtiquetasCliente(entityId, Array.from(set));
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    cargar();
    onChange?.();
  }

  async function quitarDePropias(e: Etiqueta) {
    const set = new Set(propiasIds);
    set.delete(e.id);
    const res =
      scope === "reserva"
        ? await setEtiquetasReserva(entityId, Array.from(set))
        : await setEtiquetasCliente(entityId, Array.from(set));
    if (!res.ok) toast.error(res.error ?? "No se pudo guardar");
    else {
      cargar();
      onChange?.();
    }
  }

  if (loading) {
    return <div className="text-xs text-muted-foreground">Cargando etiquetas…</div>;
  }

  // Combinada para la visualización (propias + heredadas cuando aplica).
  const visibles: Array<{ etiqueta: Etiqueta; origen: "propia" | "cliente" }> = [
    ...propias.map((e) => ({ etiqueta: e, origen: "propia" as const })),
    ...(scope === "reserva"
      ? heredadasCliente
          .filter((e) => !propiasIds.has(e.id))
          .map((e) => ({ etiqueta: e, origen: "cliente" as const }))
      : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {visibles.length === 0 && (
          <span className="text-xs text-muted-foreground italic">
            Sin etiquetas.
          </span>
        )}
        {visibles.map(({ etiqueta, origen }) => (
          <span
            key={`${origen}-${etiqueta.id}`}
            className="inline-flex items-center group"
            title={
              origen === "cliente"
                ? "Heredada del cliente — edítala en su ficha"
                : undefined
            }
          >
            <EtiquetaChip
              nombre={etiqueta.nombre}
              emoji={etiqueta.emoji}
              color={etiqueta.color}
              className={cn(
                origen === "cliente" && "ring-1 ring-offset-0 ring-muted-foreground/30",
              )}
            />
            {origen === "propia" && (
              <button
                type="button"
                onClick={() => quitarDePropias(etiqueta)}
                className="ml-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                title="Quitar"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1 border-dashed"
            >
              <Plus className="h-3 w-3" /> Etiqueta
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-2">
            <div className="relative mb-2">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar etiqueta…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
            <div className="max-h-72 overflow-y-auto pr-1 space-y-3">
              {todasCategorias
                .filter((c) => {
                  if (scope === "cliente") return c.scope === "cliente";
                  return true;
                })
                .map((cat) => {
                  const lista = ofrecidasPorCategoria.get(cat.id) ?? [];
                  if (lista.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                        <span>{cat.nombre}</span>
                        <span className="text-[9px] font-normal opacity-60">
                          ({cat.scope === "reserva" ? "solo esta reserva" : "del cliente"})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {lista.map((e) => {
                          const seleccionada = estaSeleccionada(e);
                          return (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => toggle(e)}
                              className={cn(
                                "transition",
                                seleccionada
                                  ? "ring-2 ring-offset-1 ring-primary"
                                  : "opacity-70 hover:opacity-100",
                              )}
                            >
                              <EtiquetaChip
                                nombre={e.nombre}
                                emoji={e.emoji}
                                color={e.color}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              {ofrecidasPorCategoria.size === 0 && (
                <div className="text-xs text-muted-foreground text-center py-3">
                  Sin resultados.
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
