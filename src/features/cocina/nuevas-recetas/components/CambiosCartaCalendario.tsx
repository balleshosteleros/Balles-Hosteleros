"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus, Pencil, Trash2, MoveRight, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

import {
  listCambiosCarta, crearCambioCarta, moverCambioCarta, moverSemana, deleteCambioCarta,
} from "../actions/cambios-carta-actions";
import {
  COLOR_PALETTE,
  type CambioCartaConSemanas, type CambioCartaSemana, type FaseColor,
} from "../types";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { CalendarRangeToggle, CalendarRangeNav } from "@/shared/components/calendar/CalendarRangeToggle";
import { useCalendarRange, type CalendarRangeMode } from "@/shared/components/calendar/calendar-range";
import { cn } from "@/lib/utils";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_LETRA = ["L", "M", "X", "J", "V", "S", "D"];

function fmtIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseIso(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

function diffDays(aIso: string, bIso: string): number {
  const ms = parseIso(aIso).getTime() - parseIso(bIso).getTime();
  return Math.round(ms / 86_400_000);
}

interface CeldaInfo {
  semana: CambioCartaSemana;
  cambio: CambioCartaConSemanas;
  esInicio: boolean;
  esFin: boolean;
}

function mesesARenderizar(mode: CalendarRangeMode, anchor: Date): { anio: number; mes: number }[] {
  if (mode === "TRIMESTRAL") {
    const q = Math.floor(anchor.getMonth() / 3) * 3;
    return Array.from({ length: 3 }, (_, i) => ({ anio: anchor.getFullYear(), mes: q + i }));
  }
  if (mode === "SEMESTRAL") {
    const s = anchor.getMonth() < 6 ? 0 : 6;
    return Array.from({ length: 6 }, (_, i) => ({ anio: anchor.getFullYear(), mes: s + i }));
  }
  if (mode === "ANUAL") {
    return Array.from({ length: 12 }, (_, i) => ({ anio: anchor.getFullYear(), mes: i }));
  }
  return [{ anio: anchor.getFullYear(), mes: anchor.getMonth() }];
}

export function CambiosCartaCalendario() {
  const rango = useCalendarRange("ANUAL");
  const [cambios, setCambios] = useState<CambioCartaConSemanas[]>([]);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);

  const [showNuevo, setShowNuevo] = useState(false);
  const [fechaNueva, setFechaNueva] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff + 7);
    return fmtIso(d);
  });
  const [notasNuevo, setNotasNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  useGlobalLoadingSync(guardando);

  const [detalle, setDetalle] = useState<CambioCartaConSemanas | null>(null);

  const yearsKey = useMemo(() => {
    const ys = new Set<number>();
    ys.add(rango.range.start.getFullYear());
    ys.add(rango.range.end.getFullYear());
    return [...ys].sort().join("|");
  }, [rango.range.start, rango.range.end]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const years = yearsKey.split("|").map(Number);
      const results = await Promise.all(years.map((y) => listCambiosCarta(y)));
      const all: CambioCartaConSemanas[] = [];
      for (const res of results) {
        if (res.ok) all.push(...res.data);
        else toast.error(res.error);
      }
      const seen = new Set<string>();
      const dedup = all.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      setCambios(dedup);
    } catch {
      toast.error("Error cargando cambios de carta");
    } finally {
      setCargando(false);
    }
  }, [yearsKey]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const semanasPorDia = useMemo(() => {
    const map = new Map<string, CeldaInfo[]>();
    for (const c of cambios) {
      for (const s of c.semanas) {
        const total = diffDays(s.fecha_fin, s.fecha_inicio) + 1;
        for (let i = 0; i < total; i++) {
          const d = parseIso(s.fecha_inicio);
          d.setDate(d.getDate() + i);
          const key = fmtIso(d);
          const list = map.get(key) ?? [];
          list.push({
            semana: s,
            cambio: c,
            esInicio: i === 0,
            esFin: i === total - 1,
          });
          map.set(key, list);
        }
      }
    }
    return map;
  }, [cambios]);

  async function handleCrear() {
    setGuardando(true);
    try {
      const res = await crearCambioCarta({
        fecha_inicio: fechaNueva,
        notas: notasNuevo.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Cambio de carta creado");
      setShowNuevo(false);
      setNotasNuevo("");
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  const meses = mesesARenderizar(rango.mode, rango.anchor);
  const gridCols = rango.mode === "MENSUAL"
    ? "grid-cols-1"
    : rango.mode === "TRIMESTRAL"
      ? "grid-cols-1 md:grid-cols-3"
      : rango.mode === "SEMESTRAL"
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CalendarRangeToggle mode={rango.mode} onChange={rango.setMode} />
        <div className="flex items-center gap-2">
          <CalendarRangeNav
            label={rango.label}
            onPrev={rango.prev}
            onNext={rango.next}
            onToday={rango.goToToday}
            isToday={rango.isToday}
            minWidth={180}
          />
          <Button size="sm" className="h-9" onClick={() => setShowNuevo(true)}>
            <CalendarPlus className="h-4 w-4 mr-1.5" />
            Nuevo cambio
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {cambios.length} cambio{cambios.length !== 1 ? "s" : ""} de carta cargados
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            Día oficial (sesión marketing)
          </span>
        </div>
      </div>

      {cargando ? (
        <LoadingSpinner className="py-12" />
      ) : rango.mode === "DIARIO" ? (
        <VistaDiaria
          anchor={rango.anchor}
          semanasPorDia={semanasPorDia}
          onCeldaClick={(c) => setDetalle(c)}
        />
      ) : rango.mode === "SEMANAL" ? (
        <VistaSemanal
          inicio={rango.range.start}
          semanasPorDia={semanasPorDia}
          onCeldaClick={(c) => setDetalle(c)}
        />
      ) : (
        <div className={cn("grid gap-4", gridCols)}>
          {meses.map(({ anio, mes }) => (
            <MesGrid
              key={`${anio}-${mes}`}
              anio={anio}
              mes={mes}
              nombre={MESES[mes]}
              semanasPorDia={semanasPorDia}
              onCeldaClick={(c) => setDetalle(c)}
            />
          ))}
        </div>
      )}

      <Dialog open={showNuevo} onOpenChange={setShowNuevo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo cambio de carta</DialogTitle>
            <DialogDescription>
              Se crearán 5 semanas consecutivas (una por fase del pipeline).
              La sesión de marketing es el día oficial del cambio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="cc-fecha">Fecha inicio (lunes recomendado)</Label>
              <Input
                id="cc-fecha"
                type="date"
                value={fechaNueva}
                onChange={(e) => setFechaNueva(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Día oficial:{" "}
                <strong>
                  {(() => {
                    const d = parseIso(fechaNueva);
                    if (Number.isNaN(d.getTime())) return "—";
                    d.setDate(d.getDate() + 28);
                    return d.toLocaleDateString("es-ES", {
                      day: "2-digit", month: "long", year: "numeric",
                    });
                  })()}
                </strong>
              </p>
            </div>
            <div>
              <Label htmlFor="cc-notas">Notas (opcional)</Label>
              <Textarea
                id="cc-notas"
                value={notasNuevo}
                onChange={(e) => setNotasNuevo(e.target.value)}
                rows={3}
                placeholder="Ej: cambio de temporada, festivo, evento..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevo(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCrear} disabled={guardando}>
              {guardando ? "Creando..." : "Crear cambio de carta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DetalleCambioDialog
        cambio={detalle}
        onClose={() => setDetalle(null)}
        onChanged={async () => {
          await cargar();
          if (detalle) {
            const years = yearsKey.split("|").map(Number);
            const results = await Promise.all(years.map((y) => listCambiosCarta(y)));
            const merged: CambioCartaConSemanas[] = [];
            for (const r of results) if (r.ok) merged.push(...r.data);
            const updated = merged.find((c) => c.id === detalle.id);
            setDetalle(updated ?? null);
          }
        }}
      />
    </div>
  );
}

function VistaDiaria({
  anchor,
  semanasPorDia,
  onCeldaClick,
}: {
  anchor: Date;
  semanasPorDia: Map<string, CeldaInfo[]>;
  onCeldaClick: (cambio: CambioCartaConSemanas) => void;
}) {
  const iso = fmtIso(anchor);
  const eventos = semanasPorDia.get(iso) ?? [];
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm font-semibold capitalize mb-3">
        {anchor.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
      {eventos.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">Sin cambios de carta este día.</div>
      ) : (
        <div className="space-y-2">
          {eventos.map((e, i) => {
            const color = COLOR_PALETTE[e.semana.color as FaseColor];
            return (
              <button
                key={i}
                type="button"
                onClick={() => onCeldaClick(e.cambio)}
                className="w-full text-left rounded-md border overflow-hidden flex items-stretch hover:bg-muted/40 transition-colors"
              >
                <div className="w-2 shrink-0" style={{ background: `linear-gradient(180deg, ${color.from}, ${color.to})` }} />
                <div className="flex-1 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      {e.cambio.nombre}
                      {e.semana.es_oficial && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Semana {e.semana.orden} — {e.semana.fase_nombre}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VistaSemanal({
  inicio,
  semanasPorDia,
  onCeldaClick,
}: {
  inicio: Date;
  semanasPorDia: Map<string, CeldaInfo[]>;
  onCeldaClick: (cambio: CambioCartaConSemanas) => void;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
  const hoyIso = fmtIso(new Date());

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-7 divide-x">
        {dias.map((d, idx) => {
          const iso = fmtIso(d);
          const eventos = semanasPorDia.get(iso) ?? [];
          const esHoy = iso === hoyIso;
          return (
            <div key={idx} className={cn("flex flex-col min-h-[200px]", esHoy && "bg-primary/[0.04]")}>
              <div className="px-2 py-2 text-center border-b bg-muted/20">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{DIAS_LETRA[idx]}</div>
                <div className={cn("text-sm font-bold mt-0.5", esHoy && "text-primary")}>{d.getDate()}</div>
              </div>
              <div className="flex-1 p-1.5 space-y-1">
                {eventos.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/40 text-center py-3">—</div>
                ) : (
                  eventos.map((e, i) => {
                    const color = COLOR_PALETTE[e.semana.color as FaseColor];
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onCeldaClick(e.cambio)}
                        className="w-full text-left rounded text-[10px] text-white p-1 flex items-center gap-1 hover:opacity-90"
                        style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
                        title={`${e.semana.fase_nombre} — ${e.cambio.nombre}`}
                      >
                        {e.semana.es_oficial && <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300 shrink-0" />}
                        <span className="truncate font-medium">{e.semana.fase_nombre}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MesGrid({
  anio, mes, nombre, semanasPorDia, onCeldaClick,
}: {
  anio: number;
  mes: number;
  nombre: string;
  semanasPorDia: Map<string, CeldaInfo[]>;
  onCeldaClick: (cambio: CambioCartaConSemanas) => void;
}) {
  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0).getDate();
  const offsetIni = (primerDia.getDay() + 6) % 7;
  const cells: Array<Date | null> = [];
  for (let i = 0; i < offsetIni; i++) cells.push(null);
  for (let d = 1; d <= ultimoDia; d++) cells.push(new Date(anio, mes, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const hoyIso = fmtIso(new Date());
  const esMesActual = new Date().getFullYear() === anio && new Date().getMonth() === mes;

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className={`flex items-baseline justify-between mb-2 ${esMesActual ? "text-foreground" : "text-muted-foreground"}`}>
        <h3 className="text-sm font-semibold uppercase tracking-wide">{nombre} <span className="text-xs text-muted-foreground">{anio}</span></h3>
      </div>

      <div className="grid grid-cols-7 gap-px text-[10px] text-muted-foreground mb-1">
        {DIAS_LETRA.map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square" />;
          const iso = fmtIso(d);
          const info = semanasPorDia.get(iso);
          const esHoy = iso === hoyIso;
          const semana = info?.[0];
          const color = semana ? COLOR_PALETTE[semana.semana.color as FaseColor] : null;

          return (
            <button
              key={i}
              type="button"
              onClick={() => semana && onCeldaClick(semana.cambio)}
              disabled={!semana}
              title={semana
                ? `${semana.semana.fase_nombre} — ${semana.cambio.nombre}`
                : undefined}
              className={`
                aspect-square rounded-[3px] text-[10px] flex items-center justify-center
                transition-colors relative
                ${semana ? "cursor-pointer hover:ring-2 hover:ring-foreground/40" : ""}
                ${esHoy ? "ring-1 ring-foreground/60 font-bold" : ""}
                ${!semana ? "text-muted-foreground" : "text-white font-medium"}
              `}
              style={{
                background: color
                  ? `linear-gradient(135deg, ${color.from}, ${color.to})`
                  : undefined,
              }}
            >
              {d.getDate()}
              {semana?.semana.es_oficial && semana.esInicio && (
                <Star
                  className="absolute -top-1 -right-1 h-2.5 w-2.5 fill-amber-400 text-amber-500 drop-shadow"
                  strokeWidth={3}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetalleCambioDialog({
  cambio, onClose, onChanged,
}: {
  cambio: CambioCartaConSemanas | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [movDelta, setMovDelta] = useState<string>("");
  const [eliminando, setEliminando] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } =
    useConfirmDelete();

  if (!cambio) return null;

  async function handleMoverBloque() {
    if (!cambio || !movDelta) return;
    const res = await moverCambioCarta({
      cambio_carta_id: cambio.id,
      fecha_inicio: movDelta,
    });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Bloque movido");
    setMovDelta("");
    await onChanged();
  }

  async function handleMoverSemana(semanaId: string, fechaIni: string) {
    const res = await moverSemana({ semana_id: semanaId, fecha_inicio: fechaIni });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Semana movida");
    await onChanged();
  }

  async function handleEliminar() {
    if (!cambio) return;
    const ok = await confirmDelete({
      title: "¿Eliminar cambio de carta?",
      description: `Se eliminará "${cambio.nombre}" y sus semanas.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    setEliminando(true);
    const res = await deleteCambioCarta(cambio.id);
    setEliminando(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Eliminado");
    onClose();
    await onChanged();
  }

  const oficial = cambio.semanas.find((s) => s.es_oficial);

  return (
    <Dialog open={!!cambio} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{cambio.nombre}</DialogTitle>
          <DialogDescription>
            {cambio.semanas.length} fases · día oficial:{" "}
            <strong>
              {oficial
                ? parseIso(oficial.fecha_inicio).toLocaleDateString("es-ES", {
                    weekday: "long", day: "2-digit", month: "long", year: "numeric",
                  })
                : "—"}
            </strong>
            {cambio.notas && (
              <>
                <br />
                <span className="italic">{cambio.notas}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border p-3 flex items-center gap-2 bg-muted/30">
          <MoveRight className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="mov-bloque" className="text-xs font-medium whitespace-nowrap">
            Mover todo el bloque a:
          </Label>
          <Input
            id="mov-bloque"
            type="date"
            value={movDelta}
            onChange={(e) => setMovDelta(e.target.value)}
            className="h-8"
          />
          <Button size="sm" className="h-8" onClick={handleMoverBloque} disabled={!movDelta}>
            Mover
          </Button>
        </div>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {cambio.semanas.map((s) => {
            const color = COLOR_PALETTE[s.color as FaseColor];
            return (
              <div
                key={s.id}
                className="rounded-md border overflow-hidden flex items-stretch"
              >
                <div
                  className="w-2 shrink-0"
                  style={{ background: `linear-gradient(180deg, ${color.from}, ${color.to})` }}
                />
                <div className="flex-1 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm">
                        Semana {s.orden} — {s.fase_nombre}
                      </span>
                      {s.es_oficial && (
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {parseIso(s.fecha_inicio).toLocaleDateString("es-ES", {
                        day: "2-digit", month: "short",
                      })}
                      {" → "}
                      {parseIso(s.fecha_fin).toLocaleDateString("es-ES", {
                        day: "2-digit", month: "short",
                      })}
                    </div>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 gap-1">
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="text-xs">Mover</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="end">
                      <Label htmlFor={`sem-${s.id}`} className="text-xs">
                        Nueva fecha de inicio
                      </Label>
                      <Input
                        id={`sem-${s.id}`}
                        type="date"
                        defaultValue={s.fecha_inicio}
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== s.fecha_inicio) {
                            handleMoverSemana(s.id, e.target.value);
                          }
                        }}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        El resto de semanas no se moverá.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleEliminar}
            disabled={eliminando}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Eliminar
          </Button>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
      {confirmDeleteDialog}
    </Dialog>
  );
}
