"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Plus, Search, ChevronLeft, ChevronRight, ListPlus, ListFilter, Check, ChevronDown } from "lucide-react";
import { ConfigReservasView } from "@/features/sala/components/reservas/config/ConfigReservasView";
import { Settings } from "lucide-react";
import { EtiquetasPanel } from "@/features/sala/components/reservas/EtiquetasPanel";
import { CalendarioMes } from "@/features/sala/components/reservas/CalendarioMes";
import { CalendarDays, Grid3X3, Users, LayoutGrid, Utensils } from "lucide-react";
import {
  SAMPLE_MESAS,
  Mesa, Reserva, EstadoReserva, ZonaSala, TurnoReserva,
  ZONAS_LABELS, ZONAS_SALA, ESTADO_RESERVA_LABELS, ESTADO_MESA_LABELS, ESTADOS_RESERVA,
} from "@/features/sala/data/reservas";
import { ReservaEstadoBadge, ReservaEstadoDot } from "@/features/sala/components/reservas/ReservaEstadoBadge";
import { listReservas, createReserva, updateReserva, deleteReserva } from "@/features/sala/actions/reservas-actions";
import { listReservaTipos } from "@/features/sala/actions/reserva-tipos-actions";
import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import { listSalas } from "@/features/sala/planos/actions/salas-actions";
import { listZonas } from "@/features/sala/planos/actions/zonas-actions";
import { listMesas } from "@/features/sala/planos/actions/mesas-actions";
import { getPlanoActivoConPosiciones, listPlanos } from "@/features/sala/planos/actions/planos-actions";
import type {
  Sala as SalaConfig,
  LocalMin,
  Zona as ZonaReal,
  Mesa as MesaConfig,
  Plano as PlanoConfig,
  PlanoMesaPosicion,
} from "@/features/sala/planos/data/planos";
import { getReservasConfig } from "@/features/sala/actions/reservas-config-actions";
import { listReservasExcepciones } from "@/features/sala/actions/reservas-excepciones-actions";
import { listPoliticasCancelacion } from "@/features/sala/actions/politicas-cancelacion-actions";
import { getClienteInsights } from "@/features/sala/actions/cliente-insights-actions";
import { maxpaxEfectivo } from "@/features/sala/lib/reserva-limites";
import type {
  ReservaTipo,
  EmpresaReservasConfig,
  EmpresaReservasExcepcion,
  PoliticaCancelacion,
  ClienteInsights,
} from "@/features/sala/data/reservas";
import { ReservaFlagsChips } from "@/features/sala/components/reservas/ReservaFlagsChips";
import { ReservaExternalBadge } from "@/features/sala/components/reservas/ReservaExternalBadge";
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
  NO_SHOW: "bg-red-600/20 text-red-400 border-red-600/40",
  COMPLETADA: "bg-muted text-muted-foreground border-border",
  CANCELADA: "bg-red-900/20 text-red-500 border-red-800/40",
  TARJETA_NO_INTRODUCIDA: "bg-zinc-100 text-zinc-800 border-zinc-300",
  LLEGADA_BARRA: "bg-purple-600/20 text-purple-300 border-purple-600/40",
  SENTADA: "bg-green-700/20 text-green-300 border-green-700/40",
  POSTRE: "bg-cyan-600/20 text-cyan-300 border-cyan-600/40",
  CUENTA_SOLICITADA: "bg-blue-700/20 text-blue-300 border-blue-700/40",
  LIMPIAR: "bg-lime-600/20 text-lime-300 border-lime-600/40",
  LIBERADA: "bg-yellow-600/20 text-yellow-300 border-yellow-600/40",
  A_REVISAR: "bg-rose-600/20 text-rose-300 border-rose-600/40",
};

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatFecha(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${MESES_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMes(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${MESES_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function addMonths(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  const total = d.getFullYear() * 12 + d.getMonth() + n;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = ((total % 12) + 12) % 12;
  return `${nuevoAnio}-${String(nuevoMes + 1).padStart(2, "0")}-01`;
}

function StatusDot({ estado }: { estado: EstadoReserva }) {
  const colors: Record<EstadoReserva, string> = {
    CONFIRMADA: "bg-emerald-500", PENDIENTE: "bg-amber-500", RECONFIRMADA: "bg-sky-500",
    LISTA_ESPERA: "bg-violet-500", WALK_IN: "bg-orange-400", LLEGADA: "bg-blue-500",
    NO_SHOW: "bg-red-500", COMPLETADA: "bg-muted-foreground", CANCELADA: "bg-red-800",
    TARJETA_NO_INTRODUCIDA: "bg-zinc-400", LLEGADA_BARRA: "bg-purple-500",
    SENTADA: "bg-green-600", POSTRE: "bg-cyan-500", CUENTA_SOLICITADA: "bg-blue-700",
    LIMPIAR: "bg-lime-500", LIBERADA: "bg-yellow-500", A_REVISAR: "bg-rose-500",
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
  onClose: () => void;
  onSave: (r: Reserva & {
    tipoId?: string | null;
    esGrupo?: boolean;
    tarjetaIntroducida?: boolean;
    esTicket?: boolean;
    politicaCancelacionId?: string | null;
    garantiaImporte?: number | null;
  }) => void;
}) {
  const [form, setForm] = useState({
    cliente: "", apellidos: "", telefono: "", email: "",
    fecha, hora: "", turno, comensales: 2,
    zona: "" as ZonaSala | "", observaciones: "", esWalkIn: false,
    tipoId: "" as string,
    esGrupo: false,
    tarjetaIntroducida: false,
    esTicket: false,
    politicaCancelacionId: "" as string,
    garantiaImporte: "" as string,
  });
  const [tipos, setTipos] = useState<ReservaTipo[]>([]);
  const [politicas, setPoliticas] = useState<PoliticaCancelacion[]>([]);
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [excepciones, setExcepciones] = useState<EmpresaReservasExcepcion[]>([]);
  const [paxTouched, setPaxTouched] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, p, c, e] = await Promise.all([
        listReservaTipos({ soloActivos: true }),
        listPoliticasCancelacion({ soloActivas: true }),
        getReservasConfig(),
        listReservasExcepciones({ desde: form.fecha, hasta: form.fecha }),
      ]);
      if (t.ok) setTipos(t.data);
      if (p.ok) setPoliticas(p.data);
      if (c.ok) setConfig(c.data);
      if (e.ok) setExcepciones(e.data);
    })();
  }, [form.fecha]);

  const maxPax = useMemo(
    () => maxpaxEfectivo(config, excepciones, form.fecha, form.turno),
    [config, excepciones, form.fecha, form.turno],
  );

  const excedeMaxPax = maxPax != null && form.comensales > maxPax;
  const muestraAvisoPax = paxTouched && excedeMaxPax && !form.esGrupo;
  const guardarBloqueado =
    (!form.esWalkIn && !form.cliente) ||
    !form.hora ||
    (excedeMaxPax && !form.esGrupo);

  const handleSave = () => {
    if (guardarBloqueado) return;
    onSave({
      id: `r-${Date.now()}`,
      cliente: form.esWalkIn ? "" : form.cliente,
      apellidos: form.esWalkIn ? "" : form.apellidos,
      telefono: form.telefono, email: form.email,
      fecha: form.fecha, hora: form.hora, turno: form.turno,
      comensales: form.comensales, zona: form.zona, mesaId: "",
      estado: form.esWalkIn ? "WALK_IN" : "PENDIENTE",
      observaciones: form.observaciones,
      tipoId: form.tipoId || null,
      esGrupo: form.esGrupo,
      tarjetaIntroducida: form.tarjetaIntroducida,
      esTicket: form.esTicket,
      politicaCancelacionId: form.politicaCancelacionId || null,
      garantiaImporte: form.garantiaImporte ? Number(form.garantiaImporte) : null,
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
        <div>
          <Label className="text-xs">Comensales</Label>
          <Input
            type="number"
            min={1}
            className={cn("h-8 text-xs", muestraAvisoPax && "border-amber-500 focus-visible:ring-amber-500")}
            value={form.comensales}
            onChange={(e) => setForm((p) => ({ ...p, comensales: Number(e.target.value) }))}
            onBlur={() => setPaxTouched(true)}
          />
        </div>
        <div className="col-span-2"><Label className="text-xs">Zona</Label>
          <Select value={form.zona || "ANY"} onValueChange={v => setForm(p => ({ ...p, zona: v === "ANY" ? "" : v as ZonaSala }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cualquiera" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">Cualquiera</SelectItem>
              {Object.entries(ZONAS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Tipo de reserva</Label>
          {/* Select nativo: evitar Popover+cmdk dentro de Dialog (MEMORY: combobox_dentro_dialog). */}
          <select
            value={form.tipoId}
            onChange={(e) => setForm((p) => ({ ...p, tipoId: e.target.value }))}
            className="h-8 text-xs w-full rounded-md border border-input bg-background px-2"
          >
            <option value="">— Sin tipo —</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.emoji ? `${t.emoji} ` : ""}{t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Política de cancelación</Label>
          <select
            value={form.politicaCancelacionId}
            onChange={(e) => setForm((p) => ({ ...p, politicaCancelacionId: e.target.value }))}
            className="h-8 text-xs w-full rounded-md border border-input bg-background px-2"
          >
            <option value="">— Sin política —</option>
            {politicas.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Garantía retención (€)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="h-8 text-xs"
            placeholder="0,00"
            value={form.garantiaImporte}
            onChange={(e) => setForm((p) => ({ ...p, garantiaImporte: e.target.value }))}
          />
        </div>
      </div>

      {muestraAvisoPax && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Supera el máximo de {maxPax} pax del turno {form.turno.toLowerCase()} del {form.fecha}.
          Marca <strong>&quot;Es de grupo&quot;</strong> si la reserva es correcta.
        </div>
      )}

      <div className="border rounded-md p-3 bg-muted/30 space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Flags</Label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.esGrupo}
              onChange={(e) => setForm((p) => ({ ...p, esGrupo: e.target.checked }))}
            />
            <span>Es reserva de grupo</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.tarjetaIntroducida}
              onChange={(e) => setForm((p) => ({ ...p, tarjetaIntroducida: e.target.checked }))}
            />
            <span>Tarjeta introducida</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.esTicket}
              onChange={(e) => setForm((p) => ({ ...p, esTicket: e.target.checked }))}
            />
            <span>Reserva tipo Ticket</span>
          </label>
        </div>
      </div>

      <div><Label className="text-xs">Observaciones</Label><Textarea className="text-xs" value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={guardarBloqueado}>Guardar reserva</Button>
      </div>
    </div>
  );
}

const PAISES_PREFIJO = [
  { code: "ES", prefijo: "+34", flag: "🇪🇸", label: "ESPAÑA" },
  { code: "PT", prefijo: "+351", flag: "🇵🇹", label: "PORTUGAL" },
  { code: "FR", prefijo: "+33", flag: "🇫🇷", label: "FRANCIA" },
  { code: "IT", prefijo: "+39", flag: "🇮🇹", label: "ITALIA" },
  { code: "DE", prefijo: "+49", flag: "🇩🇪", label: "ALEMANIA" },
  { code: "GB", prefijo: "+44", flag: "🇬🇧", label: "REINO UNIDO" },
  { code: "US", prefijo: "+1", flag: "🇺🇸", label: "ESTADOS UNIDOS" },
  { code: "MX", prefijo: "+52", flag: "🇲🇽", label: "MÉXICO" },
  { code: "AR", prefijo: "+54", flag: "🇦🇷", label: "ARGENTINA" },
  { code: "CO", prefijo: "+57", flag: "🇨🇴", label: "COLOMBIA" },
];

function NuevaListaEsperaForm({
  fecha,
  turno,
  onClose,
  onSave,
}: {
  fecha: string;
  turno: TurnoReserva;
  onClose: () => void;
  onSave: (input: {
    fecha: string;
    horaEstimada: string;
    turno: TurnoReserva;
    personas: number;
    notas: string;
    nombre: string;
    apellidos: string;
    paisCode: string;
    prefijo: string;
    telefono: string;
    email: string;
  }) => void;
}) {
  const horaDefault = turno === "CENA" ? "21:00" : "14:00";
  const [form, setForm] = useState({
    fecha,
    horaEstimada: horaDefault,
    personas: 2,
    notas: "",
    nombre: "",
    apellidos: "",
    paisCode: "ES",
    prefijo: "+34",
    telefono: "",
    email: "",
  });

  const guardarBloqueado =
    !form.nombre.trim() || !form.personas || form.personas < 1 || !form.horaEstimada;

  const handleSave = () => {
    if (guardarBloqueado) return;
    const [hh] = form.horaEstimada.split(":");
    const hour = Number(hh);
    const turnoDerivado: TurnoReserva = hour >= 17 ? "CENA" : "COMIDA";
    onSave({
      fecha: form.fecha,
      horaEstimada: form.horaEstimada,
      turno: turnoDerivado,
      personas: form.personas,
      notas: form.notas,
      nombre: form.nombre,
      apellidos: form.apellidos,
      paisCode: form.paisCode,
      prefijo: form.prefijo,
      telefono: form.telefono,
      email: form.email,
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="rounded-md bg-muted/30 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Datos de la lista de espera
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Día *</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={form.fecha}
              onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs">Hora *</Label>
            <Input
              type="time"
              className="h-8 text-xs"
              value={form.horaEstimada}
              onChange={e => setForm(p => ({ ...p, horaEstimada: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs">Personas *</Label>
            <Input
              type="number"
              min={1}
              className="h-8 text-xs"
              value={form.personas}
              onChange={e => setForm(p => ({ ...p, personas: Number(e.target.value) }))}
            />
          </div>
        </div>
      </div>

      <div className="rounded-md bg-muted/30 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Datos del cliente
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input
                className="h-8 text-xs"
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Apellidos</Label>
              <Input
                className="h-8 text-xs"
                value={form.apellidos}
                onChange={e => setForm(p => ({ ...p, apellidos: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Teléfono</Label>
            <div className="flex gap-1">
              <select
                value={form.paisCode}
                onChange={e => {
                  const p = PAISES_PREFIJO.find(x => x.code === e.target.value);
                  setForm(prev => ({ ...prev, paisCode: e.target.value, prefijo: p?.prefijo ?? prev.prefijo }));
                }}
                className="h-8 text-xs w-[92px] rounded-md border border-input bg-background px-1.5"
                title={PAISES_PREFIJO.find(p => p.code === form.paisCode)?.label ?? ""}
              >
                {PAISES_PREFIJO.map(p => (
                  <option key={p.code} value={p.code}>{p.flag} {p.prefijo}</option>
                ))}
              </select>
              <Input
                type="tel"
                className="h-8 text-xs flex-1"
                value={form.telefono}
                onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              className="h-8 text-xs"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs">Notas</Label>
        <Textarea
          className="text-xs min-h-[52px]"
          value={form.notas}
          onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
        />
      </div>

      <div className="flex justify-end gap-2 pt-0.5">
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={guardarBloqueado}>Guardar</Button>
      </div>
    </div>
  );
}

function renderZoneLabels(filtro: ZonaSala[]) {
  const zones: { zona: ZonaSala; x: number; y: number }[] = [
    { zona: "SALA", x: 78, y: 1 },
    { zona: "BARRA", x: 83, y: 48 },
    { zona: "TERRAZA_INTERIOR", x: 48, y: 1 },
    { zona: "TERRAZA_EXTERIOR", x: 15, y: 1 },
    { zona: "PRIVADO", x: 60, y: 68 },
  ];
  return zones
    .filter(z => filtro.includes(z.zona))
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
    apellidos: (row.cliente_apellidos as string) ?? (row.apellidos as string) ?? "",
    telefono: (row.cliente_telefono as string) ?? "",
    email: (row.cliente_email as string) ?? (row.email as string) ?? "",
    fecha: (row.fecha as string) ?? "",
    hora: (row.hora as string) ?? "",
    turno: (row.turno as TurnoReserva) ?? "COMIDA",
    comensales: (row.personas as number) ?? (row.comensales as number) ?? 0,
    zona: (row.zona as ZonaSala | "") ?? "",
    mesaId: (row.mesa as string) ?? (row.mesa_id as string) ?? "",
    estado: (row.estado as EstadoReserva) ?? "PENDIENTE",
    observaciones: (row.notas as string) ?? (row.observaciones as string) ?? "",
    clienteId: (row.cliente_id as string | null) ?? null,
    origen: (row.origen as string | null) ?? null,
    tarjetaIntroducida: (row.tarjeta_introducida as boolean) ?? false,
    esTicket: (row.es_ticket as boolean) ?? false,
    politicaCancelacionId: (row.politica_cancelacion_id as string | null) ?? null,
    garantiaImporte: (row.garantia_importe as number | null) ?? null,
    bloqueada: (row.bloqueada as boolean) ?? false,
    grupoId: (row.grupo_id as string | null) ?? null,
    tipoId: (row.tipo_id as string | null) ?? null,
    codigoId: (row.codigo_id as string | null) ?? null,
    codigoNombre: (row.codigo_nombre as string | null) ?? null,
    reconfirmadaAt: (row.reconfirmada_at as string | null) ?? null,
    externalId: (row.external_id as string | null) ?? null,
    externalOrigen: (row.external_origen as string | null) ?? null,
  };
}

function FiltroEstadosDropdown({
  seleccionados,
  onChange,
}: {
  seleccionados: EstadoReserva[];
  onChange: (e: EstadoReserva[]) => void;
}) {
  const toggle = (e: EstadoReserva) => {
    onChange(
      seleccionados.includes(e)
        ? seleccionados.filter((x) => x !== e)
        : [...seleccionados, e],
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 px-2.5">
          <ListFilter className="h-3.5 w-3.5" />
          Estados
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Estados
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChange(ESTADOS_RESERVA)}
              className="text-[10px] text-primary hover:underline"
            >
              Todos
            </button>
            <span className="text-[10px] text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] text-muted-foreground hover:underline"
            >
              Ninguno
            </button>
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-0.5">
          {ESTADOS_RESERVA.map((e) => {
            const checked = seleccionados.includes(e);
            return (
              <button
                key={e}
                type="button"
                onClick={() => toggle(e)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left",
                  checked && "bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                    checked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <ReservaEstadoDot estado={e} className="w-2 h-2 shrink-0" />
                <span className="truncate">{ESTADO_RESERVA_LABELS[e]}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FiltroSalasDropdown({
  salas,
  salaActualId,
  onSelect,
}: {
  salas: SalaConfig[];
  salaActualId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 px-2.5">
          <ListFilter className="h-3.5 w-3.5" />
          Salas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Salas
          </span>
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-0.5">
          {salas.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground italic text-center">
              No hay salas creadas
            </p>
          ) : (
            salas.map((s) => {
              const checked = s.id === salaActualId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left",
                    checked && "bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                      checked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate flex-1">{s.nombre}</span>
                  {s.esPrincipal && (
                    <span className="text-amber-500 shrink-0" title="Sala principal">★</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FiltroPlanosDropdown({
  planos,
  planoActualId,
  onSelect,
}: {
  planos: PlanoConfig[];
  planoActualId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 px-2.5">
          <ListFilter className="h-3.5 w-3.5" />
          Planos
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Planos
          </span>
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-0.5">
          {planos.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground italic text-center">
              No hay planos creados
            </p>
          ) : (
            planos.map((p) => {
              const checked = p.id === planoActualId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left",
                    checked && "bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                      checked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate flex-1">{p.nombre}</span>
                  {p.esPrincipal && (
                    <span className="text-amber-500 shrink-0" title="Plano principal">★</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ZonaItem {
  id: string;
  label: string;
  color?: string;
  matchKey: string;
}

function FiltroZonasDropdown({
  items,
  seleccionados,
  onChange,
}: {
  items: ZonaItem[];
  seleccionados: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(
      seleccionados.includes(id)
        ? seleccionados.filter((x) => x !== id)
        : [...seleccionados, id],
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 px-2.5">
          <ListFilter className="h-3.5 w-3.5" />
          Zonas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Zonas
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChange(items.map((i) => i.id))}
              className="text-[10px] text-primary hover:underline"
            >
              Todas
            </button>
            <span className="text-[10px] text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] text-muted-foreground hover:underline"
            >
              Ninguna
            </button>
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-0.5">
          {items.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
              Esta sala aún no tiene zonas.
            </div>
          ) : (
            items.map((z) => {
              const checked = seleccionados.includes(z.id);
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => toggle(z.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left",
                    checked && "bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                      checked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  {z.color && (
                    <span
                      className="inline-block h-3 w-3 rounded shrink-0 border"
                      style={{ backgroundColor: z.color }}
                    />
                  )}
                  <span className="truncate">{z.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const PLANO_MESA_SIZE = 60;
// Tamaño estándar del lienzo de una sala — debe coincidir con el editor (SalaPlanoEditor).
// No se expande para "encajar" mesas: si quedan fuera por coordenadas viejas se clampean al borde.
const PLANO_CANVAS_W = 1200;
const PLANO_CANVAS_H = 640;

function PlanoCanvas({
  mesas,
  posiciones,
  zonas,
  selectedMesaId,
  onSelectMesa,
  getEstadoMesa,
  getReservasMesa,
  onAsignar,
  onCambiarEstado,
}: {
  mesas: Mesa[];
  posiciones: Map<string, PlanoMesaPosicion>;
  zonas: ZonaReal[];
  selectedMesaId: string | null;
  onSelectMesa: (m: Mesa | null) => void;
  getEstadoMesa: (m: Mesa) => string;
  getReservasMesa: (mesaId: string) => Reserva[];
  onAsignar: (m: Mesa) => void;
  onCambiarEstado: (id: string, e: EstadoReserva) => void;
}) {
  // Mesas con posición x/y conocida y zona pasada por filtro
  const mesasConPos = useMemo(() => {
    const zonaNombres = new Set(zonas.map((z) => z.nombre.toUpperCase()));
    return mesas
      .filter((m) => posiciones.has(m.id))
      .filter((m) => !zonas.length || zonaNombres.has((m.zona as unknown as string) ?? ""));
  }, [mesas, posiciones, zonas]);

  // Autoescala el lienzo 1200x640 para caber siempre completo y centrado en el contenedor visible.
  // Mismo patrón que SalaPlanoEditor para que lo que ves al editar coincida con el board.
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const s = Math.min(w / PLANO_CANVAS_W, h / PLANO_CANVAS_H, 1);
      setScale(s > 0 ? s : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Encuadra una posición dentro del lienzo estándar (mismas bounds que el editor).
  const clampPos = (x: number, y: number) => ({
    x: Math.max(0, Math.min(PLANO_CANVAS_W - PLANO_MESA_SIZE, x)),
    y: Math.max(0, Math.min(PLANO_CANVAS_H - PLANO_MESA_SIZE, y)),
  });

  // Etiquetas de zona: posicionadas encima de la mesa más arriba-izquierda de cada zona
  const labelsZonas = useMemo(() => {
    const labels: { id: string; nombre: string; color: string; x: number; y: number }[] = [];
    for (const z of zonas) {
      const mesasZona = mesasConPos.filter(
        (m) => (m.zona as unknown as string)?.toUpperCase() === z.nombre.toUpperCase(),
      );
      if (mesasZona.length === 0) continue;
      let minX = Infinity, minY = Infinity;
      for (const m of mesasZona) {
        const pos = posiciones.get(m.id)!;
        const c = clampPos(pos.x, pos.y);
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
      }
      labels.push({ id: z.id, nombre: z.nombre, color: z.colorPastel, x: minX, y: minY - 30 });
    }
    return labels;
  }, [zonas, mesasConPos, posiciones]);

  if (mesasConPos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground italic p-4 text-center">
        No hay mesas posicionadas para mostrar. Entra a Configuración → Estructura → Editar layout.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3 bg-white dark:bg-white min-h-0">
      <div
        ref={outerRef}
        className="flex-1 flex items-center justify-center overflow-hidden min-h-0"
      >
      <div
        style={{
          width: PLANO_CANVAS_W * scale,
          height: PLANO_CANVAS_H * scale,
          position: "relative",
        }}
      >
      <div
        className="relative bg-white rounded-lg"
        style={{
          width: PLANO_CANVAS_W,
          height: PLANO_CANVAS_H,
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {labelsZonas.map((l) => (
          <span
            key={l.id}
            className="absolute px-2 py-0.5 rounded text-[11px] font-bold tracking-wide text-zinc-800 shadow-sm pointer-events-none"
            style={{ left: l.x, top: Math.max(8, l.y), backgroundColor: l.color }}
          >
            {l.nombre}
          </span>
        ))}
        {mesasConPos.map((m) => {
          const pos = posiciones.get(m.id)!;
          const c = clampPos(pos.x, pos.y);
          const estado = getEstadoMesa(m);
          const rs = getReservasMesa(m.id);
          const firstR = rs[0];
          const isWalkIn = firstR?.estado === "WALK_IN";
          return (
            <Popover key={m.id}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "absolute rounded-md flex flex-col items-center justify-center text-white text-[10px] font-bold shadow-md border border-white/10 transition-all cursor-pointer px-1",
                    mesaBg[estado] ?? mesaBg.LIBRE,
                    selectedMesaId === m.id && "ring-2 ring-primary",
                  )}
                  style={{
                    left: c.x,
                    top: c.y,
                    width: PLANO_MESA_SIZE,
                    height: PLANO_MESA_SIZE,
                    transform: pos.rotation ? `rotate(${pos.rotation}deg)` : undefined,
                  }}
                  onClick={() => onSelectMesa(m)}
                >
                  <span className="leading-none">{m.codigo}</span>
                  <span className="text-[8px] font-normal opacity-80 mt-0.5">({m.capacidad}p)</span>
                  {firstR && (
                    <span className="text-[8px] font-normal mt-0.5 opacity-90 truncate max-w-full">
                      {firstR.hora}
                    </span>
                  )}
                  {firstR && (
                    <span className="text-[8px] font-normal opacity-90 truncate max-w-full">
                      {isWalkIn ? "WALK IN" : firstR.cliente}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3">
                <MesaPopover
                  mesa={m}
                  reservas={rs}
                  onAsignar={() => onAsignar(m)}
                  onCambiarEstado={onCambiarEstado}
                />
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
      </div>
      </div>
      <div className="flex items-center gap-4 pt-3 text-[10px] text-muted-foreground justify-center flex-wrap">
        {Object.entries(mesaBg).map(([k, cls]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn("w-3 h-3 rounded", cls)} />{ESTADO_MESA_LABELS[k as keyof typeof ESTADO_MESA_LABELS]}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ReservasView() {
  const { empresaActual } = useEmpresa();
  const [mesas, setMesas] = useState<Mesa[]>(SAMPLE_MESAS);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [turno, setTurno] = useState<TurnoReserva>("CENA");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstados, setFiltroEstados] = useState<EstadoReserva[]>(ESTADOS_RESERVA);
  const [filtroOrigen, setFiltroOrigen] = useState<string>("TODOS");
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [showNueva, setShowNueva] = useState(false);
  const [showListaEspera, setShowListaEspera] = useState(false);
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null);
  const [selectedInsights, setSelectedInsights] = useState<ClienteInsights | null>(null);
  const [vista, setVista] = useState<"dia" | "mes">("dia");
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [tiposReserva, setTiposReserva] = useState<ReservaTipo[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [totalesMes, setTotalesMes] = useState<{ personas: number; reservas: number }>({ personas: 0, reservas: 0 });
  const [locales, setLocales] = useState<LocalMin[]>([]);
  const [localId, setLocalId] = useState<string>("");
  const [salasLocal, setSalasLocal] = useState<SalaConfig[]>([]);
  const [salaActualId, setSalaActualId] = useState<string>("");
  const [navDirSala, setNavDirSala] = useState<1 | -1>(1);
  const [planosLocal, setPlanosLocal] = useState<PlanoConfig[]>([]);
  const [planoActualId, setPlanoActualId] = useState<string>("");
  const [zonasReales, setZonasReales] = useState<ZonaReal[]>([]);
  const [posicionesPlano, setPosicionesPlano] = useState<Map<string, PlanoMesaPosicion>>(new Map());
  const [posicionesRefresh, setPosicionesRefresh] = useState(0);
  const [zonaIdsSel, setZonaIdsSel] = useState<string[]>(ZONAS_SALA);
  // Permite ocultar el listado de reservas o el mapa para que el otro ocupe todo el ancho.
  const [panelOculto, setPanelOculto] = useState<"ninguno" | "lista" | "mapa">("ninguno");

  useEffect(() => {
    (async () => {
      const r = await listReservaTipos({ soloActivos: true });
      if (r.ok) setTiposReserva(r.data);
    })();
  }, []);

  // Carga locales de la empresa activa
  useEffect(() => {
    (async () => {
      const r = await listLocalesEmpresa();
      if (r.ok && r.data.length > 0) {
        setLocales(r.data);
        setLocalId((prev) => prev || r.data[0].id);
      } else {
        setLocales([]);
        setLocalId("");
      }
    })();
  }, [empresaActual.id]);

  // Carga salas del local activo y selecciona la principal
  useEffect(() => {
    if (!localId) { setSalasLocal([]); setSalaActualId(""); return; }
    (async () => {
      const r = await listSalas(localId);
      if (r.ok) {
        setSalasLocal(r.data);
        const principal = r.data.find((s) => s.esPrincipal) ?? r.data[0];
        setSalaActualId(principal?.id ?? "");
      } else {
        setSalasLocal([]);
        setSalaActualId("");
      }
    })();
  }, [localId]);

  // Carga planos del local activo y selecciona el principal
  useEffect(() => {
    if (!localId) { setPlanosLocal([]); setPlanoActualId(""); return; }
    (async () => {
      const r = await listPlanos(localId);
      if (r.ok) {
        setPlanosLocal(r.data);
        const principal = r.data.find((p) => p.esPrincipal) ?? r.data[0];
        setPlanoActualId(principal?.id ?? "");
      } else {
        setPlanosLocal([]);
        setPlanoActualId("");
      }
    })();
  }, [localId]);

  // Carga zonas reales del local (todas; luego se filtran por sala activa)
  useEffect(() => {
    if (!localId) { setZonasReales([]); return; }
    (async () => {
      const r = await listZonas(localId);
      setZonasReales(r.ok ? r.data : []);
    })();
  }, [localId]);

  // Carga mesas reales del local: si hay, sustituyen las SAMPLE_MESAS.
  useEffect(() => {
    if (!localId) return;
    (async () => {
      const [r, zonasRes] = await Promise.all([listMesas(localId), listZonas(localId)]);
      if (!r.ok) {
        console.warn("[ReservasView] listMesas falló, conservando estado anterior");
        return;
      }
      const zonaNombrePorId = new Map<string, string>();
      if (zonasRes.ok) {
        zonasRes.data.forEach((z) => zonaNombrePorId.set(z.id, z.nombre.toUpperCase()));
      }
      const adaptadas: Mesa[] = r.data
        .filter((m) => m.activa)
        .map((m, idx) => ({
          id: m.id,
          codigo: m.codigo,
          numero: idx + 1,
          zona: (zonaNombrePorId.get(m.zonaId) ?? "") as ZonaSala,
          capacidad: m.capacidadMax,
          tipo: m.tipo === "BARRA" ? "BARRA" : m.tipo === "ALTA" ? "RESERVADO" : "MESA",
          estado: "LIBRE",
          x: 0, y: 0, ancho: 0, alto: 0,
          combinable: false,
          activa: true,
        }));
      setMesas(adaptadas);
    })();
  }, [localId, salaActualId]);

  // Carga el plano principal activo del local + sus posiciones x/y de mesa.
  // Se refresca al cambiar de local o al volver del panel de configuración (posicionesRefresh).
  useEffect(() => {
    if (!localId) { setPosicionesPlano(new Map()); return; }
    (async () => {
      const r = await getPlanoActivoConPosiciones(localId);
      const next = new Map<string, PlanoMesaPosicion>();
      if (r.ok && r.data) {
        for (const p of r.data.posiciones) next.set(p.mesaId, p);
      }
      setPosicionesPlano(next);
    })();
  }, [localId, posicionesRefresh]);

  const salaActual = useMemo(
    () => salasLocal.find((s) => s.id === salaActualId) ?? null,
    [salasLocal, salaActualId],
  );

  // Índice de la sala activa + siguiente sala en la dirección actual.
  // Cuando estamos en un extremo, la flecha invierte su sentido para indicar el final.
  const salaActualIdx = useMemo(
    () => salasLocal.findIndex((s) => s.id === salaActualId),
    [salasLocal, salaActualId],
  );

  useEffect(() => {
    if (salasLocal.length < 2 || salaActualIdx < 0) return;
    if (salaActualIdx === salasLocal.length - 1 && navDirSala === 1) setNavDirSala(-1);
    else if (salaActualIdx === 0 && navDirSala === -1) setNavDirSala(1);
  }, [salaActualIdx, salasLocal.length, navDirSala]);

  const siguienteSala = useMemo(() => {
    if (salasLocal.length < 2 || salaActualIdx < 0) return null;
    const nextIdx = salaActualIdx + navDirSala;
    if (nextIdx < 0 || nextIdx >= salasLocal.length) return null;
    return salasLocal[nextIdx] ?? null;
  }, [salasLocal, salaActualIdx, navDirSala]);

  const irSiguienteSala = () => {
    if (!siguienteSala) return;
    setSalaActualId(siguienteSala.id);
  };

  const zonasSalaActual = useMemo(
    () => zonasReales.filter((z) => z.salaId === salaActualId),
    [zonasReales, salaActualId],
  );

  // Items que alimentan el dropdown de zonas: reales si existen, si no fallback legacy.
  const zonaItems = useMemo(() => {
    if (zonasSalaActual.length > 0) {
      return zonasSalaActual.map((z) => ({
        id: z.id,
        label: z.nombre,
        color: z.colorPastel,
        matchKey: z.nombre.toUpperCase(),
      }));
    }
    return ZONAS_SALA.map((z) => ({
      id: z,
      label: ZONAS_LABELS[z],
      color: undefined as string | undefined,
      matchKey: z,
    }));
  }, [zonasSalaActual]);

  // Cada vez que cambian los items (sala distinta), reset a "todas seleccionadas"
  useEffect(() => {
    setZonaIdsSel(zonaItems.map((i) => i.id));
  }, [zonaItems]);

  const zonaMatchSet = useMemo(() => {
    const ids = new Set(zonaIdsSel);
    return new Set(zonaItems.filter((i) => ids.has(i.id)).map((i) => i.matchKey));
  }, [zonaItems, zonaIdsSel]);

  const zonaCoincide = useCallback(
    (zonaStr: string | "" | null | undefined) => {
      if (!zonaStr) return true;
      const up = zonaStr.toUpperCase();
      return zonaMatchSet.has(up) || zonaMatchSet.has(zonaStr);
    },
    [zonaMatchSet],
  );

  useEffect(() => {
    if (!selectedReserva) { setSelectedInsights(null); return; }
    let cancelled = false;
    (async () => {
      const ins = await getClienteInsights({
        clienteId: selectedReserva.clienteId ?? null,
        telefono: selectedReserva.telefono || null,
        email: selectedReserva.email || null,
      });
      if (!cancelled) setSelectedInsights(ins);
    })();
    return () => { cancelled = true; };
  }, [selectedReserva]);

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
  const reservasTurno = useMemo(() => reservasDia.filter(r => r.turno === turno), [reservasDia, turno]);
  const reservasFiltradas = useMemo(() => {
    return reservasTurno.filter(r => {
      const q = busqueda.toLowerCase();
      const matchQ = !q || r.cliente.toLowerCase().includes(q) || r.apellidos.toLowerCase().includes(q) || r.telefono.includes(q);
      const matchZ = zonaCoincide(r.zona);
      const matchE = filtroEstados.includes(r.estado);
      const matchO = filtroOrigen === "TODOS"
        || (filtroOrigen === "SIN_ORIGEN" && !r.origen)
        || r.origen === filtroOrigen;
      return matchQ && matchZ && matchE && matchO;
    }).sort((a, b) => a.hora.localeCompare(b.hora));
  }, [reservasTurno, busqueda, zonaCoincide, filtroEstados, filtroOrigen]);

  const origenesPresentes = useMemo(() => {
    const set = new Set<string>();
    reservasDia.forEach(r => { if (r.origen) set.add(r.origen); });
    return Array.from(set).sort();
  }, [reservasDia]);

  const mesasActivas = mesas.filter(m => m.activa);
  const capacidadTotal = mesasActivas.reduce((s, m) => s + m.capacidad, 0);
  const cubiertosReservados = reservasTurno.reduce((s, r) => s + r.comensales, 0);
  const mesasOcupadas = new Set(reservasTurno.filter(r => r.mesaId && !["CANCELADA", "NO_SHOW", "COMPLETADA"].includes(r.estado)).map(r => r.mesaId)).size;

  const getMesaEstadoTurno = (m: Mesa): string => {
    const rs = reservasTurno.filter(r => r.mesaId === m.id && !["CANCELADA", "NO_SHOW", "COMPLETADA"].includes(r.estado));
    if (rs.length === 0) return "LIBRE";
    if (rs.find(r => r.estado === "WALK_IN")) return "OCUPADA";
    return "RESERVADA";
  };

  const getReservasMesa = (mesaId: string) =>
    reservasTurno.filter(r => r.mesaId === mesaId && !["CANCELADA", "NO_SHOW", "COMPLETADA"].includes(r.estado));

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

  if (showConfig) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
        <ConfigReservasView
          onBack={() => {
            setShowConfig(false);
            setPosicionesRefresh((n) => n + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* TOP BAR — todo en una sola línea: acciones + filtros + turno + sala/zonas + vista + fecha + ajustes */}
      <div className="shrink-0 border-b bg-card px-2 py-1.5 flex items-center gap-1.5 flex-wrap">
        {/* Acciones: NUEVA · Lista espera · Estados · Buscar */}
        <div className="flex items-center gap-1.5">
          <Dialog open={showNueva} onOpenChange={setShowNueva}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs h-8 gap-1.5 px-2.5"><Plus className="h-3.5 w-3.5" />Nueva</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nueva reserva</DialogTitle></DialogHeader>
              <NuevaReservaForm fecha={fecha} turno={turno} onClose={() => setShowNueva(false)}
                onSave={async r => {
                  setReservas(prev => [...prev, r]);
                  setShowNueva(false);
                  const res = await createReserva({
                    clienteNombre: r.cliente || "WALK IN",
                    clienteApellidos: r.apellidos || undefined,
                    clienteTelefono: r.telefono,
                    clienteEmail: r.email || undefined,
                    fecha: r.fecha,
                    hora: r.hora,
                    personas: r.comensales,
                    zona: r.zona || undefined,
                    turno: r.turno,
                    estado: r.estado,
                    notas: r.observaciones || undefined,
                    tipoId: r.tipoId ?? null,
                    grupoId: r.esGrupo ? crypto.randomUUID() : null,
                    tarjetaIntroducida: r.tarjetaIntroducida ?? false,
                    esTicket: r.esTicket ?? false,
                    politicaCancelacionId: r.politicaCancelacionId ?? null,
                    garantiaImporte: r.garantiaImporte ?? null,
                  });
                  if (res.ok) { toast.success("Reserva creada"); loadReservas(fecha); }
                  else { toast.error(res.error ?? "Error al crear reserva"); }
                }} />
            </DialogContent>
          </Dialog>
          <Dialog open={showListaEspera} onOpenChange={setShowListaEspera}>
            <DialogTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                title="Añadir a lista de espera"
                aria-label="Añadir a lista de espera"
              >
                <ListPlus className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Añadir a lista de espera</DialogTitle></DialogHeader>
              <NuevaListaEsperaForm
                fecha={fecha}
                turno={turno}
                onClose={() => setShowListaEspera(false)}
                onSave={async (data) => {
                  const telCompleto = data.telefono ? `${data.prefijo} ${data.telefono}`.trim() : "";
                  const notasFinal = data.notas;
                  const optimista: Reserva = {
                    id: `r-${Date.now()}`,
                    cliente: data.nombre,
                    apellidos: data.apellidos,
                    telefono: telCompleto,
                    email: data.email,
                    fecha: data.fecha,
                    hora: data.horaEstimada,
                    turno: data.turno,
                    comensales: data.personas,
                    zona: "",
                    mesaId: "",
                    estado: "LISTA_ESPERA",
                    observaciones: notasFinal,
                  };
                  setReservas(prev => [...prev, optimista]);
                  setShowListaEspera(false);
                  const res = await createReserva({
                    clienteNombre: data.nombre,
                    clienteApellidos: data.apellidos || undefined,
                    clienteTelefono: telCompleto || undefined,
                    clienteEmail: data.email || undefined,
                    fecha: data.fecha,
                    hora: data.horaEstimada,
                    personas: data.personas,
                    turno: data.turno,
                    estado: "LISTA_ESPERA",
                    notas: notasFinal || undefined,
                  });
                  if (res.ok) { toast.success("Añadido a lista de espera"); loadReservas(fecha); }
                  else { toast.error(res.error ?? "Error al guardar"); }
                }}
              />
            </DialogContent>
          </Dialog>
          <FiltroEstadosDropdown seleccionados={filtroEstados} onChange={setFiltroEstados} />
          <div className="relative w-[150px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-8 h-8 text-xs" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
        </div>

        {/* Turno + capacidad */}
        <div className="flex gap-1 items-center">
          {(["COMIDA", "CENA"] as const).map(t => (
            <Button key={t} size="sm" variant={turno === t ? "default" : "outline"} className={cn("text-xs h-8 px-2.5", turno === t && "font-bold")} onClick={() => setTurno(t)}>
              {t}
            </Button>
          ))}
          <div
            className="ml-1 inline-flex items-center gap-2.5 h-8 px-2.5 rounded-md border border-input bg-background text-xs font-semibold"
            title={`${turno === "COMIDA" ? "Comida" : "Cena"} · ${fecha}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="tabular-nums">{cubiertosReservados}</span>
              <span className="text-muted-foreground">/</span>
              <span className="tabular-nums">{capacidadTotal}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="tabular-nums">{mesasOcupadas}</span>
              <span className="text-muted-foreground">/</span>
              <span className="tabular-nums">{mesasActivas.length}</span>
            </span>
          </div>
        </div>

        {/* Selector de Plano + Sala + filtro de Zonas */}
        <div className="flex items-center gap-1.5">
          <FiltroPlanosDropdown planos={planosLocal} planoActualId={planoActualId} onSelect={setPlanoActualId} />
          <FiltroSalasDropdown salas={salasLocal} salaActualId={salaActualId} onSelect={setSalaActualId} />
          <FiltroZonasDropdown items={zonaItems} seleccionados={zonaIdsSel} onChange={setZonaIdsSel} />
        </div>

        <div className="flex items-center gap-1.5">
          {/* KPI totales del mes (solo en vista mes) */}
          {vista === "mes" && (
            <div className="hidden md:inline-flex items-center gap-2.5 h-8 px-2.5 rounded-md border border-input bg-background text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-500" />
                <span className="tabular-nums">{totalesMes.personas}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Utensils className="h-3.5 w-3.5 text-sky-500" />
                <span className="tabular-nums">{totalesMes.reservas}</span>
              </span>
            </div>
          )}
          {/* Toggle vista: icono + texto de la vista OPUESTA — al pulsarlo cambias a ella */}
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5 px-2.5"
            title={vista === "dia" ? "Cambiar a vista Mes" : "Cambiar a vista Día"}
            onClick={() => setVista(vista === "dia" ? "mes" : "dia")}
          >
            {vista === "dia" ? <><Grid3X3 className="h-3.5 w-3.5" />Mes</> : <><CalendarDays className="h-3.5 w-3.5" />Día</>}
          </Button>
          {vista === "mes" ? (
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFecha(addMonths(fecha, -1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="text-xs h-8 w-[130px] justify-center font-medium uppercase px-2.5">{formatMes(fecha)}</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFecha(addMonths(fecha, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFecha(addDays(fecha, -1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Popover open={showDayPicker} onOpenChange={setShowDayPicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-8 w-[150px] justify-center font-medium uppercase px-2.5">{formatFecha(fecha)}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="center">
                  <CalendarioMes
                    fecha={fecha}
                    fechaSeleccionada={fecha}
                    aforoPorTurno={capacidadTotal}
                    compacto
                    onDayClick={(iso) => {
                      setFecha(iso);
                      setShowDayPicker(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFecha(addDays(fecha, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 ml-auto"
          onClick={() => setShowConfig(true)}
          title="Configuración de reservas"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {vista === "mes" ? (
        <CalendarioMes
          fecha={fecha}
          fechaSeleccionada={fecha}
          aforoPorTurno={capacidadTotal}
          hideHeader
          onTotalesChange={setTotalesMes}
          onDayClick={(iso) => {
            setFecha(iso);
            setVista("dia");
          }}
        />
      ) : (
      <>
      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT PANEL */}
        {panelOculto !== "lista" && (
        <div className={cn(
          "border-r flex flex-col bg-card overflow-hidden",
          panelOculto === "ninguno" ? "w-[420px] shrink-0" : "flex-1",
        )}>
          {(origenesPresentes.length > 0 || filtroOrigen !== "TODOS") && (
            <div className="px-3 py-1.5 border-b flex items-center gap-1.5 text-[10px]">
              <span className="text-muted-foreground">Origen:</span>
              <select
                value={filtroOrigen}
                onChange={(e) => setFiltroOrigen(e.target.value)}
                className="h-6 text-[10px] rounded border bg-background px-1.5"
              >
                <option value="TODOS">Todos</option>
                <option value="SIN_ORIGEN">Sin origen (manual)</option>
                {origenesPresentes.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-[90px_50px_50px_1fr_40px_70px] gap-1 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground border-b bg-muted/30 uppercase tracking-wider">
            <span>Zona</span><span>Mesa</span><span>Hora</span><span>Nombre</span><span>Pax</span><span>Estado</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {reservasFiltradas.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Sin reservas para este turno</p>}
            {reservasFiltradas.map(r => {
              const mesa = mesas.find(m => m.id === r.mesaId);
              return (
                <button key={r.id} onClick={() => setSelectedReserva(r)}
                  className={cn("w-full grid grid-cols-[90px_50px_50px_1fr_40px_70px] gap-1 px-3 py-2.5 text-xs border-b hover:bg-muted/40 text-left transition-colors", selectedReserva?.id === r.id && "bg-primary/10")}>
                  <span className="truncate text-muted-foreground">{r.zona ? ZONAS_LABELS[r.zona] : "—"}</span>
                  <span className="font-mono font-bold">{mesa?.codigo ?? "—"}</span>
                  <span className="tabular-nums">{r.hora}</span>
                  <span className="truncate font-medium flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{r.cliente || "WALK IN"} {r.apellidos}</span>
                    {r.origen && (
                      <span className="shrink-0 text-[9px] font-mono uppercase bg-sky-600/15 text-sky-700 dark:text-sky-400 border border-sky-600/30 rounded px-1 py-px" title={`Origen: ${r.origen}`}>
                        {r.origen}
                      </span>
                    )}
                    {r.codigoNombre && (
                      <span className="shrink-0 text-[9px] font-mono uppercase bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/40 rounded px-1 py-px" title={`Código promocional: ${r.codigoNombre}`}>
                        🎟 {r.codigoNombre}
                      </span>
                    )}
                    <ReservaFlagsChips reserva={r} tipos={tiposReserva} className="shrink-0" />
                  </span>
                  <span className="text-center">{r.comensales}</span>
                  <StatusDot estado={r.estado} />
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* DIVISOR con botones para ocultar lista o mapa (solo visible con ambos paneles) */}
        {panelOculto === "ninguno" && (
          <div className="relative flex flex-col items-center justify-center w-0 z-30">
            <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-1 -translate-x-1/2">
              <button
                type="button"
                onClick={() => setPanelOculto("lista")}
                title="Ocultar listado"
                className="h-7 w-5 rounded bg-background border shadow-sm hover:bg-muted flex items-center justify-center"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPanelOculto("mapa")}
                title="Ocultar mapa"
                className="h-7 w-5 rounded bg-background border shadow-sm hover:bg-muted flex items-center justify-center"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Botón flotante para restaurar la lista cuando está oculta */}
        {panelOculto === "lista" && (
          <button
            type="button"
            onClick={() => setPanelOculto("ninguno")}
            title="Mostrar listado"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-40 h-9 w-6 rounded-r bg-background border border-l-0 shadow-md hover:bg-muted flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Botón flotante para restaurar el mapa cuando está oculto */}
        {panelOculto === "mapa" && (
          <button
            type="button"
            onClick={() => setPanelOculto("ninguno")}
            title="Mostrar mapa"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-40 h-9 w-6 rounded-l bg-background border border-r-0 shadow-md hover:bg-muted flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* RIGHT PANEL — CANVAS PLANO si hay intersección posiciones↔mesasActivas; sino, GRID agrupado por zona */}
        {panelOculto !== "mapa" && (
        <div className="relative flex-1 flex flex-col overflow-hidden bg-white">
          {salasLocal.length >= 2 && siguienteSala && (
            <button
              type="button"
              onClick={irSiguienteSala}
              title={`Ir a sala "${siguienteSala.nombre}"`}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full border bg-background/90 backdrop-blur shadow-md flex items-center justify-center text-foreground hover:bg-background hover:shadow-lg transition-all"
              aria-label={`Cambiar a sala ${siguienteSala.nombre}`}
            >
              {navDirSala === 1 ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          )}
          {posicionesPlano.size > 0 && mesasActivas.some((m) => posicionesPlano.has(m.id)) ? (
            <PlanoCanvas
              mesas={mesasActivas}
              posiciones={posicionesPlano}
              zonas={zonasSalaActual.filter((z) => zonaIdsSel.includes(z.id))}
              selectedMesaId={selectedMesa?.id ?? null}
              onSelectMesa={setSelectedMesa}
              getEstadoMesa={getMesaEstadoTurno}
              getReservasMesa={getReservasMesa}
              onAsignar={(m) => { setSelectedMesa(m); setShowNueva(true); }}
              onCambiarEstado={cambiarEstadoReserva}
            />
          ) : (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {zonasSalaActual.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
                  Esta sala todavía no tiene zonas. Créalas en Configuración → Estructura.
                </div>
              ) : (
                zonasSalaActual
                  .filter((z) => zonaIdsSel.includes(z.id))
                  .map((zona) => {
                    const mesasZona = mesasActivas
                      .filter((m) => (m.zona as unknown as string) === zona.nombre.toUpperCase())
                      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
                    if (mesasZona.length === 0) return null;
                    return (
                      <section key={zona.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide text-zinc-800"
                            style={{ backgroundColor: zona.colorPastel }}
                          >
                            {zona.nombre}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {mesasZona.length} mesa{mesasZona.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}>
                          {mesasZona.map((m) => {
                            const estado = getMesaEstadoTurno(m);
                            const rs = getReservasMesa(m.id);
                            const firstR = rs[0];
                            const isWalkIn = firstR?.estado === "WALK_IN";
                            return (
                              <Popover key={m.id}>
                                <PopoverTrigger asChild>
                                  <button
                                    className={cn(
                                      "h-20 rounded-md flex flex-col items-center justify-center text-white text-[11px] font-bold shadow-sm border border-white/10 transition-all cursor-pointer px-1",
                                      mesaBg[estado] ?? mesaBg.LIBRE,
                                      selectedMesa?.id === m.id && "ring-2 ring-primary"
                                    )}
                                    onClick={() => setSelectedMesa(m)}
                                  >
                                    <span className="leading-none">{m.codigo}</span>
                                    <span className="text-[9px] font-normal opacity-80 mt-0.5">({m.capacidad}p)</span>
                                    {firstR && (
                                      <span className="text-[9px] font-normal mt-1 opacity-90 truncate max-w-full">
                                        {firstR.hora} {isWalkIn ? "WALK IN" : firstR.cliente}
                                      </span>
                                    )}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-3">
                                  <MesaPopover
                                    mesa={m}
                                    reservas={rs}
                                    onAsignar={() => { setSelectedMesa(m); setShowNueva(true); }}
                                    onCambiarEstado={(id, e) => cambiarEstadoReserva(id, e)}
                                  />
                                </PopoverContent>
                              </Popover>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })
              )}
              <div className="flex items-center gap-4 pt-2 text-[10px] text-muted-foreground justify-center flex-wrap border-t">
                {Object.entries(mesaBg).map(([k, cls]) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className={cn("w-3 h-3 rounded", cls)} />{ESTADO_MESA_LABELS[k as keyof typeof ESTADO_MESA_LABELS]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

      </div>
      </>
      )}

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
                <Label className="text-muted-foreground text-xs">Estado actual</Label>
                <ReservaEstadoBadge estado={selectedReserva.estado} />
              </div>
              {selectedReserva.observaciones && <Field label="Observaciones">{selectedReserva.observaciones}</Field>}
              <div className="flex flex-wrap items-center gap-2">
                <ReservaFlagsChips reserva={selectedReserva} tipos={tiposReserva} insights={selectedInsights} size="md" />
                <ReservaExternalBadge reserva={selectedReserva} />
              </div>
              <div className="pt-2 border-t space-y-1.5">
                <Label className="text-muted-foreground text-xs">Etiquetas</Label>
                <EtiquetasPanel
                  scope="reserva"
                  entityId={selectedReserva.id}
                  clienteVinculadoId={selectedReserva.clienteId ?? null}
                />
              </div>
              <div className="space-y-2 pt-2">
                <Label className="text-muted-foreground text-xs">Cambiar a</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ESTADOS_RESERVA.map((e) => (
                    <Button
                      key={e}
                      size="sm"
                      variant="outline"
                      className={cn(
                        "text-[10px] h-7 px-2 justify-start gap-1.5",
                        e === selectedReserva.estado && "ring-1 ring-primary",
                      )}
                      onClick={() => cambiarEstadoReserva(selectedReserva.id, e)}
                    >
                      <ReservaEstadoDot estado={e} className="w-2 h-2" />
                      <span className="truncate">{ESTADO_RESERVA_LABELS[e]}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
