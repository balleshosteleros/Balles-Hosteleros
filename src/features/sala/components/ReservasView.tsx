"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useSidebar } from "@/components/ui/sidebar";
import { Plus, Search, ChevronLeft, ChevronRight, ListPlus, ListFilter, Check, Map as MapIcon, List as ListIcon } from "lucide-react";
// Configuración solo se carga cuando el usuario pulsa "Configuración" — fuera del bundle inicial.
const ConfigReservasView = dynamic(
  () =>
    import("@/features/sala/components/reservas/config/ConfigReservasView").then(
      (m) => m.ConfigReservasView,
    ),
  { ssr: false },
);
import { Settings } from "lucide-react";
import { EtiquetasPanel } from "@/features/sala/components/reservas/EtiquetasPanel";
import { CalendarioMes } from "@/features/sala/components/reservas/CalendarioMes";
import { CalendarDays, Grid3X3, Users, LayoutGrid } from "lucide-react";
import {
  SAMPLE_MESAS,
  Mesa, Reserva, EstadoReserva, ZonaSala, TurnoReserva,
  ZONAS_LABELS, ZONAS_SALA, ESTADO_RESERVA_LABELS, ESTADO_MESA_LABELS, ESTADOS_RESERVA,
  ESTADO_BADGE_CLASS,
  ESTADO_DOT_CLASS,
  ESTADO_ORDEN_PRIORIDAD,
  ESTADOS_NO_OCUPANTES,
  TIPO_RESERVA_CATEGORIA_LABELS,
  DURACION_RESERVA_MAX_MINUTOS,
  DURACION_RESERVA_MIN_MINUTOS,
} from "@/features/sala/data/reservas";
import { ReservaEstadoBadge, ReservaEstadoDot } from "@/features/sala/components/reservas/ReservaEstadoBadge";
import {
  listReservas,
  createReserva,
  updateReserva,
  notificarReservaCreadaPorEmail,
} from "@/features/sala/actions/reservas-actions";
import { listReservaEtiquetas } from "@/features/sala/actions/reserva-etiquetas-actions";
import { CuponInputReserva } from "@/features/sala/cupones/components/CuponInputReserva";
import { validarCuponAdminAction } from "@/features/sala/cupones/actions/validar-cupon-action";
import { loadReservasModuleContext } from "@/features/sala/actions/reservas-module-context";
import {
  crearBloqueoExcepcion,
  listBloqueoExcepciones,
  listBloqueos,
} from "@/features/sala/bloqueos/actions/bloqueos-actions";
import {
  vigenciaAplicaEnFecha,
  type BloqueoExcepcion,
  type ReservaBloqueo,
} from "@/features/sala/bloqueos/data/bloqueos";
import {
  COLORES_PASTEL_ZONAS,
  type Sala as SalaConfig,
  type LocalMin,
  type Zona as ZonaReal,
  type Plano as PlanoConfig,
  type PlanoMesaPosicion,
  type SalaDecoracion,
  type FormaMesa,
} from "@/features/sala/planos/data/planos";
import { DecoBody } from "@/features/sala/planos/components/DecoBody";
import { pickPlanoVigente } from "@/features/sala/planos/lib/plano-vigente";
import { getReservasConfig } from "@/features/sala/actions/reservas-config-actions";
import { listReglasReservas } from "@/features/sala/reglas/actions/reglas-actions";
import { listPoliticasCancelacion } from "@/features/sala/actions/politicas-cancelacion-actions";
import { getClienteInsights } from "@/features/sala/actions/cliente-insights-actions";
import { searchClientes, type ClienteSugerencia } from "@/features/sala/actions/clientes-actions";
import { maxpaxEfectivoDesdeReglas } from "@/features/sala/lib/reserva-limites";
import type { EmpresaReservasRegla } from "@/features/sala/reglas/data/reglas";
import type {
  ReservaEtiqueta,
  TipoReservaCategoria,
  EmpresaReservasConfig,
  PoliticaCancelacion,
  ClienteInsights,
} from "@/features/sala/data/reservas";
import { ReservaFlagsChips } from "@/features/sala/components/reservas/ReservaFlagsChips";
import { ReservaExternalBadge } from "@/features/sala/components/reservas/ReservaExternalBadge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Mezcla un hex con blanco para suavizar los pasteles de zona.
 * ratio 0 = original, 1 = blanco. Tolerante a entradas mal formateadas.
 */
function lightenHex(hex: string, ratio: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  const out = (mix(r) << 16) | (mix(g) << 8) | mix(b);
  return `#${out.toString(16).padStart(6, "0")}`;
}

/** Cuánto aclaramos los pasteles de zona (tirando a blanco, sutil). */
const ZONA_LIGHTEN = 0.35;

/** Rampa pastel arcoíris construida con la paleta canónica de zonas. */
const LIBRE_RAINBOW = `linear-gradient(135deg, ${COLORES_PASTEL_ZONAS
  .map((c, i) => `${lightenHex(c, ZONA_LIGHTEN)} ${(i / (COLORES_PASTEL_ZONAS.length - 1)) * 100}%`)
  .join(", ")})`;

/**
 * Paleta de fondo de mesa por estado.
 *  - LIBRE: hereda el color pastel de su zona inline (aclarado en render).
 *  - OCUPADA: alguien sentado (walk-in) → verde oscuro estilo CoverManager.
 *  - RESERVADA: reserva confirmada/reconfirmada pero aún no sentada → verde
 *    claro llamativo, distinto del verde oscuro de OCUPADA.
 *  - BLOQUEADA: negro.
 */
const mesaBg: Record<string, string> = {
  LIBRE: "",
  OCUPADA: "bg-[#1F6F3E] hover:bg-[#22783F] text-white",
  RESERVADA: "bg-[#4ADE80] hover:bg-[#22C55E] text-zinc-900",
  BLOQUEADA: "bg-[#111111] hover:bg-[#1F1F1F] text-white",
};

/** Metadatos visuales por mesa, derivados del catálogo + zona en BD. */
interface MesaMeta {
  forma: FormaMesa;
  colorZona: string;
  capacidadMin: number;
  capacidadMax: number;
  zonaId: string;
}

// Alias local del badge centralizado (importado desde data/reservas) para
// no romper los call sites que ya leen `reservaColor[r.estado]`.
const reservaColor = ESTADO_BADGE_CLASS;

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
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", ESTADO_DOT_CLASS[estado])} />
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

// Selector rápido compartido entre la fila de lista y la mesa del plano.
// Header con info de mesa/reserva, "Nueva" (pre-asociada a la mesa), "Editar"
// (abre la ficha completa) y 7 acciones rápidas.
function ReservaQuickPopover({
  mesa,
  reserva,
  onNueva,
  onEditar,
  onCambiarEstado,
  onAccionPendiente,
}: {
  mesa: Mesa | null;
  reserva: Reserva | null;
  onNueva: () => void;
  onEditar: () => void;
  onCambiarEstado: (id: string, estado: EstadoReserva) => void;
  onAccionPendiente: (label: string) => void;
}) {
  type AccionRapida =
    | { tipo: "estado"; key: string; estado: EstadoReserva; label: string }
    | { tipo: "pendiente"; key: string; label: string };

  const acciones: AccionRapida[] = [
    { tipo: "estado", key: "TERMINANDO", estado: "TERMINANDO", label: "Terminando" },
    { tipo: "estado", key: "LIBERADA", estado: "LIBERADA", label: "Liberada" },
    { tipo: "estado", key: "CANCELADA", estado: "CANCELADA", label: "Cancelada" },
    { tipo: "estado", key: "NO_SHOW", estado: "NO_SHOW", label: "No show" },
    { tipo: "pendiente", key: "BLOQUEAR", label: "Bloquear" },
    { tipo: "pendiente", key: "DESPLAZAR", label: "Desplazar" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-bold text-sm">
          {mesa ? `Mesa ${mesa.codigo}` : "Sin mesa asignada"}
        </h4>
        {mesa && (
          <Badge variant="outline" className="text-[10px]">
            {mesa.zona ? ZONAS_LABELS[mesa.zona] : mesa.zona} · {mesa.capacidad}p
          </Badge>
        )}
      </div>
      {reserva ? (
        <div className="border rounded-md px-2 py-1.5 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-xs truncate">
              {reserva.cliente || "WALK IN"} {reserva.apellidos}
            </span>
            <Badge className={cn("text-[9px]", reservaColor[reserva.estado])} variant="outline">
              {ESTADO_RESERVA_LABELS[reserva.estado]}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {reserva.hora} · {reserva.comensales} pax
          </p>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground py-1">Mesa libre</div>
      )}
      <div className="grid grid-cols-2 gap-1">
        <Button size="sm" className="h-7 text-[11px]" onClick={onNueva}>
          <Plus className="h-3 w-3 mr-1" />Nueva
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          disabled={!reserva}
          onClick={onEditar}
        >
          Editar
        </Button>
      </div>
      {reserva && (
        <div className="grid grid-cols-3 gap-1 pt-1 border-t">
          {acciones.map((a) => (
            <Button
              key={a.key}
              size="sm"
              variant="outline"
              className={cn(
                "h-7 text-[10px] px-1.5 justify-center gap-1",
                a.tipo === "estado" && reserva.estado === a.estado && "ring-1 ring-primary",
              )}
              onClick={() => {
                if (a.tipo === "estado") onCambiarEstado(reserva.id, a.estado);
                else onAccionPendiente(a.label);
              }}
            >
              {a.tipo === "estado" && <ReservaEstadoDot estado={a.estado} className="w-2 h-2" />}
              <span className="truncate">{a.label}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function NuevaReservaForm({ fecha, turno, onClose, onSave, mesaPreseleccionada, planos, planoSalas, zonasReales, mesas, posicionesPlano, getEstadoMesa }: {
  fecha: string; turno: TurnoReserva;
  onClose: () => void;
  mesaPreseleccionada?: Mesa | null;
  planos: PlanoConfig[];
  planoSalas: Record<string, string[]>;
  zonasReales: ZonaReal[];
  mesas: Mesa[];
  posicionesPlano: Map<string, PlanoMesaPosicion>;
  getEstadoMesa: (m: Mesa) => string;
  onSave: (r: Reserva & {
    etiquetaId?: string | null;
    tipoCategoria?: TipoReservaCategoria | null;
    politicaCancelacionId?: string | null;
    garantiaImporte?: number | null;
    importePagado?: number | null;
    duracionMinutos?: number | null;
    notificarEmail?: boolean;
    codigoCupon?: string | null;
  }) => void;
}) {
  const [form, setForm] = useState({
    cliente: "", apellidos: "", telefono: "", email: "",
    fecha, hora: "", turno,
    comensales: mesaPreseleccionada ? Math.min(mesaPreseleccionada.capacidad, Math.max(2, mesaPreseleccionada.capacidad)) : 2,
    zona: (mesaPreseleccionada?.zona ?? "") as ZonaSala | "",
    mesaId: (mesaPreseleccionada?.id ?? "") as string,
    observaciones: "", esWalkIn: false,
    etiquetaId: "" as string,
    tipoCategoria: "gratis" as TipoReservaCategoria | "",
    politicaCancelacionId: "" as string,
    garantiaImporte: "" as string,
    importePagado: "" as string,
    /** Si el usuario tocó la duración → guarda override; vacío = default empresa. */
    duracionMinutos: "" as string,
    duracionTouched: false as boolean,
    notificarEmail: true,
    codigoCupon: "" as string,
  });
  const [cuponValido, setCuponValido] = useState<boolean | null>(null);
  const [etiquetas, setEtiquetas] = useState<ReservaEtiqueta[]>([]);
  const [politicas, setPoliticas] = useState<PoliticaCancelacion[]>([]);
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [reglas, setReglas] = useState<EmpresaReservasRegla[]>([]);
  const [paxTouched, setPaxTouched] = useState(false);

  // Autocompletado de clientes por nombre, apellidos o teléfono (4+ chars).
  type CampoBusqueda = "cliente" | "apellidos" | "telefono";
  const [campoActivo, setCampoActivo] = useState<CampoBusqueda | null>(null);
  const [sugerencias, setSugerencias] = useState<ClienteSugerencia[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, p, c, e] = await Promise.all([
        listReservaEtiquetas({ soloActivos: true }),
        listPoliticasCancelacion({ soloActivas: true }),
        getReservasConfig(),
        listReglasReservas(),
      ]);
      if (t.ok) setEtiquetas(t.data);
      if (p.ok) setPoliticas(p.data);
      if (c.ok) {
        setConfig(c.data);
        // Default visible para duración (sin marcar override hasta que el usuario lo edite)
        setForm((prev) => prev.duracionTouched || !c.data
          ? prev
          : { ...prev, duracionMinutos: String(c.data.duracionReservaMin) });
      }
      if (e.ok) setReglas(e.data);
    })();
  }, [form.fecha]);

  useEffect(() => {
    if (form.esWalkIn || !campoActivo) {
      setSugerencias([]);
      return;
    }
    const valor =
      campoActivo === "cliente"
        ? form.cliente
        : campoActivo === "apellidos"
          ? form.apellidos
          : form.telefono;
    const minimo = campoActivo === "telefono" ? 4 : 4;
    if ((valor ?? "").trim().length < minimo) {
      setSugerencias([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const handle = setTimeout(async () => {
      const res = await searchClientes(valor.trim(), 8);
      if (cancelado) return;
      setSugerencias(res.ok ? res.data : []);
      setBuscando(false);
    }, 200);
    return () => {
      cancelado = true;
      clearTimeout(handle);
    };
  }, [form.cliente, form.apellidos, form.telefono, form.esWalkIn, campoActivo]);

  const maxPax = useMemo(
    () => maxpaxEfectivoDesdeReglas(reglas, form.fecha, form.turno),
    [reglas, form.fecha, form.turno],
  );

  const excedeMaxPax = maxPax != null && form.comensales > maxPax;
  const muestraAvisoPax = paxTouched && excedeMaxPax;

  // Zonas disponibles según el plano vigente del día/turno seleccionado.
  // El plano se resuelve por cascada (fechas extra → rango → día semana → principal).
  // Si el plano vigente solo activa unas salas, solo se muestran sus zonas:
  // no se puede reservar en una zona que ese día no existe.
  const zonasDisponibles = useMemo<{ value: string; label: string }[]>(() => {
    if (!form.fecha || (form.turno !== "COMIDA" && form.turno !== "CENA")) {
      return [];
    }
    const planoVigente = pickPlanoVigente(planos, form.fecha, form.turno);
    if (!planoVigente) return [];
    const salaIds = new Set(planoSalas[planoVigente.id] ?? []);
    if (salaIds.size === 0) return [];
    const vistas = new Set<string>();
    const out: { value: string; label: string }[] = [];
    for (const z of zonasReales) {
      if (!salaIds.has(z.salaId)) continue;
      const key = z.nombre.toUpperCase();
      if (vistas.has(key)) continue;
      vistas.add(key);
      out.push({ value: key, label: z.nombre });
    }
    return out;
  }, [form.fecha, form.turno, planos, planoSalas, zonasReales]);

  // La zona elegida deja de existir en el plano vigente del día/turno.
  // No se resetea automáticamente: se avisa al usuario y se bloquea guardar
  // hasta que cambie la zona (a "Cualquiera" u otra disponible).
  const zonaNoDisponible = useMemo(() => {
    if (!form.zona) return false;
    return !zonasDisponibles.some((z) => z.value === form.zona);
  }, [zonasDisponibles, form.zona]);

  // Mesas seleccionables: solo las del plano vigente (las que tienen posición).
  // Si hay zona elegida, se filtran a esa zona. La pre-asignada siempre aparece.
  const mesasSeleccionables = useMemo(() => {
    const zonasOK = new Set(zonasDisponibles.map((z) => z.value));
    return mesas
      .filter((m) => posicionesPlano.has(m.id))
      .filter((m) => zonasOK.size === 0 || zonasOK.has(String(m.zona)))
      .filter((m) => !form.zona || m.zona === form.zona)
      .sort((a, b) => {
        const za = String(a.zona);
        const zb = String(b.zona);
        if (za !== zb) return za.localeCompare(zb);
        return a.codigo.localeCompare(b.codigo, undefined, { numeric: true });
      });
  }, [mesas, posicionesPlano, zonasDisponibles, form.zona]);

  const mesasPorZona = useMemo(() => {
    const m = new Map<string, Mesa[]>();
    for (const x of mesasSeleccionables) {
      const k = String(x.zona) || "—";
      const arr = m.get(k);
      if (arr) arr.push(x);
      else m.set(k, [x]);
    }
    return m;
  }, [mesasSeleccionables]);

  // Al elegir mesa, auto-completar zona; si vacía, se respeta la zona actual.
  const elegirMesa = (mesaId: string) => {
    const m = mesas.find((x) => x.id === mesaId);
    setForm((p) => ({
      ...p,
      mesaId,
      zona: m?.zona ? (String(m.zona) as ZonaSala) : p.zona,
      comensales: m ? Math.max(p.comensales, Math.min(m.capacidad, m.capacidad)) : p.comensales,
    }));
  };

  // Si cambia la zona y la mesa elegida ya no encaja, limpiamos la mesa.
  useEffect(() => {
    if (!form.mesaId) return;
    const m = mesas.find((x) => x.id === form.mesaId);
    if (!m) return;
    if (form.zona && m.zona !== form.zona) {
      setForm((p) => ({ ...p, mesaId: "" }));
    }
  }, [form.zona, form.mesaId, mesas]);

  const guardarBloqueado =
    (!form.esWalkIn && !form.cliente) ||
    !form.hora ||
    excedeMaxPax ||
    zonaNoDisponible ||
    cuponValido === false;

  const seleccionarCliente = (c: ClienteSugerencia) => {
    setForm((p) => ({
      ...p,
      cliente: c.nombre ?? "",
      apellidos: c.apellidos ?? "",
      telefono: c.telefono ?? "",
      email: c.email ?? "",
    }));
    setSugerencias([]);
    setCampoActivo(null);
  };

  const handleSave = () => {
    if (guardarBloqueado) return;
    onSave({
      id: `r-${Date.now()}`,
      cliente: form.esWalkIn ? "" : form.cliente,
      apellidos: form.esWalkIn ? "" : form.apellidos,
      telefono: form.esWalkIn ? "" : form.telefono,
      email: form.esWalkIn ? "" : form.email,
      fecha: form.fecha, hora: form.hora, turno: form.turno,
      comensales: form.comensales, zona: form.zona,
      mesaId: form.mesaId || (mesaPreseleccionada?.id ?? ""),
      estado: form.esWalkIn ? "WALK_IN" : "CONFIRMADA",
      observaciones: form.observaciones,
      etiquetaId: form.etiquetaId || null,
      tipoCategoria: (form.tipoCategoria || null) as TipoReservaCategoria | null,
      politicaCancelacionId: form.tipoCategoria === "politica" ? (form.politicaCancelacionId || null) : null,
      garantiaImporte: form.tipoCategoria === "politica" && form.garantiaImporte ? Number(form.garantiaImporte) : null,
      importePagado: form.tipoCategoria === "cupon" && form.importePagado ? Number(form.importePagado) : null,
      // Solo enviamos override si el usuario tocó la duración y es distinta del default.
      // Si no tocó nada, dejamos NULL para usar la default empresa (semántica del campo).
      duracionMinutos: (() => {
        if (!form.duracionTouched) return null;
        const n = Number(form.duracionMinutos);
        if (!Number.isFinite(n) || n <= 0) return null;
        const clamped = Math.min(
          DURACION_RESERVA_MAX_MINUTOS,
          Math.max(DURACION_RESERVA_MIN_MINUTOS, Math.round(n)),
        );
        if (config && clamped === config.duracionReservaMin) return null;
        return clamped;
      })(),
      notificarEmail: form.notificarEmail,
      codigoCupon: form.codigoCupon.trim() ? form.codigoCupon.trim().toUpperCase() : null,
    });
  };

  const renderSugerencias = (campo: CampoBusqueda) => {
    if (campoActivo !== campo || form.esWalkIn) return null;
    if (sugerencias.length === 0 && !buscando) return null;
    return (
      <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
        {buscando && (
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground">Buscando…</div>
        )}
        {!buscando && sugerencias.length === 0 && (
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground">Sin coincidencias</div>
        )}
        {sugerencias.map((c) => (
          <button
            type="button"
            key={c.id}
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => seleccionarCliente(c)}
            className="flex w-full items-start gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted"
          >
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">
                {[c.nombre, c.apellidos].filter(Boolean).join(" ")}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {[c.telefono, c.email].filter(Boolean).join(" · ") || "Sin contacto"}
              </div>
            </div>
            {typeof c.visitas === "number" && c.visitas > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                {c.visitas} visitas
              </Badge>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {mesaPreseleccionada && (
        <div className="rounded-md border border-red-500/60 bg-red-500/5 px-3 py-1.5 text-xs flex items-center justify-between gap-2">
          <span>
            <span className="font-semibold">Mesa pre-asignada:</span>{" "}
            {mesaPreseleccionada.codigo}{" "}
            <span className="text-muted-foreground">
              ({mesaPreseleccionada.capacidad}p
              {mesaPreseleccionada.zona ? ` · ${ZONAS_LABELS[mesaPreseleccionada.zona]}` : ""})
            </span>
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={!form.esWalkIn ? "default" : "outline"}
          className="text-xs h-8"
          onClick={() => setForm((p) => ({ ...p, esWalkIn: false }))}
        >
          Cliente
        </Button>
        <Button
          size="sm"
          variant={form.esWalkIn ? "default" : "outline"}
          className="text-xs h-8"
          onClick={() => setForm((p) => ({ ...p, esWalkIn: true }))}
        >
          Walk-in
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!form.esWalkIn && (
          <>
            <div className="relative">
              <Label className="text-xs">Nombre *</Label>
              <Input
                className="h-8 text-xs"
                value={form.cliente}
                onFocus={() => setCampoActivo("cliente")}
                onBlur={() => setTimeout(() => setCampoActivo((c) => (c === "cliente" ? null : c)), 150)}
                onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))}
              />
              {renderSugerencias("cliente")}
            </div>
            <div className="relative">
              <Label className="text-xs">Apellidos</Label>
              <Input
                className="h-8 text-xs"
                value={form.apellidos}
                onFocus={() => setCampoActivo("apellidos")}
                onBlur={() => setTimeout(() => setCampoActivo((c) => (c === "apellidos" ? null : c)), 150)}
                onChange={e => setForm(p => ({ ...p, apellidos: e.target.value }))}
              />
              {renderSugerencias("apellidos")}
            </div>
            <div className="relative">
              <Label className="text-xs">Teléfono</Label>
              <Input
                className="h-8 text-xs"
                value={form.telefono}
                onFocus={() => setCampoActivo("telefono")}
                onBlur={() => setTimeout(() => setCampoActivo((c) => (c === "telefono" ? null : c)), 150)}
                onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              />
              {renderSugerencias("telefono")}
            </div>
            <div><Label className="text-xs">Email</Label><Input className="h-8 text-xs" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          </>
        )}
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
        <div>
          <Label className="text-xs">
            Duración (min)
            <span className="ml-1 font-normal text-muted-foreground">
              · default {config?.duracionReservaMin ?? "—"}
            </span>
          </Label>
          <Input
            type="number"
            min={DURACION_RESERVA_MIN_MINUTOS}
            max={DURACION_RESERVA_MAX_MINUTOS}
            step={5}
            placeholder={config ? String(config.duracionReservaMin) : ""}
            className="h-8 text-xs"
            value={form.duracionMinutos}
            onChange={(e) =>
              setForm((p) => ({ ...p, duracionMinutos: e.target.value, duracionTouched: true }))
            }
          />
        </div>
        <div className="col-span-2"><Label className="text-xs">Zona</Label>
          <Select value={form.zona || "ANY"} onValueChange={v => setForm(p => ({ ...p, zona: v === "ANY" ? "" : v as ZonaSala }))}>
            <SelectTrigger
              className={cn(
                "h-8 text-xs",
                zonaNoDisponible && "border-amber-500 focus-visible:ring-amber-500",
              )}
            >
              <SelectValue placeholder="Cualquiera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">Cualquiera</SelectItem>
              {zonasDisponibles.map((z) => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}
              {zonaNoDisponible && form.zona && (
                <SelectItem value={form.zona} disabled>
                  {form.zona.charAt(0) + form.zona.slice(1).toLowerCase().replace(/_/g, " ")} (no disponible)
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {zonaNoDisponible && (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
              La zona seleccionada no está disponible para esta fecha y turno. Cámbiala para poder guardar la reserva.
            </p>
          )}
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Mesa</Label>
          <select
            value={form.mesaId}
            onChange={(e) => elegirMesa(e.target.value)}
            className="h-8 text-xs w-full rounded-md border border-input bg-background px-2"
          >
            <option value="">— Sin asignar —</option>
            {Array.from(mesasPorZona.entries()).map(([zNombre, ms]) => (
              <optgroup key={zNombre} label={zNombre}>
                {ms.map((m) => {
                  const est = getEstadoMesa(m);
                  const tag =
                    est === "LIBRE" ? "Libre" :
                    est === "OCUPADA" ? "Sentada" :
                    est === "RESERVADA" ? "Reservada" :
                    est === "BLOQUEADA" ? "Bloqueada" : "";
                  return (
                    <option key={m.id} value={m.id}>
                      {m.codigo} · {m.capacidad}p · {tag}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          {form.mesaId ? (
            <p className="text-[10px] text-muted-foreground truncate">
              {(() => {
                const m = mesas.find((x) => x.id === form.mesaId);
                if (!m) return null;
                return (
                  <>
                    <span className="font-semibold">{m.codigo}</span>{" "}
                    <span>· {m.capacidad}p · {String(m.zona)}</span>
                  </>
                );
              })()}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Sin mesa asignada — el sistema la elegirá al sentar al cliente.
            </p>
          )}
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Etiqueta de reserva</Label>
          {/* Select nativo: evitar Popover+cmdk dentro de Dialog (MEMORY: combobox_dentro_dialog). */}
          <select
            value={form.etiquetaId}
            onChange={(e) => setForm((p) => ({ ...p, etiquetaId: e.target.value }))}
            className="h-8 text-xs w-full rounded-md border border-input bg-background px-2"
          >
            <option value="">— Sin etiqueta —</option>
            {etiquetas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.emoji ? `${t.emoji} ` : ""}{t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Tipo de reserva</Label>
          <select
            value={form.tipoCategoria}
            onChange={(e) => {
              const nuevoTipo = e.target.value as TipoReservaCategoria | "";
              const incompatibleConCupon = nuevoTipo === "gratis" || nuevoTipo === "ticket";
              setForm((p) => ({
                ...p,
                tipoCategoria: nuevoTipo,
                // Limpia los campos que dejan de aplicar al cambiar de tipo.
                politicaCancelacionId: nuevoTipo === "politica" ? p.politicaCancelacionId : "",
                garantiaImporte: nuevoTipo === "politica" ? p.garantiaImporte : "",
                importePagado: nuevoTipo === "cupon" ? p.importePagado : "",
                // Si el tipo es incompatible con cupón, limpia el código.
                codigoCupon: incompatibleConCupon ? "" : p.codigoCupon,
              }));
              if (incompatibleConCupon) setCuponValido(null);
            }}
            className="h-8 text-xs w-full rounded-md border border-input bg-background px-2"
          >
            <option value="">— Sin tipo —</option>
            <option value="gratis">{TIPO_RESERVA_CATEGORIA_LABELS.gratis}</option>
            <option value="politica">{TIPO_RESERVA_CATEGORIA_LABELS.politica}</option>
            <option value="cupon">{TIPO_RESERVA_CATEGORIA_LABELS.cupon}</option>
          </select>
        </div>
        {form.tipoCategoria === "politica" && (
          <>
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
              <Label className="text-xs">Importe retenido (€)</Label>
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
          </>
        )}
        {form.tipoCategoria === "cupon" && (
          <div className="col-span-2">
            <Label className="text-xs">Importe pagado por adelantado (€)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-8 text-xs"
              placeholder="0,00"
              value={form.importePagado}
              onChange={(e) => setForm((p) => ({ ...p, importePagado: e.target.value }))}
            />
          </div>
        )}
        {/* Cupón NO coexiste con 'gratis' ni con 'ticket' (son tipos distintos). */}
        {form.tipoCategoria !== "gratis" && form.tipoCategoria !== "ticket" && (
          <div className="col-span-2">
            <CuponInputReserva
              value={form.codigoCupon}
              onChange={(v) => setForm((p) => ({ ...p, codigoCupon: v }))}
              validar={(codigo) => validarCuponAdminAction({
                codigo,
                fecha: form.fecha,
                turno: form.turno === "DIA_COMPLETO" ? null : (form.turno as "COMIDA" | "CENA"),
              })}
              contextoSerial={`${form.fecha}|${form.turno}|${form.comensales}`}
              onResult={(r) => setCuponValido(r === null ? null : r.ok)}
            />
          </div>
        )}
      </div>

      {muestraAvisoPax && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Supera el máximo de {maxPax} pax del turno {form.turno.toLowerCase()} del {form.fecha}.
        </div>
      )}

      <div><Label className="text-xs">Observaciones</Label><Textarea className="text-xs" value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} /></div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          className={cn(
            "flex items-center gap-2 text-xs select-none",
            (form.esWalkIn || !form.email.trim()) && "opacity-50",
          )}
          title={
            form.esWalkIn
              ? "No aplica en walk-in"
              : !form.email.trim()
                ? "Añade el email del cliente para notificarle"
                : undefined
          }
        >
          <Checkbox
            checked={form.notificarEmail}
            onCheckedChange={(v) =>
              setForm((p) => ({ ...p, notificarEmail: v === true }))
            }
            disabled={form.esWalkIn || !form.email.trim()}
          />
          Notificar al cliente por email
        </label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={guardarBloqueado}>Reservar</Button>
        </div>
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
    estado: (row.estado as EstadoReserva) ?? "CONFIRMADA",
    observaciones: (row.notas as string) ?? (row.observaciones as string) ?? "",
    clienteId: (row.cliente_id as string | null) ?? null,
    origen: (row.origen as string | null) ?? null,
    tarjetaIntroducida: (row.tarjeta_introducida as boolean) ?? false,
    esTicket: (row.es_ticket as boolean) ?? false,
    tipoCategoria: (row.tipo_categoria as TipoReservaCategoria | null) ?? null,
    politicaCancelacionId: (row.politica_cancelacion_id as string | null) ?? null,
    garantiaImporte: (row.garantia_importe as number | null) ?? null,
    importePagado: (row.importe_pagado as number | null) ?? null,
    ticketProductoId: (row.ticket_producto_id as string | null) ?? null,
    ticketUnidades: (row.ticket_unidades as number | null) ?? null,
    ticketImporte: (row.ticket_importe as number | null) ?? null,
    ticketIva: (row.ticket_iva as number | null) ?? null,
    pagoPendiente: (row.pago_pendiente as boolean) ?? false,
    bloqueada: (row.bloqueada as boolean) ?? false,
    grupoId: (row.grupo_id as string | null) ?? null,
    etiquetaId: (row.etiqueta_id as string | null) ?? null,
    codigoId: (row.codigo_id as string | null) ?? null,
    codigo: (row.codigo as string | null) ?? null,
    reconfirmadaAt: (row.reconfirmada_at as string | null) ?? null,
    externalId: (row.external_id as string | null) ?? null,
    externalOrigen: (row.external_origen as string | null) ?? null,
    duracionMinutos: (row.duracion_minutos as number | null) ?? null,
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

function FiltroLocalesDropdown({
  locales,
  localActualId,
  onSelect,
}: {
  locales: LocalMin[];
  localActualId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 px-2.5">
          <ListFilter className="h-3.5 w-3.5" />
          Locales
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Locales
          </span>
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-0.5">
          {locales.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground italic text-center">
              No hay locales
            </p>
          ) : (
            locales.map((l) => {
              const checked = l.id === localActualId;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onSelect(l.id)}
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
                  <span className="truncate flex-1">{l.nombre}</span>
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

/** Dimensiones por defecto. Coinciden con SalaPlanoEditor. */
const PLANO_MESA_SIZE = 60;
const PLANO_MESA_RECT_W = 84;
const PLANO_MESA_RECT_H = 48;

function getPlanoMesaDims(forma: FormaMesa, pos?: PlanoMesaPosicion | null) {
  const defW = forma === "rectangular" ? PLANO_MESA_RECT_W : PLANO_MESA_SIZE;
  const defH = forma === "rectangular" ? PLANO_MESA_RECT_H : PLANO_MESA_SIZE;
  return {
    w: pos?.width != null ? Number(pos.width) : defW,
    h: pos?.height != null ? Number(pos.height) : defH,
  };
}
// Tamaño estándar del lienzo de una sala — debe coincidir con el editor (SalaPlanoEditor).
// No se expande para "encajar" mesas: si quedan fuera por coordenadas viejas se clampean al borde.
const PLANO_CANVAS_W = 1200;
const PLANO_CANVAS_H = 640;

function PlanoCanvas({
  mesas,
  posiciones,
  mesasMeta,
  zonas,
  decoraciones,
  salaTieneZonas,
  selectedMesaId,
  selectedReservaMesaId,
  onSelectMesa,
  getEstadoMesa,
  getReservasMesa,
  onNueva,
  onEditar,
  onCambiarEstado,
  onAccionPendiente,
  onQuitarBloqueoMesa,
}: {
  mesas: Mesa[];
  posiciones: Map<string, PlanoMesaPosicion>;
  mesasMeta: Map<string, MesaMeta>;
  zonas: ZonaReal[];
  decoraciones: SalaDecoracion[];
  salaTieneZonas: boolean;
  selectedMesaId: string | null;
  selectedReservaMesaId: string | null;
  onSelectMesa: (m: Mesa | null) => void;
  getEstadoMesa: (m: Mesa) => string;
  getReservasMesa: (mesaId: string) => Reserva[];
  onNueva: (m: Mesa) => void;
  onEditar: (r: Reserva) => void;
  onCambiarEstado: (id: string, e: EstadoReserva) => void;
  onAccionPendiente: (label: string) => void;
  /** Si la mesa está BLOQUEADA y se pulsa, levanta el bloqueo solo para (fecha, turno). */
  onQuitarBloqueoMesa?: (m: Mesa) => void;
}) {
  // Mesas con posición x/y conocida.
  // Si la sala tiene zonas en BD: filtra estrictamente por las seleccionadas (zonas=[] => no muestra nada, como espera el usuario al pulsar "Ninguna").
  // Si la sala no tiene zonas en BD (legacy): muestra todas las mesas posicionadas.
  const mesasConPos = useMemo(() => {
    const zonaNombres = new Set(zonas.map((z) => z.nombre.toUpperCase()));
    return mesas
      .filter((m) => posiciones.has(m.id))
      .filter((m) => !salaTieneZonas || zonaNombres.has((m.zona as unknown as string) ?? ""));
  }, [mesas, posiciones, zonas, salaTieneZonas]);

  // Autoescala el lienzo 1200x640 para llenar el contenedor visible.
  // El plano se dimensiona como si el sidebar global estuviera colapsado (su
  // estado "natural"). Si el sidebar se expande — empujando el contenido —
  // sumamos esa diferencia al ancho efectivo para que la escala no se reduzca:
  // el plano conserva el tamaño y el menú simplemente tapa su lado izquierdo.
  const { state: sidebarState } = useSidebar();
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      // 16rem (expandido) − 3rem (colapsado/icon) ≈ 208 px de diferencia.
      const SIDEBAR_EXPAND_DIFF = 208;
      const effectiveW = w + (sidebarState === "expanded" ? SIDEBAR_EXPAND_DIFF : 0);
      const s = Math.min(effectiveW / PLANO_CANVAS_W, h / PLANO_CANVAS_H);
      setScale(s > 0 ? s : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sidebarState]);

  // Encuadra una posición dentro del lienzo estándar (mismas bounds que el editor).
  // Recibe las dimensiones reales de la mesa para que las rectangulares no se
  // recorten en el borde derecho/inferior.
  const clampPos = (x: number, y: number, w: number, h: number) => ({
    x: Math.max(0, Math.min(PLANO_CANVAS_W - w, x)),
    y: Math.max(0, Math.min(PLANO_CANVAS_H - h, y)),
  });

  // Etiquetas de zona:
  // - Si la zona tiene posición guardada en BD (etiquetaX/etiquetaY) y al menos una mesa
  //   de esa zona está colocada → se usa esa posición exacta del editor.
  // - Si no hay posición guardada (planos antiguos) → fallback al cálculo automático
  //   sobre la mesa más arriba-izquierda.
  const labelsZonas = useMemo(() => {
    const labels: { id: string; nombre: string; color: string; x: number; y: number }[] = [];
    for (const z of zonas) {
      const mesasZona = mesasConPos.filter(
        (m) => (m.zona as unknown as string)?.toUpperCase() === z.nombre.toUpperCase(),
      );
      if (mesasZona.length === 0) continue;
      if (z.etiquetaX != null && z.etiquetaY != null) {
        labels.push({
          id: z.id,
          nombre: z.nombre,
          color: z.colorPastel,
          x: z.etiquetaX,
          y: z.etiquetaY,
        });
        continue;
      }
      let minX = Infinity, minY = Infinity;
      for (const m of mesasZona) {
        const pos = posiciones.get(m.id)!;
        const meta = mesasMeta.get(m.id);
        const dims = getPlanoMesaDims(meta?.forma ?? "cuadrada", pos);
        const c = clampPos(pos.x, pos.y, dims.w, dims.h);
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
      }
      labels.push({ id: z.id, nombre: z.nombre, color: z.colorPastel, x: minX, y: minY - 30 });
    }
    return labels;
  }, [zonas, mesasConPos, posiciones, mesasMeta]);

  if (mesasConPos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground italic p-4 text-center">
        No hay mesas posicionadas para mostrar. Entra a Configuración → Estructura → Editar layout.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden py-3 bg-white dark:bg-white min-h-0">
      <div
        ref={outerRef}
        className={cn(
          "flex-1 flex items-center overflow-hidden min-h-0",
          // Cuando el sidebar está expandido el lienzo conserva su tamaño y
          // sobresale por la izquierda: anclamos a la derecha para que el
          // recorte caiga bajo el menú en lugar de partir el plano por el centro.
          sidebarState === "expanded" ? "justify-end" : "justify-center",
        )}
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
        {decoraciones.map((d) => (
          <div
            key={d.id}
            className="absolute pointer-events-none select-none"
            style={{
              left: Math.max(0, Math.min(PLANO_CANVAS_W - d.width, d.x)),
              top: Math.max(0, Math.min(PLANO_CANVAS_H - d.height, d.y)),
              width: d.width,
              height: d.height,
              transform: `rotate(${d.rotation}deg)`,
              transformOrigin: "center",
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
        {labelsZonas.map((l) => (
          <span
            key={l.id}
            className="absolute px-2 py-0.5 rounded text-[11px] font-bold tracking-wide text-zinc-800 shadow-sm pointer-events-none"
            style={{ left: l.x, top: Math.max(8, l.y), backgroundColor: lightenHex(l.color, ZONA_LIGHTEN) }}
          >
            {l.nombre}
          </span>
        ))}
        {mesasConPos.map((m) => {
          const pos = posiciones.get(m.id)!;
          const meta = mesasMeta.get(m.id);
          const forma: FormaMesa = meta?.forma ?? "cuadrada";
          const dims = getPlanoMesaDims(forma, pos);
          const c = clampPos(pos.x, pos.y, dims.w, dims.h);
          const estado = getEstadoMesa(m);
          const rs = getReservasMesa(m.id);
          const firstR = rs[0];
          const isWalkIn = firstR?.estado === "WALK_IN";
          const isLibre = estado === "LIBRE";
          const radius = forma === "redonda" ? 9999 : 6;
          return (
            <Popover key={m.id}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "absolute flex flex-col items-center justify-center text-[11px] font-semibold shadow-md border-2 transition-all cursor-pointer px-1 overflow-hidden",
                    mesaBg[estado] ?? "",
                    isLibre ? "text-foreground border-foreground/40" : "border-white/10",
                    (selectedReservaMesaId === m.id || selectedMesaId === m.id) && "ring-4 ring-red-500 z-10",
                  )}
                  style={{
                    left: c.x,
                    top: c.y,
                    width: dims.w,
                    height: dims.h,
                    borderRadius: radius,
                    backgroundColor: isLibre ? lightenHex(meta?.colorZona ?? "#FDE68A", ZONA_LIGHTEN) : undefined,
                    transform: pos.rotation ? `rotate(${pos.rotation}deg)` : undefined,
                  }}
                  onClick={() => onSelectMesa(m)}
                >
                  {/* Contra-rotación para mantener el texto legible aunque la mesa esté girada. */}
                  <div
                    className="flex flex-col items-center justify-center leading-tight pointer-events-none"
                    style={pos.rotation ? { transform: `rotate(${-pos.rotation}deg)` } : undefined}
                  >
                    <span className="leading-none">{m.codigo}</span>
                    <span className={cn("text-[9px] font-normal mt-0.5", isLibre ? "text-foreground/70" : "opacity-80")}>
                      ({m.capacidad}p)
                    </span>
                    {firstR && (
                      <span className={cn("text-[9px] font-normal mt-0.5 truncate max-w-full", isLibre ? "text-foreground/80" : "opacity-90")}>
                        {firstR.hora}
                      </span>
                    )}
                    {firstR && (
                      <span className={cn("text-[9px] font-normal truncate max-w-full", isLibre ? "text-foreground/80" : "opacity-90")}>
                        {isWalkIn ? "WALK IN" : firstR.cliente}
                      </span>
                    )}
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3">
                {estado === "BLOQUEADA" && onQuitarBloqueoMesa ? (
                  <div className="space-y-2">
                    <h4 className="font-bold text-sm">Mesa {m.codigo}</h4>
                    <p className="text-xs text-muted-foreground">
                      Bloqueada para este turno.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs"
                      onClick={() => onQuitarBloqueoMesa(m)}
                    >
                      Desbloquear
                    </Button>
                  </div>
                ) : (
                  <ReservaQuickPopover
                    mesa={m}
                    reserva={rs[0] ?? null}
                    onNueva={() => onNueva(m)}
                    onEditar={() => { if (rs[0]) onEditar(rs[0]); }}
                    onCambiarEstado={onCambiarEstado}
                    onAccionPendiente={onAccionPendiente}
                  />
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
      </div>
      </div>
      <div className="flex items-center gap-4 pt-3 text-[10px] text-muted-foreground justify-center flex-wrap">
        {Object.entries(mesaBg).map(([k, cls]) => {
          const isLibre = k === "LIBRE";
          return (
            <span key={k} className="flex items-center gap-1.5">
              <span
                className={cn("w-3 h-3 rounded", !isLibre && cls)}
                style={
                  isLibre
                    ? { background: LIBRE_RAINBOW }
                    : undefined
                }
              />
              {ESTADO_MESA_LABELS[k as keyof typeof ESTADO_MESA_LABELS]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ReservasView() {
  const { empresaActual } = useEmpresa();
  const [mesas, setMesas] = useState<Mesa[]>(SAMPLE_MESAS);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [, setLoading] = useState(true);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [turno, setTurno] = useState<TurnoReserva>("CENA");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstados, setFiltroEstados] = useState<EstadoReserva[]>(ESTADOS_RESERVA);
  const [filtroOrigen, setFiltroOrigen] = useState<string>("TODOS");
  const [cfgReservas, setCfgReservas] = useState<EmpresaReservasConfig | null>(null);
  // El usuario ha tocado el filtro de estados al menos una vez → no aplicamos la
  // preferencia "ocultar canceladas" automáticamente sobre su selección.
  const filtroEstadosTouched = useRef(false);
  const [tickAhora, setTickAhora] = useState(() => Date.now());
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [showNueva, setShowNueva] = useState(false);
  const [showListaEspera, setShowListaEspera] = useState(false);
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null);
  const [showDetalleReserva, setShowDetalleReserva] = useState(false);
  const [selectedInsights, setSelectedInsights] = useState<ClienteInsights | null>(null);
  const [vista, setVista] = useState<"dia" | "mes">("dia");
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [etiquetasReserva, setEtiquetasReserva] = useState<ReservaEtiqueta[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [totalesMes, setTotalesMes] = useState<{ personas: number; reservas: number }>({ personas: 0, reservas: 0 });
  const [locales, setLocales] = useState<LocalMin[]>([]);
  const [localId, setLocalId] = useState<string>("");
  const [salasLocal, setSalasLocal] = useState<SalaConfig[]>([]);
  const [salaActualId, setSalaActualId] = useState<string>("");
  const [navDirSala, setNavDirSala] = useState<1 | -1>(1);
  const [planosLocal, setPlanosLocal] = useState<PlanoConfig[]>([]);
  const [planoActualId, setPlanoActualId] = useState<string>("");
  const [planoSalas, setPlanoSalas] = useState<Record<string, string[]>>({});
  const [zonasReales, setZonasReales] = useState<ZonaReal[]>([]);
  const [posicionesPlano, setPosicionesPlano] = useState<Map<string, PlanoMesaPosicion>>(new Map());
  const [decoracionesPlano, setDecoracionesPlano] = useState<SalaDecoracion[]>([]);
  const [mesasMeta, setMesasMeta] = useState<Map<string, MesaMeta>>(new Map());
  const [posicionesRefresh, setPosicionesRefresh] = useState(0);
  const [zonaIdsSel, setZonaIdsSel] = useState<string[]>(ZONAS_SALA);
  // Permite ocultar el listado de reservas o el mapa para que el otro ocupe todo el ancho.
  const [panelOculto, setPanelOculto] = useState<"ninguno" | "lista" | "mapa">("ninguno");
  // Vista del panel derecho: "mapa" (plano editor) o "listado" (zonas agrupadas, vista común a todas las empresas).
  const [vistaPlano, setVistaPlano] = useState<"mapa" | "listado">("mapa");
  // Por defecto, al cambiar de sala se elige automáticamente la vista que mejor encaja:
  // si la sala tiene posiciones de plano → "mapa"; si no → "listado". El click del usuario manda después.
  useEffect(() => {
    const tienePlano =
      posicionesPlano.size > 0 && mesasActivas.some((m) => posicionesPlano.has(m.id));
    setVistaPlano(tienePlano ? "mapa" : "listado");
    // Solo al cambiar de sala recalculamos; los toggles manuales no deben reiniciarse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaActualId]);

  // Bulk load: TODO el contexto inicial (locales, salas, planos, zonas, mesas,
  // posiciones del plano activo, etiquetas de reserva) en una sola server action
  // que internamente paraleliza con Promise.all. Reemplaza 6 useEffects en
  // cascada por uno solo: ~6 round-trips secuenciales → ~1 RTT efectivo.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Si ya hay localId seleccionado (el usuario cambió de local en el
      // dropdown), lo pasamos como override; si no, se elige el primero.
      const ctx = await loadReservasModuleContext(localId || undefined);
      if (cancelled) return;
      const d = ctx.data;
      setLocales(d.locales);
      if (!localId) setLocalId(d.localId);
      setSalasLocal(d.salas);
      const salaPrincipal = d.salas.find((s) => s.esPrincipal) ?? d.salas[0];
      setSalaActualId(salaPrincipal?.id ?? "");
      setPlanosLocal(d.planos);
      setPlanoSalas(d.planoSalas);
      const planoPrincipal = d.planos.find((p) => p.esPrincipal) ?? d.planos[0];
      setPlanoActualId(planoPrincipal?.id ?? "");
      setZonasReales(d.zonas);
      setEtiquetasReserva(d.etiquetas);
      const zonaNombrePorId = new Map<string, string>();
      const zonaColorPorId = new Map<string, string>();
      d.zonas.forEach((z) => {
        zonaNombrePorId.set(z.id, z.nombre.toUpperCase());
        zonaColorPorId.set(z.id, z.colorPastel);
      });
      const adaptadas: Mesa[] = d.mesas
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
      const meta = new Map<string, MesaMeta>();
      for (const m of d.mesas) {
        if (!m.activa) continue;
        meta.set(m.id, {
          forma: m.forma,
          colorZona: zonaColorPorId.get(m.zonaId) ?? "#FDE68A",
          capacidadMin: m.capacidadMin,
          capacidadMax: m.capacidadMax,
          zonaId: m.zonaId,
        });
      }
      setMesasMeta(meta);
      const next = new Map<string, PlanoMesaPosicion>();
      for (const p of d.posiciones) next.set(p.mesaId, p);
      setPosicionesPlano(next);
      setDecoracionesPlano(d.decoraciones);
    })();
    return () => { cancelled = true; };
  }, [empresaActual.id, localId, posicionesRefresh]);

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

  const decoracionesSalaActual = useMemo(
    () => decoracionesPlano.filter((d) => d.salaId === salaActualId),
    [decoracionesPlano, salaActualId],
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

  // Bloqueos del local (Config → Bloqueos). Se cargan al cambiar de local y se
  // filtran client-side por fecha + turno para sacar las mesas que están
  // bloqueadas hoy. Las zonas se expanden a sus mesas.
  const [bloqueosLocal, setBloqueosLocal] = useState<ReservaBloqueo[]>([]);
  const [bloqueoExcepciones, setBloqueoExcepciones] = useState<BloqueoExcepcion[]>([]);
  const [bloqueosRefresh, setBloqueosRefresh] = useState(0);
  useEffect(() => {
    if (!localId) {
      setBloqueosLocal([]);
      setBloqueoExcepciones([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [r, ex] = await Promise.all([
        listBloqueos(localId),
        listBloqueoExcepciones(localId),
      ]);
      if (cancelled) return;
      setBloqueosLocal(r.ok ? r.data : []);
      setBloqueoExcepciones(ex.ok ? ex.data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [localId, posicionesRefresh, bloqueosRefresh]);

  const mesasBloqueadasIds = useMemo(() => {
    const ids = new Set<string>();
    if (bloqueosLocal.length === 0) return ids;
    const turnoActual: "COMIDA" | "CENA" | null =
      turno === "COMIDA" || turno === "CENA" ? turno : null;
    for (const b of bloqueosLocal) {
      if (!vigenciaAplicaEnFecha(b, fecha)) continue;
      if (b.turno !== "AMBOS" && turnoActual && b.turno !== turnoActual) continue;
      for (const mid of b.mesaIds) ids.add(mid);
      if (b.zonaIds.length > 0) {
        const setZ = new Set(b.zonaIds);
        for (const [mesaId, m] of mesasMeta.entries()) {
          if (setZ.has(m.zonaId)) ids.add(mesaId);
        }
      }
    }
    // Restamos excepciones puntuales: una mesa con excepción para esta
    // (fecha, turno) deja de estar bloqueada solo ese día/turno.
    for (const e of bloqueoExcepciones) {
      if (e.fecha !== fecha) continue;
      if (turnoActual && e.turno !== turnoActual) continue;
      ids.delete(e.mesaId);
    }
    return ids;
  }, [bloqueosLocal, bloqueoExcepciones, fecha, turno, mesasMeta]);

  // Config de reservas (preferencias del motor: ocultar canceladas, parpadeo,
  // duración por defecto…). Se recarga al volver al view.
  useEffect(() => {
    (async () => {
      const c = await getReservasConfig();
      if (c.ok && c.data) setCfgReservas(c.data);
    })();
  }, []);

  // Si `ocultarCanceladas` está activo y el usuario aún no ha tocado el filtro,
  // retiramos CANCELADA del filtro inicial. Si lo activa más tarde, también.
  useEffect(() => {
    if (!cfgReservas) return;
    if (filtroEstadosTouched.current) return;
    setFiltroEstados((prev) =>
      cfgReservas.ocultarCanceladas
        ? prev.filter((e) => e !== "CANCELADA")
        : ESTADOS_RESERVA,
    );
  }, [cfgReservas]);

  // Tick para reevaluar el parpadeo (se anima por CSS; solo refrescamos la
  // clasificación cada 30 s para mover reservas entre franjas 0-15 / 15-30).
  useEffect(() => {
    const id = setInterval(() => setTickAhora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  /**
   * Devuelve clase Tailwind con animación si la reserva entra en alguna de las
   * franjas configuradas como "parpadeo" (Preferencias del motor). Solo afecta
   * a reservas vivas del día actual.
   */
  const parpadeoClassPara = useCallback(
    (r: Reserva): string | null => {
      if (!cfgReservas) return null;
      if (r.fecha !== fecha) return null;
      if (ESTADOS_NO_OCUPANTES.includes(r.estado)) return null;
      const ahora = new Date(tickAhora);
      const hoyISO = ahora.toISOString().split("T")[0];
      if (r.fecha !== hoyISO) return null;
      const [hh, mm] = (r.hora ?? "00:00").split(":").map((n) => parseInt(n, 10) || 0);
      const horaReserva = new Date(ahora);
      horaReserva.setHours(hh, mm, 0, 0);
      const deltaMin = (horaReserva.getTime() - ahora.getTime()) / 60_000;
      const durOverride = typeof r.duracionMinutos === "number" ? r.duracionMinutos : null;
      const dur = durOverride && durOverride > 0 ? durOverride : cfgReservas.duracionReservaMin;
      // Pasado tiempo de duración (la reserva debería haber terminado ya).
      if (cfgReservas.parpadeoPasadoDuracion && deltaMin <= -dur) {
        return "animate-pulse bg-red-500/10";
      }
      // Próximos 0-15 min.
      if (cfgReservas.parpadeo0a15 && deltaMin >= 0 && deltaMin <= 15) {
        return "animate-pulse bg-emerald-500/10";
      }
      // Próximos 15-30 min.
      if (cfgReservas.parpadeo15a30 && deltaMin > 15 && deltaMin <= 30) {
        return "animate-pulse bg-amber-500/10";
      }
      return null;
    },
    [cfgReservas, fecha, tickAhora],
  );

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
    }).sort((a, b) => {
      const horaCmp = a.hora.localeCompare(b.hora);
      if (horaCmp !== 0) return horaCmp;
      return ESTADO_ORDEN_PRIORIDAD[a.estado] - ESTADO_ORDEN_PRIORIDAD[b.estado];
    });
  }, [reservasTurno, busqueda, zonaCoincide, filtroEstados, filtroOrigen]);

  const origenesPresentes = useMemo(() => {
    const set = new Set<string>();
    reservasDia.forEach(r => { if (r.origen) set.add(r.origen); });
    return Array.from(set).sort();
  }, [reservasDia]);

  const mesasActivas = mesas.filter(m => m.activa);
  const capacidadTotal = mesasActivas.reduce((s, m) => s + m.capacidad, 0);
  // Las reservas canceladas (también NO_SHOW y LIBERADA) no cuentan en ningún
  // sumatorio: si se cancela deja de ocupar plaza.
  const reservasContables = reservasTurno.filter(
    r => r.estado !== "CANCELADA" && r.estado !== "NO_SHOW" && r.estado !== "LIBERADA",
  );
  const cubiertosReservados = reservasContables.reduce((s, r) => s + r.comensales, 0);
  const mesasOcupadas = new Set(reservasTurno.filter(r => r.mesaId && !ESTADOS_NO_OCUPANTES.includes(r.estado)).map(r => r.mesaId)).size;

  // Índice mesaId → reservas activas del turno. Se rehace solo si cambia `reservasTurno`,
  // evitando un O(N×M) en cada render (antes hacíamos un `.filter()` por cada mesa).
  const reservasActivasPorMesa = useMemo(() => {
    const map = new Map<string, Reserva[]>();
    for (const r of reservasTurno) {
      if (!r.mesaId) continue;
      if (ESTADOS_NO_OCUPANTES.includes(r.estado)) continue;
      const arr = map.get(r.mesaId);
      if (arr) arr.push(r);
      else map.set(r.mesaId, [r]);
    }
    return map;
  }, [reservasTurno]);

  const getMesaEstadoTurno = (m: Mesa): string => {
    if (mesasBloqueadasIds.has(m.id)) return "BLOQUEADA";
    const rs = reservasActivasPorMesa.get(m.id);
    if (!rs || rs.length === 0) return "LIBRE";
    if (rs.some(r => r.estado === "WALK_IN")) return "OCUPADA";
    return "RESERVADA";
  };

  const getReservasMesa = (mesaId: string): Reserva[] =>
    reservasActivasPorMesa.get(mesaId) ?? [];

  const cambiarEstadoReserva = async (id: string, estado: EstadoReserva) => {
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r));
    setSelectedReserva(prev => (prev && prev.id === id ? { ...prev, estado } : prev));
    const res = await updateReserva(id, { estado });
    if (res.ok) {
      toast.success(`Reserva actualizada a ${ESTADO_RESERVA_LABELS[estado]}`);
    } else {
      toast.error("Error al actualizar reserva");
      loadReservas(fecha);
    }
  };

  // Click en una mesa: la selecciona y, si tiene reserva activa, sincroniza la
  // selección de reserva para que la fila correspondiente también se resalte.
  const handleSelectMesa = (m: Mesa | null) => {
    setSelectedMesa(m);
    if (m) {
      const rs = reservasActivasPorMesa.get(m.id) ?? [];
      setSelectedReserva(rs[0] ?? null);
    }
  };

  // "Nueva" desde el popover de mesa: deja la mesa preseleccionada y abre el
  // formulario de Nueva reserva.
  const abrirNuevaConMesa = (m: Mesa) => {
    setSelectedMesa(m);
    setShowNueva(true);
  };

  // "Editar" desde el popover: abre la ficha completa de la reserva.
  const abrirDetalleReserva = (r: Reserva) => {
    setSelectedReserva(r);
    setShowDetalleReserva(true);
  };

  // Placeholder para Bloquear/Desplazar (sin backend todavía).
  const accionPendiente = (label: string) =>
    toast.info(`${label}: disponible próximamente`);

  const handleQuitarBloqueoMesa = useCallback(
    async (m: Mesa) => {
      if (!localId) return;
      const turnoExcep: "COMIDA" | "CENA" =
        turno === "COMIDA" ? "COMIDA" : "CENA";
      const r = await crearBloqueoExcepcion({
        localId,
        fecha,
        turno: turnoExcep,
        mesaId: m.id,
      });
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo quitar el bloqueo");
        return;
      }
      toast.success(`Mesa ${m.codigo} desbloqueada solo para hoy (${turnoExcep === "COMIDA" ? "comida" : "cena"})`);
      setBloqueosRefresh((n) => n + 1);
    },
    [localId, fecha, turno],
  );

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
        {/* Acciones: NUEVA · Lista espera · Estados · Buscar — solo en vista día */}
        {vista === "dia" && (
        <div className="flex items-center gap-1.5">
          <Dialog
            open={showNueva}
            onOpenChange={(v) => {
              setShowNueva(v);
              // Al cerrar manualmente, limpiamos la mesa preseleccionada para
              // que el siguiente "Nueva" desde la toolbar no la arrastre.
              if (!v) setSelectedMesa(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs h-8 gap-1.5 px-2.5" onClick={() => setSelectedMesa(null)}><Plus className="h-3.5 w-3.5" />Nueva</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nueva reserva</DialogTitle></DialogHeader>
              <NuevaReservaForm
                fecha={fecha}
                turno={turno}
                mesaPreseleccionada={selectedMesa}
                planos={planosLocal}
                planoSalas={planoSalas}
                zonasReales={zonasReales}
                mesas={mesas}
                posicionesPlano={posicionesPlano}
                getEstadoMesa={getMesaEstadoTurno}
                onClose={() => setShowNueva(false)}
                onSave={async r => {
                  setReservas(prev => [...prev, r]);
                  setShowNueva(false);
                  const mesaCodigo = r.mesaId ? mesas.find(m => m.id === r.mesaId)?.codigo : undefined;
                  const res = await createReserva({
                    clienteNombre: r.cliente || "WALK IN",
                    clienteApellidos: r.apellidos || undefined,
                    clienteTelefono: r.telefono,
                    clienteEmail: r.email || undefined,
                    fecha: r.fecha,
                    hora: r.hora,
                    personas: r.comensales,
                    mesa: mesaCodigo,
                    zona: r.zona || undefined,
                    turno: r.turno,
                    estado: r.estado,
                    notas: r.observaciones || undefined,
                    etiquetaId: r.etiquetaId ?? null,
                    tipoCategoria: r.tipoCategoria ?? null,
                    politicaCancelacionId: r.politicaCancelacionId ?? null,
                    garantiaImporte: r.garantiaImporte ?? null,
                    importePagado: r.importePagado ?? null,
                    duracionMinutos: r.duracionMinutos ?? null,
                    codigoCupon: r.codigoCupon ?? null,
                  });
                  setSelectedMesa(null);
                  if (res.ok) {
                    toast.success("Reserva creada");
                    loadReservas(fecha);
                    if (r.notificarEmail && r.email && res.id) {
                      const notif = await notificarReservaCreadaPorEmail(res.id);
                      if (notif.ok) toast.success("Notificación enviada al cliente");
                      else toast.error(`No se pudo notificar: ${notif.error ?? "error desconocido"}`);
                    }
                  } else {
                    toast.error(res.error ?? "Error al crear reserva");
                  }
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
          <FiltroEstadosDropdown
            seleccionados={filtroEstados}
            onChange={(next) => {
              filtroEstadosTouched.current = true;
              setFiltroEstados(next);
            }}
          />
          <div className="relative w-[150px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-8 h-8 text-xs" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
        </div>
        )}

        {/* Turno + capacidad — solo en vista día */}
        {vista === "dia" && (
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
        )}

        {/* Selector de Local + Plano + Sala + filtro de Zonas — solo en vista día */}
        {vista === "dia" && (
        <div className="flex items-center gap-1.5">
          <FiltroLocalesDropdown locales={locales} localActualId={localId} onSelect={setLocalId} />
          <FiltroPlanosDropdown planos={planosLocal} planoActualId={planoActualId} onSelect={setPlanoActualId} />
          <FiltroSalasDropdown salas={salasLocal} salaActualId={salaActualId} onSelect={setSalaActualId} />
          <FiltroZonasDropdown items={zonaItems} seleccionados={zonaIdsSel} onChange={setZonaIdsSel} />
        </div>
        )}

        <div className="flex items-center gap-1.5">
          {/* KPI totales del mes (solo en vista mes) */}
          {vista === "mes" && (
            <div className="hidden md:inline-flex items-center gap-2.5 h-8 px-2.5 rounded-md border border-input bg-background text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="tabular-nums">{totalesMes.personas}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
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
          panelOculto === "ninguno" ? "w-[360px] shrink-0" : "flex-1",
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
          <div className="grid grid-cols-[64px_40px_40px_1fr_30px_48px] gap-1 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground border-b bg-muted/30 uppercase tracking-wider">
            <span>Zona</span><span>Mesa</span><span>Hora</span><span>Nombre</span><span>Pax</span><span>Estado</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {reservasFiltradas.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Sin reservas para este turno</p>}
            {reservasFiltradas.map(r => {
              const mesa = mesas.find(m => m.id === r.mesaId) ?? null;
              const blink = parpadeoClassPara(r);
              return (
                <Popover key={r.id}>
                  <PopoverTrigger asChild>
                    <button
                      onClick={() => setSelectedReserva(r)}
                      className={cn(
                        "w-full grid grid-cols-[64px_40px_40px_1fr_30px_48px] gap-1 px-3 py-2.5 text-xs border-b hover:bg-muted/40 text-left transition-colors",
                        selectedReserva?.id === r.id && "ring-2 ring-red-500 ring-inset bg-red-500/5",
                        blink,
                      )}
                    >
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
                        {/* El chip "Cupón <CODIGO>" se pinta dentro de <ReservaFlagsChips />. */}
                        <ReservaFlagsChips reserva={r} etiquetas={etiquetasReserva} className="shrink-0" />
                      </span>
                      <span className="text-center">{r.comensales}</span>
                      <StatusDot estado={r.estado} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" side="right" align="start">
                    <ReservaQuickPopover
                      mesa={mesa}
                      reserva={r}
                      onNueva={() => { if (mesa) abrirNuevaConMesa(mesa); else { setSelectedMesa(null); setShowNueva(true); } }}
                      onEditar={() => abrirDetalleReserva(r)}
                      onCambiarEstado={cambiarEstadoReserva}
                      onAccionPendiente={accionPendiente}
                    />
                  </PopoverContent>
                </Popover>
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

        {/* RIGHT PANEL — CANVAS PLANO si vistaPlano === "mapa" y hay intersección posiciones↔mesasActivas; sino, GRID agrupado por zona */}
        {panelOculto !== "mapa" && (
        <div className="relative flex-1 flex flex-col overflow-hidden bg-white">
          {/* Toggle pequeño dentro del lienzo: alterna entre vista mapa y vista listado (común a todas las empresas).
             Estilo y posición igualados al botón de configuración del header para quedar visualmente justo debajo. */}
          <Button
            variant="outline"
            size="icon"
            className="absolute right-3 top-3 z-20 h-8 w-8 bg-background/90 backdrop-blur"
            onClick={() => setVistaPlano((v) => (v === "mapa" ? "listado" : "mapa"))}
            title={vistaPlano === "mapa" ? "Ver zonas en listado" : "Ver mapa de la sala"}
            aria-label={vistaPlano === "mapa" ? "Ver zonas en listado" : "Ver mapa de la sala"}
          >
            {vistaPlano === "mapa" ? (
              <ListIcon className="h-4 w-4" />
            ) : (
              <MapIcon className="h-4 w-4" />
            )}
          </Button>
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
          {vistaPlano === "mapa" ? (
            <PlanoCanvas
              mesas={mesasActivas}
              posiciones={posicionesPlano}
              mesasMeta={mesasMeta}
              zonas={zonasSalaActual.filter((z) => zonaIdsSel.includes(z.id))}
              decoraciones={decoracionesSalaActual}
              salaTieneZonas={zonasSalaActual.length > 0}
              selectedMesaId={selectedMesa?.id ?? null}
              selectedReservaMesaId={selectedReserva?.mesaId ?? null}
              onSelectMesa={handleSelectMesa}
              getEstadoMesa={getMesaEstadoTurno}
              getReservasMesa={getReservasMesa}
              onNueva={abrirNuevaConMesa}
              onEditar={abrirDetalleReserva}
              onCambiarEstado={cambiarEstadoReserva}
              onAccionPendiente={accionPendiente}
              onQuitarBloqueoMesa={handleQuitarBloqueoMesa}
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
                            style={{ backgroundColor: lightenHex(zona.colorPastel, ZONA_LIGHTEN) }}
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
                            const isLibre = estado === "LIBRE";
                            return (
                              <Popover key={m.id}>
                                <PopoverTrigger asChild>
                                  <button
                                    className={cn(
                                      "h-20 rounded-md flex flex-col items-center justify-center text-[11px] font-bold shadow-sm border-2 transition-all cursor-pointer px-1",
                                      mesaBg[estado] ?? "",
                                      isLibre ? "text-foreground border-foreground/40" : "border-white/10",
                                      (selectedReserva?.mesaId === m.id || selectedMesa?.id === m.id) && "ring-4 ring-red-500 z-10",
                                    )}
                                    style={isLibre ? { backgroundColor: lightenHex(zona.colorPastel, ZONA_LIGHTEN) } : undefined}
                                    onClick={() => handleSelectMesa(m)}
                                  >
                                    <span className="leading-none">{m.codigo}</span>
                                    <span className={cn("text-[9px] font-normal mt-0.5", isLibre ? "text-foreground/70" : "opacity-80")}>
                                      ({m.capacidad}p)
                                    </span>
                                    {firstR && (
                                      <span className={cn("text-[9px] font-normal mt-1 truncate max-w-full", isLibre ? "text-foreground/80" : "opacity-90")}>
                                        {firstR.hora} {isWalkIn ? "WALK IN" : firstR.cliente}
                                      </span>
                                    )}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-3">
                                  <ReservaQuickPopover
                                    mesa={m}
                                    reserva={firstR ?? null}
                                    onNueva={() => abrirNuevaConMesa(m)}
                                    onEditar={() => { if (firstR) abrirDetalleReserva(firstR); }}
                                    onCambiarEstado={cambiarEstadoReserva}
                                    onAccionPendiente={accionPendiente}
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
                {Object.entries(mesaBg).map(([k, cls]) => {
                  const isLibre = k === "LIBRE";
                  return (
                    <span key={k} className="flex items-center gap-1.5">
                      <span
                        className={cn("w-3 h-3 rounded", !isLibre && cls)}
                        style={
                          isLibre
                            ? { background: LIBRE_RAINBOW }
                            : undefined
                        }
                      />
                      {ESTADO_MESA_LABELS[k as keyof typeof ESTADO_MESA_LABELS]}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        )}

      </div>
      </>
      )}

      <Dialog open={showDetalleReserva} onOpenChange={setShowDetalleReserva}>
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
                <ReservaFlagsChips reserva={selectedReserva} etiquetas={etiquetasReserva} insights={selectedInsights} size="md" />
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
