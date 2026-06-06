"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DecoBody } from "@/features/sala/planos/components/DecoBody";
import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import { listSalas } from "@/features/sala/planos/actions/salas-actions";
import { listZonas } from "@/features/sala/planos/actions/zonas-actions";
import { listMesas } from "@/features/sala/planos/actions/mesas-actions";
import { listMesaPosicionesSala } from "@/features/sala/planos/actions/mesa-posiciones-actions";
import { listSalaDecoraciones } from "@/features/sala/planos/actions/sala-decoraciones-actions";
import type {
  FormaMesa,
  LocalMin,
  Mesa,
  MesaPosicion,
  Sala,
  SalaDecoracion,
  Zona,
} from "@/features/sala/planos/data/planos";
import {
  type TurnoRegla,
  type VigenciaSpec,
  DIA_ISO_DOW_LABELS,
} from "@/features/sala/reglas/data/reglas";
import { TurnoToggle } from "@/features/sala/reglas/components/TurnoToggle";
import { VigenciaSelector } from "@/features/sala/reglas/components/VigenciaSelector";
import {
  createBloqueo,
  deleteBloqueo,
  listBloqueos,
} from "@/features/sala/bloqueos/actions/bloqueos-actions";
import type { ReservaBloqueo } from "@/features/sala/bloqueos/data/bloqueos";

const CANVAS_W = 1200;
const CANVAS_H = 640;
const ZONA_LABEL_H = 22;
const MESA_SIZE = 60;
const MESA_RECT_W = 84;
const MESA_RECT_H = 48;

function getMesaDimsDefault(forma: FormaMesa) {
  if (forma === "rectangular") return { w: MESA_RECT_W, h: MESA_RECT_H };
  return { w: MESA_SIZE, h: MESA_SIZE };
}

function getMesaDims(forma: FormaMesa, pos?: MesaPosicion | null) {
  const def = getMesaDimsDefault(forma);
  return {
    w: pos?.width != null ? Number(pos.width) : def.w,
    h: pos?.height != null ? Number(pos.height) : def.h,
  };
}

function zonaLabelWidth(nombre: string): number {
  return Math.max(48, nombre.length * 7 + 16);
}

function formateaFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function describeVigencia(b: ReservaBloqueo): string {
  switch (b.modoVigencia) {
    case "siempre":
      return "Siempre";
    case "hoy":
    case "fechas":
      return `Días: ${(b.fechasExtra ?? []).map(formateaFecha).join(", ")}`;
    case "todos_los_dias":
      return "Todos los días";
    case "todos_los_dia": {
      const d = (b.diasSemana ?? [])[0] as 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined;
      return d ? `Todos los ${DIA_ISO_DOW_LABELS[d].toLowerCase()}` : "Día de la semana";
    }
    case "rango":
      return `Del ${formateaFecha(b.fechaDesde ?? "")} al ${formateaFecha(b.fechaHasta ?? "")}`;
    default:
      return "—";
  }
}

function turnoLabel(t: TurnoRegla): string {
  return t === "COMIDA" ? "Comida" : t === "CENA" ? "Cena" : "Comida y cena";
}

export function BloqueosTab() {
  const [locales, setLocales] = useState<LocalMin[]>([]);
  const [localId, setLocalId] = useState<string>("");
  const [salas, setSalas] = useState<Sala[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [posiciones, setPosiciones] = useState<Map<string, MesaPosicion>>(new Map());
  const [decoraciones, setDecoraciones] = useState<SalaDecoracion[]>([]);
  const [salaId, setSalaId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [seleccionMesas, setSeleccionMesas] = useState<Set<string>>(new Set());
  const [seleccionZonas, setSeleccionZonas] = useState<Set<string>>(new Set());
  const [turno, setTurno] = useState<TurnoRegla>("AMBOS");
  const [vigencia, setVigencia] = useState<VigenciaSpec>({ modo: "hoy" });
  const [motivo, setMotivo] = useState("");
  const [aplicando, setAplicando] = useState(false);

  const [bloqueos, setBloqueos] = useState<ReservaBloqueo[]>([]);
  const [cargandoBloqueos, setCargandoBloqueos] = useState(true);

  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Cargar locales
  useEffect(() => {
    (async () => {
      const r = await listLocalesEmpresa();
      if (r.ok && r.data.length > 0) {
        setLocales(r.data);
        setLocalId(r.data[0].id);
      } else {
        setLoading(false);
      }
    })();
  }, []);

  // Cargar salas/zonas/mesas del local
  const cargarLocal = useCallback(async (lid: string) => {
    if (!lid) return;
    setLoading(true);
    const [salasRes, zonasRes, mesasRes] = await Promise.all([
      listSalas(lid),
      listZonas(lid),
      listMesas(lid),
    ]);
    const salasData = salasRes.ok ? salasRes.data : [];
    setSalas(salasData);
    setZonas(zonasRes.ok ? zonasRes.data : []);
    setMesas(mesasRes.ok ? mesasRes.data : []);
    const primera = salasData.find((s) => s.esPrincipal) ?? salasData[0];
    setSalaId(primera?.id ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    if (localId) cargarLocal(localId);
  }, [localId, cargarLocal]);

  // Cargar posiciones + decos de la sala seleccionada
  useEffect(() => {
    if (!salaId) {
      setPosiciones(new Map());
      setDecoraciones([]);
      return;
    }
    (async () => {
      const [posRes, decoRes] = await Promise.all([
        listMesaPosicionesSala(salaId),
        listSalaDecoraciones(salaId),
      ]);
      const m = new Map<string, MesaPosicion>();
      if (posRes.ok) for (const p of posRes.data) m.set(p.mesaId, p);
      setPosiciones(m);
      setDecoraciones(decoRes.ok ? decoRes.data : []);
    })();
  }, [salaId]);

  // Cargar lista de bloqueos del local
  const cargarBloqueos = useCallback(async () => {
    if (!localId) return;
    setCargandoBloqueos(true);
    const r = await listBloqueos(localId);
    setBloqueos(r.ok ? r.data : []);
    setCargandoBloqueos(false);
  }, [localId]);

  useEffect(() => {
    cargarBloqueos();
  }, [cargarBloqueos]);

  // Escalado del canvas al ancho disponible
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
  }, [loading]);

  const zonasSala = useMemo(
    () => zonas.filter((z) => z.salaId === salaId),
    [zonas, salaId],
  );
  const zonaPorId = useMemo(() => new Map(zonas.map((z) => [z.id, z])), [zonas]);
  const mesaPorId = useMemo(() => new Map(mesas.map((m) => [m.id, m])), [mesas]);
  const mesasSalaPosicionadas = useMemo(() => {
    const zonaIds = new Set(zonasSala.map((z) => z.id));
    return mesas.filter((m) => zonaIds.has(m.zonaId) && posiciones.has(m.id));
  }, [mesas, zonasSala, posiciones]);

  /**
   * IDs de mesa que tienen al menos un bloqueo activo (cualquier vigencia,
   * cualquier turno) en este local. Las zonas se expanden a sus mesas. Solo
   * cuenta para la visualización del plano — la validación real ya la hace el
   * motor con `getMesasBloqueadas` y la fecha/turno reales.
   */
  const mesasConBloqueoIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of bloqueos) {
      for (const mid of b.mesaIds) ids.add(mid);
      if (b.zonaIds.length > 0) {
        const setZ = new Set(b.zonaIds);
        for (const m of mesas) {
          if (setZ.has(m.zonaId)) ids.add(m.id);
        }
      }
    }
    return ids;
  }, [bloqueos, mesas]);

  function toggleMesa(mesaId: string) {
    setSeleccionMesas((prev) => {
      const next = new Set(prev);
      if (next.has(mesaId)) next.delete(mesaId);
      else next.add(mesaId);
      return next;
    });
  }

  function toggleZona(zonaId: string) {
    setSeleccionZonas((prev) => {
      const next = new Set(prev);
      if (next.has(zonaId)) next.delete(zonaId);
      else next.add(zonaId);
      return next;
    });
  }

  function limpiarSeleccion() {
    setSeleccionMesas(new Set());
    setSeleccionZonas(new Set());
  }

  async function aplicar() {
    if (!localId) return;
    if (seleccionMesas.size === 0 && seleccionZonas.size === 0) {
      toast.error("Selecciona al menos una zona o una mesa");
      return;
    }
    if (vigencia.modo === "rango" && (!vigencia.fechaDesde || !vigencia.fechaHasta)) {
      toast.error("Indica fecha desde y hasta");
      return;
    }
    if (vigencia.modo === "fechas" && (vigencia.fechas ?? []).length === 0) {
      toast.error("Añade al menos una fecha");
      return;
    }
    setAplicando(true);
    try {
      const res = await createBloqueo({
        localId,
        vigencia,
        turno,
        zonaIds: Array.from(seleccionZonas),
        mesaIds: Array.from(seleccionMesas),
        motivo,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar");
        return;
      }
      toast.success("Bloqueo aplicado");
      limpiarSeleccion();
      setMotivo("");
      cargarBloqueos();
    } finally {
      setAplicando(false);
    }
  }

  async function borrar(id: string) {
    const r = await deleteBloqueo(id);
    if (!r.ok) {
      toast.error(r.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Bloqueo eliminado");
    cargarBloqueos();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-3 space-y-1">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Bloqueos de mesas y zonas</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Marca mesas concretas o zonas enteras como no reservables en una fecha
          o periodicidad. Prevalece sobre el plano vigente: si una mesa cae en
          un bloqueo activo, no se podrá reservar ni por web ni desde el panel
          en esa franja.
        </p>
      </div>

      {/* Contexto local + sala (siempre visible) */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Local</Label>
          {locales.length > 1 ? (
            <Select value={localId} onValueChange={setLocalId}>
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((l) => (
                  <SelectItem key={l.id} value={l.id} className="text-xs">
                    {l.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-8 px-3 inline-flex items-center rounded-md border bg-muted/30 text-xs font-medium">
              {locales[0]?.nombre ?? "Sin local"}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sala</Label>
          {salas.length > 1 ? (
            <Select value={salaId} onValueChange={setSalaId}>
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {salas.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-8 px-3 inline-flex items-center rounded-md border bg-muted/30 text-xs font-medium">
              {salas[0]?.nombre ?? "Sin salas"}
            </div>
          )}
        </div>
      </div>

      {/* Toggles de zona */}
      {zonasSala.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Bloquear zona completa</Label>
          <div className="flex flex-wrap gap-1.5">
            {zonasSala.map((z) => {
              const activa = seleccionZonas.has(z.id);
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => toggleZona(z.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 h-8 rounded border text-xs font-medium transition-colors",
                    activa
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-input hover:border-foreground",
                  )}
                  style={!activa ? { backgroundColor: `${z.colorPastel}33` } : undefined}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded"
                    style={{ backgroundColor: z.colorPastel }}
                  />
                  {z.nombre}
                  {activa && <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Canvas del plano */}
      <div
        ref={outerRef}
        className="border rounded-md overflow-hidden bg-muted/20 relative flex items-center justify-center"
        style={{ height: CANVAS_H }}
      >
        {salas.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-4 text-center">
            Este local no tiene salas todavía. Crea una desde Estructura → Salas.
          </p>
        ) : mesasSalaPosicionadas.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-4 text-center">
            La sala &quot;{salas.find((s) => s.id === salaId)?.nombre ?? ""}&quot;
            no tiene mesas colocadas en el plano todavía. Edita el plano desde
            Estructura → Salas para colocar mesas.
          </p>
        ) : (
          <div
            style={{
              width: CANVAS_W * scale,
              height: CANVAS_H * scale,
              position: "relative",
            }}
          >
            <div
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
              {/* Decoraciones */}
              {decoraciones.map((d) => (
                <div
                  key={d.id}
                  className="absolute pointer-events-none select-none"
                  style={{
                    left: Math.max(0, Math.min(CANVAS_W - d.width, d.x)),
                    top: Math.max(0, Math.min(CANVAS_H - d.height, d.y)),
                    width: d.width,
                    height: d.height,
                    transform: `rotate(${d.rotation}deg)`,
                    transformOrigin: "center",
                    opacity: 0.7,
                  }}
                >
                  <DecoBody
                    tipo={d.tipo}
                    width={d.width}
                    height={d.height}
                    counterRotation={d.rotation}
                  />
                </div>
              ))}

              {/* Etiquetas de zona */}
              {zonasSala.map((z) => {
                if (z.etiquetaX == null || z.etiquetaY == null) return null;
                const w = zonaLabelWidth(z.nombre);
                return (
                  <div
                    key={`zlabel-${z.id}`}
                    className="absolute flex items-center justify-center text-[11px] font-bold tracking-wide text-zinc-800 rounded shadow-sm border border-foreground/15 pointer-events-none select-none"
                    style={{
                      left: Math.max(0, Math.min(CANVAS_W - w, z.etiquetaX)),
                      top: Math.max(0, Math.min(CANVAS_H - ZONA_LABEL_H, z.etiquetaY)),
                      width: w,
                      height: ZONA_LABEL_H,
                      backgroundColor: z.colorPastel,
                    }}
                  >
                    {z.nombre}
                  </div>
                );
              })}

              {/* Mesas (clickeables) */}
              {mesasSalaPosicionadas.map((m) => {
                const pos = posiciones.get(m.id)!;
                const zona = zonaPorId.get(m.zonaId);
                const seleccionada = seleccionMesas.has(m.id);
                const dims = getMesaDims(m.forma, pos);
                const radius = m.forma === "redonda" ? 9999 : 6;
                const zonaIncluida = zona && seleccionZonas.has(zona.id);
                const bloqueada = mesasConBloqueoIds.has(m.id);
                let bg = zona?.colorPastel ?? "#FDE68A";
                let textCol = "text-foreground";
                let borderCls = "border-foreground/40 hover:border-foreground";
                if (bloqueada) {
                  bg = "#1f2937"; // gris-900: el "negro" del plano
                  textCol = "text-white";
                  borderCls = "border-black";
                }
                if (zonaIncluida) {
                  bg = "#fee2e2";
                  textCol = "text-foreground";
                  borderCls = "border-destructive/60 ring-1 ring-destructive/30";
                }
                if (seleccionada) {
                  bg = "#fecaca";
                  textCol = "text-foreground";
                  borderCls = "border-destructive shadow-lg ring-2 ring-destructive/40";
                }
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMesa(m.id)}
                    className={cn(
                      "absolute flex flex-col items-center justify-center text-xs font-semibold border-2 select-none transition-shadow",
                      borderCls,
                      textCol,
                    )}
                    style={{
                      left: Math.max(0, Math.min(CANVAS_W - dims.w, pos.x)),
                      top: Math.max(0, Math.min(CANVAS_H - dims.h, pos.y)),
                      width: dims.w,
                      height: dims.h,
                      borderRadius: radius,
                      backgroundColor: bg,
                      transform: `rotate(${pos.rotation}deg)`,
                    }}
                    title={
                      bloqueada
                        ? `${m.codigo} · ${m.capacidadMin}-${m.capacidadMax} pax · Bloqueada`
                        : `${m.codigo} · ${m.capacidadMin}-${m.capacidadMax} pax`
                    }
                  >
                    <div
                      className="flex flex-col items-center justify-center pointer-events-none"
                      style={{ transform: `rotate(${-pos.rotation}deg)` }}
                    >
                      <span className="flex items-center gap-1">
                        {bloqueada && !seleccionada && !zonaIncluida && (
                          <Lock className="h-3 w-3" />
                        )}
                        {m.codigo}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-normal",
                          bloqueada && !seleccionada && !zonaIncluida
                            ? "text-white/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {m.capacidadMin}-{m.capacidadMax}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-foreground/40" style={{ backgroundColor: "#FDE68A" }} />
          Disponible
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-black" style={{ backgroundColor: "#1f2937" }} />
          Bloqueada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-destructive" style={{ backgroundColor: "#fecaca" }} />
          Seleccionada para nuevo bloqueo
        </span>
      </div>

      {/* Resumen de selección */}
      {(seleccionMesas.size > 0 || seleccionZonas.size > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-destructive/5 px-3 py-2 text-xs">
          <span className="font-medium">Seleccionado:</span>
          {Array.from(seleccionZonas).map((zid) => {
            const z = zonaPorId.get(zid);
            if (!z) return null;
            return (
              <span
                key={`sz-${zid}`}
                className="inline-flex items-center gap-1 rounded bg-destructive/10 text-destructive px-2 h-6"
              >
                Zona {z.nombre}
              </span>
            );
          })}
          {Array.from(seleccionMesas).map((mid) => {
            const m = mesaPorId.get(mid);
            if (!m) return null;
            return (
              <span
                key={`sm-${mid}`}
                className="inline-flex items-center gap-1 rounded bg-destructive/10 text-destructive px-2 h-6"
              >
                Mesa {m.codigo}
              </span>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 ml-auto text-xs"
            onClick={limpiarSeleccion}
          >
            Limpiar
          </Button>
        </div>
      )}

      <Separator />

      {/* Periodicidad + turno + motivo */}
      <div className="rounded-md border bg-card p-4 space-y-4">
        <TurnoToggle value={turno} onChange={setTurno} label="Aplicar a" />
        <VigenciaSelector value={vigencia} onChange={setVigencia} hideSiempre />
        <div className="space-y-1.5 max-w-md">
          <Label className="text-xs">Motivo (opcional)</Label>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: Evento privado, obra, terraza cerrada por lluvia…"
            className="h-8 text-xs"
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={aplicar} disabled={aplicando}>
            {aplicando ? "Aplicando…" : "Aplicar bloqueo"}
          </Button>
        </div>
      </div>

      {/* Lista de bloqueos activos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-semibold">Bloqueos activos</h5>
          <span className="text-[10px] text-muted-foreground">
            Prevalecen sobre el plano vigente.
          </span>
        </div>
        {cargandoBloqueos ? (
          <p className="text-xs text-muted-foreground">Cargando…</p>
        ) : bloqueos.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Sin bloqueos. Los que añadas aparecerán aquí.
          </p>
        ) : (
          <ul className="divide-y rounded border">
            {bloqueos.map((b) => {
              const zonasNombres = b.zonaIds
                .map((zid) => zonaPorId.get(zid)?.nombre)
                .filter(Boolean) as string[];
              const mesasCodigos = b.mesaIds
                .map((mid) => mesaPorId.get(mid)?.codigo)
                .filter(Boolean) as string[];
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-2 px-3 py-2 text-xs"
                >
                  <span className="font-medium w-28 shrink-0">
                    {turnoLabel(b.turno)}
                  </span>
                  <span className="flex-1 truncate">
                    {describeVigencia(b)}
                    {" — "}
                    {zonasNombres.length > 0 && (
                      <span className="text-destructive">
                        zonas: {zonasNombres.join(", ")}
                      </span>
                    )}
                    {zonasNombres.length > 0 && mesasCodigos.length > 0 && " · "}
                    {mesasCodigos.length > 0 && (
                      <span className="text-destructive">
                        mesas: {mesasCodigos.join(", ")}
                      </span>
                    )}
                    {b.motivo ? ` · ${b.motivo}` : ""}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => borrar(b.id)}
                    aria-label="Borrar bloqueo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
