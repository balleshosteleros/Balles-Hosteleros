"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import {
  AlertTriangle, CheckCircle2, Timer, Plus, Search, History, FileText,
  CalendarDays, List, ChevronLeft, ChevronRight, CircleHelp, Gavel, ShieldCheck,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  CATALOGO_VENCIMIENTOS, AMBITOS, PERIODICIDADES, ETIQUETA_AMBITO,
  ETIQUETA_PERIODICIDAD, ETIQUETA_EJECUTOR, getVencimientoCatalogo,
  type AmbitoVencimiento, type PeriodicidadVencimiento,
} from "@/features/gerencia/data/catalogo-vencimientos";
import {
  listVencimientos, listHistorial, sembrarCatalogo, createVencimiento,
  registrarRevision,
  type VencimientoRow, type HistorialRow,
} from "@/features/gerencia/actions/vencimientos-actions";

// ─── Estado calculado a partir de la fecha ──────────────────────────────────

type EstadoVencimiento = "AL DIA" | "PROXIMA" | "VENCIDA" | "SIN FECHA";

function calcularEstado(fechaVencimiento: string | null): EstadoVencimiento {
  if (!fechaVencimiento) return "SIN FECHA";
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(`${fechaVencimiento}T00:00:00`);
  const dias = Math.ceil((fecha.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return "VENCIDA";
  if (dias <= 30) return "PROXIMA";
  return "AL DIA";
}

function diasRestantes(fechaVencimiento: string | null): number | null {
  if (!fechaVencimiento) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(`${fechaVencimiento}T00:00:00`);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / 86_400_000);
}

const ETIQUETA_ESTADO: Record<EstadoVencimiento, string> = {
  "AL DIA": "Al día",
  "PROXIMA": "Próxima",
  "VENCIDA": "Vencida",
  "SIN FECHA": "Sin fecha",
};

const estadoBadge: Record<EstadoVencimiento, string> = {
  "AL DIA": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "PROXIMA": "bg-amber-100 text-amber-800 border-amber-300",
  "VENCIDA": "bg-red-100 text-red-800 border-red-300",
  "SIN FECHA": "bg-slate-100 text-slate-600 border-slate-300",
};

const estadoIcono: Record<EstadoVencimiento, React.ReactNode> = {
  "AL DIA": <CheckCircle2 className="h-3 w-3" />,
  "PROXIMA": <Timer className="h-3 w-3" />,
  "VENCIDA": <AlertTriangle className="h-3 w-3" />,
  "SIN FECHA": <CircleHelp className="h-3 w-3" />,
};

/** Colores del cuadrado en la barra superior según el estado. */
const cuadradoEstilo: Record<EstadoVencimiento, string> = {
  "AL DIA": "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400",
  "PROXIMA": "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400",
  "VENCIDA": "border-red-300 bg-red-50 text-red-700 hover:border-red-400",
  "SIN FECHA": "border-border bg-muted/40 text-muted-foreground hover:border-muted-foreground/40",
};

const calDotColor: Record<EstadoVencimiento, string> = {
  "AL DIA": "bg-emerald-500",
  "PROXIMA": "bg-amber-500",
  "VENCIDA": "bg-red-500",
  "SIN FECHA": "bg-slate-400",
};

const RESULTADOS = ["CORRECTO", "CON_DEFICIENCIAS", "DESFAVORABLE", "PENDIENTE"] as const;
const ETIQUETA_RESULTADO: Record<string, string> = {
  CORRECTO: "Correcto",
  CON_DEFICIENCIAS: "Con deficiencias",
  DESFAVORABLE: "Desfavorable",
  PENDIENTE: "Pendiente",
};

/** Resuelve el icono de lucide por nombre; cae en un genérico si no existe. */
function IconoVencimiento({ nombre, className }: { nombre: string; className?: string }) {
  const Componente = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[nombre];
  const Final = Componente ?? ShieldCheck;
  return <Final className={className} />;
}

export function VencimientosView() {
  const [vencimientos, setVencimientos] = useState<VencimientoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [buscar, setBuscar] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroAmbito, setFiltroAmbito] = useState("todos");
  const [mesActual, setMesActual] = useState(new Date());

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [seleccionada, setSeleccionada] = useState<VencimientoRow | null>(null);
  const [historial, setHistorial] = useState<HistorialRow[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [nuevaSeq, setNuevaSeq] = useState(0);
  const [registrarOpen, setRegistrarOpen] = useState(false);

  const abrirNueva = () => { setNuevaSeq((n) => n + 1); setNuevaOpen(true); };

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await listVencimientos();
    if (res.ok) setVencimientos(res.data);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const conEstado = useMemo(
    () => vencimientos
      .filter((r) => r.activo)
      .map((r) => ({ ...r, estado: calcularEstado(r.fecha_vencimiento) })),
    [vencimientos]
  );

  // ─── Barra superior: los cuadrados con icono ──────────────────────────────
  // Se muestran los vencimientos marcados como críticos en el catálogo, más
  // cualquiera que esté vencida aunque no sea crítica: si te pueden multar hoy,
  // tiene que verse arriba.
  const cuadrados = useMemo(() => {
    const clavesCriticas = new Set(CATALOGO_VENCIMIENTOS.filter((c) => c.critica).map((c) => c.clave));
    return conEstado
      .filter((r) => (r.clave && clavesCriticas.has(r.clave)) || r.estado === "VENCIDA")
      .sort((a, b) => {
        const orden: Record<EstadoVencimiento, number> = { "VENCIDA": 0, "PROXIMA": 1, "SIN FECHA": 2, "AL DIA": 3 };
        if (orden[a.estado] !== orden[b.estado]) return orden[a.estado] - orden[b.estado];
        return a.nombre.localeCompare(b.nombre, "es");
      });
  }, [conEstado]);

  const filtradas = useMemo(() => conEstado.filter((r) => {
    if (buscar) {
      const q = buscar.toLowerCase();
      const cat = r.clave ? getVencimientoCatalogo(r.clave) : undefined;
      const enNormativa = cat?.normativa.toLowerCase().includes(q) ?? false;
      if (!r.nombre.toLowerCase().includes(q) && !enNormativa) return false;
    }
    if (filtroEstado !== "todos" && r.estado !== filtroEstado) return false;
    if (filtroAmbito !== "todos" && r.ambito !== filtroAmbito) return false;
    return true;
  }).sort((a, b) => {
    if (!a.fecha_vencimiento) return 1;
    if (!b.fecha_vencimiento) return -1;
    return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
  }), [conEstado, buscar, filtroEstado, filtroAmbito]);

  const resumen = useMemo(() => {
    const r = { total: conEstado.length, alDia: 0, proximas: 0, vencidas: 0, sinFecha: 0 };
    conEstado.forEach((v) => {
      if (v.estado === "AL DIA") r.alDia++;
      else if (v.estado === "PROXIMA") r.proximas++;
      else if (v.estado === "VENCIDA") r.vencidas++;
      else r.sinFecha++;
    });
    return r;
  }, [conEstado]);

  const abrirDetalle = async (revision: VencimientoRow) => {
    setSeleccionada(revision);
    setDetalleOpen(true);
    setCargandoHistorial(true);
    const res = await listHistorial(revision.id);
    setHistorial(res.ok ? res.data : []);
    setCargandoHistorial(false);
  };

  const handleSembrar = async () => {
    const res = await sembrarCatalogo();
    if (!res.ok) { toast.error(res.error ?? "No se pudo cargar el catálogo"); return; }
    if (res.creadas === 0) toast.info("Ya tienes todos los vencimientos del catálogo");
    else toast.success(`Se han añadido ${res.creadas} vencimientos obligatorios`);
    cargar();
  };

  // ─── Calendario ───────────────────────────────────────────────────────────
  const inicioMes = startOfMonth(mesActual);
  const diasMes = eachDayOfInterval({ start: inicioMes, end: endOfMonth(mesActual) });
  const offsetInicio = (getDay(inicioMes) + 6) % 7;
  const porDia = useMemo(() => {
    const mapa: Record<string, typeof conEstado> = {};
    conEstado.forEach((r) => {
      if (!r.fecha_vencimiento) return;
      (mapa[r.fecha_vencimiento] ??= []).push(r);
    });
    return mapa;
  }, [conEstado]);

  const catalogoSel = seleccionada?.clave ? getVencimientoCatalogo(seleccionada.clave) : undefined;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-6 space-y-6 pb-28">
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleSembrar}>
            <Gavel className="h-4 w-4" />
            Cargar vencimientos obligatorios
          </Button>
          <Button variant="primary" size="sm" onClick={abrirNueva}>
            <Plus className="h-4 w-4" />
            Nueva
          </Button>
        </div>

        {/* ─── Cuadrados de vencimientos importantes ────────────────────── */}
        {cuadrados.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Vencimientos importantes · pincha en uno para ver todo su historial
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-9 xl:grid-cols-12 gap-2">
              {cuadrados.map((r) => {
                const cat = r.clave ? getVencimientoCatalogo(r.clave) : undefined;
                const dias = diasRestantes(r.fecha_vencimiento);
                return (
                  <Tooltip key={r.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => abrirDetalle(r)}
                        className={`relative aspect-square rounded-lg border-2 p-2 flex flex-col items-center justify-center gap-1 transition-colors ${cuadradoEstilo[r.estado]}`}
                      >
                        {r.estado === "VENCIDA" && (
                          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                        )}
                        <IconoVencimiento nombre={cat?.icono ?? "ShieldCheck"} className="h-6 w-6" />
                        <span className="text-[10px] leading-tight text-center font-medium line-clamp-2">
                          {r.nombre}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium">{r.nombre}</p>
                      <p className="text-xs opacity-90 mt-0.5">
                        {r.fecha_vencimiento
                          ? dias !== null && dias < 0
                            ? `Venció hace ${Math.abs(dias)} días`
                            : `Vence el ${format(parseISO(r.fecha_vencimiento), "d 'de' MMMM 'de' yyyy", { locale: es })}`
                          : "Sin fecha registrada todavía"}
                      </p>
                      {cat && <p className="text-xs opacity-75 mt-1">{cat.normativa}</p>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Resumen ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><FileText className="h-5 w-5 text-muted-foreground" /></div>
            <div><p className="text-2xl font-bold">{resumen.total}</p><p className="text-xs text-muted-foreground">Vencimientos controlados</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-emerald-700">{resumen.alDia}</p><p className="text-xs text-muted-foreground">Al día</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center"><Timer className="h-5 w-5 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-amber-700">{resumen.proximas}</p><p className="text-xs text-muted-foreground">Próximas (30 días)</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <div><p className="text-2xl font-bold text-red-700">{resumen.vencidas}</p><p className="text-xs text-muted-foreground">Vencidas</p></div>
          </CardContent></Card>
        </div>

        {/* ─── Filtros ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar vencimiento o normativa..." value={buscar} onChange={(e) => setBuscar(e.target.value)} className="pl-9" />
          </div>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {(Object.keys(ETIQUETA_ESTADO) as EstadoVencimiento[]).map((e) => (
                <SelectItem key={e} value={e}>{ETIQUETA_ESTADO[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroAmbito} onValueChange={setFiltroAmbito}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Ámbito" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los ámbitos</SelectItem>
              {AMBITOS.map((a) => <SelectItem key={a} value={a}>{ETIQUETA_AMBITO[a]}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-1 bg-muted rounded-lg p-1">
            <Button variant={vista === "lista" ? "secondary" : "ghost"} size="sm" onClick={() => setVista("lista")} className="gap-1.5"><List className="h-4 w-4" /> Lista</Button>
            <Button variant={vista === "calendario" ? "secondary" : "ghost"} size="sm" onClick={() => setVista("calendario")} className="gap-1.5"><CalendarDays className="h-4 w-4" /> Calendario</Button>
          </div>
        </div>

        {/* ─── Lista ────────────────────────────────────────────────────── */}
        {vista === "lista" && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Ámbito</TableHead>
                  <TableHead>Periodicidad</TableHead>
                  <TableHead>Última</TableHead>
                  <TableHead>Próximo vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando && (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Cargando vencimientos...</TableCell></TableRow>
                )}
                {!cargando && filtradas.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    {conEstado.length === 0
                      ? "Todavía no hay vencimientos. Pulsa «Cargar vencimientos obligatorios» para traer el catálogo normativo completo."
                      : "No se encontraron vencimientos con esos filtros"}
                  </TableCell></TableRow>
                )}
                {!cargando && filtradas.map((r) => {
                  const cat = r.clave ? getVencimientoCatalogo(r.clave) : undefined;
                  return (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => abrirDetalle(r)}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <IconoVencimiento nombre={cat?.icono ?? "ShieldCheck"} className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium">{r.nombre}</p>
                            {cat && <p className="text-xs text-muted-foreground">{cat.normativa}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{ETIQUETA_AMBITO[r.ambito as AmbitoVencimiento] ?? r.ambito}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{ETIQUETA_PERIODICIDAD[r.periodicidad as PeriodicidadVencimiento] ?? r.periodicidad}</TableCell>
                      <TableCell className="text-sm">{r.fecha_ultima ? format(parseISO(r.fecha_ultima), "d MMM yyyy", { locale: es }) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{r.fecha_vencimiento ? format(parseISO(r.fecha_vencimiento), "d MMM yyyy", { locale: es }) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Badge className={`gap-1 ${estadoBadge[r.estado]}`}>{estadoIcono[r.estado]} {ETIQUETA_ESTADO[r.estado]}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* ─── Calendario ───────────────────────────────────────────────── */}
        {vista === "calendario" && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => setMesActual((m) => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <h3 className="text-lg font-semibold capitalize">{format(mesActual, "MMMM yyyy", { locale: es })}</h3>
                <Button variant="ghost" size="icon" onClick={() => setMesActual((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                  <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                ))}
                {Array.from({ length: offsetInicio }).map((_, i) => <div key={`e-${i}`} className="bg-background p-2 min-h-[80px]" />)}
                {diasMes.map((dia) => {
                  const key = format(dia, "yyyy-MM-dd");
                  const items = porDia[key] ?? [];
                  const esHoy = isSameDay(dia, new Date());
                  return (
                    <div key={key} className={`bg-background p-2 min-h-[80px] ${esHoy ? "ring-2 ring-primary/30 ring-inset" : ""}`}>
                      <span className={`text-xs font-medium ${esHoy ? "text-primary font-bold" : "text-muted-foreground"}`}>{format(dia, "d")}</span>
                      <div className="mt-1 space-y-0.5">
                        {items.slice(0, 3).map((r) => (
                          <button key={r.id} type="button" className="flex items-center gap-1 w-full text-left hover:opacity-70" onClick={() => abrirDetalle(r)}>
                            <span className={`h-2 w-2 rounded-full shrink-0 ${calDotColor[r.estado]}`} />
                            <span className="text-[10px] truncate">{r.nombre}</span>
                          </button>
                        ))}
                        {items.length > 3 && <span className="text-[10px] text-muted-foreground">+{items.length - 3} más</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Detalle con historial completo ───────────────────────────── */}
        <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {seleccionada && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 pr-8">
                    <IconoVencimiento nombre={catalogoSel?.icono ?? "ShieldCheck"} className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{seleccionada.nombre}</span>
                    <Badge className={`gap-1 shrink-0 ${estadoBadge[calcularEstado(seleccionada.fecha_vencimiento)]}`}>
                      {estadoIcono[calcularEstado(seleccionada.fecha_vencimiento)]}
                      {ETIQUETA_ESTADO[calcularEstado(seleccionada.fecha_vencimiento)]}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="historial">
                  <TabsList className="w-full">
                    <TabsTrigger value="historial" className="flex-1 gap-1"><History className="h-3.5 w-3.5" /> Historial ({historial.length})</TabsTrigger>
                    <TabsTrigger value="detalle" className="flex-1 gap-1"><FileText className="h-3.5 w-3.5" /> Qué exige la ley</TabsTrigger>
                  </TabsList>

                  <TabsContent value="historial" className="mt-4 space-y-4">
                    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="text-sm">
                        <p className="text-muted-foreground text-xs">Próximo vencimiento</p>
                        <p className="font-medium">
                          {seleccionada.fecha_vencimiento
                            ? format(parseISO(seleccionada.fecha_vencimiento), "d 'de' MMMM 'de' yyyy", { locale: es })
                            : "Sin fecha registrada"}
                        </p>
                      </div>
                      <Button size="sm" variant="primary" onClick={() => setRegistrarOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Anotar revisión
                      </Button>
                    </div>

                    {cargandoHistorial && <p className="text-center text-muted-foreground py-8 text-sm">Cargando historial...</p>}
                    {!cargandoHistorial && historial.length === 0 && (
                      <p className="text-center text-muted-foreground py-8 text-sm">
                        Todavía no hay ninguna revisión anotada. Cada vez que se haga una, anótala aquí y el sistema calculará solo la siguiente fecha.
                      </p>
                    )}
                    {!cargandoHistorial && historial.map((h) => (
                      <div key={h.id} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{format(parseISO(h.fecha), "d 'de' MMMM 'de' yyyy", { locale: es })}</span>
                          <Badge variant="outline" className="text-xs">{ETIQUETA_RESULTADO[h.resultado] ?? h.resultado}</Badge>
                        </div>
                        {h.realizado_por && <p className="text-xs text-muted-foreground">Realizado por: {h.realizado_por}</p>}
                        {h.observaciones && <p className="text-xs text-muted-foreground">{h.observaciones}</p>}
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="detalle" className="mt-4 space-y-4">
                    {catalogoSel ? (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">Normativa que la obliga</Label>
                          <p className="text-sm font-medium mt-0.5">{catalogoSel.normativa}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">En qué consiste</Label>
                          <p className="text-sm mt-0.5 text-muted-foreground">{catalogoSel.descripcion}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Cada cuánto</Label>
                            <p className="text-sm font-medium">{ETIQUETA_PERIODICIDAD[catalogoSel.periodicidad]}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Quién la hace</Label>
                            <p className="text-sm font-medium">{ETIQUETA_EJECUTOR[catalogoSel.ejecutor]}</p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Documento que hay que poder enseñar</Label>
                          <p className="text-sm font-medium mt-0.5">{catalogoSel.documentoProbatorio}</p>
                        </div>
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                          <Label className="text-xs text-red-700">Riesgo si no se cumple</Label>
                          <p className="text-sm text-red-800 mt-0.5">{catalogoSel.riesgoSancion}</p>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">Este vencimiento lo has creado tú, no viene del catálogo normativo.</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div><Label className="text-xs text-muted-foreground">Ámbito</Label><p className="text-sm font-medium">{ETIQUETA_AMBITO[seleccionada.ambito as AmbitoVencimiento] ?? seleccionada.ambito}</p></div>
                          <div><Label className="text-xs text-muted-foreground">Cada cuánto</Label><p className="text-sm font-medium">{ETIQUETA_PERIODICIDAD[seleccionada.periodicidad as PeriodicidadVencimiento] ?? seleccionada.periodicidad}</p></div>
                        </div>
                      </div>
                    )}
                    {seleccionada.proveedor && (
                      <div><Label className="text-xs text-muted-foreground">Empresa que la realiza</Label><p className="text-sm font-medium mt-0.5">{seleccionada.proveedor}</p></div>
                    )}
                    {seleccionada.notas && (
                      <div><Label className="text-xs text-muted-foreground">Notas</Label><p className="text-sm mt-0.5 text-muted-foreground">{seleccionada.notas}</p></div>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* La key remonta el formulario en cada apertura: entra siempre limpio. */}
        {seleccionada && registrarOpen && (
          <RegistrarRevisionDialog
            key={`reg-${seleccionada.id}-${seleccionada.fecha_ultima ?? "sin"}`}
            open={registrarOpen}
            onOpenChange={setRegistrarOpen}
            revision={seleccionada}
            onGuardado={async () => {
              await cargar();
              const res = await listHistorial(seleccionada.id);
              setHistorial(res.ok ? res.data : []);
              const actualizada = (await listVencimientos()).data.find((r) => r.id === seleccionada.id);
              if (actualizada) setSeleccionada(actualizada);
            }}
          />
        )}

        {nuevaOpen && (
          <NuevaRevisionDialog key={`nueva-${nuevaSeq}`} open onOpenChange={setNuevaOpen} onGuardado={cargar} />
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Anotar una revisión realizada ──────────────────────────────────────────

function RegistrarRevisionDialog({
  open, onOpenChange, revision, onGuardado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  revision: VencimientoRow;
  onGuardado: () => Promise<void>;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);
  const [resultado, setResultado] = useState<string>("CORRECTO");
  const [realizadoPor, setRealizadoPor] = useState(revision.proveedor ?? "");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!fecha) return;
    setGuardando(true);
    const res = await registrarRevision({
      revision_id: revision.id,
      fecha,
      resultado,
      realizado_por: realizadoPor || null,
      observaciones: observaciones || null,
    });
    setGuardando(false);
    if (!res.ok) { toast.error(res.error ?? "No se pudo anotar la revisión"); return; }
    toast.success(
      res.proximaFecha
        ? `Revisión anotada. La siguiente toca el ${format(parseISO(res.proximaFecha), "d 'de' MMMM 'de' yyyy", { locale: es })}`
        : "Anotado"
    );
    onOpenChange(false);
    await onGuardado();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Anotar revisión de {revision.nombre.toLowerCase()}</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha en que se hizo</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <Label>Resultado</Label>
              <Select value={resultado} onValueChange={setResultado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESULTADOS.map((r) => <SelectItem key={r} value={r}>{ETIQUETA_RESULTADO[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Quién la ha realizado</Label>
            <Input value={realizadoPor} onChange={(e) => setRealizadoPor(e.target.value)} placeholder="Empresa o persona responsable" />
          </div>
          <div>
            <Label>Observaciones</Label>
            <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} placeholder="Deficiencias detectadas, piezas cambiadas, número de acta..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} disabled={!fecha || guardando}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Alta de una revisión propia ────────────────────────────────────────────

function NuevaRevisionDialog({
  open, onOpenChange, onGuardado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGuardado: () => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [ambito, setAmbito] = useState<string>("SEGURIDAD");
  const [periodicidad, setPeriodicidad] = useState<string>("ANUAL");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    const res = await createVencimiento({
      nombre, ambito, periodicidad,
      fecha_vencimiento: fechaVencimiento || null,
      proveedor: proveedor || null,
      notas: notas || null,
    });
    setGuardando(false);
    if (!res.ok) { toast.error(res.error ?? "No se pudo crear el vencimiento"); return; }
    toast.success("Vencimiento creado");
    onOpenChange(false);
    await onGuardado();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo vencimiento</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Revisión de la cámara de congelación" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ámbito</Label>
              <Select value={ambito} onValueChange={setAmbito}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AMBITOS.map((a) => <SelectItem key={a} value={a}>{ETIQUETA_AMBITO[a]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cada cuánto</Label>
              <Select value={periodicidad} onValueChange={setPeriodicidad}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODICIDADES.map((p) => <SelectItem key={p} value={p}>{ETIQUETA_PERIODICIDAD[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Próximo vencimiento</Label>
              <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
            </div>
            <div>
              <Label>Empresa que la realiza</Label>
              <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} disabled={!nombre.trim() || guardando}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
