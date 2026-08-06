"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ChevronDown, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { formatFechaAuditoria } from "@/features/calidad/lib/fecha-auditoria";
import { cn } from "@/lib/utils";
import {
  getAnaliticaAuditorias,
  type AnaliticaAuditorias,
  type SeccionAnalitica,
  type PreguntaAnalitica,
} from "@/features/calidad/actions/analitica-actions";

/* Paleta: azul sequencial para magnitud, estados para bueno/crítico. */
const AZUL = "#2a78d6";
const AZUL_SUAVE = "#9ec5f4";
const EJE = "#a3a3a3";
const BUENO = "#0ca30c";
const CRITICO = "#d03b3b";
const AVISO = "#fab219";

const TODAS = "__todas__";

function num(n: number, dec = 2): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function colorNota(n: number): string {
  if (n >= 8) return BUENO;
  if (n >= 6) return AZUL;
  if (n >= 5) return AVISO;
  return CRITICO;
}

function claseNota(n: number | null): string {
  if (n === null) return "bg-muted text-muted-foreground";
  if (n >= 9) return "bg-emerald-100 text-emerald-700";
  if (n >= 7) return "bg-blue-100 text-blue-700";
  if (n >= 5) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

/** La pendiente se expresa como puntos ganados/perdidos a lo largo de todo el histórico. */
function TendenciaBadge({ pendiente, puntos }: { pendiente: number; puntos: number }) {
  const total = pendiente * Math.max(0, puntos - 1);
  const plano = Math.abs(total) < 0.15;
  const Icono = plano ? Minus : total > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs tabular-nums",
        plano
          ? "bg-muted text-muted-foreground"
          : total > 0
            ? "bg-emerald-100 text-emerald-700"
            : "bg-red-100 text-red-700",
      )}
      title={plano ? "Estable" : total > 0 ? "Mejora en el histórico" : "Empeora en el histórico"}
    >
      <Icono className="h-3 w-3" />
      {plano ? "Estable" : `${total > 0 ? "+" : "−"}${num(Math.abs(total), 1)}`}
    </span>
  );
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
}

function TooltipSerie({ active, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { etiqueta: string; nota: number; subtitulo?: string };
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-medium text-popover-foreground">{d.etiqueta}</div>
      {d.subtitulo && <div className="text-muted-foreground">{d.subtitulo}</div>}
      <div className="mt-0.5 font-mono tabular-nums text-popover-foreground">{num(d.nota)} / 10</div>
    </div>
  );
}

export function AuditoriasAnaliticaView() {
  const [data, setData] = useState<AnaliticaAuditorias | null>(null);
  const [loading, setLoading] = useState(true);
  const [plantillaId, setPlantillaId] = useState<string>(TODAS);
  const [localId, setLocalId] = useState<string>(TODAS);
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});

  const cargar = useCallback(() => {
    setLoading(true);
    getAnaliticaAuditorias({
      plantillaId: plantillaId === TODAS ? undefined : plantillaId,
      localId: localId === TODAS ? undefined : localId,
      desde: desde || undefined,
      hasta: hasta || undefined,
    }).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [plantillaId, localId, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const serieGlobal = useMemo(() => {
    if (!data) return [];
    return data.auditorias
      .filter((a) => a.nota !== null)
      .map((a) => ({
        etiqueta: formatFechaAuditoria(a.fecha),
        subtitulo: `Nº ${a.numero_secuencial} · ${a.local_nombre}`,
        nota: a.nota as number,
      }));
  }, [data]);

  const rankingSecciones = useMemo(() => {
    if (!data) return [];
    return [...data.secciones]
      .sort((a, b) => a.media - b.media)
      .map((s) => ({ etiqueta: s.titulo, nota: s.media, clave: s.clave }));
  }, [data]);

  /** Las 10 preguntas con peor media de todo el histórico: por dónde empezar a arreglar. */
  const peoresPreguntas = useMemo(() => {
    if (!data) return [];
    return data.secciones
      .flatMap((s) => s.preguntas)
      .sort((a, b) => a.media - b.media)
      .slice(0, 10);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  const sinDatos = !data || data.auditorias.length === 0;

  return (
    <div className="space-y-4">
      {/* Filtros — una sola fila sobre los gráficos */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Plantilla</Label>
          <Select value={plantillaId} onValueChange={setPlantillaId}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas</SelectItem>
              {(data?.plantillas ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Local</Label>
          <Select value={localId} onValueChange={setLocalId}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todos</SelectItem>
              {(data?.locales ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Desde</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 w-[160px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Hasta</Label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 w-[160px]" />
        </div>
        {(plantillaId !== TODAS || localId !== TODAS || desde || hasta) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setPlantillaId(TODAS); setLocalId(TODAS); setDesde(""); setHasta(""); }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {sinDatos ? (
        <div className="rounded-lg border bg-card py-16 text-center">
          <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <div className="text-sm text-muted-foreground">No hay auditorías enviadas con estos filtros.</div>
        </div>
      ) : (
        <>
          {/* Cifras de cabecera */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Nota media</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold">{data.mediaGlobal === null ? "—" : num(data.mediaGlobal)}</span>
                <span className="text-sm text-muted-foreground">/ 10</span>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Tendencia general</div>
              <div className="mt-2">
                <TendenciaBadge pendiente={data.tendenciaGlobal} puntos={serieGlobal.length} />
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Auditorías</div>
              <div className="mt-1 text-3xl font-semibold">{data.auditorias.length}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Última</div>
              <div className="mt-1 text-sm font-medium">
                {(() => {
                  const u = data.auditorias[data.auditorias.length - 1];
                  return u ? `${formatFechaAuditoria(u.fecha)} · ${num(u.nota ?? 0)}` : "—";
                })()}
              </div>
            </div>
          </div>

          {/* Evolución de la nota global */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium">Evolución de la nota final</h3>
            <p className="text-xs text-muted-foreground">Cada punto es una auditoría enviada, de la más antigua a la más reciente.</p>
            <div className="mt-3 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serieGlobal} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                  <CartesianGrid stroke={EJE} strokeOpacity={0.18} vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: EJE }} tickLine={false} axisLine={{ stroke: EJE, strokeOpacity: 0.3 }} />
                  <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: EJE }} tickLine={false} axisLine={false} />
                  <Tooltip content={<TooltipSerie />} cursor={{ stroke: EJE, strokeOpacity: 0.3 }} />
                  {data.mediaGlobal !== null && (
                    <ReferenceLine
                      y={data.mediaGlobal}
                      stroke={AZUL_SUAVE}
                      strokeWidth={2}
                      label={{ value: `media ${num(data.mediaGlobal)}`, position: "right", fontSize: 10, fill: EJE }}
                    />
                  )}
                  <Line type="monotone" dataKey="nota" stroke={AZUL} strokeWidth={2} dot={{ r: 4, fill: AZUL }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ranking de secciones */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium">Nota media por sección</h3>
            <p className="text-xs text-muted-foreground">Ordenadas de peor a mejor: lo de arriba es lo que más urge.</p>
            <div className="mt-3" style={{ height: Math.max(180, rankingSecciones.length * 34 + 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingSecciones} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke={EJE} strokeOpacity={0.18} horizontal={false} />
                  <XAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: EJE }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="etiqueta" width={230} tick={{ fontSize: 11, fill: EJE }} tickLine={false} axisLine={false} />
                  <Tooltip content={<TooltipSerie />} cursor={{ fill: EJE, fillOpacity: 0.08 }} />
                  <Bar dataKey="nota" radius={[0, 4, 4, 0]} barSize={16} label={{ position: "right", fontSize: 11, fill: EJE, formatter: (v: number) => num(v) }}>
                    {rankingSecciones.map((s) => (
                      <Cell key={s.clave} fill={colorNota(s.nota)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Preguntas más problemáticas */}
          {peoresPreguntas.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-medium">Preguntas con peor nota</h3>
              <p className="text-xs text-muted-foreground">Media histórica de cada pregunta, sumando todas las auditorías.</p>
              <div className="mt-3 divide-y">
                {peoresPreguntas.map((p) => (
                  <div key={p.clave} className="flex items-start gap-3 py-2">
                    <span className={cn("mt-0.5 shrink-0 rounded-md px-2 py-0.5 font-mono text-sm tabular-nums", claseNota(p.media))}>
                      {num(p.media)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{p.texto}</div>
                      <div className="text-xs text-muted-foreground">{p.seccion} · {p.veces} auditorías</div>
                    </div>
                    <TendenciaBadge pendiente={p.tendencia} puntos={p.veces} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detalle por sección: tendencia de la sección y de cada pregunta */}
          <div className="space-y-3">
            {data.secciones.map((s) => (
              <BloqueSeccion
                key={s.clave}
                seccion={s}
                abierta={abiertas[s.clave] ?? false}
                onToggle={() => setAbiertas((prev) => ({ ...prev, [s.clave]: !(prev[s.clave] ?? false) }))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BloqueSeccion({
  seccion,
  abierta,
  onToggle,
}: {
  seccion: SeccionAnalitica;
  abierta: boolean;
  onToggle: () => void;
}) {
  const serie = seccion.serie.map((p) => ({
    etiqueta: formatFechaAuditoria(p.fecha),
    subtitulo: `Nº ${p.numero_secuencial}`,
    nota: p.nota,
  }));

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <div className="min-w-0">
          <div className="font-medium">{seccion.titulo}</div>
          <div className="text-xs text-muted-foreground">{seccion.preguntas.length} preguntas · {seccion.serie.length} auditorías</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TendenciaBadge pendiente={seccion.tendencia} puntos={seccion.serie.length} />
          <span className={cn("rounded-md px-2 py-0.5 font-mono text-sm tabular-nums", claseNota(seccion.media))}>
            {num(seccion.media)}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !abierta && "-rotate-90")} />
        </div>
      </button>

      {abierta && (
        <div className="space-y-4 border-t px-4 py-4">
          <div>
            <div className="text-xs text-muted-foreground">Evolución de la sección</div>
            <div className="mt-2 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                  <CartesianGrid stroke={EJE} strokeOpacity={0.18} vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: EJE }} tickLine={false} axisLine={{ stroke: EJE, strokeOpacity: 0.3 }} />
                  <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 11, fill: EJE }} tickLine={false} axisLine={false} />
                  <Tooltip content={<TooltipSerie />} cursor={{ stroke: EJE, strokeOpacity: 0.3 }} />
                  <Line type="monotone" dataKey="nota" stroke={AZUL} strokeWidth={2} dot={{ r: 3, fill: AZUL }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Pregunta a pregunta (de peor a mejor)</div>
            <div className="mt-1 divide-y">
              {seccion.preguntas.map((p) => (
                <FilaPregunta key={p.clave} p={p} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilaPregunta({ p }: { p: PreguntaAnalitica }) {
  const [abierta, setAbierta] = useState(false);
  const serie = p.serie.map((s) => ({
    etiqueta: formatFechaAuditoria(s.fecha),
    subtitulo: `Nº ${s.numero_secuencial}`,
    nota: s.nota,
  }));

  return (
    <div className="py-2">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className={cn("mt-0.5 shrink-0 rounded-md px-2 py-0.5 font-mono text-sm tabular-nums", claseNota(p.media))}>
          {num(p.media)}
        </span>
        <span className="min-w-0 flex-1 text-sm">{p.texto}</span>
        <TendenciaBadge pendiente={p.tendencia} puntos={p.veces} />
        <Badge variant="outline" className="shrink-0 text-[10px] tabular-nums">{p.veces}</Badge>
        <ChevronDown className={cn("mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", !abierta && "-rotate-90")} />
      </button>

      {abierta && (
        <div className="mt-2 h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
              <CartesianGrid stroke={EJE} strokeOpacity={0.18} vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: EJE }} tickLine={false} axisLine={{ stroke: EJE, strokeOpacity: 0.3 }} />
              <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 10, fill: EJE }} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipSerie />} cursor={{ stroke: EJE, strokeOpacity: 0.3 }} />
              <Line type="monotone" dataKey="nota" stroke={AZUL} strokeWidth={2} dot={{ r: 3, fill: AZUL }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function AnaliticaNavButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="gap-1.5">
      <BarChart3 className="h-3.5 w-3.5" /> Gráficas
    </Button>
  );
}

export function VolverAuditoriasButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="gap-1.5">
      <ArrowLeft className="h-3.5 w-3.5" /> Auditorías realizadas
    </Button>
  );
}
