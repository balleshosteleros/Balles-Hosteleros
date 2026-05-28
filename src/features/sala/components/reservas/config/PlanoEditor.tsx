"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  Mesa,
  Plano,
  PlanoMesaPosicion,
  Sala,
  Zona,
} from "@/features/sala/planos/data/planos";
import {
  listPlanoMesas,
  listPlanoSalas,
  removePlanoMesa,
  togglePlanoSala,
  upsertPlanoMesa,
} from "@/features/sala/planos/actions/planos-actions";

const MESA_SIZE = 60;
const CANVAS_W = 2000;
const CANVAS_H = 1200;

interface Props {
  plano: Plano;
  salas: Sala[];
  zonas: Zona[];
  mesas: Mesa[];
  onBack: () => void;
}

interface DragState {
  mesaId: string;
  offsetX: number;
  offsetY: number;
  esNueva: boolean;
}

export function PlanoEditor({ plano, salas, zonas, mesas, onBack }: Props) {
  const [salasActivas, setSalasActivas] = useState<Set<string>>(new Set());
  const [posiciones, setPosiciones] = useState<Map<string, PlanoMesaPosicion>>(new Map());
  const [loading, setLoading] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [ps, pm] = await Promise.all([listPlanoSalas(plano.id), listPlanoMesas(plano.id)]);
    if (ps.ok) setSalasActivas(new Set(ps.data));
    if (pm.ok) {
      const map = new Map<string, PlanoMesaPosicion>();
      for (const p of pm.data) map.set(p.mesaId, p);
      setPosiciones(map);
    }
    setLoading(false);
  }, [plano.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const zonasPorSala = useMemo(() => {
    const map = new Map<string, Zona[]>();
    for (const z of zonas) {
      const arr = map.get(z.salaId) ?? [];
      arr.push(z);
      map.set(z.salaId, arr);
    }
    return map;
  }, [zonas]);

  const mesasPorZona = useMemo(() => {
    const map = new Map<string, Mesa[]>();
    for (const m of mesas) {
      const arr = map.get(m.zonaId) ?? [];
      arr.push(m);
      map.set(m.zonaId, arr);
    }
    return map;
  }, [mesas]);

  const zonaPorId = useMemo(() => new Map(zonas.map((z) => [z.id, z])), [zonas]);
  const mesaPorId = useMemo(() => new Map(mesas.map((m) => [m.id, m])), [mesas]);

  function mesaEstaColocada(mesaId: string): boolean {
    return posiciones.has(mesaId);
  }

  async function handleToggleSala(salaId: string, activar: boolean) {
    const prev = new Set(salasActivas);
    setSalasActivas((s) => {
      const next = new Set(s);
      if (activar) next.add(salaId);
      else next.delete(salaId);
      return next;
    });
    const res = await togglePlanoSala(plano.id, salaId, activar);
    if (!res.ok) {
      setSalasActivas(prev);
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    // Si se desactiva, recargar posiciones (cascade)
    if (!activar) cargar();
  }

  function startDragNueva(e: React.PointerEvent, mesaId: string) {
    e.preventDefault();
    setDrag({ mesaId, offsetX: MESA_SIZE / 2, offsetY: MESA_SIZE / 2, esNueva: true });
  }

  function startDragExistente(e: React.PointerEvent, mesaId: string) {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = posiciones.get(mesaId);
    if (!pos) return;
    const mouseX = e.clientX - rect.left + (canvasRef.current?.scrollLeft ?? 0);
    const mouseY = e.clientY - rect.top + (canvasRef.current?.scrollTop ?? 0);
    setDrag({
      mesaId,
      offsetX: mouseX - pos.x,
      offsetY: mouseY - pos.y,
      esNueva: false,
    });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left + (canvasRef.current?.scrollLeft ?? 0) - drag.offsetX;
    const y = e.clientY - rect.top + (canvasRef.current?.scrollTop ?? 0) - drag.offsetY;
    setPosiciones((prev) => {
      const next = new Map(prev);
      const actual = prev.get(drag.mesaId);
      next.set(drag.mesaId, {
        planoId: plano.id,
        mesaId: drag.mesaId,
        x: Math.max(0, Math.min(CANVAS_W - MESA_SIZE, x)),
        y: Math.max(0, Math.min(CANVAS_H - MESA_SIZE, y)),
        rotation: actual?.rotation ?? 0,
      });
      return next;
    });
  }

  async function handlePointerUp() {
    if (!drag) return;
    const pos = posiciones.get(drag.mesaId);
    setDrag(null);
    if (!pos) return;
    const res = await upsertPlanoMesa({
      planoId: plano.id,
      mesaId: drag.mesaId,
      x: pos.x,
      y: pos.y,
      rotation: pos.rotation,
    });
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      // recargar para revertir
      cargar();
    }
  }

  async function handleQuitarMesa(mesaId: string) {
    setPosiciones((prev) => {
      const next = new Map(prev);
      next.delete(mesaId);
      return next;
    });
    setMesaSeleccionada(null);
    const res = await removePlanoMesa(plano.id, mesaId);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo quitar");
      cargar();
    }
  }

  async function handleRotar(mesaId: string, delta: number) {
    const pos = posiciones.get(mesaId);
    if (!pos) return;
    const nuevaRotacion = (pos.rotation + delta + 360) % 360;
    setPosiciones((prev) => {
      const next = new Map(prev);
      next.set(mesaId, { ...pos, rotation: nuevaRotacion });
      return next;
    });
    const res = await upsertPlanoMesa({
      planoId: plano.id,
      mesaId,
      x: pos.x,
      y: pos.y,
      rotation: nuevaRotacion,
    });
    if (!res.ok) toast.error(res.error ?? "No se pudo guardar");
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Volver
        </Button>
        <div className="text-sm">
          <span className="font-semibold">{plano.nombre}</span>
          {plano.esPrincipal && (
            <span className="ml-2 text-[10px] uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded">
              Principal
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-[260px_1fr] gap-3" style={{ height: "60vh" }}>
        {/* Panel lateral */}
        <aside className="border rounded-md overflow-y-auto p-3 space-y-3 bg-card">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Salas activas en el plano
            </p>
            <div className="space-y-1.5">
              {salas.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Crea salas en Estructura.</p>
              ) : (
                salas.map((s) => (
                  <label key={s.id} className="flex items-center justify-between text-xs">
                    <span>{s.nombre}</span>
                    <Switch
                      checked={salasActivas.has(s.id)}
                      onCheckedChange={(v) => handleToggleSala(s.id, v)}
                    />
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Mesas disponibles (arrastra al lienzo)
            </p>
            {salasActivas.size === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Activa al menos una sala arriba.
              </p>
            ) : (
              <div className="space-y-2">
                {salas
                  .filter((s) => salasActivas.has(s.id))
                  .map((sala) => {
                    const zs = zonasPorSala.get(sala.id) ?? [];
                    return (
                      <div key={sala.id} className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                          {sala.nombre}
                        </p>
                        {zs.map((zona) => {
                          const ms = (mesasPorZona.get(zona.id) ?? []).filter(
                            (m) => !mesaEstaColocada(m.id),
                          );
                          if (ms.length === 0) return null;
                          return (
                            <div key={zona.id} className="space-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded"
                                  style={{ backgroundColor: zona.colorPastel }}
                                />
                                {zona.nombre}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {ms.map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onPointerDown={(e) => startDragNueva(e, m.id)}
                                    className="text-[11px] font-semibold border rounded px-2 py-1 cursor-grab active:cursor-grabbing hover:border-foreground"
                                    style={{ backgroundColor: `${zona.colorPastel}66` }}
                                  >
                                    {m.codigo}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {mesaSeleccionada && (
            <div className="pt-2 border-t space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Mesa seleccionada: {mesaPorId.get(mesaSeleccionada)?.codigo}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => handleRotar(mesaSeleccionada, -15)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRotar(mesaSeleccionada, 15)}>
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  onClick={() => handleQuitarMesa(mesaSeleccionada)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Quitar
                </Button>
              </div>
            </div>
          )}
        </aside>

        {/* Lienzo */}
        <div
          ref={canvasRef}
          className="border rounded-md overflow-auto bg-muted/20 relative"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={() => setMesaSeleccionada(null)}
        >
          <div
            className="relative"
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              backgroundImage:
                "linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          >
            {Array.from(posiciones.values()).map((pos) => {
              const mesa = mesaPorId.get(pos.mesaId);
              if (!mesa) return null;
              const zona = zonaPorId.get(mesa.zonaId);
              const seleccionada = mesaSeleccionada === pos.mesaId;
              return (
                <div
                  key={pos.mesaId}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setMesaSeleccionada(pos.mesaId);
                    startDragExistente(e, pos.mesaId);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "absolute flex flex-col items-center justify-center text-xs font-semibold border-2 rounded-md cursor-grab active:cursor-grabbing select-none",
                    seleccionada ? "border-primary shadow-lg" : "border-foreground/40",
                  )}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: MESA_SIZE,
                    height: MESA_SIZE,
                    backgroundColor: zona?.colorPastel ?? "#FDE68A",
                    transform: `rotate(${pos.rotation}deg)`,
                  }}
                >
                  <span>{mesa.codigo}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {mesa.capacidadMin}-{mesa.capacidadMax}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Arrastra mesas desde el panel al lienzo. Click para seleccionar y rotar/quitar. Las posiciones se guardan automáticamente.
      </p>
    </div>
  );
}
