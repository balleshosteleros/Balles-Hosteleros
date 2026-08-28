"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/shared/components/NumberInput";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { useSincronizacionEnVivo } from "@/shared/hooks/useSincronizacionEnVivo";
import { useSidebar } from "@/components/ui/sidebar";
import { Plus, Search, ChevronLeft, ChevronRight, ListPlus, ListFilter, Check, Move, Map as MapIcon, List as ListIcon } from "lucide-react";
// Configuración solo se carga cuando el usuario pulsa "Configuración" — fuera del bundle inicial.
const ConfigReservasView = dynamic(
  () =>
    import("@/features/sala/components/reservas/config/ConfigReservasView").then(
      (m) => m.ConfigReservasView,
    ),
  { ssr: false },
);
import { Settings, Sun, Moon } from "lucide-react";
import { useSalaTema } from "@/features/sala/hooks/useSalaTema";
import { EtiquetasPanel } from "@/features/sala/components/reservas/EtiquetasPanel";
import { CalendarioMes } from "@/features/sala/components/reservas/CalendarioMes";
import { CalendarDays, Grid3X3, Users, LayoutGrid, AlertTriangle, Clock } from "lucide-react";
import {
  SAMPLE_MESAS,
  Mesa, Reserva, EstadoReserva, ZonaSala, TurnoReserva,
  ZONAS_LABELS, zonaLabel, ZONAS_SALA, ESTADO_RESERVA_LABELS, ESTADO_MESA_LABELS, ESTADOS_RESERVA,
  ESTADO_BADGE_CLASS,
  ESTADO_DOT_CLASS,
  ESTADO_ORDEN_PRIORIDAD,
  ESTADOS_NO_OCUPANTES,
  ESTADOS_NO_ASISTEN,
  TIPO_RESERVA_CATEGORIA_LABELS,
  DURACION_RESERVA_MAX_MINUTOS,
  DURACION_RESERVA_MIN_MINUTOS,
  DURACION_RESERVA_OPCIONES,
  formatearDuracionReserva,
  etiquetaDiasTranscurridos,
  origenLabel,
  RESERVA_NOMBRE_MAX_CHARS,
  RESERVA_APELLIDOS_MAX_CHARS,
} from "@/features/sala/data/reservas";
import { ReservaEstadoBadge, ReservaEstadoDot } from "@/features/sala/components/reservas/ReservaEstadoBadge";
import {
  listReservas,
  createReserva,
  updateReserva,
  notificarReservaCreadaPorEmail,
} from "@/features/sala/actions/reservas-actions";
import { CuponInputReserva } from "@/features/sala/cupones/components/CuponInputReserva";
import { validarCuponAdminAction } from "@/features/sala/cupones/actions/validar-cupon-action";
import { loadReservasModuleContext } from "@/features/sala/actions/reservas-module-context";
import {
  createBloqueo,
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
import { getReservasConfig } from "@/features/sala/actions/reservas-config-actions";
import {
  getDisponibilidadTurno,
  getChoquesMesa,
  type SlotDisponibilidad,
  type ChoqueReserva,
} from "@/features/sala/actions/reservas-disponibilidad-actions";
import { useReglasSubmodulo } from "@/features/ajustes/hooks/use-reglas-submodulo";
import { LabelConRegla } from "@/shared/components/forms/LabelConRegla";
import { listReglasReservas } from "@/features/sala/reglas/actions/reglas-actions";
import { listPoliticasCancelacion } from "@/features/sala/actions/politicas-cancelacion-actions";
import { getClienteInsights } from "@/features/sala/actions/cliente-insights-actions";
import {
  guardarDatosClienteReserva,
  type DatosClienteReserva,
} from "@/features/sala/actions/reserva-cliente-actions";
import { searchClientes, type ClienteSugerencia } from "@/features/sala/actions/clientes-actions";
import { maxpaxEfectivoDesdeReglas } from "@/features/sala/lib/reserva-limites";
import type { EmpresaReservasRegla, TurnoRegla } from "@/features/sala/reglas/data/reglas";
import type {
  TipoReservaCategoria,
  EmpresaReservasConfig,
  PoliticaCancelacion,
  ClienteInsights,
} from "@/features/sala/data/reservas";
import { ReservaFlagsChips } from "@/features/sala/components/reservas/ReservaFlagsChips";
import { ReservaExternalBadge } from "@/features/sala/components/reservas/ReservaExternalBadge";
import { HistoricoEmailsReserva } from "@/features/sala/components/reservas/HistoricoEmailsReserva";
import { ActividadReserva } from "@/features/sala/components/reservas/ActividadReserva";
import { RevisionVinculacion } from "@/features/sala/components/reservas/RevisionVinculacion";
import { ActividadCliente } from "@/features/sala/components/clientes/ActividadCliente";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useModoInmersivoActivo } from "@/features/layout/hooks/useModoInmersivoActivo";
import { useModoInmersivo } from "@/features/layout/contexts/modo-inmersivo-context";

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

/**
 * Versión oscura de un pastel de zona.
 *
 * No se puede mezclar el hex con azul marino en RGB: los amarillos y naranjas
 * salían marrones. Se trabaja en HSL para CONSERVAR el matiz de la zona (lo que
 * la identifica de un vistazo) y bajar solo luminosidad y saturación, de modo
 * que el amarillo siga leyéndose como amarillo, pero apagado.
 */
function zonaOscura(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let sat = 0;
  if (d !== 0) {
    sat = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  // Matiz intacto; saturación contenida y luminosidad baja para que la mesa
  // libre sea una superficie tintada sobre el lienzo, no un bloque de color.
  const satOut = Math.min(sat, 0.42) * 100;
  const lumOut = 26;
  return `hsl(${h.toFixed(0)} ${satOut.toFixed(0)}% ${lumOut}%)`;
}

/** Cuánto aclaramos los pasteles de zona (tirando a blanco, sutil). */
const ZONA_LIGHTEN = 0.35;

/**
 * Color de fondo de una zona según el tema activo: aclarado hacia blanco en
 * claro, mezclado con azul marino en oscuro. Único punto donde se decide, para
 * que plano, etiquetas y listado por zonas no diverjan.
 */
function colorZona(hex: string, esOscuro: boolean): string {
  return esOscuro ? zonaOscura(hex) : lightenHex(hex, ZONA_LIGHTEN);
}

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
  // En tema oscuro el negro puro se confundía con el lienzo azul marino: la
  // mesa bloqueada pasa a un gris azulado con borde marcado para seguir
  // leyéndose como "apagada" sin desaparecer del plano.
  BLOQUEADA:
    "bg-[#111111] hover:bg-[#1F1F1F] text-white " +
    "[.sala-oscuro_&]:bg-[#0A0F1A] [.sala-oscuro_&]:hover:bg-[#131A29] " +
    "[.sala-oscuro_&]:!border-white/25 [.sala-oscuro_&]:text-zinc-300",
};

/** Suma minutos a "HH:MM" y devuelve "HH:MM" (envuelve pasada la medianoche). */
function horaMasMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "—";
  const total = ((h * 60 + m + minutos) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

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

/**
 * Rejilla de la lista de reservas. El origen tiene su propia columna (antes
 * salía como chip pegado al nombre, que se leía como parte del cliente) y el
 * estado tiene sitio suficiente para leerse entero sin recortarse.
 */
/**
 * Rejilla de la lista. El panel mide 460 px, así que el ancho fijo tiene que
 * dejar sitio de verdad al nombre: con columnas más anchas el nombre se
 * quedaba en ~44 px y los datos se pisaban unos a otros. Reparto: hora 50,
 * mesa 62, pax 26, origen 56, estado 86 + 5 huecos de 6 px + 24 de padding =
 * 334 px, y los ~126 restantes son para el nombre.
 */
const LISTA_GRID =
  "grid grid-cols-[50px_62px_minmax(0,1fr)_26px_56px_86px] gap-1.5 items-center";

function StatusDot({ estado }: { estado: EstadoReserva }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", ESTADO_DOT_CLASS[estado])} />
      <span className="truncate text-[11px] leading-tight" title={ESTADO_RESERVA_LABELS[estado]}>
        {ESTADO_RESERVA_LABELS[estado]}
      </span>
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
  onBloquearMesa,
  onDesplazarReserva,
}: {
  mesa: Mesa | null;
  reserva: Reserva | null;
  onNueva: () => void;
  onEditar: () => void;
  onCambiarEstado: (id: string, estado: EstadoReserva) => void;
  /** Bloquea la mesa para la fecha y turno en pantalla. */
  onBloquearMesa: (m: Mesa) => void;
  /** Abre el selector de mesa destino para mover la reserva. */
  onDesplazarReserva: (r: Reserva) => void;
}) {
  type AccionRapida =
    | { tipo: "estado"; key: string; estado: EstadoReserva; label: string }
    | { tipo: "accion"; key: string; label: string; onClick: () => void; disabled?: boolean };

  const acciones: AccionRapida[] = [
    { tipo: "estado", key: "TERMINANDO", estado: "TERMINANDO", label: "Terminando" },
    { tipo: "estado", key: "LIBERADA", estado: "LIBERADA", label: "Liberada" },
    { tipo: "estado", key: "CANCELADA", estado: "CANCELADA", label: "Cancelada" },
    { tipo: "estado", key: "NO_SHOW", estado: "NO_SHOW", label: "No show" },
    {
      tipo: "accion",
      key: "BLOQUEAR",
      label: "Bloquear",
      onClick: () => { if (mesa) onBloquearMesa(mesa); },
      disabled: !mesa,
    },
    {
      tipo: "accion",
      key: "DESPLAZAR",
      label: "Desplazar",
      onClick: () => { if (reserva) onDesplazarReserva(reserva); },
      disabled: !reserva,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-bold text-sm">
          {mesa ? `Mesa ${mesa.codigo}` : "Sin mesa asignada"}
        </h4>
        {mesa && (
          <Badge variant="outline" className="text-[10px]">
            {zonaLabel(mesa.zona ? String(mesa.zona) : null)} · {mesa.capacidad}p
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
              disabled={a.tipo === "accion" && a.disabled}
              onClick={() => {
                if (a.tipo === "estado") onCambiarEstado(reserva.id, a.estado);
                else a.onClick();
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

function NuevaReservaForm({ fecha, turno, onClose, onSave, mesaPreseleccionada, zonasReales, mesas, mesasMeta, localId, getEstadoMesa }: {
  fecha: string; turno: TurnoReserva;
  onClose: () => void;
  mesaPreseleccionada?: Mesa | null;
  zonasReales: ZonaReal[];
  mesas: Mesa[];
  /** Capacidades reales del catálogo (min/max) para avisar de aforo de mesa. */
  mesasMeta: Map<string, MesaMeta>;
  localId: string;
  getEstadoMesa: (m: Mesa) => string;
  onSave: (r: Reserva & {
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
    // Siempre 2 por defecto: la capacidad de la mesa no dice cuánta gente viene.
    comensales: 2,
    zona: (mesaPreseleccionada?.zona ?? "") as ZonaSala | "",
    mesaId: (mesaPreseleccionada?.id ?? "") as string,
    observaciones: "", esWalkIn: false,
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
  const [politicas, setPoliticas] = useState<PoliticaCancelacion[]>([]);
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [reglas, setReglas] = useState<EmpresaReservasRegla[]>([]);
  const [paxTouched, setPaxTouched] = useState(false);

  // Disponibilidad real del turno: qué horas tienen mesa libre para ESTE grupo
  // en la zona elegida, y con qué reservas se choca en las que no la tienen.
  const [slots, setSlots] = useState<SlotDisponibilidad[]>([]);
  const [turnoCerrado, setTurnoCerrado] = useState<{ cerrado: boolean; motivo: string | null }>({
    cerrado: false,
    motivo: null,
  });
  const [cargandoSlots, setCargandoSlots] = useState(false);
  /**
   * Aviso pendiente de aceptar, con TODOS los motivos de peligro juntos.
   * Mientras esté relleno el guardado espera: el usuario debe confirmar que
   * asume lo que se le detalla (pisar reservas y/o meter un grupo que no cabe).
   */
  const [aviso, setAviso] = useState<{
    choques: ChoqueReserva[];
    aforo: { tipo: "excede" | "insuficiente"; min: number; max: number } | null;
    mesaCodigo: string;
    capacidad: number;
  } | null>(null);
  const [comprobandoSolape, setComprobandoSolape] = useState(false);
  // El formulario no regaña de entrada: los avisos de campos obligatorios solo
  // aparecen cuando el usuario ya ha intentado guardar al menos una vez.
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  // Autocompletado de clientes: cualquiera de los cuatro datos de contacto
  // sirve para buscar, a partir de 5 caracteres escritos.
  type CampoBusqueda = "cliente" | "apellidos" | "telefono" | "email";
  const [campoActivo, setCampoActivo] = useState<CampoBusqueda | null>(null);
  const [sugerencias, setSugerencias] = useState<ClienteSugerencia[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, c, e] = await Promise.all([
        listPoliticasCancelacion({ soloActivas: true }),
        getReservasConfig(),
        listReglasReservas(),
      ]);
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

  // Horas del turno con su ocupación real. Se recalcula al cambiar cualquier
  // dato que altere la respuesta: fecha, turno, zona o nº de comensales (una
  // mesa de 2 no sirve para 6, así que subir el grupo cambia qué horas caben).
  useEffect(() => {
    if (!form.fecha || !form.comensales || form.comensales < 1) {
      setSlots([]);
      return;
    }
    let cancelado = false;
    setCargandoSlots(true);
    (async () => {
      const res = await getDisponibilidadTurno({
        fecha: form.fecha,
        turno: form.turno,
        personas: form.comensales,
        zona: form.zona || null,
        localId: localId || null,
      });
      if (cancelado) return;
      if (res.ok) {
        setSlots(res.data.slots);
        setTurnoCerrado({ cerrado: res.data.cerrado, motivo: res.data.motivo });
      } else {
        // Fallo al calcular: no se inventa disponibilidad, se deja la hora libre
        // y el servidor sigue siendo la última barrera al guardar.
        setSlots([]);
        setTurnoCerrado({ cerrado: false, motivo: null });
      }
      setCargandoSlots(false);
    })();
    return () => { cancelado = true; };
  }, [form.fecha, form.turno, form.comensales, form.zona, localId]);

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
          : campoActivo === "email"
            ? form.email
            : form.telefono;
    // 5 caracteres: por debajo, cualquier texto casa con media base de datos y
    // el desplegable estorba más de lo que ayuda.
    const MINIMO_BUSQUEDA = 5;
    if ((valor ?? "").trim().length < MINIMO_BUSQUEDA) {
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
  }, [form.cliente, form.apellidos, form.telefono, form.email, form.esWalkIn, campoActivo]);

  const maxPax = useMemo(
    () => maxpaxEfectivoDesdeReglas(reglas, form.fecha, form.turno),
    [reglas, form.fecha, form.turno],
  );

  const excedeMaxPax = maxPax != null && form.comensales > maxPax;
  const muestraAvisoPax = paxTouched && excedeMaxPax;

  // Zonas del desplegable: SIEMPRE se ofrecen todas las zonas reales del local.
  // Antes se filtraban por el plano vigente del día/turno y, si la cascada no
  // resolvía plano o el plano no tenía salas asociadas, la lista salía vacía y
  // no se podía elegir zona ni mesa al crear la reserva.
  // El plano decide cómo se PINTA la sala, no dónde se puede sentar a alguien.
  const zonasDisponibles = useMemo<{ value: string; label: string }[]>(() => {
    const vistas = new Set<string>();
    const out: { value: string; label: string }[] = [];
    for (const z of zonasReales) {
      const key = z.nombre.toUpperCase();
      if (vistas.has(key)) continue;
      vistas.add(key);
      out.push({ value: key, label: z.nombre });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [zonasReales]);

  // Con todas las zonas del local siempre en la lista, la única forma de tener
  // una zona "no disponible" es que venga de una reserva vieja cuya zona ya se
  // borró del catálogo. Se avisa y se bloquea guardar hasta cambiarla.
  const zonaNoDisponible = useMemo(() => {
    if (!form.zona) return false;
    return !zonasDisponibles.some((z) => z.value === form.zona);
  }, [zonasDisponibles, form.zona]);

  // Mesas seleccionables: SOLO las de la zona elegida.
  //
  // La zona manda sobre la mesa: toda mesa pertenece siempre a una zona, así que
  // sin zona no hay nada que ofrecer y el selector de mesa queda deshabilitado.
  // No se filtra por `posicionesPlano`: una mesa sin colocar en el plano sigue
  // siendo una mesa real donde se puede sentar gente.
  const mesasSeleccionables = useMemo(() => {
    if (!form.zona) return [];
    return mesas
      .filter((m) => String(m.zona) === form.zona)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  }, [mesas, form.zona]);

  // Mesa que se muestra en el banner superior: siempre la del formulario,
  // para que seleccionar otra abajo se refleje arriba (y no queden en conflicto).
  const mesaBanner = useMemo(
    () => (form.mesaId ? (mesas.find((m) => m.id === form.mesaId) ?? null) : null),
    [mesas, form.mesaId],
  );

  /** Slot correspondiente a la hora elegida (si esa hora está en el grid). */
  const slotElegido = useMemo(
    () => slots.find((s) => s.hora === form.hora.slice(0, 5)) ?? null,
    [slots, form.hora],
  );

  /** Códigos de la zona ocupados a la hora elegida (capaces o no). */
  const codigosOcupadosAhora = useMemo(
    () => new Set((slotElegido?.mesasOcupadas ?? []).map((c) => c.toUpperCase())),
    [slotElegido],
  );

  /** ¿Está ocupada a esa hora la mesa `codigo`? Cubre uniones ("M1+M2"). */
  const mesaOcupadaEn = useCallback(
    (slot: SlotDisponibilidad | null, codigo: string) => {
      if (!slot) return false;
      const ocupadas = new Set(slot.mesasOcupadas.map((c) => c.toUpperCase()));
      return codigo
        .split("+")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
        .some((c) => ocupadas.has(c));
    },
    [],
  );

  // Peligro por HORARIO (⏰): la mesa ya tiene reserva en esa franja.
  //
  // Con MESA ya elegida manda esa mesa: da igual que la zona tenga otras
  // libres, si LA MESA está pillada a esa hora se pisa una reserva. Antes solo
  // se miraba si quedaba alguna mesa CAPAZ libre en la zona, así que elegir una
  // mesa de 3 para 2 comensales (no "capaz") no marcaba peligro alguno.
  //
  // Sin mesa elegida se mantiene la lectura de zona: no queda ningún hueco
  // limpio para ese grupo.
  const horaConflictiva = useMemo(() => {
    if (!slotElegido) return false;
    if (mesaBanner) return mesaOcupadaEn(slotElegido, mesaBanner.codigo);
    return !slotElegido.hayMesaLibre;
  }, [slotElegido, mesaBanner, mesaOcupadaEn]);

  /**
   * Peligro por AFORO (👥): el grupo no encaja en la capacidad de la mesa.
   *
   * Es un problema DISTINTO al del horario y por eso lleva su propio icono:
   * aquí la mesa puede estar perfectamente libre, pero es demasiado pequeña
   * (o demasiado grande) para el grupo según el catálogo.
   */
  const aforoMesa = useCallback(
    (mesaId: string, personas: number) => {
      const meta = mesasMeta.get(mesaId);
      if (!meta || !personas) return null;
      if (personas > meta.capacidadMax) {
        return {
          tipo: "excede" as const,
          min: meta.capacidadMin,
          max: meta.capacidadMax,
        };
      }
      if (personas < meta.capacidadMin) {
        return {
          tipo: "insuficiente" as const,
          min: meta.capacidadMin,
          max: meta.capacidadMax,
        };
      }
      return null;
    },
    [mesasMeta],
  );

  /** Aviso de aforo de la mesa actualmente elegida (null si encaja). */
  const aforoConflictivo = useMemo(
    () => (mesaBanner ? aforoMesa(mesaBanner.id, form.comensales) : null),
    [mesaBanner, form.comensales, aforoMesa],
  );

  // Al elegir mesa se fija también su zona: la mesa siempre trae la suya, y así
  // el dato guardado en la reserva y el selector de zona no pueden divergir.
  // Los comensales NO se tocan: son un dato del cliente, no de la mesa (antes
  // se subían a la capacidad de la mesa, convirtiendo 2 pax en 15 al elegir A1).
  const elegirMesa = (mesaId: string) => {
    const m = mesas.find((x) => x.id === mesaId);
    setForm((p) => ({
      ...p,
      mesaId,
      zona: m?.zona ? (String(m.zona) as ZonaSala) : p.zona,
    }));
  };

  // Al cambiar de zona, la mesa elegida deja de pertenecer a ella: se limpia.
  const elegirZona = (zona: ZonaSala | "") => {
    setForm((p) => {
      if (p.zona === zona) return p;
      const mesaSigueEnZona =
        p.mesaId && mesas.some((m) => m.id === p.mesaId && String(m.zona) === zona);
      return { ...p, zona, mesaId: mesaSigueEnZona ? p.mesaId : "" };
    });
  };

  // Campos obligatorios al crear la reserva. Nombre, apellidos, fecha, hora,
  // comensales, turno, estado y mesa son fijos; email y teléfono los decide cada
  // empresa en Ajustes → Departamentos → Sala → Reservas. Los walk-in quedan
  // fuera: entran sin ficha de cliente porque se atienden en el momento.
  const { esRequerido: reservaRequiere } = useReglasSubmodulo("sala", "reservas");

  // La mesa es obligatoria salvo en walk-in, donde el cliente ya está sentado y
  // se le asigna sitio en el momento.
  const faltaMesa = !form.esWalkIn && !form.mesaId;

  /**
   * Qué falta por rellenar, en lenguaje del usuario. No bloquea el botón: se
   * enseña solo cuando se intenta guardar, para no recibir al usuario con un
   * aviso rojo antes de haber escrito nada.
   */
  const camposQueFaltan = useMemo(() => {
    const faltan: string[] = [];
    if (!form.esWalkIn) {
      if (!form.cliente.trim()) faltan.push("nombre");
      if (!form.apellidos.trim()) faltan.push("apellidos");
      if (reservaRequiere("telefono") && !form.telefono.trim()) faltan.push("teléfono");
      if (reservaRequiere("email") && !form.email.trim()) faltan.push("email");
    }
    if (!form.fecha) faltan.push("fecha");
    if (!form.hora) faltan.push("hora");
    if (!form.turno) faltan.push("turno");
    if (!form.comensales || form.comensales < 1) faltan.push("comensales");
    if (faltaMesa) faltan.push("mesa");
    return faltan;
  }, [
    form.esWalkIn,
    form.cliente,
    form.apellidos,
    form.telefono,
    form.email,
    form.fecha,
    form.hora,
    form.turno,
    form.comensales,
    faltaMesa,
    reservaRequiere,
  ]);

  // Bloqueos duros: no dependen de rellenar campos, sino de que lo elegido no
  // es válido. Estos sí deshabilitan el botón porque no hay nada que escribir.
  const guardarBloqueado =
    excedeMaxPax || zonaNoDisponible || cuponValido === false;

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

  /** Duración efectiva de esta reserva (override del usuario o default empresa). */
  const duracionEfectiva = useMemo(() => {
    const n = Number(form.duracionMinutos);
    if (form.duracionTouched && Number.isFinite(n) && n > 0) {
      return Math.min(DURACION_RESERVA_MAX_MINUTOS, Math.max(DURACION_RESERVA_MIN_MINUTOS, Math.round(n)));
    }
    return config?.duracionReservaMin ?? null;
  }, [form.duracionMinutos, form.duracionTouched, config]);

  /**
   * Paso 1 del guardado: reunir TODOS los motivos de peligro antes de crear.
   *
   * Son dos comprobaciones independientes y pueden darse a la vez:
   *   ⏰ HORARIO — la mesa ya tiene reserva en esa franja (se consulta al
   *      servidor, no al grid: el grid mira la zona y aquí importa la mesa
   *      concreta, que además puede ser una unión).
   *   👥 AFORO  — el grupo no encaja en la capacidad de la mesa.
   *
   * Si hay alguno, se abre el aviso y NO se guarda hasta que el usuario acepte.
   */
  const handleSave = async () => {
    if (guardarBloqueado || comprobandoSolape) return;
    // Aquí es donde el formulario se permite avisar: solo al intentar guardar.
    setIntentoGuardar(true);
    if (camposQueFaltan.length > 0) return;
    const mesa = mesas.find((m) => m.id === (form.mesaId || mesaPreseleccionada?.id));
    if (!mesa) {
      emitirReserva();
      return;
    }
    const aforo = aforoMesa(mesa.id, form.comensales);
    let choques: ChoqueReserva[] = [];
    if (form.hora) {
      setComprobandoSolape(true);
      const res = await getChoquesMesa({
        fecha: form.fecha,
        hora: form.hora,
        mesa: mesa.codigo,
        duracionMin: duracionEfectiva,
      });
      setComprobandoSolape(false);
      if (res.ok) choques = res.data;
    }
    if (choques.length > 0 || aforo) {
      setAviso({ choques, aforo, mesaCodigo: mesa.codigo, capacidad: mesa.capacidad });
      return;
    }
    emitirReserva();
  };

  /** Paso 2: construir y enviar la reserva. Ya sin preguntas. */
  const emitirReserva = () => {
    setAviso(null);
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
      tipoCategoria: (form.tipoCategoria || null) as TipoReservaCategoria | null,
      politicaCancelacionId: form.tipoCategoria === "politica" ? (form.politicaCancelacionId || null) : null,
      garantiaImporte: form.tipoCategoria === "politica" && form.garantiaImporte ? Number(form.garantiaImporte) : null,
      importePagado: form.tipoCategoria === "cupon" && form.importePagado ? Number(form.importePagado) : null,
      // Solo enviamos override si el usuario tocó la duración y es distinta del default.
      // Si no tocó nada, dejamos NULL para usar la default empresa (semántica del campo).
      duracionMinutos: (() => {
        if (!form.duracionTouched) return null;
        if (duracionEfectiva == null) return null;
        if (config && duracionEfectiva === config.duracionReservaMin) return null;
        return duracionEfectiva;
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
            {/* Se enseñan los cuatro datos: al elegir de la lista se rellenan
                todos, así que el usuario debe ver exactamente qué se copia. */}
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">
                {[c.nombre, c.apellidos].filter(Boolean).join(" ") || "Sin nombre"}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {c.telefono || "Sin teléfono"} · {c.email || "Sin email"}
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
    <div className="space-y-2">
      {/* El banner refleja la mesa REALMENTE seleccionada en el formulario, no la
          preseleccionada al abrir: si el usuario la cambia abajo, aquí se ve el
          cambio. Si la deja sin asignar, desaparece. */}
      {mesaBanner && (
        <div className="rounded-md border border-red-500/60 bg-red-500/5 px-3 py-1.5 text-xs flex items-center justify-between gap-2">
          <span>
            <span className="font-semibold">Mesa asignada:</span>{" "}
            {mesaBanner.codigo}{" "}
            <span className="text-muted-foreground">
              ({mesaBanner.capacidad}p{mesaBanner.zona ? ` · ${zonaLabel(String(mesaBanner.zona))}` : ""})
            </span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => setForm((p) => ({ ...p, mesaId: "" }))}
          >
            Quitar
          </Button>
        </div>
      )}
      {/* Aviso de campos obligatorios: solo tras intentar guardar. Antes de eso
          el formulario no dice nada, para no recibir al usuario con un error. */}
      {intentoGuardar && camposQueFaltan.length > 0 && (
        <div className="rounded-md border border-amber-500/60 bg-amber-500/5 px-3 py-1.5 text-xs">
          <span className="font-semibold">
            {camposQueFaltan.length === 1 ? "Falta un dato:" : "Faltan datos:"}
          </span>{" "}
          <span className="text-muted-foreground">
            {camposQueFaltan.join(", ")}.
          </span>
        </div>
      )}
      {/* Selector cliente / walk-in: una sola pastilla con dos mitades, para que
          se vea de un vistazo cuál de los dos está activo. */}
      <div className="grid w-full max-w-xs grid-cols-2 gap-1 rounded-lg border bg-muted/60 p-1">
        {[
          { walkIn: false, label: "Cliente" },
          { walkIn: true, label: "Walk-in" },
        ].map((op) => {
          const activo = form.esWalkIn === op.walkIn;
          return (
            <button
              key={op.label}
              type="button"
              aria-pressed={activo}
              onClick={() => setForm((p) => ({ ...p, esWalkIn: op.walkIn }))}
              className={cn(
                "h-8 rounded-md text-xs font-medium transition-colors",
                activo
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {op.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-2">
        {!form.esWalkIn && (
          <>
            <div className="relative">
              <Label className="text-xs">Nombre *</Label>
              <Input
                className="h-8 text-xs"
                maxLength={RESERVA_NOMBRE_MAX_CHARS}
                value={form.cliente}
                onFocus={() => setCampoActivo("cliente")}
                onBlur={() => setTimeout(() => setCampoActivo((c) => (c === "cliente" ? null : c)), 150)}
                onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))}
              />
              {renderSugerencias("cliente")}
            </div>
            <div className="relative">
              <Label className="text-xs">Apellidos *</Label>
              <Input
                className="h-8 text-xs"
                maxLength={RESERVA_APELLIDOS_MAX_CHARS}
                value={form.apellidos}
                onFocus={() => setCampoActivo("apellidos")}
                onBlur={() => setTimeout(() => setCampoActivo((c) => (c === "apellidos" ? null : c)), 150)}
                onChange={e => setForm(p => ({ ...p, apellidos: e.target.value }))}
              />
              {renderSugerencias("apellidos")}
            </div>
            <div className="relative">
              <LabelConRegla
                moduloKey="sala"
                submoduloKey="reservas"
                campoKey="telefono"
                className="text-xs"
              >
                Teléfono
              </LabelConRegla>
              <Input
                className="h-8 text-xs"
                value={form.telefono}
                onFocus={() => setCampoActivo("telefono")}
                onBlur={() => setTimeout(() => setCampoActivo((c) => (c === "telefono" ? null : c)), 150)}
                onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              />
              {renderSugerencias("telefono")}
            </div>
            <div className="relative">
              <LabelConRegla
                moduloKey="sala"
                submoduloKey="reservas"
                campoKey="email"
                className="text-xs"
              >
                Email
              </LabelConRegla>
              <Input
                className="h-8 text-xs"
                value={form.email}
                onFocus={() => setCampoActivo("email")}
                onBlur={() => setTimeout(() => setCampoActivo((c) => (c === "email" ? null : c)), 150)}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              />
              {renderSugerencias("email")}
            </div>
          </>
        )}
        <div><Label className="text-xs">Fecha *</Label><Input type="date" className="h-8 text-xs" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></div>
        {/* Hora: solo las del horario real del turno. El ⚠ de cada hora sigue a
            la MESA elegida si la hay (esa mesa está pillada a esa hora); si aún
            no hay mesa, avisa cuando no queda ningún hueco para el grupo. */}
        <div><Label className="text-xs">Hora *</Label>
          {slots.length > 0 ? (
            <select
              value={form.hora.slice(0, 5)}
              onChange={(e) => setForm((p) => ({ ...p, hora: e.target.value }))}
              className={cn(
                "h-8 text-xs w-full rounded-md border border-input bg-background px-2",
                horaConflictiva && "border-amber-500",
              )}
            >
              <option value="">— Elige hora —</option>
              {slots.map((s) => {
                // ⏰ = peligro de HORARIO. El aforo no depende de la hora, así
                // que aquí nunca sale 👥.
                const pisa = mesaBanner
                  ? mesaOcupadaEn(s, mesaBanner.codigo)
                  : !s.hayMesaLibre;
                return (
                  <option key={s.hora} value={s.hora}>
                    {s.hora}{pisa ? "  ⏰" : ""}
                  </option>
                );
              })}
            </select>
          ) : (
            // Sin horario definido (o fallo al calcularlo): entrada libre, para
            // no bloquear el alta por un problema de configuración.
            <Input
              type="time"
              className="h-8 text-xs"
              value={form.hora}
              onChange={(e) => setForm((p) => ({ ...p, hora: e.target.value }))}
            />
          )}
          {cargandoSlots ? (
            <p className="mt-1 text-[10px] text-muted-foreground">Calculando disponibilidad…</p>
          ) : turnoCerrado.cerrado ? (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
              Cerrado este día en {form.turno === "CENA" ? "cena" : "comida"}
              {turnoCerrado.motivo ? ` · ${turnoCerrado.motivo}` : ""}.
            </p>
          ) : horaConflictiva ? (
            <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
              <Clock className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {mesaBanner
                  ? `La mesa ${mesaBanner.codigo} ya tiene reserva a esta hora: se pisará.`
                  : `Sin mesas libres para ${form.comensales} pax${
                      form.zona ? ` en ${zonaLabel(form.zona)}` : ""
                    } a esta hora: la reserva pisará otra existente.`}
              </span>
            </p>
          ) : null}
        </div>
        <div><Label className="text-xs">Turno *</Label>
          <Select value={form.turno} onValueChange={v => setForm(p => ({ ...p, turno: v as TurnoReserva }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="COMIDA">Comida</SelectItem><SelectItem value="CENA">Cena</SelectItem></SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Comensales *</Label>
          <NumberInput
            min={1}
            emptyValue={1}
            decimales={false}
            className={cn("h-8 text-xs", muestraAvisoPax && "border-amber-500 focus-visible:ring-amber-500")}
            value={form.comensales}
            onValueChange={(n) => setForm((p) => ({ ...p, comensales: n }))}
            onBlur={() => setPaxTouched(true)}
          />
        </div>
        <div>
          <Label className="text-xs">
            Duración
            {config && <span className="align-super">*</span>}
          </Label>
          <Select
            value={form.duracionMinutos}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, duracionMinutos: v, duracionTouched: true }))
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURACION_RESERVA_OPCIONES.map((o) => (
                <SelectItem key={o.minutos} value={String(o.minutos)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {config && (
            <p className="pt-1 text-[10px] text-muted-foreground/80">
              <span className="align-super">*</span> Por defecto{" "}
              {formatearDuracionReserva(config.duracionReservaMin)}.
            </p>
          )}
        </div>
        {/* Zona manda sobre mesa: se elige zona y luego una mesa de esa zona. */}
        <div className="col-span-1"><Label className="text-xs">Zona</Label>
          <Select value={form.zona} onValueChange={(v) => elegirZona(v as ZonaSala)}>
            <SelectTrigger
              className={cn(
                "h-8 text-xs",
                zonaNoDisponible && "border-amber-500 focus-visible:ring-amber-500",
              )}
            >
              <SelectValue placeholder="Elige zona" />
            </SelectTrigger>
            <SelectContent>
              {zonasDisponibles.map((z) => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}
              {zonaNoDisponible && form.zona && (
                <SelectItem value={form.zona} disabled>
                  {zonaLabel(form.zona)} (no disponible)
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {zonaNoDisponible ? (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
              La zona seleccionada ya no existe en el catálogo de salas. Cámbiala para poder guardar la reserva.
            </p>
          ) : zonasDisponibles.length === 0 ? (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
              Este local no tiene zonas. Créalas en Configuración → Salas.
            </p>
          ) : null}
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Mesa</Label>
          {/* Sin zona no hay mesas que ofrecer: la mesa siempre cuelga de una zona. */}
          <select
            value={form.mesaId}
            onChange={(e) => elegirMesa(e.target.value)}
            disabled={!form.zona}
            className="h-8 text-xs w-full rounded-md border border-input bg-background px-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{form.zona ? "— Sin asignar —" : "— Elige zona primero —"}</option>
            {mesasSeleccionables.map((m) => {
              const est = getEstadoMesa(m);
              const tag =
                est === "LIBRE" ? "Libre" :
                est === "OCUPADA" ? "Sentada" :
                est === "RESERVADA" ? "Reservada" :
                est === "BLOQUEADA" ? "Bloqueada" : "";
              // Dos peligros DISTINTOS, cada uno con su icono, y pueden salir
              // los dos a la vez:
              //   ⏰ = a esa hora la mesa ya tiene reserva (se pisaría).
              //   👥 = el grupo no encaja en la capacidad de la mesa.
              const pisa = codigosOcupadosAhora.has(m.codigo.toUpperCase());
              const aforo = aforoMesa(m.id, form.comensales);
              const avisos = `${pisa ? " ⏰" : ""}${aforo ? " 👥" : ""}`;
              return (
                <option key={m.id} value={m.id}>
                  {m.codigo} · {m.capacidad}p · {tag}{avisos}
                </option>
              );
            })}
          </select>
          {form.mesaId ? (
            <>
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
              {/* 👥 Aviso de AFORO, independiente del de horario: puede salir
                  con la mesa completamente libre. */}
              {aforoConflictivo && (
                <p className="flex items-start gap-1 text-[10px] text-rose-700 dark:text-rose-300">
                  <Users className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    {aforoConflictivo.tipo === "excede"
                      ? `Esta mesa admite máximo ${aforoConflictivo.max} y quieres sentar a ${form.comensales}.`
                      : `Esta mesa es para mínimo ${aforoConflictivo.min} y solo vienen ${form.comensales}.`}
                  </span>
                </p>
              )}
            </>
          ) : !form.zona ? (
            <p className="text-[10px] text-muted-foreground">
              Elige antes la zona: las mesas se listan por zona.
            </p>
          ) : mesasSeleccionables.length === 0 ? (
            // Nunca dejar la lista vacía en silencio: si no hay mesas, se dice por qué.
            <p className="text-[10px] text-amber-700 dark:text-amber-300">
              {zonaLabel(form.zona)} no tiene mesas activas. Elige otra zona.
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Sin mesa asignada — el sistema la elegirá al sentar al cliente.
            </p>
          )}
          {/* Leyenda: los iconos no se adivinan. Solo se muestra si en la lista
              hay al menos una mesa marcada. */}
          {mesasSeleccionables.some(
            (m) =>
              codigosOcupadosAhora.has(m.codigo.toUpperCase()) ||
              aforoMesa(m.id, form.comensales),
          ) && (
            <p className="text-[10px] text-muted-foreground">
              ⏰ ya reservada a esa hora · 👥 el grupo no encaja en la mesa
            </p>
          )}
        </div>
        {/* Las etiquetas se asignan desde la ficha de la reserva, una vez
            creada: ahí van agrupadas y admiten varias a la vez. */}
        <div className="col-span-3">
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
          <div className="col-span-3">
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
          <div className="col-span-3">
            <CuponInputReserva
              value={form.codigoCupon}
              onChange={(v) => setForm((p) => ({ ...p, codigoCupon: v }))}
              validar={(codigo) => validarCuponAdminAction({
                codigo,
                fecha: form.fecha,
                turno: form.turno,
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
          <Button size="sm" onClick={handleSave} disabled={guardarBloqueado || comprobandoSolape}>
            {comprobandoSolape ? "Comprobando…" : "Reservar"}
          </Button>
        </div>
      </div>

      {/* Aviso previo a crear: detalla CADA motivo de peligro por separado
          (⏰ horario y 👥 aforo) para que se acepte sabiendo exactamente qué
          se asume. El back-office manda, pero informado. */}
      <Dialog open={aviso != null} onOpenChange={(v) => { if (!v) setAviso(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              {aviso && aviso.choques.length > 0 && aviso.aforo
                ? "Dos avisos en esta reserva"
                : aviso?.aforo
                  ? "El grupo no encaja en la mesa"
                  : "Esta mesa ya está reservada"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            {/* ⏰ MOTIVO 1: horario */}
            {aviso && aviso.choques.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  Se pisa {aviso.choques.length === 1 ? "una reserva" : `${aviso.choques.length} reservas`}
                </p>
                <p className="text-muted-foreground">
                  Tu reserva de {form.comensales} pax ocupa la mesa {aviso.mesaCodigo} de{" "}
                  {form.hora.slice(0, 5)} a{" "}
                  {horaMasMinutos(form.hora, duracionEfectiva ?? 120)}, y coincide con:
                </p>
                {aviso.choques.map((c) => (
                  <div
                    key={c.reservaId}
                    className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2"
                  >
                    <div className="font-semibold">{c.cliente || "Sin nombre"}</div>
                    <div className="text-muted-foreground">
                      Mesa {c.mesa} · {c.personas} pax · termina a las {c.horaFin}
                    </div>
                  </div>
                ))}
                <p className="text-muted-foreground">
                  La mesa quedará ocupada dos veces a la vez.
                </p>
              </div>
            )}

            {/* 👥 MOTIVO 2: aforo de la mesa */}
            {aviso?.aforo && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-300">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  El grupo no encaja en la mesa
                </p>
                <div className="rounded-md border border-rose-500/40 bg-rose-500/5 px-3 py-2">
                  <div className="font-semibold">Mesa {aviso.mesaCodigo}</div>
                  <div className="text-muted-foreground">
                    {aviso.aforo.tipo === "excede"
                      ? `Admite máximo ${aviso.aforo.max} ${aviso.aforo.max === 1 ? "persona" : "personas"} y quieres sentar a ${form.comensales}.`
                      : `Es para mínimo ${aviso.aforo.min} ${aviso.aforo.min === 1 ? "persona" : "personas"} y solo vienen ${form.comensales}.`}
                  </div>
                </div>
                <p className="text-muted-foreground">
                  {aviso.aforo.tipo === "excede"
                    ? "Puede que no quepan cómodamente."
                    : "Estarás ocupando una mesa mayor de la necesaria."}
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAviso(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={emitirReserva}>Aceptar y reservar</Button>
          </div>
        </DialogContent>
      </Dialog>
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
            <NumberInput
              min={1}
              emptyValue={1}
              decimales={false}
              className="h-8 text-xs"
              value={form.personas}
              onValueChange={n => setForm(p => ({ ...p, personas: n }))}
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
    // OJO: `reservas.mesa` guarda el CÓDIGO ("R3", "M1+M2"), no el UUID.
    // `mesaId` se rellena después, resolviendo el código contra las mesas cargadas
    // (ver `reservasConMesa`). Aquí solo se conserva el código en crudo.
    mesaCodigo: (row.mesa as string) ?? "",
    mesaId: (row.mesa_id as string) ?? "",
    estado: (row.estado as EstadoReserva) ?? "CONFIRMADA",
    observaciones: (row.notas as string) ?? (row.observaciones as string) ?? "",
    clienteId: (row.cliente_id as string | null) ?? null,
    // Enganchó con una ficha existente y los datos no coinciden: hasta que
    // alguien lo revise, el nombre que se ve puede no ser el de quien reservó.
    vinculacionPendiente: row.vinculacion_estado === "PENDIENTE",
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
    codigoId: (row.codigo_id as string | null) ?? null,
    codigo: (row.codigo as string | null) ?? null,
    reconfirmadaAt: (row.reconfirmada_at as string | null) ?? null,
    externalId: (row.external_id as string | null) ?? null,
    externalOrigen: (row.external_origen as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
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
  mesasResaltadasIds,
  onSelectMesa,
  getEstadoMesa,
  getReservasMesa,
  onNueva,
  onEditar,
  onCambiarEstado,
  onBloquearMesa,
  onDesplazarReserva,
  onQuitarBloqueoMesa,
  reservaMoviendo,
  onElegirDestino,
  onCancelarMover,
  esOscuro,
}: {
  mesas: Mesa[];
  posiciones: Map<string, PlanoMesaPosicion>;
  mesasMeta: Map<string, MesaMeta>;
  zonas: ZonaReal[];
  decoraciones: SalaDecoracion[];
  salaTieneZonas: boolean;
  selectedMesaId: string | null;
  selectedReservaMesaId: string | null;
  /**
   * Mesas de la reserva que el raton tiene encima en la lista. Es un conjunto
   * porque una reserva puede ocupar VARIAS mesas (las uniones se guardan como
   * "M1+M2"): se resaltan todas a la vez.
   */
  mesasResaltadasIds: Set<string>;
  onSelectMesa: (m: Mesa | null) => void;
  getEstadoMesa: (m: Mesa) => string;
  getReservasMesa: (mesaId: string) => Reserva[];
  onNueva: (m: Mesa) => void;
  onEditar: (r: Reserva) => void;
  onCambiarEstado: (id: string, e: EstadoReserva) => void;
  onBloquearMesa: (m: Mesa) => void;
  onDesplazarReserva: (r: Reserva) => void;
  /** Si la mesa está BLOQUEADA y se pulsa, levanta el bloqueo solo para (fecha, turno). */
  onQuitarBloqueoMesa?: (m: Mesa) => void;
  /**
   * Reserva "en la mano" tras pulsar Desplazar. Mientras no sea null, el plano
   * está en modo mover: el popover no se abre y el clic elige la mesa destino.
   */
  reservaMoviendo?: Reserva | null;
  onElegirDestino?: (m: Mesa) => void;
  onCancelarMover?: () => void;
  /** Tema activo de la vista: decide si los pasteles de zona se aclaran u oscurecen. */
  esOscuro: boolean;
}) {
  const moviendo = reservaMoviendo != null;
  // Mesas con posición x/y conocida.
  // Si la sala tiene zonas en BD: filtra estrictamente por las seleccionadas (zonas=[] => no muestra nada, como espera el usuario al pulsar "Ninguna").
  // Si la sala no tiene zonas en BD (legacy): muestra todas las mesas posicionadas.
  const mesasConPos = useMemo(() => {
    const zonaNombres = new Set(zonas.map((z) => z.nombre.toUpperCase()));
    return mesas
      .filter((m) => posiciones.has(m.id))
      .filter((m) => !salaTieneZonas || zonaNombres.has((m.zona as unknown as string) ?? ""));
  }, [mesas, posiciones, zonas, salaTieneZonas]);

  // Autoescala el lienzo 1200x640 al espacio que HAY, exactamente igual que el
  // editor de Ajustes (misma formula, mismo tope de 1). Asi el plano que se
  // dibuja y el que se ve son el mismo tamano y nada puede quedarse fuera.
  //
  // Antes se dimensionaba como si el menu lateral estuviera siempre plegado:
  // se le sumaban al ancho 208 px que en realidad no estaban disponibles, y
  // con el menu abierto el plano se salia por la izquierda. El tope de 1 evita
  // lo contrario: que al haber sitio de sobra el plano se ampliara mas que en
  // Ajustes y las mesas del borde se fueran fuera del lienzo.
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
    <div className="flex-1 flex flex-col overflow-hidden py-3 min-h-0">
      {/* Barra del modo mover: mientras la reserva está "en la mano" el plano
          deja de abrir popovers y el siguiente clic elige la mesa destino. */}
      {moviendo && reservaMoviendo && (
        <div className="shrink-0 mx-3 mb-2 rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-2 flex items-center gap-2 text-xs">
          <Move className="h-4 w-4 shrink-0 text-sky-600 animate-pulse" />
          <span className="min-w-0 truncate">
            Moviendo{" "}
            <span className="font-semibold">
              {reservaMoviendo.cliente || "WALK IN"} {reservaMoviendo.apellidos}
            </span>{" "}
            · {reservaMoviendo.hora.slice(0, 5)} · {reservaMoviendo.comensales} pax —
            pulsa la mesa destino en el plano.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] ml-auto shrink-0"
            onClick={() => onCancelarMover?.()}
          >
            Cancelar
          </Button>
        </div>
      )}
      <div
        ref={outerRef}
        className={cn(
          // El plano ya se escala al espacio real, asi que siempre cabe entero
          // y se centra. Antes se anclaba a la derecha para que el trozo que
          // sobresalia cayera bajo el menu; ya no sobresale nada.
          "flex-1 flex items-center justify-center overflow-hidden min-h-0",
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
        className="sala-lienzo relative"
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
            className="sala-deco absolute pointer-events-none select-none"
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
            className={cn(
              "absolute px-2 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-sm pointer-events-none",
              esOscuro ? "text-zinc-100" : "text-zinc-800",
            )}
            style={{ left: l.x, top: Math.max(8, l.y), backgroundColor: colorZona(l.color, esOscuro) }}
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
          // En modo mover, la mesa de origen no es un destino válido y las
          // bloqueadas tampoco: se apagan para que se vea dónde SÍ se puede soltar.
          const esOrigenMover = moviendo && reservaMoviendo?.mesaId === m.id;
          const destinoInvalido = moviendo && (esOrigenMover || estado === "BLOQUEADA");
          return (
            <Popover key={m.id}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "sala-mesa absolute flex flex-col items-center justify-center text-[11px] font-semibold border-2 transition-all cursor-pointer px-1 overflow-hidden",
                    mesaBg[estado] ?? "",
                    isLibre ? "text-foreground border-foreground/40" : "border-white/10",
                    (selectedReservaMesaId === m.id ||
                      selectedMesaId === m.id ||
                      mesasResaltadasIds.has(m.id)) &&
                      "ring-4 ring-red-500 z-10",
                    moviendo && !destinoInvalido && "cursor-copy ring-2 ring-sky-500 ring-offset-1 hover:ring-4 hover:scale-105 z-10",
                    destinoInvalido && "opacity-40 cursor-not-allowed",
                  )}
                  title={
                    moviendo
                      ? esOrigenMover
                        ? "Mesa actual de la reserva"
                        : estado === "BLOQUEADA"
                          ? "Mesa bloqueada en este turno"
                          : `Mover la reserva a la mesa ${m.codigo}`
                      : undefined
                  }
                  style={{
                    left: c.x,
                    top: c.y,
                    width: dims.w,
                    height: dims.h,
                    borderRadius: radius,
                    backgroundColor: isLibre ? colorZona(meta?.colorZona ?? "#FDE68A", esOscuro) : undefined,
                    transform: pos.rotation ? `rotate(${pos.rotation}deg)` : undefined,
                  }}
                  onClick={(e) => {
                    if (moviendo) {
                      // En modo mover el clic es "soltar aquí": no abrimos el
                      // popover ni cambiamos la selección de mesa.
                      e.preventDefault();
                      if (!destinoInvalido) onElegirDestino?.(m);
                      return;
                    }
                    onSelectMesa(m);
                  }}
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
                    onBloquearMesa={onBloquearMesa}
                    onDesplazarReserva={onDesplazarReserva}
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
  const { empresaActual, ajustes } = useEmpresa();
  const searchParams = useSearchParams();
  // Tema visual SOLO de esta vista (claro / oscuro azul marino). No toca el
  // resto del software, que sigue siendo de tema claro.
  const { esOscuro, alternarTema } = useSalaTema();
  // Ajustes → Empresa → Reservas. Apagado (por defecto) el listado enseña las
  // reservas de TODAS las salas del turno y cambiar de sala solo mueve el plano;
  // encendido, cada sala enseña únicamente las suyas.
  const listadoPorSala = ajustes.configOperativa.reservasListadoPorSala ?? false;
  const [mesas, setMesas] = useState<Mesa[]>(SAMPLE_MESAS);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [, setLoading] = useState(true);
  /**
   * Día que se está mirando. Arranca en el `?fecha=` de la URL si lo hay, para
   * que al pinchar una reserva desde la ficha del cliente se abra directamente
   * ese día en el plano en vez de hoy.
   */
  const fechaPedida = searchParams?.get("fecha") ?? null;
  const fechaPedidaValida =
    fechaPedida && /^\d{4}-\d{2}-\d{2}$/.test(fechaPedida) ? fechaPedida : null;
  const [fecha, setFecha] = useState(
    () => fechaPedidaValida ?? new Date().toISOString().split("T")[0],
  );

  // Y también DESPUÉS del montaje: si ya estabas en esta pantalla, Next reutiliza
  // el componente al navegar y el estado inicial no se vuelve a calcular, así que
  // sin esto el enlace desde la ficha no movería el día.
  useEffect(() => {
    if (fechaPedidaValida) setFecha(fechaPedidaValida);
  }, [fechaPedidaValida]);
  // El turno también viaja en la URL: la lista filtra por turno, así que llegar
  // a una reserva de comida con el turno en CENA la dejaría fuera de pantalla.
  const turnoPedido = searchParams?.get("turno") ?? null;
  const turnoPedidoValido =
    turnoPedido === "COMIDA" || turnoPedido === "CENA" ? turnoPedido : null;
  const [turno, setTurno] = useState<TurnoReserva>(turnoPedidoValido ?? "CENA");

  useEffect(() => {
    if (turnoPedidoValido) setTurno(turnoPedidoValido);
  }, [turnoPedidoValido]);
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
  /** Cambio de estado pendiente de decidir si se avisa al cliente por correo. */
  const [confirmEstado, setConfirmEstado] = useState<
    { id: string; estado: EstadoReserva; email: string } | null
  >(null);
  /** Edición del tiempo de mesa desde la ficha de la reserva. */
  const [duracionEdit, setDuracionEdit] = useState("");
  // Comensales editables desde la ficha. Como el tiempo de mesa: se escriben
  // aquí y se guardan al salir del campo, sin pasar por el botón Guardar (que
  // sirve a los datos del cliente).
  const [comensalesEdit, setComensalesEdit] = useState<number>(0);
  const [guardandoComensales, setGuardandoComensales] = useState(false);
  // Se incrementa tras cada cambio para que la Actividad se vuelva a leer y
  // muestre la línea recién grabada sin cerrar y reabrir la ficha.
  const [actividadVersion, setActividadVersion] = useState(0);

  /**
   * Reserva sobre la que esta el raton en la lista. Resalta en rojo a la vez la
   * fila y su mesa (o sus mesas) en el plano, para ver de un vistazo donde se
   * sienta esa gente sin tener que hacer clic. Al quitar el raton se apaga todo.
   */
  const [reservaHoverId, setReservaHoverId] = useState<string | null>(null);
  const [guardandoDuracion, setGuardandoDuracion] = useState(false);
  // Fecha y hora editables desde la ficha. Cambiar la hora recalcula el turno
  // en el servidor (y con el, en que mapa sale la reserva), asi que aqui solo
  // se manda el dato nuevo y se recarga.
  const [fechaEdit, setFechaEdit] = useState("");
  const [horaEdit, setHoraEdit] = useState("");
  const [guardandoCuando, setGuardandoCuando] = useState(false);
  /** Aviso de peligro: la mesa ya está ocupada en esa franja. */
  const [avisoOcupada, setAvisoOcupada] = useState<string | null>(null);
  /** Confirmación de "Bloquear" una mesa para el día y turno en pantalla. */
  const [confirmBloqueo, setConfirmBloqueo] = useState<
    { mesa: Mesa; reservasActivas: number } | null
  >(null);
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  /**
   * Reserva "en la mano": se ha pulsado Desplazar y el plano está esperando a
   * que se elija la mesa destino. Mientras vale algo, el mapa entra en modo mover.
   */
  const [reservaADesplazar, setReservaADesplazar] = useState<Reserva | null>(null);
  /** Mesa destino elegida que pisaría a otras reservas: hay que confirmar. */
  const [choqueDesplazar, setChoqueDesplazar] = useState<
    { mesa: Mesa; choques: ChoqueReserva[] } | null
  >(null);
  const [guardandoDesplazar, setGuardandoDesplazar] = useState(false);

  const [showDetalleReserva, setShowDetalleReserva] = useState(false);
  const [selectedInsights, setSelectedInsights] = useState<ClienteInsights | null>(null);
  // Datos del cliente editables en la ficha. Se sincronizan con la reserva
  // seleccionada y solo se persisten al pulsar Guardar.
  const [clienteEdit, setClienteEdit] = useState<DatosClienteReserva>({
    nombre: "", apellidos: "", telefono: "", email: "",
  });
  // Copia intacta de los datos tal y como estaban al abrir la ficha: es lo que
  // se restaura si el usuario rechaza modificar el cliente.
  const [datosClienteOriginales, setDatosClienteOriginales] = useState<DatosClienteReserva>({
    nombre: "", apellidos: "", telefono: "", email: "",
  });
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  /**
   * Confirmación al editar los datos de un cliente que ya tiene ficha. Editar
   * aquí reescribe SU ficha y todas sus reservas, así que no puede pasar de
   * largo: o se acepta el cambio, o los campos vuelven a como estaban. No hay
   * término medio (guardar la reserva con datos distintos de la ficha dejaría
   * al mismo cliente con dos versiones de sí mismo).
   */
  const [confirmCambioCliente, setConfirmCambioCliente] = useState<{
    reservaId: string;
    original: DatosClienteReserva;
    cambios: { campo: string; antes: string; despues: string }[];
  } | null>(null);
  const [vista, setVista] = useState<"dia" | "mes">("dia");
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  // BARRA SUPERIOR REPLEGADA. Reservas se mira durante todo el servicio y la
  // barra de herramientas del software no se usa en ese rato: ocupa alto y su
  // fondo claro rompe el tema oscuro del plano. Se repliega SOLO en la vista
  // frontal — en Configuración (`showConfig`) se está trabajando en el
  // software, así que ahí la barra baja como en cualquier otro módulo.
  //
  // Para recuperarla basta acercar el cursor al menú lateral: el menú ya se
  // expande solo por hover, y la barra acompaña ese mismo gesto.
  useModoInmersivoActivo(!showConfig);
  const { inmersivo, setInmersivoOscuro } = useModoInmersivo();
  // Se avisa al chrome del software (menu lateral) de que esta vista va en
  // oscuro, para que su borde derecho no se quede con el gris claro del tema
  // del software y aparezca como una linea blanca contra el azul marino.
  useEffect(() => {
    setInmersivoOscuro(esOscuro);
    return () => setInmersivoOscuro(false);
  }, [esOscuro, setInmersivoOscuro]);
  const { state: sidebarState, isMobile: sidebarIsMobile } = useSidebar();
  const barraReplegada =
    inmersivo && !showConfig && !sidebarIsMobile && sidebarState === "collapsed";
  const [totalesMes, setTotalesMes] = useState<{ personas: number; reservas: number }>({ personas: 0, reservas: 0 });
  const [locales, setLocales] = useState<LocalMin[]>([]);
  const [localId, setLocalId] = useState<string>("");
  const [salasLocalTodas, setSalasLocalTodas] = useState<SalaConfig[]>([]);
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
      setSalasLocalTodas(d.salas);
      const salaPrincipal = d.salas.find((s) => s.esPrincipal) ?? d.salas[0];
      setSalaActualId(salaPrincipal?.id ?? "");
      setPlanosLocal(d.planos);
      setPlanoSalas(d.planoSalas);
      const planoPrincipal = d.planos.find((p) => p.esPrincipal) ?? d.planos[0];
      setPlanoActualId(planoPrincipal?.id ?? "");
      setZonasReales(d.zonas);
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

  // Salas que muestra el plano SELECCIONADO en el filtro de planos. Un plano es
  // un conjunto de salas activas (`planoSalas`), así que elegir plano restringe
  // qué salas —y por tanto qué mesas y zonas— se ven. Antes el filtro solo
  // movía el check del desplegable y el plano dibujado no cambiaba nunca.
  const salasLocal = useMemo(() => {
    const ids = planoActualId ? planoSalas[planoActualId] : undefined;
    if (!ids || ids.length === 0) return salasLocalTodas;
    const permitidas = new Set(ids);
    const filtradas = salasLocalTodas.filter((s) => permitidas.has(s.id));
    // Si el plano no tiene ninguna sala del local, no dejamos la vista vacía.
    return filtradas.length > 0 ? filtradas : salasLocalTodas;
  }, [salasLocalTodas, planoSalas, planoActualId]);

  // Si la sala activa no pertenece al plano elegido, saltamos a la primera suya.
  useEffect(() => {
    if (salasLocal.length === 0) return;
    if (salasLocal.some((s) => s.id === salaActualId)) return;
    setSalaActualId(salasLocal[0]!.id);
  }, [salasLocal, salaActualId]);

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

  // Zonas que alimentan el filtro del LISTADO. Con el listado separado por sala
  // son las de la sala visible; con el listado unificado (por defecto) son las
  // de todas las salas del plano, porque si no las reservas de las demás salas
  // no encontrarían su zona y el filtro las tiraría de la lista.
  const zonasFiltroListado = useMemo(() => {
    if (listadoPorSala) return zonasSalaActual;
    const salasOK = new Set(salasLocal.map((s) => s.id));
    return zonasReales.filter((z) => salasOK.has(z.salaId));
  }, [listadoPorSala, zonasSalaActual, zonasReales, salasLocal]);

  // Items que alimentan el dropdown de zonas: reales si existen, si no fallback legacy.
  const zonaItems = useMemo(() => {
    if (zonasFiltroListado.length > 0) {
      // Dos salas distintas pueden tener una zona con el mismo nombre. Como el
      // filtro casa por NOMBRE, las agrupamos en una sola entrada del desplegable.
      const porNombre = new Map<string, { id: string; label: string; color: string | undefined; matchKey: string }>();
      for (const z of zonasFiltroListado) {
        const matchKey = z.nombre.toUpperCase();
        if (porNombre.has(matchKey)) continue;
        porNombre.set(matchKey, { id: matchKey, label: z.nombre, color: z.colorPastel, matchKey });
      }
      return Array.from(porNombre.values());
    }
    return ZONAS_SALA.map((z) => ({
      id: z,
      label: ZONAS_LABELS[z],
      color: undefined as string | undefined,
      matchKey: z,
    }));
  }, [zonasFiltroListado]);

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

  // El campo de tiempo de mesa arranca con el valor de la reserva; si no tiene
  // override, con el valor por defecto de la empresa.
  useEffect(() => {
    if (!selectedReserva) return;
    const efectiva =
      selectedReserva.duracionMinutos ?? cfgReservas?.duracionReservaMin ?? null;
    setDuracionEdit(efectiva ? String(efectiva) : "");
  }, [selectedReserva, cfgReservas]);

  // Los comensales del campo editable arrancan con los de la reserva abierta.
  useEffect(() => {
    if (!selectedReserva) return;
    setComensalesEdit(selectedReserva.comensales);
    setFechaEdit(selectedReserva.fecha);
    setHoraEdit(selectedReserva.hora.slice(0, 5));
  }, [selectedReserva]);

  // Los campos del cliente se recargan al cambiar de reserva: si no, quedarían
  // los del cliente anterior y se guardarían sobre quien no toca. Se guarda
  // aparte una copia intacta: es a lo que se vuelve si el usuario decide NO
  // modificar la ficha del cliente.
  useEffect(() => {
    if (!selectedReserva) return;
    const datos: DatosClienteReserva = {
      nombre: selectedReserva.cliente ?? "",
      apellidos: selectedReserva.apellidos ?? "",
      telefono: selectedReserva.telefono ?? "",
      email: selectedReserva.email ?? "",
    };
    setClienteEdit(datos);
    setDatosClienteOriginales(datos);
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

  // Sincronización en vivo: si otra persona crea, mueve o cancela una reserva,
  // el plano y el listado se actualizan solos. Sala es la pantalla donde más
  // manos trabajan a la vez y donde un dato viejo se paga sentando mal una mesa.
  //
  // Se PAUSA mientras hay un diálogo abierto (nueva reserva, ficha, bloqueo…):
  // refrescar bajo los pies mientras rellenas un formulario perdería lo escrito.
  // Los cambios que lleguen entre medias se aplican al cerrar.
  useSincronizacionEnVivo({
    tablas: ["reservas", "mesas"],
    empresaId: empresaActual.id,
    onCambio: () => void loadReservas(fecha),
    pausado:
      showNueva || showListaEspera || !!selectedReserva || !!selectedMesa ||
      !!confirmEstado || !!confirmBloqueo,
  });

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

  // La BD guarda el CÓDIGO de mesa ("R3"), pero toda la UI compara contra el
  // UUID (`mesas.find(m => m.id === r.mesaId)`). Sin esta resolución el `find`
  // no encontraba nada nunca: la columna "Mesa" salía "—", el plano no pintaba
  // las mesas reservadas y el contador de ocupadas se quedaba a 0.
  // Las uniones se graban como "M1+M2": la reserva se ancla a la primera mesa
  // del conjunto para que el plano tenga dónde resaltarla.
  const mesaIdPorCodigo = useMemo(() => {
    const m = new Map<string, string>();
    for (const mesa of mesas) m.set(mesa.codigo.toUpperCase(), mesa.id);
    return m;
  }, [mesas]);

  const reservasResueltas = useMemo(() => {
    if (mesaIdPorCodigo.size === 0) return reservas;
    return reservas.map((r) => {
      if (r.mesaId) return r;
      const codigo = r.mesaCodigo?.trim();
      if (!codigo) return r;
      const primero = codigo.split("+")[0]?.trim().toUpperCase() ?? "";
      const id = mesaIdPorCodigo.get(primero);
      return id ? { ...r, mesaId: id } : r;
    });
  }, [reservas, mesaIdPorCodigo]);

  /**
   * Mesas que hay que resaltar en el plano por el hover de la lista. Se parte
   * el codigo por "+" porque una union ("M1+M2") ocupa DOS mesas fisicas y las
   * dos tienen que encenderse: `mesaId` solo guarda la primera.
   */
  const mesasResaltadasIds = useMemo(() => {
    if (!reservaHoverId) return new Set<string>();
    const r = reservasResueltas.find((x) => x.id === reservaHoverId);
    if (!r) return new Set<string>();
    const ids = new Set<string>();
    const codigos = (r.mesaCodigo ?? "")
      .split("+")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    for (const c of codigos) {
      const id = mesaIdPorCodigo.get(c);
      if (id) ids.add(id);
    }
    // Sin codigo (o sin correspondencia) queda el id ya resuelto de la reserva.
    if (ids.size === 0 && r.mesaId) ids.add(r.mesaId);
    return ids;
  }, [reservaHoverId, reservasResueltas, mesaIdPorCodigo]);

  const reservasDia = useMemo(() => reservasResueltas.filter(r => r.fecha === fecha), [reservasResueltas, fecha]);
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

  // Mesas de la SALA activa: el canvas recibía todas las del local mientras las
  // zonas sí venían filtradas, así que dos salas con una zona del mismo nombre
  // mezclaban sus mesas en el plano.
  const mesasActivas = useMemo(() => {
    const activas = mesas.filter((m) => m.activa);
    const zonasOK = new Set(zonasSalaActual.map((z) => z.id));
    if (zonasOK.size === 0) return activas;
    return activas.filter((m) => {
      const zonaId = mesasMeta.get(m.id)?.zonaId;
      // Sin metadatos de zona no la escondemos: mejor mostrarla que perderla.
      return !zonaId || zonasOK.has(zonaId);
    });
  }, [mesas, zonasSalaActual, mesasMeta]);
  const capacidadTotal = mesasActivas.reduce((s, m) => s + m.capacidad, 0);
  // Los contadores de arriba van SIEMPRE en función del filtro: si el usuario
  // desmarca estados, zonas u origen, o busca un cliente, el total refleja lo
  // que está viendo. Antes se calculaban sobre el turno entero y el número no
  // se movía al filtrar.
  // Sobre esa base solo se descuentan los que NO asisten (canceladas/no-show):
  // una LIBERADA soltó la mesa, pero el cliente vino y comió, así que cuenta.
  const reservasContables = reservasFiltradas.filter(
    r => !ESTADOS_NO_ASISTEN.includes(r.estado),
  );
  const cubiertosReservados = reservasContables.reduce((s, r) => s + r.comensales, 0);
  const mesasOcupadas = new Set(
    reservasFiltradas
      .filter(r => r.mesaId && !ESTADOS_NO_OCUPANTES.includes(r.estado))
      .map(r => r.mesaId),
  ).size;

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

  /**
   * Aplica el cambio de estado. `notificarCliente` decide si sale el correo:
   * cambiar de estado es criterio del empleado, así que por defecto NO se
   * notifica a nadie (antes el servidor enviaba el correo por su cuenta).
   */
  const aplicarEstadoReserva = async (
    id: string,
    estado: EstadoReserva,
    notificarCliente: boolean,
  ) => {
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r));
    setSelectedReserva(prev => (prev && prev.id === id ? { ...prev, estado } : prev));
    const res = await updateReserva(id, { estado, notificarCliente });
    if (res.ok) {
      toast.success(`Reserva actualizada a ${ESTADO_RESERVA_LABELS[estado]}`);
      if (notificarCliente) toast.success("Correo enviado al cliente");
      setActividadVersion((v) => v + 1);
      // Recargamos también en el camino feliz: el servidor puede tocar campos
      // derivados (reconfirmada_at, origen) que el update optimista no refleja.
      loadReservas(fecha);
    } else {
      // Reactivar una reserva anulada puede chocar con otra que haya entrado en
      // esa mesa mientras tanto. Ese caso se muestra como aviso de peligro
      // persistente (no un toast que se va) porque hay que recolocar a alguien.
      const msg = res.error ?? "Error al actualizar reserva";
      if (/ya tiene una reserva/i.test(msg)) setAvisoOcupada(msg);
      else toast.error(msg);
      loadReservas(fecha);
    }
  };

  /**
   * Amplía (o recorta) el tiempo que esta reserva ocupa la mesa. Se puede tocar
   * en cualquier momento: una mesa que se alarga solo necesita más minutos aquí,
   * y a partir de ese momento el sistema calcula su hora de fin con el valor
   * nuevo para dejar entrar (o no) la siguiente reserva.
   */
  /**
   * Guarda el tiempo de mesa. El valor llega por parámetro desde el selector:
   * el estado de React aún no se ha propagado cuando se dispara el guardado
   * automático, así que leerlo de `duracionEdit` guardaría el valor anterior.
   */
  const guardarDuracion = async (id: string, valor?: string) => {
    const n = Number(valor ?? duracionEdit);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Introduce un tiempo válido.");
      return;
    }
    const clamped = Math.min(
      DURACION_RESERVA_MAX_MINUTOS,
      Math.max(DURACION_RESERVA_MIN_MINUTOS, Math.round(n)),
    );
    setGuardandoDuracion(true);
    const res = await updateReserva(id, { duracionMinutos: clamped });
    setGuardandoDuracion(false);
    if (res.ok) {
      toast.success(`Tiempo de mesa: ${formatearDuracionReserva(clamped)}`);
      setSelectedReserva(prev =>
        prev && prev.id === id ? { ...prev, duracionMinutos: clamped } : prev,
      );
      setActividadVersion((v) => v + 1);
      loadReservas(fecha);
    } else {
      // Ampliar el tiempo puede pisar a la reserva que entró detrás.
      const msg = res.error ?? "No se pudo guardar el tiempo de mesa";
      if (/ya tiene una reserva/i.test(msg)) setAvisoOcupada(msg);
      else toast.error(msg);
    }
  };

  /**
   * Cambia el cuándo de la reserva: fecha u hora. El turno lo recalcula el
   * servidor a partir de la hora, así que al pasar una reserva de las 14:00 a
   * las 21:00 deja de salir en el mapa de comida y aparece en el de cena sola.
   * Cambiar de día la saca del mapa del día viejo y la lleva al nuevo.
   */
  const guardarCuando = async (
    id: string,
    campo: "fecha" | "hora",
    valor: string,
  ) => {
    if (!valor) {
      toast.error(
        campo === "fecha" ? "Elige una fecha." : "Elige una hora.",
      );
      setFechaEdit(selectedReserva?.fecha ?? "");
      setHoraEdit(selectedReserva?.hora.slice(0, 5) ?? "");
      return;
    }
    const actual =
      campo === "fecha"
        ? selectedReserva?.fecha
        : selectedReserva?.hora.slice(0, 5);
    if (valor === actual) return;

    setGuardandoCuando(true);
    const res = await updateReserva(id, { [campo]: valor });
    setGuardandoCuando(false);

    if (!res.ok) {
      const msg = res.error ?? "No se pudo guardar el cambio.";
      if (/ya tiene una reserva/i.test(msg)) setAvisoOcupada(msg);
      else toast.error(msg);
      setFechaEdit(selectedReserva?.fecha ?? "");
      setHoraEdit(selectedReserva?.hora.slice(0, 5) ?? "");
      return;
    }

    toast.success(campo === "fecha" ? "Fecha actualizada" : "Hora actualizada");
    setActividadVersion((v) => v + 1);
    // Recarga completa: el turno (y por tanto el mapa en el que sale) lo ha
    // recalculado el servidor, y si cambió el día esta reserva ya no pertenece
    // al listado que hay en pantalla.
    loadReservas(fecha);
    setSelectedReserva((prev) =>
      prev && prev.id === id
        ? { ...prev, [campo]: campo === "hora" ? `${valor}:00` : valor }
        : prev,
    );
  };

  /**
   * Guarda los comensales de la reserva. Se puede corregir en cualquier
   * momento: vienen dos más de los que dijeron al reservar y hay que dejarlo
   * apuntado. El aforo de la mesa NO bloquea el cambio, solo avisa: en sala
   * mandan las personas que hay, y ya se recolocará la mesa si hace falta.
   */
  const guardarComensales = async (id: string, valor: number) => {
    if (!Number.isFinite(valor) || valor < 1) {
      toast.error("Introduce un número de comensales válido.");
      setComensalesEdit(selectedReserva?.comensales ?? 1);
      return;
    }
    if (valor === selectedReserva?.comensales) return;

    setGuardandoComensales(true);
    const res = await updateReserva(id, { personas: valor });
    setGuardandoComensales(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron guardar los comensales.");
      setComensalesEdit(selectedReserva?.comensales ?? 1);
      return;
    }

    setReservas((prev) =>
      prev.map((r) => (r.id === id ? { ...r, comensales: valor } : r)),
    );
    setSelectedReserva((prev) =>
      prev && prev.id === id ? { ...prev, comensales: valor } : prev,
    );
    setActividadVersion((v) => v + 1);
    toast.success("Comensales actualizados");

    // Aviso (no bloqueo) si la mesa asignada se queda corta o grande.
    const mesa = mesas.find((m) => m.id === selectedReserva?.mesaId);
    const meta = mesa ? mesasMeta.get(mesa.id) : null;
    if (mesa && meta) {
      if (valor > meta.capacidadMax) {
        toast.warning(
          `La mesa ${mesa.codigo} admite máximo ${meta.capacidadMax}.`,
        );
      } else if (valor < meta.capacidadMin) {
        toast.warning(
          `La mesa ${mesa.codigo} es para mínimo ${meta.capacidadMin}.`,
        );
      }
    }
  };

  /**
   * Guarda los datos del cliente de la ficha. Un solo botón para los cuatro
   * campos, y el cambio se propaga a la ficha del cliente y a todas sus
   * reservas: el mismo cliente no puede quedar con dos teléfonos distintos.
   */
  const guardarDatosCliente = async (id: string) => {
    if (!clienteEdit.nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    // Antes de tocar nada: si los datos difieren de los que tenía la ficha, se
    // pregunta. La respuesta es binaria — se cambia la ficha o se restaura.
    const original = datosClienteOriginales;
    const campos: { clave: keyof DatosClienteReserva; campo: string }[] = [
      { clave: "nombre", campo: "Nombre" },
      { clave: "apellidos", campo: "Apellidos" },
      { clave: "telefono", campo: "Teléfono" },
      { clave: "email", campo: "Email" },
    ];
    const cambios = campos
      .filter((c) => clienteEdit[c.clave].trim() !== original[c.clave].trim())
      .map((c) => ({
        campo: c.campo,
        antes: original[c.clave].trim() || "—",
        despues: clienteEdit[c.clave].trim() || "—",
      }));
    if (cambios.length > 0 && !confirmCambioCliente) {
      setConfirmCambioCliente({
        reservaId: id,
        original,
        cambios,
      });
      return;
    }
    setConfirmCambioCliente(null);
    setGuardandoCliente(true);
    const res = await guardarDatosClienteReserva(id, clienteEdit);
    setGuardandoCliente(false);
    if (res.ok) {
      toast.success("Datos del cliente guardados");
      // El cambio deja línea en la actividad: hay que releerla para que se vea
      // sin cerrar y reabrir la ficha.
      setActividadVersion((v) => v + 1);
      // Lo guardado pasa a ser el nuevo punto de partida: un segundo cambio se
      // compara contra esto, no contra lo que había al abrir la ficha.
      setDatosClienteOriginales({
        nombre: clienteEdit.nombre.trim(),
        apellidos: clienteEdit.apellidos.trim(),
        telefono: clienteEdit.telefono.trim(),
        email: clienteEdit.email.trim(),
      });
      // Recarga: el cambio afecta a más reservas que la abierta, así que el
      // listado entero puede haber quedado desfasado.
      loadReservas(fecha);
      setSelectedReserva((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              cliente: clienteEdit.nombre.trim(),
              apellidos: clienteEdit.apellidos.trim(),
              telefono: clienteEdit.telefono.trim(),
              email: clienteEdit.email.trim(),
            }
          : prev,
      );
    } else {
      // Si el guardado falla, los campos no pueden quedarse con datos que no
      // están en ninguna parte: se vuelve a lo que hay en la ficha real.
      setClienteEdit(datosClienteOriginales);
      toast.error(res.error ?? "No se pudieron guardar los datos");
    }
  };

  const cambiarEstadoReserva = async (id: string, estado: EstadoReserva) => {
    // Solo RECONFIRMADA y CANCELADA tienen correo asociado, y solo tiene
    // sentido preguntar si el cliente dejó email.
    const tieneCorreo = estado === "RECONFIRMADA" || estado === "CANCELADA";
    const reserva = reservasResueltas.find((r) => r.id === id) ?? null;
    if (tieneCorreo && reserva?.email?.trim()) {
      setConfirmEstado({ id, estado, email: reserva.email.trim() });
      return;
    }
    await aplicarEstadoReserva(id, estado, false);
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

  // "Bloquear": deja la mesa fuera de juego solo para el día y turno que hay en
  // pantalla (bloqueo puntual, no recurrente). Si la mesa tiene reservas activas
  // se pide confirmación antes, porque bloquearla la saca del servicio.
  const pedirBloqueoMesa = (m: Mesa) => {
    const activas = reservasActivasPorMesa.get(m.id) ?? [];
    setConfirmBloqueo({ mesa: m, reservasActivas: activas.length });
  };

  const bloquearMesaHoy = useCallback(
    async (m: Mesa) => {
      if (!localId) {
        toast.error("Selecciona un local antes de bloquear la mesa.");
        return;
      }
      const turnoBloqueo: TurnoRegla = turno === "COMIDA" ? "COMIDA" : "CENA";
      setGuardandoBloqueo(true);
      const res = await createBloqueo({
        localId,
        vigencia: { modo: "fechas", fechas: [fecha] },
        turno: turnoBloqueo,
        zonaIds: [],
        mesaIds: [m.id],
        motivo: "Bloqueada desde el plano de reservas",
      });
      setGuardandoBloqueo(false);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo bloquear la mesa");
        return;
      }
      toast.success(
        `Mesa ${m.codigo} bloqueada para el ${fecha} (${turnoBloqueo === "COMIDA" ? "comida" : "cena"})`,
      );
      setConfirmBloqueo(null);
      setBloqueosRefresh((n) => n + 1);
    },
    [localId, fecha, turno],
  );

  // "Desplazar": entra en modo mover. La reserva queda "en la mano" y el
  // siguiente clic sobre una mesa del plano es el destino. Se puede elegir
  // CUALQUIER mesa (tenga o no reserva): si al hacerlo pisa a alguien por
  // horario, se avisa con quién y se deja decidir.
  const abrirDesplazar = (r: Reserva) => {
    setReservaADesplazar(r);
    setChoqueDesplazar(null);
    toast.info("Elige en el plano la mesa a la que mueves la reserva.");
  };

  const cancelarDesplazar = useCallback(() => {
    setReservaADesplazar(null);
    setChoqueDesplazar(null);
  }, []);

  // Escape sale del modo mover sin tocar nada, como en cualquier arrastre.
  useEffect(() => {
    if (!reservaADesplazar) return;
    const onKey = (e: KeyboardEvent) => {
      // Si hay un aviso de solape abierto, Escape lo cierra a él primero.
      if (e.key === "Escape" && !choqueDesplazar) cancelarDesplazar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reservaADesplazar, choqueDesplazar, cancelarDesplazar]);

  /** Aplica el movimiento. Se llama tras comprobar choques (o tras aceptarlos). */
  const aplicarDesplazamiento = useCallback(
    async (r: Reserva, mesaDestino: Mesa) => {
      setGuardandoDesplazar(true);
      const res = await updateReserva(r.id, {
        mesa: mesaDestino.codigo,
        zona: mesaDestino.zona ? String(mesaDestino.zona) : undefined,
      });
      setGuardandoDesplazar(false);
      if (!res.ok) {
        const msg = res.error ?? "No se pudo desplazar la reserva";
        if (/ya tiene una reserva/i.test(msg)) setAvisoOcupada(msg);
        else toast.error(msg);
        return;
      }
      toast.success(`Reserva movida a la mesa ${mesaDestino.codigo}`);
      setReservaADesplazar(null);
      setChoqueDesplazar(null);
      loadReservas(fecha);
    },
    [fecha, loadReservas],
  );

  /**
   * Clic sobre una mesa estando en modo mover. Antes de tocar nada se pregunta
   * al servidor si esa mesa tiene reservas que se pisen por horario con esta
   * (contando la duración real de cada una, no solo la hora de inicio). Si las
   * hay, se enseña el aviso y el usuario decide; si no, se mueve directamente.
   */
  const elegirMesaDestino = useCallback(
    async (mesaDestino: Mesa) => {
      const r = reservaADesplazar;
      if (!r) return;
      if (mesaDestino.id === r.mesaId) {
        toast.info("La reserva ya está en esa mesa.");
        return;
      }
      if (mesasBloqueadasIds.has(mesaDestino.id)) {
        toast.error(`La mesa ${mesaDestino.codigo} está bloqueada en este turno.`);
        return;
      }
      setGuardandoDesplazar(true);
      const res = await getChoquesMesa({
        fecha: r.fecha,
        hora: r.hora,
        mesa: mesaDestino.codigo,
        duracionMin: r.duracionMinutos ?? cfgReservas?.duracionReservaMin ?? null,
        ignoreReservaId: r.id,
      });
      setGuardandoDesplazar(false);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo comprobar la mesa");
        return;
      }
      if (res.data.length > 0) {
        setChoqueDesplazar({ mesa: mesaDestino, choques: res.data });
        return;
      }
      await aplicarDesplazamiento(r, mesaDestino);
    },
    [reservaADesplazar, mesasBloqueadasIds, cfgReservas, aplicarDesplazamiento],
  );

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
      <div
        className={cn(
          "sala-tema flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden",
          esOscuro && "sala-oscuro",
        )}
      >
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
    <div
      className={cn(
        "sala-tema flex flex-col overflow-hidden",
        // Con la barra replegada solo queda el reborde superior (0.5rem);
        // con la barra visible se le descuentan sus 3.5rem.
        barraReplegada ? "h-[calc(100vh-0.5rem)]" : "h-[calc(100vh-3.5rem)]",
        esOscuro && "sala-oscuro",
      )}
    >
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
            {/* Ancho generoso y contenido en 3 columnas: la reserva se rellena
                entera sin tener que bajar por el diálogo. */}
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Nueva reserva</DialogTitle></DialogHeader>
              <NuevaReservaForm
                fecha={fecha}
                turno={turno}
                mesaPreseleccionada={selectedMesa}
                zonasReales={zonasReales}
                mesas={mesas}
                mesasMeta={mesasMeta}
                localId={localId}
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
                    // Sin localId el servidor se salta la comprobación de mesas
                    // bloqueadas: se podía reservar en una mesa bloqueada desde
                    // el back-office (el portal público sí lo validaba).
                    localId: localId || undefined,
                    zona: r.zona || undefined,
                    turno: r.turno,
                    estado: r.estado,
                    notas: r.observaciones || undefined,
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
                    // Revertir el optimistic update: si el servidor rechaza
                    // (solape, mesa bloqueada, cupo), la fila provisional se
                    // quedaba en la lista y parecía una reserva real.
                    setReservas(prev => prev.filter(x => x.id !== r.id));
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
                  else {
                    // Revertir el optimista: si falla, la fila no debe quedarse.
                    setReservas(prev => prev.filter(x => x.id !== optimista.id));
                    toast.error(res.error ?? "Error al guardar");
                  }
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

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={alternarTema}
            title={esOscuro ? "Cambiar a vista clara" : "Cambiar a vista oscura"}
            aria-label={esOscuro ? "Cambiar a vista clara" : "Cambiar a vista oscura"}
            aria-pressed={esOscuro}
          >
            {esOscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowConfig(true)}
            title="Configuración de reservas"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
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
          // 560 px (antes 460): el nombre y los apellidos del cliente no se
          // leian enteros y es el dato por el que se busca a la gente en sala.
          // Lo que crece la lista lo cede el plano, que aguanta bien menos
          // ancho porque se escala solo.
          panelOculto === "ninguno" ? "w-[560px] shrink-0" : "flex-1",
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
                <option value="SIN_ORIGEN">Manual</option>
                {origenesPresentes.map((o) => (
                  <option key={o} value={o}>{origenLabel(o)}</option>
                ))}
              </select>
            </div>
          )}
          <div className={cn(LISTA_GRID, "px-3 py-2 text-[10px] font-semibold text-muted-foreground border-b bg-muted/30 uppercase tracking-wider")}>
            <span className="truncate">Hora</span>
            <span className="truncate">Mesa</span>
            <span className="truncate">Nombre</span>
            <span className="truncate text-center">Pax</span>
            <span className="truncate">Origen</span>
            <span className="truncate">Estado</span>
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
                      onMouseEnter={() => setReservaHoverId(r.id)}
                      onMouseLeave={() => setReservaHoverId(null)}
                      className={cn(
                        "w-full text-[13px] border-b hover:bg-muted/40 text-left transition-colors",
                        LISTA_GRID,
                        "px-3 py-3",
                        // El mismo recuadro rojo que marca la seleccion sirve
                        // para el hover: fila y mesa se encienden a la vez.
                        (selectedReserva?.id === r.id || reservaHoverId === r.id) &&
                          "ring-2 ring-red-500 ring-inset bg-red-500/5",
                        blink,
                      )}
                    >
                      {/* La hora es lo primero que se busca en una lista de
                          reservas: va en grande y en tabular para que las
                          cifras queden alineadas de fila a fila. */}
                      <span className="truncate text-[15px] font-semibold tabular-nums">
                        {r.hora.slice(0, 5)}
                      </span>
                      {/* Mesa y zona, una encima de otra: son el mismo dato
                          (dónde se sienta) y antes competían en dos columnas.
                          La mesa manda, la zona la acompaña en pequeño. */}
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span
                          className="truncate font-mono text-[15px] font-bold leading-tight"
                          title={mesa?.codigo ?? undefined}
                        >
                          {mesa?.codigo ?? "—"}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {zonaLabel(r.zona ? String(r.zona) : null) || "—"}
                        </span>
                      </span>
                      {/* Nombre legible y, debajo, el teléfono en pequeño: es
                          lo que se necesita para llamar sin abrir la ficha. */}
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {/* Enganchó con una ficha existente y nadie lo ha
                              revisado: el nombre de al lado puede no ser el de
                              quien reservó. Va delante para que se vea antes
                              que el nombre al que avisa. */}
                          {r.vinculacionPendiente && (
                            <AlertTriangle
                              className="size-3.5 shrink-0 text-amber-500"
                              aria-label="Datos sin revisar"
                            />
                          )}
                          <span
                            className="truncate font-medium"
                            title={`${r.cliente || "WALK IN"} ${r.apellidos ?? ""}`.trim()}
                          >
                            {r.cliente || "WALK IN"} {r.apellidos}
                          </span>
                          {/* El chip "Cupón <CODIGO>" se pinta dentro de <ReservaFlagsChips />. */}
                          <ReservaFlagsChips reserva={r} className="shrink-0" />
                        </span>
                        {r.telefono && (
                          <span className="truncate text-[10px] tabular-nums text-muted-foreground">
                            {r.telefono}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 text-center tabular-nums">{r.comensales}</span>
                      <span className="min-w-0 truncate text-[11px] text-muted-foreground" title={origenLabel(r.origen)}>
                        {origenLabel(r.origen)}
                      </span>
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
                      onBloquearMesa={pedirBloqueoMesa}
                      onDesplazarReserva={abrirDesplazar}
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
        <div className="relative flex-1 flex flex-col overflow-hidden">
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
              zonas={zonasSalaActual.filter((z) => zonaMatchSet.has(z.nombre.toUpperCase()))}
              decoraciones={decoracionesSalaActual}
              salaTieneZonas={zonasSalaActual.length > 0}
              selectedMesaId={selectedMesa?.id ?? null}
              selectedReservaMesaId={selectedReserva?.mesaId ?? null}
              mesasResaltadasIds={mesasResaltadasIds}
              onSelectMesa={handleSelectMesa}
              getEstadoMesa={getMesaEstadoTurno}
              getReservasMesa={getReservasMesa}
              onNueva={abrirNuevaConMesa}
              onEditar={abrirDetalleReserva}
              onCambiarEstado={cambiarEstadoReserva}
              onBloquearMesa={pedirBloqueoMesa}
              onDesplazarReserva={abrirDesplazar}
              onQuitarBloqueoMesa={handleQuitarBloqueoMesa}
              reservaMoviendo={reservaADesplazar}
              onElegirDestino={elegirMesaDestino}
              onCancelarMover={cancelarDesplazar}
              esOscuro={esOscuro}
            />
          ) : (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Misma barra del modo mover que en el plano. */}
              {reservaADesplazar && (
                <div className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-2 flex items-center gap-2 text-xs">
                  <Move className="h-4 w-4 shrink-0 text-sky-600 animate-pulse" />
                  <span className="min-w-0 truncate">
                    Moviendo{" "}
                    <span className="font-semibold">
                      {reservaADesplazar.cliente || "WALK IN"} {reservaADesplazar.apellidos}
                    </span>{" "}
                    · {reservaADesplazar.hora.slice(0, 5)} · {reservaADesplazar.comensales} pax —
                    pulsa la mesa destino.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] ml-auto shrink-0"
                    onClick={cancelarDesplazar}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
              {zonasSalaActual.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
                  Esta sala todavía no tiene zonas. Créalas en Configuración → Estructura.
                </div>
              ) : (
                zonasSalaActual
                  .filter((z) => zonaMatchSet.has(z.nombre.toUpperCase()))
                  .map((zona) => {
                    const mesasZona = mesasActivas
                      .filter((m) => (m.zona as unknown as string) === zona.nombre.toUpperCase())
                      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
                    if (mesasZona.length === 0) return null;
                    return (
                      <section key={zona.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide",
                              esOscuro ? "text-zinc-100" : "text-zinc-800",
                            )}
                            style={{ backgroundColor: colorZona(zona.colorPastel, esOscuro) }}
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
                            // Mismo modo mover que en el plano: con una reserva
                            // "en la mano", el clic elige mesa destino.
                            const moviendoAqui = reservaADesplazar != null;
                            const destinoInvalido =
                              moviendoAqui &&
                              (reservaADesplazar?.mesaId === m.id || estado === "BLOQUEADA");
                            return (
                              <Popover key={m.id}>
                                <PopoverTrigger asChild>
                                  <button
                                    className={cn(
                                      "h-20 rounded-md flex flex-col items-center justify-center text-[11px] font-bold shadow-sm border-2 transition-all cursor-pointer px-1",
                                      mesaBg[estado] ?? "",
                                      isLibre ? "text-foreground border-foreground/40" : "border-white/10",
                                      (selectedReserva?.mesaId === m.id ||
                                        selectedMesa?.id === m.id ||
                                        mesasResaltadasIds.has(m.id)) &&
                                        "ring-4 ring-red-500 z-10",
                                      moviendoAqui && !destinoInvalido && "cursor-copy ring-2 ring-sky-500 hover:ring-4 hover:scale-105 z-10",
                                      destinoInvalido && "opacity-40 cursor-not-allowed",
                                    )}
                                    style={isLibre ? { backgroundColor: colorZona(zona.colorPastel, esOscuro) } : undefined}
                                    onClick={(e) => {
                                      if (moviendoAqui) {
                                        e.preventDefault();
                                        if (!destinoInvalido) elegirMesaDestino(m);
                                        return;
                                      }
                                      handleSelectMesa(m);
                                    }}
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
                                    onBloquearMesa={pedirBloqueoMesa}
                                    onDesplazarReserva={abrirDesplazar}
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

      {/* Ficha de la reserva en dos columnas: a la izquierda todo lo que es la
          reserva (cuándo, dónde, en qué estado), a la derecha el cliente. Son
          dos cosas distintas y mezcladas cuesta encontrarlas. El botón de
          guardar va abajo, fijo, y sirve a los datos del cliente. */}
      <Dialog
        open={showDetalleReserva}
        onOpenChange={(v) => {
          // Cerrar sin guardar no deja los datos del cliente a medias: se
          // restauran los originales, que es lo que hay realmente en su ficha.
          if (!v) setClienteEdit(datosClienteOriginales);
          setShowDetalleReserva(v);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalle de reserva</DialogTitle></DialogHeader>
          {selectedReserva && (
            <div className="grid gap-6 text-sm md:grid-cols-2">

              {/* Vinculación pendiente de revisar: va lo primero y a lo ancho
                  de las dos columnas. Es lo más importante de esta ficha —los
                  datos que se ven abajo pueden no ser los de quien reservó— y
                  no se pinta nada cuando no hay nada que revisar. */}
              <div className="md:col-span-2 empty:hidden">
                <RevisionVinculacion
                  key={`${selectedReserva.id}-${actividadVersion}`}
                  reservaId={selectedReserva.id}
                  onResuelto={() => {
                    setActividadVersion((v) => v + 1);
                    void loadReservas(fecha);
                  }}
                />
              </div>

              {/* ── Columna izquierda: la reserva ─────────────────────────
                  Las dos mitades van sobre fondos distintos porque cuentan
                  cosas distintas: a la izquierda lo que le pasa a ESTA reserva
                  (mesa, hora, estado, sus etiquetas, sus correos), a la derecha
                  la persona, que sigue existiendo entre reserva y reserva. Sin
                  esa separacion las dos "Etiquetas" y las dos "Actividad" se
                  leian como lo mismo. */}
              <div className="space-y-3 rounded-lg border bg-muted/25 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Esta reserva
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Fecha y hora editables: mover una reserva era el caso
                      más común y no se podía hacer desde aquí. */}
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Fecha
                    </Label>
                    <Input
                      type="date"
                      className="h-8 text-sm font-medium"
                      disabled={guardandoCuando}
                      value={fechaEdit}
                      onChange={(e) => setFechaEdit(e.target.value)}
                      onBlur={() =>
                        guardarCuando(selectedReserva.id, "fecha", fechaEdit)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Hora
                    </Label>
                    <Input
                      type="time"
                      className="h-8 text-sm font-medium"
                      disabled={guardandoCuando}
                      value={horaEdit}
                      onChange={(e) => setHoraEdit(e.target.value)}
                      onBlur={() =>
                        guardarCuando(selectedReserva.id, "hora", horaEdit)
                      }
                    />
                  </div>
                  {/* El turno NO se elige: sale de la hora. Se enseña para que
                      se vea en qué mapa cae, pero no es un campo que se toque. */}
                  <Field label="Turno">
                    {selectedReserva.turno === "CENA" ? "Cena" : "Comida"}
                  </Field>
                  {/* Comensales: editable. Antes era solo lectura y la única
                      forma de corregir "somos dos más" era borrar la reserva y
                      volver a crearla. */}
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Comensales
                    </Label>
                    <NumberInput
                      min={1}
                      emptyValue={1}
                      decimales={false}
                      className="h-8 text-sm font-medium"
                      disabled={guardandoComensales}
                      value={comensalesEdit}
                      onValueChange={(n) => setComensalesEdit(n)}
                      onBlur={() =>
                        guardarComensales(selectedReserva.id, comensalesEdit)
                      }
                    />
                  </div>
                  <Field label="Zona">{zonaLabel(selectedReserva.zona ? String(selectedReserva.zona) : null)}</Field>
                  <Field label="Mesa">{mesas.find(m => m.id === selectedReserva.mesaId)?.codigo ?? "Sin asignar"}</Field>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground text-xs">Estado actual</Label>
                  <ReservaEstadoBadge estado={selectedReserva.estado} />
                </div>
                {/* Tiempo de ocupación de la mesa. Arranca en el valor por defecto
                    de la empresa y se puede ampliar en cualquier momento sobre la
                    marcha (mesa que se alarga), sin tocar la configuración. */}
                <div className="pt-2 border-t space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Tiempo de mesa</Label>
                  <Select
                    value={duracionEdit}
                    disabled={guardandoDuracion}
                    onValueChange={(v) => {
                      setDuracionEdit(v);
                      guardarDuracion(selectedReserva.id, v);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURACION_RESERVA_OPCIONES.map((o) => (
                        <SelectItem key={o.minutos} value={String(o.minutos)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(() => {
                    const efectiva =
                      selectedReserva.duracionMinutos ?? cfgReservas?.duracionReservaMin ?? null;
                    if (!efectiva) {
                      return (
                        <p className="text-[10px] text-muted-foreground">
                          Sin duración configurada.
                        </p>
                      );
                    }
                    const fin = horaMasMinutos(selectedReserva.hora, efectiva);
                    const def = cfgReservas?.duracionReservaMin;
                    return (
                      <>
                        <p className="text-[10px] text-muted-foreground">
                          Ocupa la mesa hasta las {fin}.
                          {def != null && <span className="align-super">*</span>}
                        </p>
                        {def != null && (
                          <p className="pt-1 text-[10px] text-muted-foreground/80">
                            <span className="align-super">*</span> Por defecto{" "}
                            {formatearDuracionReserva(def)}, según lo configurado en
                            ajustes.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
                {selectedReserva.observaciones && <Field label="Observaciones">{selectedReserva.observaciones}</Field>}
                {/* Cuándo se PIDIÓ la mesa, que no es cuándo es la reserva: dice
                    con cuánta antelación llegó. Informativo, nunca editable.
                    Se pinta en la zona de la empresa, no en la del navegador de
                    quien mira, y los días son enteros (24 h cumplidas): una
                    reserva de ayer a las 23:00 vista hoy a las 9:00 sigue
                    poniendo "hoy", porque no ha pasado un día completo. */}
                {selectedReserva.createdAt && (
                  <div className="pt-2 border-t space-y-0.5">
                    <Label className="text-muted-foreground text-xs">
                      Reserva hecha el
                    </Label>
                    <p className="text-sm font-medium">
                      {formatFechaHoraEnZona(
                        selectedReserva.createdAt,
                        empresaActual.zonaHoraria,
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {etiquetaDiasTranscurridos(
                        selectedReserva.createdAt,
                        tickAhora,
                      )}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <ReservaFlagsChips reserva={selectedReserva} insights={selectedInsights} size="md" />
                  <ReservaExternalBadge reserva={selectedReserva} />
                </div>
                <div className="pt-2 border-t space-y-1.5">
                  {/* "de la reserva" en el titulo: el cliente tiene sus PROPIAS
                      etiquetas en su columna, y sin apellido las dos se leian
                      como la misma cosa. */}
                  <Label className="text-muted-foreground text-xs">
                    Etiquetas de la reserva
                  </Label>
                  <EtiquetasPanel
                    scope="reserva"
                    entityId={selectedReserva.id}
                    clienteVinculadoId={selectedReserva.clienteId ?? null}
                  />
                </div>

                {/* Correos y actividad de ESTA reserva: viven en la columna de
                    la reserva, que es de lo que hablan. Antes estaban en la del
                    cliente y parecian suyos. */}
                <div className="pt-2 border-t">
                  <HistoricoEmailsReserva reservaId={selectedReserva.id} />
                </div>
                <div className="pt-2 border-t">
                  <ActividadReserva
                    key={actividadVersion}
                    reservaId={selectedReserva.id}
                  />
                </div>
                <div className="space-y-2 pt-2 border-t">
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

              {/* ── Columna derecha: el cliente ─────────────────────────── */}
              <div className="space-y-3 rounded-lg border border-sky-500/25 bg-sky-500/[0.06] p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  Ficha del cliente
                </h3>

                {/* Fiabilidad de un vistazo: si falla mucho, se decide aquí si
                    se le guarda la mesa. */}
                <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-2.5">
                  {[
                    { valor: selectedInsights?.visitasTotal ?? 0, label: "Visitas" },
                    { valor: selectedInsights?.noShows ?? 0, label: "No shows" },
                    { valor: selectedInsights?.canceladas ?? 0, label: "Canceladas" },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className="text-base font-semibold leading-none">{s.valor}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Nombre</Label>
                    <Input
                      className="h-8 text-xs"
                      value={clienteEdit.nombre}
                      onChange={(e) =>
                        setClienteEdit((p) => ({ ...p, nombre: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Apellidos</Label>
                    <Input
                      className="h-8 text-xs"
                      value={clienteEdit.apellidos}
                      onChange={(e) =>
                        setClienteEdit((p) => ({ ...p, apellidos: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Teléfono</Label>
                    <Input
                      type="tel"
                      className="h-8 text-xs"
                      value={clienteEdit.telefono}
                      onChange={(e) =>
                        setClienteEdit((p) => ({ ...p, telefono: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <Input
                      type="email"
                      className="h-8 text-xs"
                      value={clienteEdit.email}
                      onChange={(e) =>
                        setClienteEdit((p) => ({ ...p, email: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Al guardar, los datos se actualizan en la ficha del cliente y en todas sus reservas.
                </p>

                {/* Actividad DEL CLIENTE: los cambios de sus datos, se hayan
                    hecho aquí o desde su ficha. Va junto a los campos que la
                    generan, y separada de la actividad de la reserva —que está
                    más abajo y cuenta otra cosa: lo que le ha pasado a ESTA
                    reserva. Un walk-in sin ficha no tiene actividad de cliente. */}
                {selectedReserva.clienteId && (
                  <>
                    {/* Etiquetas DE LA PERSONA (alergias, VIP, moroso...): le
                        acompanan en todas sus reservas, a diferencia de las de
                        la reserva, que valen solo para esa noche. */}
                    <div className="pt-2 border-t border-sky-500/20 space-y-1.5">
                      <Label className="text-muted-foreground text-xs">
                        Etiquetas del cliente
                      </Label>
                      <EtiquetasPanel
                        scope="cliente"
                        entityId={selectedReserva.clienteId}
                        clienteVinculadoId={selectedReserva.clienteId}
                      />
                    </div>
                    <div className="pt-2 border-t border-sky-500/20">
                      <ActividadCliente
                        key={`${selectedReserva.clienteId}-${actividadVersion}`}
                        clienteId={selectedReserva.clienteId}
                      />
                    </div>
                  </>
                )}

              </div>

              {/* Guardar: abajo del todo y a lo ancho de las dos columnas.
                  `pb-28` por la regla de no tapar el chat flotante. */}
              <div className="md:col-span-2 flex justify-end border-t pt-4 pb-28">
                <Button
                  disabled={guardandoCliente}
                  onClick={() => guardarDatosCliente(selectedReserva.id)}
                >
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Editar los datos de un cliente reescribe SU ficha y todas sus reservas,
          no solo la abierta. Por eso se confirma, y la respuesta es binaria: se
          modifica la ficha, o los campos vuelven a los datos originales. No se
          permite guardar la reserva con datos distintos de los del cliente. */}
      <Dialog
        open={confirmCambioCliente !== null}
        onOpenChange={(v) => {
          // Cerrar por la X o por fuera equivale a NO modificar: se restaura.
          if (!v && confirmCambioCliente) {
            setClienteEdit(confirmCambioCliente.original);
            setConfirmCambioCliente(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modificar los datos del cliente</DialogTitle>
          </DialogHeader>
          {confirmCambioCliente && (
            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Estos datos son los de la ficha del cliente. Si los cambias, se
                actualizan en su ficha y en todas sus reservas.
              </p>
              <div className="rounded-md border divide-y">
                {confirmCambioCliente.cambios.map((c) => (
                  <div key={c.campo} className="grid grid-cols-[5rem_1fr] gap-2 px-3 py-2">
                    <span className="text-muted-foreground">{c.campo}</span>
                    <span className="min-w-0">
                      <span className="line-through text-muted-foreground break-words">
                        {c.antes}
                      </span>{" "}
                      <span className="font-medium break-words">{c.despues}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground">
                Si no quieres modificarlos, los campos vuelven a como estaban.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setClienteEdit(confirmCambioCliente.original);
                    setConfirmCambioCliente(null);
                  }}
                >
                  No modificar
                </Button>
                <Button
                  size="sm"
                  disabled={guardandoCliente}
                  onClick={() => guardarDatosCliente(confirmCambioCliente.reservaId)}
                >
                  Modificar la ficha
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bloquear mesa: solo para la fecha y el turno que hay en pantalla. Se
          confirma siempre porque saca la mesa del servicio, y se avisa si tenía
          reservas activas encima. */}
      <Dialog
        open={confirmBloqueo !== null}
        onOpenChange={(v) => { if (!v) setConfirmBloqueo(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmBloqueo ? `Bloquear mesa ${confirmBloqueo.mesa.codigo}` : ""}
            </DialogTitle>
          </DialogHeader>
          {confirmBloqueo && (
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">
                La mesa queda fuera de servicio el{" "}
                <span className="font-medium text-foreground">{fecha}</span> en{" "}
                <span className="font-medium text-foreground">
                  {turno === "COMIDA" ? "comida" : "cena"}
                </span>
                . Los demás días no se tocan.
              </p>
              {confirmBloqueo.reservasActivas > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 flex gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>
                    Esta mesa tiene {confirmBloqueo.reservasActivas}{" "}
                    {confirmBloqueo.reservasActivas === 1 ? "reserva" : "reservas"} en este
                    turno. Desplázalas antes o quedarán sobre una mesa bloqueada.
                  </span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmBloqueo(null)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={guardandoBloqueo}
                  onClick={() => bloquearMesaHoy(confirmBloqueo.mesa)}
                >
                  Bloquear
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Desplazar — aviso de solape. La mesa destino se elige en el plano; si
          pisa a otra(s) reserva(s) por horario, aquí se dice con quién y hasta
          qué hora, y el usuario decide si mueve igualmente o cancela. */}
      <Dialog
        open={choqueDesplazar !== null}
        onOpenChange={(v) => { if (!v) setChoqueDesplazar(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Esa mesa ya está ocupada a esa hora
            </DialogTitle>
          </DialogHeader>
          {choqueDesplazar && reservaADesplazar && (
            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Mover{" "}
                <span className="font-medium text-foreground">
                  {reservaADesplazar.cliente || "WALK IN"} {reservaADesplazar.apellidos}
                </span>{" "}
                ({reservaADesplazar.hora.slice(0, 5)} · {reservaADesplazar.comensales} pax) a la
                mesa <span className="font-medium text-foreground">{choqueDesplazar.mesa.codigo}</span>{" "}
                pisaría {choqueDesplazar.choques.length === 1 ? "esta reserva" : "estas reservas"}:
              </p>
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 divide-y divide-amber-500/20">
                {choqueDesplazar.choques.map((c) => (
                  <div key={c.reservaId} className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{c.cliente || "WALK IN"}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {c.horaInicio}–{c.horaFin} · {c.personas} pax · {c.mesa}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground">
                Si la mueves igualmente, las dos quedarán sobre la misma mesa a la vez.
              </p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setChoqueDesplazar(null)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={guardandoDesplazar}
                  onClick={() => aplicarDesplazamiento(reservaADesplazar, choqueDesplazar.mesa)}
                >
                  Mover igualmente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Mesa ya ocupada: al reactivar una reserva anulada (o al ampliar su
          tiempo) puede chocar con otra que haya entrado mientras tanto. Mismo
          lenguaje visual que el aviso de solape al crear. */}
      <Dialog open={avisoOcupada != null} onOpenChange={(v) => { if (!v) setAvisoOcupada(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Esta mesa ya está reservada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-xs">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2">
              {avisoOcupada}
            </div>
            <p className="text-muted-foreground">
              No se ha guardado el cambio. Cambia la mesa o la hora de esta reserva, o
              recoloca antes a la otra.
            </p>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAvisoOcupada(null)}>Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cambio de estado con correo asociado: lo decide el empleado, no el
          sistema. Se puede cambiar el estado sin avisar al cliente. */}
      <Dialog
        open={confirmEstado !== null}
        onOpenChange={(v) => { if (!v) setConfirmEstado(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmEstado
                ? `Pasar a ${ESTADO_RESERVA_LABELS[confirmEstado.estado].toLowerCase()}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            ¿Quieres avisar al cliente por correo de este cambio?
            {confirmEstado && (
              <>
                {" "}Se enviaría a{" "}
                <span className="font-medium text-foreground">{confirmEstado.email}</span>.
              </>
            )}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmEstado(null)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!confirmEstado) return;
                const c = confirmEstado;
                setConfirmEstado(null);
                aplicarEstadoReserva(c.id, c.estado, false);
              }}
            >
              Cambiar sin avisar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!confirmEstado) return;
                const c = confirmEstado;
                setConfirmEstado(null);
                aplicarEstadoReserva(c.id, c.estado, true);
              }}
            >
              Cambiar y avisar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
