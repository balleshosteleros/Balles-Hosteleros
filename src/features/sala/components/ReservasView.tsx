"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Plus, Search, Users, ChevronLeft, ChevronRight, Eye, ListPlus } from "lucide-react";
import {
  SAMPLE_MESAS, SAMPLE_LISTA_ESPERA,
  Mesa, Reserva, ListaEspera, EstadoReserva, ZonaSala, TurnoReserva,
  ZONAS_LABELS, ESTADO_RESERVA_LABELS, ESTADO_MESA_LABELS,
} from "@/features/sala/data/reservas";
import { listReservas, createReserva, updateReserva, deleteReserva } from "@/features/sala/actions/reservas-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const mesaBg: Record<string, string> = {
  LIBRE: "bg-emerald-600 hover:bg-emerald-500",
  OCUPADA: "bg-amber-600 hover:bg-amber-500",
  RESERVADA: "bg-sky-600 hover:bg-sky-500",
  BLOQUEADA: "bg-muted hover:bg-muted",
};

const reservaColor: Record<EstadoReserva, string> = {
  CONFIRMADA: "bg-emerald-600/20 text-emerald-400 border-emerald-600/40",
  PENDIENTE: "bg-amber-600/20 text-amber-400 border-amber-600/40",
  RECONFIRMADA: "bg-sky-600/20 text-sky-400 border-sky-600/40",
  LISTA_ESPERA: "bg-violet-600/20 text-violet-400 border-violet-600/40",
  WALK_IN: "bg-orange-600/20 text-orange-300 border-orange-600/40",
  LLEGADA: "bg-blue-600/20 text-blue-400 border-blue-600/40",
  "NO SHOW": "bg-red-600/20 text-red-400 border-red-600/40",
  COMPLETADA: "bg-muted text-muted-foreground border-border",
  CANCELADA: "bg-red-900/20 text-red-500 border-red-800/40",
};

function formatFecha(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function StatusDot({ estado }: { estado: EstadoReserva }) {
  const colors: Record<EstadoReserva, string> = {
    CONFIRMADA: "bg-emerald-500", PENDIENTE: "bg-amber-500", RECONFIRMADA: "bg-sky-500",
    LISTA_ESPERA: "bg-violet-500", WALK_IN: "bg-orange-400", LLEGADA: "bg-blue-500",
    "NO SHOW": "bg-red-500", COMPLETADA: "bg-muted-foreground", CANCELADA: "bg-red-800",
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", colors[estado])} />
      <span className="truncate">{ESTADO_RESERVA_LABELS[estado]}</span>
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</Label>
      <p className="font-medium text-sm">{children}</p>
    </div>
  );
}

function MesaPopover({ mesa, reservas, onAsignar, onCambiarEstado }: {
  mesa: Mesa; reservas: Reserva[];
  onAsignar: () => void;
  onCambiarEstado: (id: string, e: EstadoReserva) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm">Mesa {mesa.codigo}</h4>
        <Badge variant="outline" className="text-[10px]">{mesa.zona ? ZONAS_LABELS[mesa.zona] : mesa.zona} · {mesa.capacidad}p</Badge>
      </div>
      {reservas.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">Mesa libre</div>
      ) : (
        reservas.map(r => (
          <div key={r.id} className="border rounded-md p-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs">{r.cliente || "WALK IN"} {r.apellidos}</span>
              <Badge className={cn("text-[9px]", reservaColor[r.estado])} variant="outline">{ESTADO_RESERVA_LABELS[r.estado]}</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">{r.hora} · {r.comensales} pax</p>
            {r.observaciones && <p className="text-[10px] text-muted-foreground italic">{r.observaciones}</p>}
            <div className="flex gap-1 pt-1">
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => onCambiarEstado(r.id, "LLEGADA")}>Llegada</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => onCambiarEstado(r.id, "COMPLETADA")}>Completar</Button>
            </div>
          </div>
        ))
      )}
      <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={onAsignar}>
        <Plus className="h-3 w-3 mr-1" />Asignar reserva
      </Button>
    </div>
  );
}

function NuevaReservaForm({ fecha, turno, onClose, onSave }: {
  fecha: string; turno: TurnoReserva;
  onClose: () => void; onSave: (r: Reserva) => void;
}) {
  const [form, setForm] = useState({
    cliente: "", apellidos: "", telefono: "", email: "",
    fecha, hora: "", turno, comensales: 2,
    zona: "" as ZonaSala | "", observaciones: "", esWalkIn: false,
  });

  const handleSave = () => {
    if (!form.esWalkIn && !form.cliente) return;
    if (!form.hora) return;
    onSave({
      id: `r-${Date.now()}`, cliente: form.esWalkIn ? "" : form.cliente,
      apellidos: form.esWalkIn ? "" : form.apellidos,
      telefono: form.telefono, email: form.email,
      fecha: form.fecha, hora: form.hora, turno: form.turno,
      comensales: form.comensales, zona: form.zona, mesaId: "",
      estado: form.esWalkIn ? "WALK_IN" : "PENDIENTE",
      observaciones: form.observaciones,
    });
  };

  return (
    <div className="space-y-3">
      <Button size="sm" variant={form.esWalkIn ? "default" : "outline"} className="text-xs h-7"
        onClick={() => setForm(p => ({ ...p, esWalkIn: !p.esWalkIn }))}>WALK IN</Button>
      <div className="grid grid-cols-2 gap-3">
        {!form.esWalkIn && (
          <>
            <div><Label className="text-xs">Nombre *</Label><Input className="h-8 text-xs" value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} /></div>
            <div><Label className="text-xs">Apellidos</Label><Input className="h-8 text-xs" value={form.apellidos} onChange={e => setForm(p => ({ ...p, apellidos: e.target.value }))} /></div>
          </>
        )}
        <div><Label className="text-xs">Teléfono</Label><Input className="h-8 text-xs" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} /></div>
        <div><Label className="text-xs">Email</Label><Input className="h-8 text-xs" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
        <div><Label className="text-xs">Fecha *</Label><Input type="date" className="h-8 text-xs" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></div>
        <div><Label className="text-xs">Hora *</Label><Input type="time" className="h-8 text-xs" value={form.hora} onChange={e => setForm(p => ({ ...p, hora: e.target.value }))} /></div>
        <div><Label className="text-xs">Turno</Label>
          <Select value={form.turno} onValueChange={v => setForm(p => ({ ...p, turno: v as TurnoReserva }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="COMIDA">Comida</SelectItem><SelectItem value="CENA">Cena</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Comensales</Label><Input type="number" min={1} className="h-8 text-xs" value={form.comensales} onChange={e => setForm(p => ({ ...p, comensales: Number(e.target.value) }))} /></div>
        <div className="col-span-2"><Label className="text-xs">Zona</Label>
          <Select value={form.zona || "ANY"} onValueChange={v => setForm(p => ({ ...p, zona: v === "ANY" ? "" : v as ZonaSala }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cualquiera" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">Cualquiera</SelectItem>
              {Object.entries(ZONAS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Observaciones</Label><Textarea className="text-xs" value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave}>Guardar reserva</Button>
      </div>
    </div>
  );
}

function ListaEsperaPanel({ lista, onConvertir }: { lista: ListaEspera[]; onConvertir: (le: ListaEspera) => void }) {
  const esperando = lista.filter(l => l.estado === "ESPERANDO");
  return (
    <div className="space-y-3">
      {esperando.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No hay clientes en lista de espera</p>
      ) : (
        esperando.map(le => (
          <div key={le.id} className="border rounded-lg p-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-medium text-sm">{le.cliente}</p>
              <p className="text-xs text-muted-foreground">{le.comensales} pax · {le.hora}{le.zona ? ` · ${ZONAS_LABELS[le.zona]}` : ""}</p>
              {le.observaciones && <p className="text-xs text-muted-foreground italic mt-1">{le.observaciones}</p>}
            </div>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onConvertir(le)}>Asignar mesa</Button>
          </div>
        ))
      )}
    </div>
  );
}

function renderZoneLabels(filtro: ZonaSala | "TODAS") {
  const zones: { zona: ZonaSala; x: number; y: number }[] = [
    { zona: "SALA", x: 78, y: 1 },
    { zona: "BARRA", x: 83, y: 48 },
    { zona: "TERRAZA_INTERIOR", x: 48, y: 1 },
    { zona: "TERRAZA_EXTERIOR", x: 15, y: 1 },
    { zona: "PRIVADO", x: 60, y: 68 },
  ];
  return zones
    .filter(z => filtro === "TODAS" || z.zona === filtro)
    .map(z => (
      <div key={z.zona} className="absolute text-[11px] font-bold text-primary tracking-wide" style={{ left: `${z.x}%`, top: `${z.y}%` }}>
        {ZONAS_LABELS[z.zona]}
      </div>
    ));
}

function mapDbToReserva(row: Record<string, unknown>): Reserva {
  return {
    id: row.id as string,
    cliente: (row.cliente_nombre as string) ?? "",
    apellidos: (row.apellidos as string) ?? "",
    telefono: (row.cliente_telefono as string) ?? "",
    email: (row.email as string) ?? "",
    fecha: (row.fecha as string) ?? "",
    hora: (row.hora as string) ?? "",
    turno: (row.turno as TurnoReserva) ?? "COMIDA",
    comensales: (row.personas as number) ?? (row.comensales as number) ?? 0,
    zona: (row.zona as ZonaSala | "") ?? "",
    mesaId: (row.mesa as string) ?? (row.mesa_id as string) ?? "",
    estado: (row.estado as EstadoReserva) ?? "PENDIENTE",
    observaciones: (row.notas as string) ?? (row.observaciones as string) ?? "",
  };
}

export function ReservasView() {
  const { empresaActual } = useEmpresa();
  const [mesas, setMesas] = useState<Mesa[]>(SAMPLE_MESAS);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [listaEspera, setListaEspera] = useState<ListaEspera[]>(SAMPLE_LISTA_ESPERA);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [turno, setTurno] = useState<TurnoReserva | "DIA_COMPLETO">("CENA");
  const [busqueda, setBusqueda] = useState("");
  const [filtroZona, setFiltroZona] = useState<ZonaSala | "TODAS">("TODAS");
  const [filtroEstado, setFiltroEstado] = useState<EstadoReserva | "TODOS">("TODOS");
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [showNueva, setShowNueva] = useState(false);
  const [showListaEspera, setShowListaEspera] = useState(false);
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null);
  const [showVerTodo, setShowVerTodo] = useState(false);

  const loadReservas = useCallback(async (f?: string) => {
    setLoading(true);
    try {
      const res = await listReservas(f);
      if (res.ok) {
        setReservas(res.data.map(mapDbToReserva));
      } else {
        toast.error("Error al cargar reservas");
      }
    } catch {
      toast.error("Error de conexion al cargar reservas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservas(fecha);
  }, [fecha, loadReservas]);

  const reservasDia = useMemo(() => reservas.filter(r => r.fecha === fecha), [reservas, fecha]);
  const reservasTurno = useMemo(() => turno === "DIA_COMPLETO" ? reservasDia : reservasDia.filter(r => r.turno === turno), [reservasDia, turno]);
  const reservasFiltradas = useMemo(() => {
    return reservasTurno.filter(r => {
      const q = busqueda.toLowerCase();
      const matchQ = !q || r.cliente.toLowerCase().includes(q) || r.apellidos.toLowerCase().includes(q) || r.telefono.includes(q);
      const matchZ = filtroZona === "TODAS" || r.zona === filtroZona;
      const matchE = filtroEstado === "TODOS" || r.estado === filtroEstado;
      return matchQ && matchZ && matchE;
    }).sort((a, b) => a.hora.localeCompare(b.hora));
  }, [reservasTurno, busqueda, filtroZona, filtroEstado]);

  const mesasActivas = mesas.filter(m => m.activa);
  const capacidadTotal = mesasActivas.reduce((s, m) => s + m.capacidad, 0);
  const cubiertosReservados = reservasTurno.reduce((s, r) => s + r.comensales, 0);
  const mesasOcupadas = new Set(reservasTurno.filter(r => r.mesaId && !["CANCELADA", "NO SHOW", "COMPLETADA"].includes(r.estado)).map(r => r.mesaId)).size;

  const getMesaEstadoTurno = (m: Mesa): string => {
    const rs = reservasTurno.filter(r => r.mesaId === m.id && !["CANCELADA", "NO SHOW", "COMPLETADA"].includes(r.estado));
    if (rs.length === 0) return "LIBRE";
    if (rs.find(r => r.estado === "WALK_IN")) return "OCUPADA";
    return "RESERVADA";
  };

  const getReservasMesa = (mesaId: string) =>
    reservasTurno.filter(r => r.mesaId === mesaId && !["CANCELADA", "NO SHOW", "COMPLETADA"].includes(r.estado));

  const cambiarEstadoReserva = async (id: string, estado: EstadoReserva) => {
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r));
    setSelectedReserva(null);
    const res = await updateReserva(id, { estado });
    if (res.ok) {
      toast.success(`Reserva actualizada a ${ESTADO_RESERVA_LABELS[estado]}`);
    } else {
      toast.error("Error al actualizar reserva");
      loadReservas(fecha);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* TOP BAR */}
      <div className="shrink-0 border-b bg-card px-4 py-2 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(["COMIDA", "CENA", "DIA_COMPLETO"] as const).map(t => (
            <Button key={t} size="sm" variant={turno === t ? "default" : "outline"} className={cn("text-xs h-8", turno === t && "font-bold")} onClick={() => setTurno(t)}>
              {t === "DIA_COMPLETO" ? "DÍA COMPLETO" : t}
            </Button>
          ))}
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Comida</span>
          <span className="text-muted-foreground">Cerrado</span>
          <span className="text-muted-foreground mx-1">Cena</span>
          <Badge variant="secondary" className="bg-emerald-600 text-white text-[10px] px-1.5">ON</Badge>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-amber-400" />{cubiertosReservados} / {capacidadTotal}</span>
          <span className="flex items-center gap-1 text-muted-foreground">🪑 {mesasOcupadas} / {mesasActivas.length}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFecha(addDays(fecha, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="text-xs h-7 min-w-[160px] justify-center font-medium">{formatFecha(fecha)}</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFecha(addDays(fecha, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setFecha(new Date().toISOString().split("T")[0])}>HOY</Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-[420px] shrink-0 border-r flex flex-col bg-card overflow-hidden">
          <div className="p-3 border-b space-y-2">
            <div className="flex gap-2">
              <Dialog open={showNueva} onOpenChange={setShowNueva}>
                <DialogTrigger asChild>
                  <Button size="sm" className="text-xs h-8 gap-1"><Plus className="h-3.5 w-3.5" />NUEVA RESERVA</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Nueva reserva</DialogTitle></DialogHeader>
                  <NuevaReservaForm fecha={fecha} turno={turno === "DIA_COMPLETO" ? "COMIDA" : turno} onClose={() => setShowNueva(false)}
                    onSave={async r => {
                      setReservas(prev => [...prev, r]);
                      setShowNueva(false);
                      const res = await createReserva({
                        clienteNombre: r.cliente || "WALK IN",
                        clienteTelefono: r.telefono,
                        fecha: r.fecha,
                        hora: r.hora,
                        personas: r.comensales,
                        zona: r.zona || undefined,
                        turno: r.turno,
                        notas: r.observaciones || undefined,
                      });
                      if (res.ok) { toast.success("Reserva creada"); loadReservas(fecha); }
                      else { toast.error(res.error ?? "Error al crear reserva"); }
                    }} />
                </DialogContent>
              </Dialog>
              <Dialog open={showListaEspera} onOpenChange={setShowListaEspera}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-xs h-8 gap-1"><ListPlus className="h-3.5 w-3.5" />LISTA DE ESPERA</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Lista de espera — {formatFecha(fecha)}</DialogTitle></DialogHeader>
                  <ListaEsperaPanel lista={listaEspera.filter(l => l.fecha === fecha)} onConvertir={le => {
                    const nueva: Reserva = { id: `r-${Date.now()}`, cliente: le.cliente, apellidos: "", telefono: le.telefono, email: "", fecha: le.fecha, hora: le.hora, turno: turno === "DIA_COMPLETO" ? "COMIDA" : turno, comensales: le.comensales, zona: le.zona, mesaId: "", estado: "PENDIENTE", observaciones: le.observaciones };
                    setReservas(prev => [...prev, nueva]);
                    setListaEspera(prev => prev.map(l => l.id === le.id ? { ...l, estado: "ASIGNADO" } : l));
                  }} />
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex gap-1 flex-wrap text-[10px]">
              {(["TODOS", "CONFIRMADA", "PENDIENTE", "WALK_IN", "LISTA_ESPERA", "NO SHOW"] as const).map(e => (
                <button key={e} onClick={() => setFiltroEstado(e as any)}
                  className={cn("px-2 py-1 rounded-full border transition-colors",
                    filtroEstado === e ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                  {e === "TODOS" ? "Todas" : ESTADO_RESERVA_LABELS[e as EstadoReserva] ?? e}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-8 h-8 text-xs" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-[50px_50px_1fr_40px_70px_90px] gap-1 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground border-b bg-muted/30 uppercase tracking-wider">
            <span>Mesa</span><span>Hora</span><span>Nombre</span><span>Pax</span><span>Estado</span><span>Zona</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {reservasFiltradas.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Sin reservas para este turno</p>}
            {reservasFiltradas.map(r => {
              const mesa = mesas.find(m => m.id === r.mesaId);
              return (
                <button key={r.id} onClick={() => setSelectedReserva(r)}
                  className={cn("w-full grid grid-cols-[50px_50px_1fr_40px_70px_90px] gap-1 px-3 py-2.5 text-xs border-b hover:bg-muted/40 text-left transition-colors", selectedReserva?.id === r.id && "bg-primary/10")}>
                  <span className="font-mono font-bold">{mesa?.codigo ?? "—"}</span>
                  <span className="tabular-nums">{r.hora}</span>
                  <span className="truncate font-medium">{r.cliente || "WALK IN"} {r.apellidos}</span>
                  <span className="text-center">{r.comensales}</span>
                  <StatusDot estado={r.estado} />
                  <span className="truncate text-muted-foreground">{r.zona ? ZONAS_LABELS[r.zona] : "—"}</span>
                </button>
              );
            })}
          </div>
          <div className="border-t p-2 text-[10px] text-muted-foreground flex justify-between px-3">
            <span>{reservasFiltradas.length} reservas</span>
            <span>{cubiertosReservados} cubiertos</span>
          </div>
        </div>

        {/* RIGHT PANEL — FLOOR PLAN */}
        <div className="flex-1 flex flex-col overflow-hidden bg-muted/10">
          <div className="shrink-0 border-b px-4 py-2 flex items-center gap-3 bg-card/50">
            <span className="font-bold text-sm">{empresaActual.nombre.toUpperCase()}</span>
            <span className="text-xs text-muted-foreground">({mesasOcupadas}/{mesasActivas.length})</span>
            <div className="ml-auto flex items-center gap-2">
              <Select value={filtroZona} onValueChange={v => setFiltroZona(v as any)}>
                <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas las zonas</SelectItem>
                  {Object.entries(ZONAS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant={showVerTodo ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setShowVerTodo(!showVerTodo)}>
                <Eye className="h-3.5 w-3.5 mr-1" />VER TODO
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="relative w-full min-h-[600px]" style={{ aspectRatio: "16/10" }}>
              {renderZoneLabels(filtroZona)}
              {mesasActivas.filter(m => filtroZona === "TODAS" || m.zona === filtroZona).map(m => {
                const estado = getMesaEstadoTurno(m);
                const rs = getReservasMesa(m.id);
                const firstR = rs[0];
                const isWalkIn = firstR?.estado === "WALK_IN";
                return (
                  <Popover key={m.id}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn("absolute rounded-lg flex flex-col items-center justify-center text-white text-[10px] font-bold shadow-md border border-white/10 transition-all cursor-pointer", mesaBg[estado] ?? mesaBg.LIBRE, selectedMesa?.id === m.id && "ring-2 ring-primary")}
                        style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.ancho}%`, height: `${m.alto}%`, minWidth: 50, minHeight: 40 }}
                        onClick={() => setSelectedMesa(m)}>
                        <span className="leading-none">{m.codigo} ({m.capacidad}p)</span>
                        {firstR && <span className="text-[8px] font-normal mt-0.5 opacity-90 truncate max-w-full px-1">{firstR.hora}{" "}{isWalkIn ? "WALK IN" : firstR.cliente}</span>}
                        {firstR && firstR.apellidos && !isWalkIn && <span className="text-[8px] font-normal opacity-70 truncate max-w-full px-1">{firstR.apellidos}</span>}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3">
                      <MesaPopover mesa={m} reservas={rs} onAsignar={() => { setSelectedMesa(m); setShowNueva(true); }} onCambiarEstado={(id, e) => cambiarEstadoReserva(id, e)} />
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground justify-center flex-wrap">
              {Object.entries(mesaBg).map(([k, cls]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={cn("w-3 h-3 rounded", cls)} />{ESTADO_MESA_LABELS[k as keyof typeof ESTADO_MESA_LABELS]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedReserva} onOpenChange={() => setSelectedReserva(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Detalle de reserva</DialogTitle></DialogHeader>
          {selectedReserva && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cliente">{selectedReserva.cliente || "WALK IN"} {selectedReserva.apellidos}</Field>
                <Field label="Teléfono">{selectedReserva.telefono || "—"}</Field>
                <Field label="Fecha">{selectedReserva.fecha}</Field>
                <Field label="Hora">{selectedReserva.hora}</Field>
                <Field label="Turno">{selectedReserva.turno}</Field>
                <Field label="Comensales">{selectedReserva.comensales}</Field>
                <Field label="Zona">{selectedReserva.zona ? ZONAS_LABELS[selectedReserva.zona] : "—"}</Field>
                <Field label="Mesa">{mesas.find(m => m.id === selectedReserva.mesaId)?.codigo ?? "Sin asignar"}</Field>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-muted-foreground text-xs">Estado</Label>
                <Badge className={reservaColor[selectedReserva.estado]} variant="outline">{ESTADO_RESERVA_LABELS[selectedReserva.estado]}</Badge>
              </div>
              {selectedReserva.observaciones && <Field label="Observaciones">{selectedReserva.observaciones}</Field>}
              <div className="flex gap-2 pt-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => cambiarEstadoReserva(selectedReserva.id, "LLEGADA")}>Marcar llegada</Button>
                <Button size="sm" variant="outline" onClick={() => cambiarEstadoReserva(selectedReserva.id, "COMPLETADA")}>Completada</Button>
                <Button size="sm" variant="outline" className="text-amber-500" onClick={() => cambiarEstadoReserva(selectedReserva.id, "NO SHOW")}>No Show</Button>
                <Button size="sm" variant="destructive" onClick={() => cambiarEstadoReserva(selectedReserva.id, "CANCELADA")}>Cancelar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
