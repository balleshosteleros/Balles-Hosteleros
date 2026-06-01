"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  Mesa,
  MesaPosicion,
  Sala,
  Zona,
} from "@/features/sala/planos/data/planos";
import {
  listMesaPosicionesSala,
  removeMesaPosicion,
  upsertMesaPosicion,
} from "@/features/sala/planos/actions/mesa-posiciones-actions";

const MESA_SIZE = 60;
// Tamaño estándar del lienzo de una sala. Ajustado para que entre en la pantalla
// sin scroll vertical. Si hace falta más espacio, el usuario debe crear otra sala.
const CANVAS_W = 1200;
const CANVAS_H = 640;

interface Props {
  sala: Sala;
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

/**
 * Editor visual del plano de UNA sala.
 * Las posiciones viven en `mesas.x/y/rotation` — son propiedad de la sala
 * a través de sus zonas/mesas; cualquier plano que use esta sala las reutiliza.
 */
export function SalaPlanoEditor({ sala, zonas, mesas, onBack }: Props) {
  const [posiciones, setPosiciones] = useState<Map<string, MesaPosicion>>(new Map());
  const [loading, setLoading] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const outerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const s = Math.min(w / CANVAS_W, h / CANVAS_H, 1);
      setScale(s > 0 ? s : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zonasSala = useMemo(
    () => zonas.filter((z) => z.salaId === sala.id),
    [zonas, sala.id],
  );
  const mesasSala = useMemo(() => {
    const zonaIds = new Set(zonasSala.map((z) => z.id));
    return mesas.filter((m) => zonaIds.has(m.zonaId));
  }, [mesas, zonasSala]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await listMesaPosicionesSala(sala.id);
    if (r.ok) {
      const map = new Map<string, MesaPosicion>();
      for (const p of r.data) map.set(p.mesaId, p);
      setPosiciones(map);
    }
    setLoading(false);
  }, [sala.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const mesasPorZona = useMemo(() => {
    const map = new Map<string, Mesa[]>();
    for (const m of mesasSala) {
      const arr = map.get(m.zonaId) ?? [];
      arr.push(m);
      map.set(m.zonaId, arr);
    }
    return map;
  }, [mesasSala]);

  const zonaPorId = useMemo(() => new Map(zonasSala.map((z) => [z.id, z])), [zonasSala]);
  const mesaPorId = useMemo(() => new Map(mesasSala.map((m) => [m.id, m])), [mesasSala]);

  function mesaEstaColocada(mesaId: string): boolean {
    return posiciones.has(mesaId);
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
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;
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
    const x = (e.clientX - rect.left) / scale - drag.offsetX;
    const y = (e.clientY - rect.top) / scale - drag.offsetY;
    setPosiciones((prev) => {
      const next = new Map(prev);
      const actual = prev.get(drag.mesaId);
      next.set(drag.mesaId, {
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
    const res = await upsertMesaPosicion({
      mesaId: drag.mesaId,
      x: pos.x,
      y: pos.y,
      rotation: pos.rotation,
    });
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
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
    const res = await removeMesaPosicion(mesaId);
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
    const res = await upsertMesaPosicion({
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
          Volver a salas
        </Button>
        <div className="text-sm">
          <span className="text-muted-foreground">Plano de</span>{" "}
          <span className="font-semibold">{sala.nombre}</span>
          {sala.esPrincipal && (
            <span className="ml-2 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded">
              Principal
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-[260px_1fr] gap-3" style={{ height: CANVAS_H }}>
        {/* Panel lateral: mesas disponibles de esta sala */}
        <aside className="border rounded-md overflow-y-auto p-3 space-y-3 bg-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Mesas disponibles (arrastra al lienzo)
          </p>
          {zonasSala.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Esta sala aún no tiene zonas.
            </p>
          ) : (
            <div className="space-y-2">
              {zonasSala.map((zona) => {
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
              {mesasSala.every((m) => mesaEstaColocada(m.id)) && (
                <p className="text-[11px] text-muted-foreground italic">
                  Todas las mesas de esta sala ya están en el lienzo.
                </p>
              )}
            </div>
          )}

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

        {/* Lienzo — autoescala para caber completo y centrado, sin scroll. */}
        <div
          ref={outerRef}
          className="border rounded-md overflow-hidden bg-muted/20 relative flex items-center justify-center"
          style={{ height: CANVAS_H }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={() => setMesaSeleccionada(null)}
        >
          <div
            style={{
              width: CANVAS_W * scale,
              height: CANVAS_H * scale,
              position: "relative",
            }}
          >
          <div
            ref={canvasRef}
            className="relative"
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              position: "absolute",
              top: 0,
              left: 0,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
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
                    left: Math.max(0, Math.min(CANVAS_W - MESA_SIZE, pos.x)),
                    top: Math.max(0, Math.min(CANVAS_H - MESA_SIZE, pos.y)),
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
      </div>

      <p className="text-[11px] text-muted-foreground">
        Arrastra mesas desde el panel al lienzo. Click para seleccionar y rotar o quitar. El lienzo tiene un tamaño estándar — si necesitas más espacio, crea otra sala. Las posiciones se guardan automáticamente.
      </p>
    </div>
  );
}
