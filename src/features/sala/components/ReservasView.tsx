"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { es } from "date-fns/locale";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { ahoraEnZona, formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { diaNegocioDe } from "@/features/sala/lib/dia-negocio";
import { useSincronizacionEnVivo } from "@/shared/hooks/useSincronizacionEnVivo";
import { useBloqueoCambioEmpresa } from "@/shared/hooks/useBloqueoCambioEmpresa";
import { Plus, Search, ChevronLeft, ChevronRight, Check, Move, Map as MapIcon, List as ListIcon, Lock, Table2 } from "lucide-react";
// Configuración solo se carga cuando el usuario pulsa "Configuración" — fuera del bundle inicial.
const ConfigReservasView = dynamic(
  () =>
    import("@/features/sala/components/reservas/config/ConfigReservasView").then(
      (m) => m.ConfigReservasView,
    ),
  { ssr: false },
);
// Igual que Configuración: la vista de cobros solo se descarga al pulsar el
// botón del billete, no en cada apertura del calendario.
const CobrosReservasView = dynamic(
  () =>
    import("@/features/sala/components/reservas/CobrosReservasView").then(
      (m) => m.CobrosReservasView,
    ),
  { ssr: false },
);
import { Settings, Sun, Moon, Banknote } from "lucide-react";
import { useSalaTema } from "@/features/sala/hooks/useSalaTema";
import { EtiquetasPanel } from "@/features/sala/components/reservas/EtiquetasPanel";
import { FichaClienteEstadisticas } from "@/features/sala/components/reservas/FichaClienteEstadisticas";
import {
  compararReservasPorJornada,
  franjasSolapan,
} from "@/features/sala/lib/reserva-conflicto";
import { esHoraEnCuarto } from "@/features/sala/lib/reserva-cuartos";
import { SelectorHoraCuartos } from "@/features/sala/components/reservas/SelectorHoraCuartos";
import {
  SelectorMesaConAvisos,
  AvisoAforoMesa,
  type EstadoMesaParaReserva,
} from "@/features/sala/components/reservas/SelectorMesaConAvisos";
import { EditorMesasReserva, codigosDeMesa } from "@/features/sala/components/reservas/EditorMesasReserva";
import { CalendarioMes } from "@/features/sala/components/reservas/CalendarioMes";
import { CalendarDays, Grid3X3, Users, LayoutGrid, AlertTriangle, Clock, Mail, CheckCircle2 } from "lucide-react";
import {
  SAMPLE_MESAS,
  Mesa, Reserva, EstadoReserva, ZonaSala, TurnoReserva,
  zonaLabel, ESTADO_RESERVA_LABELS, ESTADO_MESA_LABELS, ESTADOS_RESERVA,
  ESTADO_BADGE_CLASS,
  ESTADO_DOT_CLASS,
  ESTADOS_NO_OCUPANTES,
  ESTADOS_NO_ASISTEN,
  ESTADOS_OCULTOS_EN_LISTA,
  TIPO_RESERVA_CATEGORIA_LABELS,
  DURACION_RESERVA_MAX_MINUTOS,
  DURACION_RESERVA_MIN_MINUTOS,
  DURACION_RESERVA_DEFAULT_MINUTOS,
  DURACION_RESERVA_OPCIONES,
  formatearDuracionReserva,
  origenLabel,
  esReservaWalkIn,
  RESERVA_NOMBRE_MAX_CHARS,
  RESERVA_COMENTARIO_MAX_CHARS,
  RESERVA_APELLIDOS_MAX_CHARS,
  MAX_COMENSALES_SIN_REGLA,
} from "@/features/sala/data/reservas";
import { labelOrigen, ORIGENES_ALTA_SALA } from "@/features/sala/data/origenes";
import {
  PREFIJOS_TELEFONO,
  PREFIJO_POR_DEFECTO,
  separarPrefijo,
  componerTelefono,
  paisDeTelefono,
} from "@/features/sala/data/prefijos-telefono";
import { ReservaEstadoDot } from "@/features/sala/components/reservas/ReservaEstadoBadge";
import { EtiquetaChip } from "@/features/sala/components/reservas/config/EtiquetaChip";
import {
  listEtiquetasEfectivasDeReservas,
  type EtiquetaConOrigen,
} from "@/features/sala/actions/sala-etiquetas-actions";
import {
  listReservas,
  createReserva,
  updateReserva,
  intercambiarMesasReservas,
  notificarReservaCreadaPorEmail,
} from "@/features/sala/actions/reservas-actions";
import { CuponInputReserva } from "@/features/sala/cupones/components/CuponInputReserva";
import { validarCuponAdminAction } from "@/features/sala/cupones/actions/validar-cupon-action";
import { loadReservasModuleContext } from "@/features/sala/actions/reservas-module-context";
import { contarReservasPorCliente } from "@/features/sala/actions/reservas-conteo-cliente-actions";
import {
  createBloqueo,
  listBloqueoExcepciones,
  listBloqueos,
  quitarBloqueoMesa,
} from "@/features/sala/bloqueos/actions/bloqueos-actions";
import {
  vigenciaAplicaEnFecha,
  type BloqueoExcepcion,
  type ReservaBloqueo,
} from "@/features/sala/bloqueos/data/bloqueos";
import {
  COLORES_PASTEL_ZONAS,
  type Sala as SalaConfig,
  type Zona as ZonaReal,
  type PlanoMesaPosicion,
  type PlanoEncuadre,
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
import {
  proponerMesaAutomatica,
  type MesaPropuesta,
  type MotivoSinPropuesta,
} from "@/features/sala/actions/reserva-propuesta-mesa-actions";
import { useReglasSubmodulo } from "@/features/ajustes/hooks/use-reglas-submodulo";
import { LabelConRegla } from "@/shared/components/forms/LabelConRegla";
import { listReglasReservas } from "@/features/sala/reglas/actions/reglas-actions";
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
  ClienteInsights,
} from "@/features/sala/data/reservas";
import {
  ReservaFlagsChips,
  type ReservaDuplicada,
} from "@/features/sala/components/reservas/ReservaFlagsChips";
import {
  tipoDeReserva,
  TIPO_RESERVA_LABELS,
  type TipoReserva,
} from "@/features/sala/lib/tipo-reserva";
import { AvisoCobrosBanner } from "@/features/sala/components/reservas/AvisoCobrosBanner";
import { CobroPoliticaBloque } from "@/features/sala/components/reservas/CobroPoliticaBloque";
import { ReservaTiempoCelda } from "@/features/sala/components/reservas/ReservaTiempoCelda";
import {
  ColumnaListaHeader,
  type OrdenLista,
} from "@/features/sala/components/reservas/ColumnaListaHeader";
import { calcularTiempoReserva, minutosHastaReserva } from "@/features/sala/lib/reserva-tiempo";
import { ClienteReservasBadge } from "@/features/sala/components/reservas/ClienteReservasBadge";
import { ReservaExternalBadge } from "@/features/sala/components/reservas/ReservaExternalBadge";
import { HistoricoEmailsReserva } from "@/features/sala/components/reservas/HistoricoEmailsReserva";
import { ActividadReserva } from "@/features/sala/components/reservas/ActividadReserva";
import { RevisionVinculacion } from "@/features/sala/components/reservas/RevisionVinculacion";
import { ActividadCliente } from "@/features/sala/components/clientes/ActividadCliente";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useModoInmersivoActivo } from "@/features/layout/hooks/useModoInmersivoActivo";
import { useModoInmersivo } from "@/features/layout/contexts/modo-inmersivo-context";
import { friendlyError } from "@/shared/lib/friendly-errors";
// Color de zona: vive en `lib/color-zona` porque lo comparten el plano, el
// listado por zonas y el salón de reasignación manual de mesas.
import {
  colorZona,
  lightenHex,
  ZONA_LIGHTEN,
} from "@/features/sala/lib/color-zona";
import { formatearFechaEs } from "@/shared/lib/fecha";

/** Rampa pastel arcoíris construida con la paleta canónica de zonas. */
const LIBRE_RAINBOW = `linear-gradient(135deg, ${COLORES_PASTEL_ZONAS
  .map((c, i) => `${lightenHex(c, ZONA_LIGHTEN)} ${(i / (COLORES_PASTEL_ZONAS.length - 1)) * 100}%`)
  .join(", ")})`;

/**
 * Paleta de fondo de mesa por estado.
 *  - LIBRE: hereda el color pastel de su zona inline (aclarado en render).
 *  - OCUPADA: hay gente SENTADA en ella → verde OSCURO estilo CoverManager.
 *  - RESERVADA: reserva confirmada/reconfirmada pero aún no sentada → verde
 *    CLARO. La diferencia entre los dos es de luminosidad (oscuro = ya están,
 *    claro = todavía no), que es lo que se lee de lejos y en movimiento.
 *  - TERMINADA: ya han terminado de comer pero siguen en la mesa → ROSA, el
 *    mismo fucsia con el que se marca ese estado en la lista y en la ficha.
 *    Va aparte de OCUPADA a propósito: son los dos únicos estados con gente
 *    sentada, y para sala no es lo mismo una mesa comiendo que una a punto de
 *    quedar libre —es la que se prepara para el siguiente pase—. Antes las dos
 *    salían del mismo verde oscuro y no había forma de distinguirlas.
 *  - BLOQUEADA: negro.
 */
const mesaBg: Record<string, string> = {
  LIBRE: "",
  // El texto de cada mesa va en el color que MAS contraste da contra su fondo:
  // negro sobre los fondos claros (RESERVADA, TERMINADA) y blanco sobre el
  // verde oscuro de OCUPADA. El nombre de la mesa y su capacidad son lo que se
  // busca de un vistazo, asi que mandan ellos sobre el codigo de color.
  // Los dos verdes se separan A PROPOSITO por LUMINOSIDAD, no por tono: en
  // movimiento el ojo distingue claro/oscuro mucho antes que dos verdes
  // vecinos. Antes eran #34A85A y #4ADE80 —los dos verdes medios— y en pleno
  // servicio no habia forma de saber cual estaba sentada.
  // OCUPADA va oscuro y con el texto en BLANCO; RESERVADA claro y con el
  // texto en negro. El contraste del texto refuerza la lectura del estado.
  OCUPADA: "bg-[#15803D] hover:bg-[#166534] text-white",
  RESERVADA: "bg-[#86EFAC] hover:bg-[#6EE7A0] text-zinc-900",
  TERMINADA: "bg-[#E879F9] hover:bg-[#D946EF] text-zinc-900",
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

/** Mes en tres letras: "4 SEPTIEMBRE 2026" ocupaba media barra él solo. */
const MESES_ES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function formatFecha(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${MESES_ES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMes(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${MESES_ES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
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
 * Rejilla de la lista. El panel mide LISTA_ANCHO_PX y el ancho fijo tiene que
 * dejar sitio de verdad al nombre, que es por lo que se busca a la gente en
 * sala. Reparto: hora 46, mesa 58, per. 42, origen 58, tipo 64, estado 60,
 * tiempo 64 + 7 huecos de 6 px + 24 de padding = 458 px, y los ~210 px que
 * quedan son para el NOMBRE, que ha de caber con apellido.
 *
 * TIEMPO sube a 64 porque una mesa muy pasada de hora marca "+08:00" y en 52
 * se cortaba en "+08…", justo el dato que la columna existe para dar.
 *
 * PER. necesita 42, no 34: su cabecera no es solo el texto, tambien reserva
 * sitio para la flecha de ordenar, asi que a la palabra le quedaban 18 px de
 * los 34 y se leia "P…". Todas las cabeceras que filtran u ordenan pagan ese
 * peaje; en las demas columnas no se nota porque su texto ya cabe.
 *
 * HORA sube a 56 por lo mismo: con 46 px la palabra pagaba el peaje de la
 * flecha y se leia "Hor…". Los 10 px salen del NOMBRE, que sigue teniendo de
 * sobra; las horas de la celda ("22:45") ya cabian y no cambian.
 *
 * "Per." necesita 34: con 24 la cabecera se cortaba en "P.". Los 12 px que le
 * faltaban salen de ESTADO, que iba sobrado y además lleva `title`.
 *
 * La columna TIEMPO va la última: es un dato que se mira de reojo (cuánto
 * falta, cuánto se retrasa, cuánto lleva sentada), no uno que se lea en cada
 * fila. El ancho extra que necesita se lo cede el plano, que se escala solo.
 *
 * MESA sube a 72: su cabecera lleva DOS embudos en fila -el de la mesa y el
 * de la zona, que se ve en la misma celda debajo-, y en 58 px el segundo se
 * salia. Los codigos de mesa ("VIP1", "TE10") ya cabian de sobra en 58.
 */
/**
 * Ancho de la lista de reservas cuando se ve junto al plano.
 *
 * Manda en DOS sitios —el propio panel y el relleno que coloca los botones de
 * arriba sobre el plano—, así que vive aquí una sola vez: escrito a mano en
 * los dos, bastaba con tocar uno para que los botones dejaran de caer donde
 * empieza el plano.
 *
 * 668 px: al quitar la columna de Etiquetas (66 px y su hueco) la lista deja
 * de necesitar ese ancho, y lo que sobra se lo lleva el PLANO, que se escala
 * solo. El nombre no pierde sitio: sigue siendo la columna elastica.
 */
const LISTA_ANCHO_PX = 668;

/* ---------------------------------------------------------------------------
   DÍA DE NEGOCIO ↔ CALENDARIO
   ---------------------------------------------------------------------------
   La fecha de una reserva es un DÍA ("2026-09-05"), no un instante, así que se
   convierte a mano y NUNCA con `new Date("2026-09-05")`: esa forma la lee como
   UTC y en España se pinta el día anterior a partir de cierta hora. Se arma el
   Date con año/mes/día sueltos, que es hora local, y se deshace igual.
   --------------------------------------------------------------------------- */

/** "2026-09-05" → Date local de ese día. `undefined` si no es una fecha. */
function fechaDesdeDiaNegocio(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Date → "2026-09-05", con los números del calendario local. */
function aDiaNegocio(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "2026-09-05" → "05/09/2026". Día/mes/año, el formato del software. */
function formatFechaDiaNegocio(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

const LISTA_GRID =
  // Hora · Mesa · Nombre · Per · Origen · Tipo · Estado · Tiempo.
  // Origen y Tipo suben porque "Cancelación" y los origenes largos se cortaban
  // a media palabra; el resto del ancho se lo queda el NOMBRE, que es el dato
  // por el que se busca a la gente en sala.
  //
  // Las etiquetas ya NO tienen columna: van pegadas al telefono, dentro de la
  // celda del nombre. Son avisos cortos ("alergico", "VIP") que se leen junto a
  // la persona a la que avisan, y la columna que ocupaban se la queda el NOMBRE.
  //
  // NOMBRE Y APELLIDO ENTEROS es la regla que manda aquí: "Ferran Viñals
  // Carm…" no sirve para cantar una mesa en sala. Las demás columnas se
  // aprietan a lo justo de su texto (todas llevan `title` con el valor
  // completo, así que recortarlas no pierde el dato) y lo que sueltan se lo
  // queda el nombre. Los chips que van pegados al nombre (visitas, cupón,
  // reconfirmación) no se cuentan: solo salen en algunas filas.
  "grid grid-cols-[56px_72px_minmax(0,1fr)_42px_58px_64px_60px_64px] gap-1.5 items-center";

/**
 * TIPO de la reserva: cuál de las cuatro es (PRP-082).
 *
 * No se deduce aquí: lo resuelve `tipoDeReserva()`, que es la fuente única y
 * ya aplica el orden de prioridad (ticket → garantía → cancelación → gratis).
 * Inventar la cuenta en la celda es justo lo que hacía que cada pantalla
 * dijera una cosa distinta.
 *
 * En la columna se usan etiquetas cortas porque "Política de cancelación" no
 * cabe; el nombre completo va en el `title`.
 */
const TIPO_RESERVA_CORTO: Record<TipoReserva, string> = {
  ticket: "Ticket",
  garantia: "Garantía",
  cancelacion: "Cancelación",
  gratis: "Gratis",
};

/**
 * El color mide el RIESGO DE QUE TE DEJEN TIRADO, no el tipo de cobro:
 *
 *   · Ticket (verde)      → ya pagó. Si no viene, el dinero está cobrado.
 *   · Garantía (naranja)  → el importe está retenido: se cobra seguro, pero
 *                           la retención caduca y hay que capturarla a tiempo.
 *   · Cancelación (rojo)  → solo hay una tarjeta guardada. Es la única en la
 *                           que el cobro puede fallar (sin fondos, caducada),
 *                           así que es la que más te puede dejar tirado.
 *   · Gratis (gris)       → sin compromiso: si no viene, no hay nada.
 */
const TIPO_RESERVA_COLOR: Record<TipoReserva, string> = {
  ticket: "text-emerald-600 dark:text-emerald-400",
  garantia: "text-orange-600 dark:text-orange-400",
  cancelacion: "text-red-600 dark:text-red-400",
  gratis: "text-muted-foreground",
};

function TipoReservaCelda({ reserva }: { reserva: Reserva }) {
  const tipo = tipoDeReserva({
    esTicket: reserva.esTicket,
    tieneGarantia: reserva.tieneGarantia,
    garantiaImporte: reserva.garantiaImporte,
    tieneCancelacion: reserva.tieneCancelacion,
    cancelacionImporte: reserva.cancelacionImporte,
  });

  return (
    <span
      className={cn(
        "min-w-0 truncate text-[11px]",
        tipo === "gratis" ? "" : "font-medium",
        TIPO_RESERVA_COLOR[tipo],
      )}
      title={TIPO_RESERVA_LABELS[tipo]}
    >
      {TIPO_RESERVA_CORTO[tipo]}
    </span>
  );
}

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

// Selector rápido compartido entre la fila de lista y la mesa del plano.
//
// Reparto de la ventana, de arriba abajo:
//   · Cabecera — mesa/zona y el CANDADO que saca la mesa del servicio.
//   · Ficha de la reserva.
//   · "Editar" + "Desplazar", los dos grandes y al mismo nivel: mover a
//     alguien de mesa se hace tanto como abrir su ficha.
//   · Estados de servicio: Confirmada · Sentada · Terminada · Liberada.
//   · No show y Cancelada, anchos y aparte: son los dos finales que cierran
//     la reserva sin que el cliente se haya sentado.
//
// Crear una reserva NO se hace desde aquí: para eso está el botón "Nuevo" de
// la cabecera del módulo, que es el único sitio donde se dan de alta.
function ReservaQuickPopover({
  mesa,
  reserva,
  onEditar,
  onCambiarEstado,
  onBloquearMesa,
  onDesplazarReserva,
  onWalkIn,
  desdeLista = false,
  sinCabecera = false,
}: {
  mesa: Mesa | null;
  reserva: Reserva | null;
  onEditar: () => void;
  onCambiarEstado: (id: string, estado: EstadoReserva) => void;
  /**
   * Sentar a alguien que llega sin reservar en esta mesa. Solo se ofrece con la
   * mesa libre y desde el plano: es el gesto de sala más frecuente y antes no
   * tenía sitio en la interfaz (encargados, 4-sep-2026).
   */
  onWalkIn?: (m: Mesa) => void;
  /**
   * Bloquea para la fecha y turno en pantalla. `mesa` es la mesa concreta que
   * se pulsó en el plano; desde la lista llega null y entonces se bloquean
   * TODAS las mesas de la reserva.
   */
  onBloquearMesa: (m: Mesa | null, r: Reserva | null) => void;
  /** Abre el selector de mesa destino para mover la reserva. */
  onDesplazarReserva: (r: Reserva) => void;
  /**
   * Se ha abierto desde el LISTADO, no pulsando una mesa del plano. Aquí el
   * usuario no ha señalado ninguna mesa en concreto, así que el candado
   * bloquea todas las que tenga la reserva.
   */
  desdeLista?: boolean;
  /**
   * La mesa y el candado ya los pinta quien envuelve (la mesa con VARIAS
   * reservas), asi que aqui se ocultan: repetir "Mesa A1" por cada reserva
   * gastaba el alto que hacia falta para que cupieran todas.
   */
  sinCabecera?: boolean;
}) {
  /**
   * Estados de servicio, en el orden en que ocurren durante el pase.
   *
   * "Sentada" guarda SENTADA. Antes guardaba WALK_IN, y eso estaba mal: WALK_IN
   * es el ORIGEN de la reserva (cliente que llegó sin reservar), asi que sentar
   * a un cliente que SI habia reservado le borraba por donde habia entrado
   * (`updateReserva` fuerza `origen = 'WALKIN'` en ese estado).
   */
  const ESTADOS_SERVICIO: EstadoReserva[] = [
    "CONFIRMADA",
    "SENTADA",
    "TERMINANDO",
    "LIBERADA",
  ];

  /** Los dos finales en los que el cliente no llega a comer. */
  const ESTADOS_FIN: EstadoReserva[] = ["NO_SHOW", "CANCELADA"];


  // Desde la lista no hay mesa señalada: el candado va sin mesa concreta y
  // quien bloquea resuelve todas las de la reserva.
  const mesaDelCandado = desdeLista ? null : mesa;

  // Hay algo que bloquear siempre que se sepa qué mesa: la pulsada en el
  // plano, o las que tenga asignadas la reserva abierta desde la lista. Una
  // reserva sin mesa no se puede bloquear: no hay nada que sacar del servicio.
  const puedeBloquear = mesaDelCandado != null
    || (reserva?.mesaCodigo ?? "").trim().length > 0
    || (reserva?.mesaId ?? "").length > 0;

  const tituloCandado = mesaDelCandado
    ? `Bloquear la mesa ${mesaDelCandado.codigo} en este turno`
    : "Bloquear las mesas de esta reserva en este turno";

  return (
    <div className="space-y-2">
      {!sinCabecera && (
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-bold text-sm">
            {mesa ? `Mesa ${mesa.codigo}` : "Sin mesa asignada"}
          </h4>
          <div className="flex items-center gap-1.5">
            {mesa && (
              <Badge variant="outline" className="text-[10px]">
                {zonaLabel(mesa.zona ? String(mesa.zona) : null)} · {mesa.capacidad}p
              </Badge>
            )}
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 shrink-0"
              disabled={!puedeBloquear}
              title={tituloCandado}
              aria-label={tituloCandado}
              onClick={() => onBloquearMesa(mesaDelCandado, reserva)}
            >
              <Lock className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {sinCabecera ? null : reserva ? (
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
            {reserva.hora} · {reserva.comensales} per
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground py-1">Mesa libre</div>
          {mesa && onWalkIn && (
            <Button
              size="sm"
              className="h-9 w-full text-xs"
              onClick={() => onWalkIn(mesa)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Walk-in
            </Button>
          )}
        </div>
      )}
      {reserva && (
        <>
          {/* Las dos acciones que se usan a diario, del mismo tamaño: mover
              una reserva de mesa pesa tanto como abrir su ficha. */}
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="outline" className="h-9 text-xs" onClick={onEditar}>
              Editar
            </Button>
            <Button
              size="sm"
              className="h-9 text-xs"
              onClick={() => onDesplazarReserva(reserva)}
            >
              <Move className="h-3.5 w-3.5 mr-1" />
              Desplazar
            </Button>
          </div>
          {/* Los SEIS estados, todos del mismo tamaño. Antes los cuatro de
              servicio iban en botones pequeños y "No show"/"Cancelada" en
              grandes: al ser la misma decision (en que estado queda la
              reserva) no hay razon para que unos pesen mas que otros. */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t">
            {[...ESTADOS_SERVICIO, ...ESTADOS_FIN].map((e) => (
              <Button
                key={e}
                size="sm"
                variant="outline"
                className={cn(
                  "h-9 text-xs justify-center gap-1.5",
                  reserva.estado === e && "ring-1 ring-primary",
                )}
                onClick={() => onCambiarEstado(reserva.id, e)}
              >
                <ReservaEstadoDot estado={e} className="w-2 h-2" />
                <span className="truncate">{ESTADO_RESERVA_LABELS[e]}</span>
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Contenido del popover de una mesa. Normalmente es una sola reserva, pero una
 * misma mesa puede tener DOS en el mismo turno (doble servicio): entonces se
 * apilan una debajo de otra, la mas temprana ARRIBA, para que el orden en el
 * que van a llegar los clientes se lea de arriba abajo sin pensarlo.
 *
 * `reservas` llega ya ordenado por hora desde `getReservasMesa`.
 */
function MesaReservasPopover({
  mesa,
  reservas,
  onEditar,
  onCambiarEstado,
  onBloquearMesa,
  onDesplazarReserva,
  onWalkIn,
}: {
  mesa: Mesa | null;
  reservas: Reserva[];
  onEditar: (r: Reserva) => void;
  onCambiarEstado: (id: string, estado: EstadoReserva) => void;
  onBloquearMesa: (m: Mesa | null, r: Reserva | null) => void;
  onDesplazarReserva: (r: Reserva) => void;
  onWalkIn?: (m: Mesa) => void;
}) {
  // Una sola reserva (o ninguna): el popover de siempre, sin nada alrededor.
  if (reservas.length <= 1) {
    return (
      <ReservaQuickPopover
        mesa={mesa}
        reserva={reservas[0] ?? null}
        onEditar={() => { if (reservas[0]) onEditar(reservas[0]); }}
        onCambiarEstado={onCambiarEstado}
        onBloquearMesa={onBloquearMesa}
        onDesplazarReserva={onDesplazarReserva}
        onWalkIn={onWalkIn}
      />
    );
  }

  return (
    <MesaVariasReservas
      mesa={mesa}
      reservas={reservas}
      onEditar={onEditar}
      onCambiarEstado={onCambiarEstado}
      onBloquearMesa={onBloquearMesa}
      onDesplazarReserva={onDesplazarReserva}
    />
  );
}

/**
 * Mesa con VARIAS reservas en el mismo turno (doble o triple servicio).
 *
 * Cada reserva traia debajo su bloque entero de acciones —Editar, Desplazar y
 * los seis estados—, unos 190 px por reserva: con dos el desplegable ya se
 * salia por arriba de la pantalla y la primera reserva quedaba cortada, sin
 * verse ni el nombre. Con tres era imposible.
 *
 * Ahora las reservas se leen TODAS de un vistazo —hora, nombre, personas y
 * estado, una linea cada una, la mas temprana arriba— y las acciones salen
 * solo para la que se pulsa. Con tres reservas el desplegable sigue cabiendo.
 *
 * Arranca con la primera abierta: en el caso normal (dos reservas) se sigue
 * llegando a lo que se busca sin un clic de mas.
 */
function MesaVariasReservas({
  mesa,
  reservas,
  onEditar,
  onCambiarEstado,
  onBloquearMesa,
  onDesplazarReserva,
}: {
  mesa: Mesa | null;
  reservas: Reserva[];
  onEditar: (r: Reserva) => void;
  onCambiarEstado: (id: string, estado: EstadoReserva) => void;
  onBloquearMesa: (m: Mesa | null, r: Reserva | null) => void;
  onDesplazarReserva: (r: Reserva) => void;
}) {
  const [abiertaId, setAbiertaId] = useState<string | null>(reservas[0]?.id ?? null);
  const abierta = reservas.find((r) => r.id === abiertaId) ?? null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold">
          {mesa ? `Mesa ${mesa.codigo}` : "Sin mesa asignada"}
        </h4>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {reservas.length} reservas
          </Badge>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 shrink-0"
            disabled={mesa == null}
            title={mesa ? `Bloquear la mesa ${mesa.codigo} en este turno` : "Bloquear la mesa"}
            aria-label={mesa ? `Bloquear la mesa ${mesa.codigo} en este turno` : "Bloquear la mesa"}
            onClick={() => onBloquearMesa(mesa, abierta)}
          >
            <Lock className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {/* Las reservas del turno, en orden de llegada. La abierta se marca con
          el borde para saber a cual pertenecen las acciones de abajo. */}
      <div className="space-y-1">
        {reservas.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setAbiertaId(r.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
              r.id === abiertaId ? "border-primary bg-muted/50" : "hover:bg-muted/40",
            )}
          >
            <span className="shrink-0 text-xs font-semibold tabular-nums">
              {r.hora.slice(0, 5)}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {r.cliente || "WALK IN"} {r.apellidos}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
              {r.comensales} per
            </span>
            <ReservaEstadoDot estado={r.estado} className="h-2 w-2 shrink-0" />
          </button>
        ))}
      </div>
      {/* Acciones de la reserva elegida. Es el mismo bloque de siempre, pero
          uno solo en vez de uno por reserva. */}
      {abierta && (
        <div className="border-t pt-2">
          <ReservaQuickPopover
            mesa={mesa}
            reserva={abierta}
            sinCabecera
            onEditar={() => onEditar(abierta)}
            onCambiarEstado={onCambiarEstado}
            onBloquearMesa={onBloquearMesa}
            onDesplazarReserva={onDesplazarReserva}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Las tres formas de dar de alta a un cliente desde sala. Es UN solo
 * formulario con tres modos, no tres pantallas: cambian los datos que se
 * piden y el estado con el que nace, pero el resto (fecha, hora, personas,
 * zona, notas) es común.
 *
 * - `CLIENTE`: la reserva normal. Alguien llama y reserva para más tarde.
 * - `WALKIN`: llegó sin reservar y se sienta ya. No hay ficha de cliente.
 * - `LISTA_ESPERA`: híbrido. Está en la puerta como el walk-in, pero no hay
 *   mesa libre: se le apunta con sus datos y se le avisa cuando la haya.
 */
type TipoAltaReserva = "CLIENTE" | "WALKIN" | "LISTA_ESPERA";

function NuevaReservaForm({ fecha, turno, onClose, onSave, mesaPreseleccionada, tipoAltaInicial = "CLIENTE", zonasReales, mesas, mesasMeta, localId, empresaId, getEstadoMesa }: {
  fecha: string; turno: TurnoReserva;
  onClose: () => void;
  mesaPreseleccionada?: Mesa | null;
  /** Abre el formulario ya en un modo concreto (viene de "Sentar walk-in" en el plano). */
  tipoAltaInicial?: TipoAltaReserva;
  zonasReales: ZonaReal[];
  mesas: Mesa[];
  /** Capacidades reales del catálogo (min/max) para avisar de aforo de mesa. */
  mesasMeta: Map<string, MesaMeta>;
  localId: string;
  /** Empresa activa: acota la escucha en vivo a sus propias reservas. */
  empresaId: string | null;
  getEstadoMesa: (m: Mesa) => string;
  onSave: (r: Reserva & {
    tipoCategoria?: TipoReservaCategoria | null;
    garantiaImporte?: number | null;
    importePagado?: number | null;
    duracionMinutos?: number | null;
    notificarEmail?: boolean;
    codigoCupon?: string | null;
    origen?: string | null;
    /** El local aceptó el aviso y sienta igual en una mesa bloqueada. */
    forzarMesaBloqueada?: boolean;
  }) => void;
}) {
  const [form, setForm] = useState({
    // El teléfono se guarda SIEMPRE con prefijo: un número sin él no sirve
    // para llamar a quien no es del país y además duplica fichas de cliente.
    cliente: "", apellidos: "", telefonoPrefijo: PREFIJO_POR_DEFECTO, telefono: "", email: "",
    fecha, hora: "", turno,
    // Siempre 2 por defecto: la capacidad de la mesa no dice cuánta gente viene.
    comensales: 2,
    zona: (mesaPreseleccionada?.zona ?? "") as ZonaSala | "",
    mesaId: (mesaPreseleccionada?.id ?? "") as string,
    observaciones: "", tipoAlta: tipoAltaInicial as TipoAltaReserva,
    // Un alta desde el back-office entra por teléfono salvo que digan otra
    // cosa: es como llega la inmensa mayoría. En walk-in no se usa este valor
    // (lo fija `emitirReserva`), pero se conserva por si vuelve a Cliente.
    origen: "TELEFONO" as string,
    tipoCategoria: "gratis" as TipoReservaCategoria | "",
    garantiaImporte: "" as string,
    importePagado: "" as string,
    /** Si el usuario tocó la duración → guarda override; vacío = default empresa. */
    duracionMinutos: "" as string,
    duracionTouched: false as boolean,
    codigoCupon: "" as string,
  });
  /**
   * Walk-in puro: el cliente ya está sentado y no deja datos. Es lo único que
   * apaga los campos de la ficha y el cobro.
   *
   * La lista de espera NO entra aquí: sí pide nombre y teléfono, porque el
   * sentido de apuntarse es que te avisen cuando haya mesa.
   */
  const esWalkIn = form.tipoAlta === "WALKIN";
  /**
   * Lista de espera: aún no hay mesa. Se apunta al cliente y se le asigna
   * cuando alguna quede libre, así que aquí no se elige mesa ni se comprueba
   * si choca con otra reserva — no ocupa nada todavía.
   */
  const esListaEspera = form.tipoAlta === "LISTA_ESPERA";
  /**
   * Ni garantía, ni prepago, ni cupón. El walk-in ya está sentado y la lista
   * de espera todavía no tiene mesa: en ninguno de los dos hay nada que
   * garantizar ni que cobrar por adelantado.
   */
  const sinCobro = esWalkIn || esListaEspera;
  const [cuponValido, setCuponValido] = useState<boolean | null>(null);
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
  /** Sube cada vez que cambia algo en reservas: obliga a repedir los slots. */
  const [disponibilidadVersion, setDisponibilidadVersion] = useState(0);
  /**
   * Aviso pendiente de aceptar, con TODOS los motivos de peligro juntos.
   * Mientras esté relleno el guardado espera: el usuario debe confirmar que
   * asume lo que se le detalla (pisar reservas y/o meter un grupo que no cabe).
   */
  const [aviso, setAviso] = useState<{
    choques: ChoqueReserva[];
    aforo: { tipo: "excede" | "insuficiente"; min: number; max: number } | null;
    /**
     * La mesa está bloqueada en este turno. No impide guardar —el local manda—
     * pero no se pasa de aquí sin que alguien lo lea y lo acepte.
     */
    bloqueada: boolean;
    mesaCodigo: string;
    capacidad: number;
  } | null>(null);
  const [comprobandoSolape, setComprobandoSolape] = useState(false);
  // El formulario no regaña de entrada: los avisos de campos obligatorios solo
  // aparecen cuando el usuario ya ha intentado guardar al menos una vez.
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  /**
   * Último paso de toda reserva interna: decidir si además de confirmarla se
   * avisa al cliente por correo. Se abre cuando ya no queda nada que validar,
   * y solo si hay email al que escribir (en walk-in o sin email no hay
   * decisión que tomar, se guarda directo).
   */
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);
  /**
   * Asignación automática ("— El sistema elige la mesa —").
   *
   * El sistema NUNCA asigna a ciegas: propone, y la reserva solo se crea con
   * esa mesa cuando el usuario acepta expresamente la propuesta. Mientras este
   * estado está relleno, el guardado espera.
   *
   *   propuesta → mesa encontrada: se enseña cuál y dónde está (sala y zona).
   *   fallo     → no hay mesa posible, con el motivo distinguido:
   *               SIN_CAPACIDAD deja elegir mesa a mano; el resto, no.
   */
  const [propuesta, setPropuesta] = useState<MesaPropuesta | null>(null);
  const [fallo, setFallo] = useState<{
    motivo: MotivoSinPropuesta;
    libresNoAptas: MesaPropuesta[];
    zonaBuscada: string | null;
  } | null>(null);
  const [buscandoMesa, setBuscandoMesa] = useState(false);
  /**
   * Código de la mesa aceptada en la propuesta automática cuando no se puede
   * representar con el `mesaId` del formulario: una unión ("M1+M2") o una mesa
   * de otra sala que no está en el catálogo cargado en pantalla. Viaja aparte
   * porque `setForm` no se ha aplicado aún al encadenar desde la propuesta.
   */
  const [mesaCodigoAutoRef, setMesaCodigoAuto] = useState<string | null>(null);

  // Autocompletado de clientes: cualquiera de los cuatro datos de contacto
  // sirve para buscar, a partir de 5 caracteres escritos.
  type CampoBusqueda = "cliente" | "apellidos" | "telefono" | "email";
  const [campoActivo, setCampoActivo] = useState<CampoBusqueda | null>(null);
  const [sugerencias, setSugerencias] = useState<ClienteSugerencia[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, e] = await Promise.all([
        getReservasConfig(),
        listReglasReservas(),
      ]);
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
  // dato que altere la respuesta: fecha, turno, zona, nº de comensales (una
  // mesa de 2 no sirve para 6, así que subir el grupo cambia qué horas caben)
  // y DURACIÓN, porque una reserva más larga solapa con más reservas.
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
        duracionMin: Number(form.duracionMinutos) || null,
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
  }, [
    form.fecha,
    form.turno,
    form.comensales,
    form.zona,
    form.duracionMinutos,
    localId,
    // Cada aviso de la sincronización en vivo fuerza un recálculo: mientras
    // este formulario está abierto pueden entrar reservas por el portal o por
    // otro puesto, y las horas y mesas que se ofrecen tienen que ser las de
    // AHORA, no las de cuando se abrió la ventana.
    disponibilidadVersion,
  ]);

  /**
   * Reservas que entran, cambian o se anulan mientras se rellena este alta.
   *
   * No se toca nada de lo escrito: solo se sube un contador que vuelve a pedir
   * la disponibilidad. Así los ⏰ del desplegable de horas y los iconos de las
   * mesas se corrigen solos, sin cerrar y reabrir la ventana.
   */
  useSincronizacionEnVivo({
    tablas: ["reservas"],
    empresaId: empresaId ?? null,
    onCambio: () => setDisponibilidadVersion((v) => v + 1),
    margenMs: 200,
  });

  useEffect(() => {
    if (esWalkIn || !campoActivo) {
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
  }, [form.cliente, form.apellidos, form.telefono, form.email, esWalkIn, campoActivo]);

  const maxPax = useMemo(
    () => maxpaxEfectivoDesdeReglas(reglas, form.fecha, form.turno),
    [reglas, form.fecha, form.turno],
  );

  const excedeMaxPax = maxPax != null && form.comensales > maxPax;
  const muestraAvisoPax = paxTouched && excedeMaxPax;

  /**
   * Tamaños de grupo que ofrece el desplegable de comensales.
   *
   * Llega hasta el máximo configurado para ese día y turno. Si una reserva ya
   * guardada tiene más gente (porque el tope se bajó después, o venía de un
   * grupo autorizado a mano) su valor se añade igualmente: el desplegable no
   * puede perder el dato de una reserva existente al abrirla.
   */
  const opcionesComensales = useMemo(() => {
    const tope = maxPax != null && maxPax > 0 ? maxPax : MAX_COMENSALES_SIN_REGLA;
    const nums = Array.from({ length: tope }, (_, i) => i + 1);
    if (form.comensales > tope) nums.push(form.comensales);
    return nums;
  }, [maxPax, form.comensales]);

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
    // La lista de espera no tiene conflicto posible: se apunta a alguien
    // precisamente porque a esa hora no hay mesa. Marcarlo en ámbar sería
    // avisar de lo que se está haciendo a propósito.
    if (esListaEspera) return false;
    if (!slotElegido) return false;
    if (mesaBanner) return mesaOcupadaEn(slotElegido, mesaBanner.codigo);
    return !slotElegido.hayMesaLibre;
  }, [esListaEspera, slotElegido, mesaBanner, mesaOcupadaEn]);

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

  /**
   * Diagnóstico de CADA mesa para la hora y el grupo actuales: es lo que pinta
   * ✅ / ⏰ / 👥 en el desplegable. Se recalcula al cambiar hora o comensales,
   * y `codigosOcupadosAhora` viene del último cálculo de disponibilidad, así
   * que una reserva que entre por otro sitio se refleja aquí sin reabrir nada.
   */
  const estadoPorMesa = useMemo(() => {
    const out = new Map<string, EstadoMesaParaReserva>();
    for (const m of mesasSeleccionables) {
      out.set(m.id, {
        ocupada: codigosOcupadosAhora.has(m.codigo.toUpperCase()),
        aforo: aforoMesa(m.id, form.comensales),
      });
    }
    return out;
  }, [mesasSeleccionables, codigosOcupadosAhora, aforoMesa, form.comensales]);

  // Al elegir mesa se fija también su zona: la mesa siempre trae la suya, y así
  // el dato guardado en la reserva y el selector de zona no pueden divergir.
  // Los comensales NO se tocan: son un dato del cliente, no de la mesa (antes
  // se subían a la capacidad de la mesa, convirtiendo 2 per en 15 al elegir A1).
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

  /**
   * Qué falta por rellenar, en lenguaje del usuario. No bloquea el botón: se
   * enseña solo cuando se intenta guardar, para no recibir al usuario con un
   * aviso rojo antes de haber escrito nada.
   */
  const camposQueFaltan = useMemo(() => {
    const faltan: string[] = [];
    if (!esWalkIn) {
      if (!form.cliente.trim()) faltan.push("nombre");
      // El teléfono NO se consulta a la configuración: es obligatorio siempre,
      // como el nombre o la fecha. Es el único contacto que sirve para avisar al
      // cliente de un cambio de última hora — y en la lista de espera es LA
      // razón de apuntarse: sin número no hay forma de avisar de que hay mesa.
      if (!form.telefono.trim()) faltan.push("teléfono");
    }
    // Apellidos, email y origen solo se exigen en la reserva normal. Quien
    // espera en la puerta deja el nombre y el móvil y poco más: pedirle la
    // ficha entera mientras hace cola es lo que llevaba a inventarse datos.
    if (form.tipoAlta === "CLIENTE") {
      if (!form.apellidos.trim()) faltan.push("apellidos");
      if (reservaRequiere("email") && !form.email.trim()) faltan.push("email");
      // El canal por el que entra la reserva es un dato obligatorio: sin él la
      // analítica de origen miente. No se pregunta ni en walk-in ni en lista de
      // espera porque lo fija el propio tipo de alta.
      if (!form.origen.trim()) faltan.push("origen");
    }
    if (!form.fecha) faltan.push("fecha");
    if (!form.hora) faltan.push("hora");
    if (!form.turno) faltan.push("turno");
    if (!form.comensales || form.comensales < 1) faltan.push("comensales");
    // La mesa NO entra aquí: dejarla en "— El sistema elige la mesa —" es una
    // elección válida, no un campo sin rellenar. Lo que hace el sistema con esa
    // elección (proponer una mesa y esperar a que se acepte) se resuelve al
    // guardar, en `handleSave`.
    return faltan;
  }, [
    esWalkIn,
    form.tipoAlta,
    form.origen,
    form.cliente,
    form.apellidos,
    form.telefono,
    form.email,
    form.fecha,
    form.hora,
    form.turno,
    form.comensales,
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
      // La ficha puede traerlo con prefijo o sin él (números antiguos): se
      // parte para que el selector y el campo queden coherentes.
      telefonoPrefijo: separarPrefijo(c.telefono).prefijo,
      telefono: separarPrefijo(c.telefono).numero,
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
    if (guardarBloqueado || comprobandoSolape || buscandoMesa) return;
    // Aquí es donde el formulario se permite avisar: solo al intentar guardar.
    setIntentoGuardar(true);
    if (camposQueFaltan.length > 0) return;
    // La lista de espera se guarda directa: no hay mesa que buscar, ni choque
    // que comprobar, ni aforo que validar. Precisamente se apunta a alguien
    // porque AHORA no hay mesa; la asignación llega después, cuando se libere.
    if (esListaEspera) {
      pedirConfirmacion();
      return;
    }
    const mesa = mesas.find((m) => m.id === (form.mesaId || mesaPreseleccionada?.id));
    if (!mesa) {
      // Sin mesa elegida a mano manda la ASIGNACIÓN AUTOMÁTICA: el sistema
      // busca una mesa válida y la propone. Nunca se crea la reserva con una
      // mesa que el usuario no haya visto y aceptado.
      //
      // Los walk-in quedan fuera: el cliente ya está en la puerta y se le
      // sienta en el momento, así que no hay nada que proponer por adelantado.
      if (esWalkIn || !localId) {
        pedirConfirmacion();
        return;
      }
      await buscarMesaAutomatica();
      return;
    }
    const aforo = aforoMesa(mesa.id, form.comensales);
    // 🔒 BLOQUEO — la mesa está fuera de servicio en este turno. Al local no se
    // le prohíbe usarla, pero tiene que saberlo antes de sentar a nadie.
    const bloqueada = getEstadoMesa(mesa) === "BLOQUEADA";
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
    if (choques.length > 0 || aforo || bloqueada) {
      setAviso({ choques, aforo, bloqueada, mesaCodigo: mesa.codigo, capacidad: mesa.capacidad });
      return;
    }
    pedirConfirmacion();
  };

  /**
   * Asignación automática: busca una mesa válida y la PROPONE.
   *
   * Válida = admite a este grupo por capacidad Y está libre durante toda la
   * duración prevista de la reserva, sin solaparse con ninguna otra.
   *
   * El ámbito lo decide la zona del formulario:
   *   - Con zona elegida → solo mesas de esa zona (el sistema no cambia de zona
   *     por su cuenta).
   *   - Sin zona         → todas las zonas y salas del local.
   *
   * Si no hay ninguna mesa posible NO se asigna nada al azar: se enseña el
   * motivo real, y solo cuando el problema es de capacidad se ofrece elegir
   * mesa a mano (que es la única decisión que el local puede tomar ahí).
   */
  const buscarMesaAutomatica = async () => {
    setBuscandoMesa(true);
    const res = await proponerMesaAutomatica({
      fecha: form.fecha,
      hora: form.hora,
      personas: form.comensales,
      turno: form.turno,
      zona: form.zona || null,
      localId,
      duracionMin: duracionEfectiva,
    });
    setBuscandoMesa(false);
    if (!res.ok) {
      toast.error(friendlyError(res.error));
      return;
    }
    if (res.data.encontrada) {
      setPropuesta(res.data.mesa);
      return;
    }
    setFallo({
      motivo: res.data.motivo,
      libresNoAptas: res.data.libresNoAptas,
      zonaBuscada: res.data.zonaBuscada,
    });
  };

  /**
   * El usuario ACEPTA la mesa propuesta: a partir de aquí la reserva ya lleva
   * mesa concreta y sigue el camino normal (confirmación de aviso al cliente).
   *
   * Una unión ("M1+M2") no tiene `mesaId` de mesa suelta, así que se emite por
   * código: es lo que se guarda en BD de todas formas.
   */
  const aceptarPropuesta = () => {
    if (!propuesta) return;
    const elegida = propuesta;
    setPropuesta(null);
    // La zona de la reserva pasa a ser la de la mesa aceptada: si se buscó sin
    // zona, hasta ahora la reserva no tenía ninguna.
    const zonaFinal = (elegida.zonaNombre || form.zona || "") as ZonaSala | "";
    if (elegida.mesaId) {
      const enCatalogo = mesas.find((m) => m.id === elegida.mesaId);
      if (enCatalogo) {
        setForm((p) => ({ ...p, mesaId: enCatalogo.id, zona: zonaFinal }));
        pedirConfirmacion();
        return;
      }
    }
    // Unión, o mesa fuera del catálogo cargado en pantalla (se buscó en otra
    // sala): se emite por código, que es lo que entiende el servidor.
    setForm((p) => ({ ...p, zona: zonaFinal }));
    pedirConfirmacion(elegida.codigo);
  };

  /**
   * El usuario elige a mano una de las mesas libres que NO encajan por
   * capacidad. Es una decisión deliberada del local ("aquí caben igual"), así
   * que se acepta sin volver a discutir el aforo: ya se le ha dicho.
   */
  const elegirMesaDeFallo = (m: MesaPropuesta) => {
    setFallo(null);
    const zonaFinal = (m.zonaNombre || form.zona || "") as ZonaSala | "";
    if (m.mesaId && mesas.some((x) => x.id === m.mesaId)) {
      setForm((p) => ({ ...p, mesaId: m.mesaId as string, zona: zonaFinal }));
      pedirConfirmacion();
      return;
    }
    setForm((p) => ({ ...p, zona: zonaFinal }));
    pedirConfirmacion(m.codigo);
  };

  /**
   * Paso 2: preguntar si se notifica al cliente. Solo tiene sentido cuando hay
   * un correo al que escribir: sin email (o en walk-in, que ni siquiera tiene
   * ficha) la reserva se confirma directamente sin preguntar nada.
   */
  const pedirConfirmacion = (mesaCodigoAuto?: string | null) => {
    setAviso(null);
    if (esWalkIn || !form.email.trim()) {
      emitirReserva(false, mesaCodigoAuto);
      return;
    }
    // El código de la mesa aceptada viaja aparte hasta el final: `setForm` no
    // se ha aplicado todavía cuando se encadena desde `aceptarPropuesta`, así
    // que leerlo del formulario daría el valor viejo (vacío).
    setMesaCodigoAuto(mesaCodigoAuto ?? null);
    setConfirmarEnvio(true);
  };

  /** Paso 3: construir y enviar la reserva. Ya sin preguntas. */
  const emitirReserva = (notificarEmail: boolean, mesaCodigoAuto?: string | null) => {
    setAviso(null);
    setConfirmarEnvio(false);
    const codigoAuto = mesaCodigoAuto ?? mesaCodigoAutoRef ?? null;
    setMesaCodigoAuto(null);
    onSave({
      id: `r-${Date.now()}`,
      cliente: esWalkIn ? "" : form.cliente,
      apellidos: esWalkIn ? "" : form.apellidos,
      telefono: esWalkIn ? "" : componerTelefono(form.telefonoPrefijo, form.telefono),
      email: esWalkIn ? "" : form.email,
      fecha: form.fecha, hora: form.hora, turno: form.turno,
      comensales: form.comensales, zona: form.zona,
      // La lista de espera no lleva mesa: se apunta al cliente y se le asigna
      // una cuando quede libre. Mandar mesa aquí la ocuparía sin haberla dado.
      mesaId: esListaEspera ? "" : (form.mesaId || (mesaPreseleccionada?.id ?? "")),
      // Mesa aceptada de la propuesta automática que no está en el catálogo de
      // pantalla (una unión, u otra sala): se manda por código, que es lo que
      // se guarda en BD.
      mesaCodigo: esListaEspera ? undefined : (codigoAuto ?? undefined),
      // WALK_IN no es un estado, es el ORIGEN: quien llega sin reservar nace
      // CONFIRMADA como cualquiera y se le marca SENTADA al sentarlo. Lo que
      // lo distingue es el origen, que le acompaña toda su vida.
      estado: esListaEspera ? "LISTA_ESPERA" : "CONFIRMADA",
      observaciones: form.observaciones,
      // Un walk-in es siempre gratis: ni garantía, ni prepago, ni cupón. La
      // lista de espera tampoco cobra: todavía no hay mesa que garantizar.
      tipoCategoria: (sinCobro ? "gratis" : form.tipoCategoria || null) as TipoReservaCategoria | null,
      garantiaImporte: !sinCobro && form.tipoCategoria === "politica" && form.garantiaImporte ? Number(form.garantiaImporte) : null,
      importePagado: !sinCobro && form.tipoCategoria === "cupon" && form.importePagado ? Number(form.importePagado) : null,
      // Solo enviamos override si el usuario tocó la duración y es distinta del default.
      // Si no tocó nada, dejamos NULL para usar la default empresa (semántica del campo).
      duracionMinutos: (() => {
        if (!form.duracionTouched) return null;
        if (duracionEfectiva == null) return null;
        if (config && duracionEfectiva === config.duracionReservaMin) return null;
        return duracionEfectiva;
      })(),
      notificarEmail,
      codigoCupon: !sinCobro && form.codigoCupon.trim() ? form.codigoCupon.trim().toUpperCase() : null,
      // Walk-in siempre WALKIN, pase lo que pase en el selector: el cliente
      // llegó andando. El servidor lo vuelve a forzar, aquí se manda coherente.
      // La lista de espera va igual: su origen ES "Lista de espera", el mismo
      // nombre que su estado, porque es a la vez por dónde entró y en qué
      // situación está.
      // Nunca `null`: el origen es obligatorio y `camposQueFaltan` ya impide
      // llegar aquí sin él. El fallback es el canal por defecto del alta.
      origen: esWalkIn
        ? "WALKIN"
        : esListaEspera
          ? "LISTA_ESPERA"
          : (form.origen.trim() || ORIGENES_ALTA_SALA[0]),
      // Si la mesa elegida está bloqueada, se llega aquí solo después de haber
      // leído y aceptado el aviso: el servidor necesita saberlo para dejar
      // pasar la reserva en vez de rechazarla como hace con la web.
      forzarMesaBloqueada: (() => {
        const id = form.mesaId || mesaPreseleccionada?.id;
        if (!id) return false;
        const m = mesas.find((x) => x.id === id);
        return m ? getEstadoMesa(m) === "BLOQUEADA" : false;
      })(),
    });
  };

  const renderSugerencias = (campo: CampoBusqueda) => {
    if (campoActivo !== campo || esWalkIn) return null;
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

  /**
   * En walk-in los datos del cliente se ocultan, pero su hueco se queda: la
   * rejilla no se recompone y ningún campo cambia de sitio al saltar de una
   * pestaña a otra. `invisible` los borra de la vista sin sacarlos del flujo, e
   * `inert` los saca del tabulador y de los lectores de pantalla, que si no
   * seguirían encontrando cuatro campos que ya no existen para el usuario.
   */
  const camposClienteOcultos = esWalkIn ? "invisible" : undefined;
  const propsClienteOculto = esWalkIn
    ? ({ inert: "", "aria-hidden": true } as Record<string, unknown>)
    : {};

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
      {/* Las tres formas de dar de alta, en una sola pastilla de tres tercios:
          la reserva normal, el que llegó sin reservar y el que espera mesa.
          Se ve de un vistazo cuál está activo sin desplegar nada. */}
      <div className="grid w-full max-w-md grid-cols-3 gap-1 rounded-lg border bg-muted/60 p-1">
        {[
          { tipo: "CLIENTE" as const, label: "Cliente" },
          { tipo: "WALKIN" as const, label: "Walk-in" },
          { tipo: "LISTA_ESPERA" as const, label: "Lista de espera" },
        ].map((op) => {
          const activo = form.tipoAlta === op.tipo;
          return (
            <button
              key={op.tipo}
              type="button"
              aria-pressed={activo}
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  tipoAlta: op.tipo,
                  // Ni el walk-in ni la lista de espera llevan garantía ni
                  // cupón: uno ya está sentado y el otro aún no tiene mesa.
                  // El tipo queda en Gratis.
                  ...(op.tipo !== "CLIENTE"
                    ? {
                        tipoCategoria: "gratis" as TipoReservaCategoria,
                        garantiaImporte: "",
                        importePagado: "",
                        codigoCupon: "",
                      }
                    : {}),
                  // La lista de espera no ocupa mesa: si venía una elegida (o
                  // preseleccionada desde el plano) se suelta, para no dejarla
                  // pillada por alguien que todavía está esperando.
                  ...(op.tipo === "LISTA_ESPERA" ? { mesaId: "" } : {}),
                }))
              }
              className={cn(
                "h-8 rounded-md text-xs font-medium transition-colors",
                activo
                  ? "bg-blue-600 text-white shadow-sm hover:bg-blue-600"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {op.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-2">
        {/* Los cuatro campos del cliente NO se descuelgan de la rejilla en
            walk-in: se quedan en su sitio, invisibles. Si se quitaran del todo,
            fecha, hora, turno y todo lo de abajo saltarían dos filas hacia
            arriba al cambiar de pestaña, y quien está dando de alta con gente
            en la puerta tendría que volver a buscar cada campo. Así lo único
            que pasa al pulsar Walk-in es que los datos del cliente desaparecen:
            nada más se mueve. Van ocultos de verdad (`invisible` + `inert`), no
            solo despintados: un hueco vacío no se lee ni se tabula. */}
        <div className={cn("relative", camposClienteOcultos)} {...propsClienteOculto}>
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
        <div className={cn("relative", camposClienteOcultos)} {...propsClienteOculto}>
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
        <div className={cn("relative", camposClienteOcultos)} {...propsClienteOculto}>
            <LabelConRegla
              moduloKey="sala"
              submoduloKey="reservas"
              campoKey="telefono"
              className="text-xs"
            >
              Teléfono
            </LabelConRegla>
            {/* Prefijo obligatorio, nunca a mano: si unos números lo llevan
                y otros no, el mismo cliente acaba con dos fichas. */}
            <div className="flex gap-1.5">
              <select
                value={form.telefonoPrefijo}
                onChange={e => setForm(p => ({ ...p, telefonoPrefijo: e.target.value }))}
                className="h-8 w-[86px] shrink-0 rounded-md border border-input bg-background px-1.5 text-xs"
                title={PREFIJOS_TELEFONO.find(x => x.prefijo === form.telefonoPrefijo)?.label ?? ""}
              >
                {PREFIJOS_TELEFONO.map(x => (
                  <option key={x.prefijo} value={x.prefijo}>{x.flag} {x.prefijo}</option>
                ))}
              </select>
              <Input
                type="tel"
                className="h-8 flex-1 text-xs"
                value={form.telefono}
                onFocus={() => setCampoActivo("telefono")}
                onBlur={() => setTimeout(() => setCampoActivo((c) => (c === "telefono" ? null : c)), 150)}
                onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              />
            </div>
            {renderSugerencias("telefono")}
        </div>
        <div className={cn("relative", camposClienteOcultos)} {...propsClienteOculto}>
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
                // En lista de espera no se marca nada: apuntarse es justamente
                // para una hora SIN mesa libre, así que el ⏰ saldría en casi
                // todas y avisaría de lo que ya se da por hecho.
                const pisa = esListaEspera
                  ? false
                  : mesaBanner
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
            // Sin horario definido (o fallo al calcularlo) no se bloquea el
            // alta, pero la hora sigue eligiéndose en cuartos: la cuadrícula es
            // la regla del sistema, no una consecuencia de tener slots.
            <SelectorHoraCuartos
              value={form.hora}
              aviso={horaConflictiva}
              onChange={(h) => setForm((p) => ({ ...p, hora: h }))}
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
                  : `Sin mesas libres para ${form.comensales} per${
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
          {/* Desplegable, no campo libre: se ofrecen solo los tamaños que la
              empresa acepta. El tope es el "tamaño máximo por reserva" de
              Configuración → Límites (mesa o combinación de mesas), el mismo
              que aplica el portal público. Sin regla configurada se cae al
              máximo por defecto para no dejar el selector sin opciones. */}
          <Select
            value={String(form.comensales)}
            onValueChange={(v) => {
              setPaxTouched(true);
              setForm((p) => ({ ...p, comensales: Number(v) }));
            }}
          >
            <SelectTrigger
              className={cn(
                "h-8 text-xs",
                muestraAvisoPax && "border-amber-500 focus-visible:ring-amber-500",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcionesComensales.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} {n === 1 ? "persona" : "personas"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {/* En lista de espera no se elige mesa: se apunta al cliente porque
              justamente NO hay ninguna libre. Se dice en su sitio en vez de
              esconder el campo, para que no parezca que falta algo. */}
          {esListaEspera ? (
            <p className="text-[10px] text-muted-foreground">
              Sin mesa: se le asigna una cuando quede libre.
            </p>
          ) : (
          <>
          {/* Sin zona no se listan mesas concretas (la mesa cuelga de una zona),
              pero el selector NO se bloquea: dejarlo en automático es una
              elección válida y busca en todas las zonas y salas del local. */}
          {/* Mismo selector que en la ficha de edición: los indicadores
              (✅ / ⏰ / 👥) tienen que decir lo mismo al crear y al editar. */}
          <SelectorMesaConAvisos
            value={form.mesaId}
            onChange={elegirMesa}
            mesas={mesasSeleccionables}
            estadoPorMesa={estadoPorMesa}
            placeholder="— El sistema elige la mesa —"
            etiquetaEstado={(m) => {
              const est = getEstadoMesa(m);
              return est === "LIBRE" ? "Libre" :
                est === "OCUPADA" ? "Sentada" :
                est === "RESERVADA" ? "Reservada" :
                est === "BLOQUEADA" ? "Bloqueada" : "";
            }}
          />
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
              <AvisoAforoMesa aforo={aforoConflictivo} comensales={form.comensales} />
            </>
          ) : !form.zona ? (
            // Sin zona el sistema busca en TODO el local. Se dice explícitamente
            // para que quede claro que no es un campo a medio rellenar.
            <p className="text-[10px] text-muted-foreground">
              Al reservar, el sistema buscará una mesa libre para {form.comensales}{" "}
              {form.comensales === 1 ? "persona" : "personas"} en todas las zonas y salas, y
              te la propondrá antes de confirmar.
            </p>
          ) : mesasSeleccionables.length === 0 ? (
            // Nunca dejar la lista vacía en silencio: si no hay mesas, se dice por qué.
            <p className="text-[10px] text-amber-700 dark:text-amber-300">
              {zonaLabel(form.zona)} no tiene mesas activas. Elige otra zona.
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Al reservar, el sistema buscará una mesa libre en {zonaLabel(form.zona)} y te la
              propondrá antes de confirmar.
            </p>
          )}
          </>
          )}
        </div>
        {/* Origen: por dónde entró la reserva. Un alta desde sala nace como
            "Teléfono", que es como llega la mayoría, pero se puede cambiar
            porque también se apunta a quien escribe o pregunta en la puerta.
            En walk-in no se pregunta: el cliente llegó andando y el origen es
            Walk in, sin discusión — se enseña bloqueado para que quede claro
            qué se va a guardar. */}
        <div className="col-span-3">
          <Label className="text-xs">Origen</Label>
          {/* Con un solo origen disponible el campo se muestra fijo, igual que
              en walk-in: un desplegable de una opción solo invita a abrirlo
              para no encontrar nada. Si mañana se abre otro canal en
              `ORIGENES_ALTA_SALA`, vuelve a ser un selector. */}
          {esWalkIn || esListaEspera || ORIGENES_ALTA_SALA.length === 1 ? (
            <Input
              className="h-8 text-xs"
              value={labelOrigen(
                esWalkIn ? "WALKIN" : esListaEspera ? "LISTA_ESPERA" : ORIGENES_ALTA_SALA[0],
              )}
              readOnly
              disabled
              title={
                esWalkIn
                  ? "Las reservas walk-in siempre se registran con origen Walk in."
                  : esListaEspera
                    ? "La lista de espera se registra con origen Lista de espera, igual que su estado."
                    : "Las reservas que se dan de alta aquí entran por teléfono."
              }
            />
          ) : (
            <select
              value={form.origen}
              onChange={(e) => setForm((p) => ({ ...p, origen: e.target.value }))}
              className="h-8 text-xs w-full rounded-md border border-input bg-background px-2"
            >
              {ORIGENES_ALTA_SALA.map((o) => (
                <option key={o} value={o}>{labelOrigen(o)}</option>
              ))}
            </select>
          )}
        </div>
        {/* Las etiquetas se asignan desde la ficha de la reserva, una vez
            creada: ahí van agrupadas y admiten varias a la vez. */}
        <div className="col-span-3">
          <Label className="text-xs">Tipo de reserva</Label>
          {sinCobro ? (
            <Input
              className="h-8 text-xs"
              value={TIPO_RESERVA_CATEGORIA_LABELS.gratis}
              readOnly
              disabled
              title={
                esWalkIn
                  ? "Las reservas walk-in son siempre gratis: no hay garantía ni cupón."
                  : "La lista de espera no cobra nada: todavía no hay mesa que garantizar."
              }
            />
          ) : (
          <select
            value={form.tipoCategoria}
            onChange={(e) => {
              const nuevoTipo = e.target.value as TipoReservaCategoria | "";
              const incompatibleConCupon = nuevoTipo === "gratis" || nuevoTipo === "ticket";
              setForm((p) => ({
                ...p,
                tipoCategoria: nuevoTipo,
                // Limpia los campos que dejan de aplicar al cambiar de tipo.
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
          )}
        </div>
        {!sinCobro && form.tipoCategoria === "politica" && (
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
        )}
        {!sinCobro && form.tipoCategoria === "cupon" && (
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
        {!sinCobro && form.tipoCategoria !== "gratis" && form.tipoCategoria !== "ticket" && (
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

      {/* El desplegable ya no ofrece grupos por encima del máximo, así que
          esto solo salta cuando el tamaño venía de antes (una reserva creada
          con otro tope, o un grupo autorizado a mano) y sigue bloqueando el
          guardado hasta corregirlo. */}
      {muestraAvisoPax && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Son {form.comensales} y el máximo por reserva del turno de{" "}
          {form.turno.toLowerCase()} es {maxPax}. Baja el número o gestiónalo
          como reserva de grupo.
        </div>
      )}

      <div>
        <Label className="text-xs">Comentarios</Label>
        <Textarea
          className="text-xs"
          rows={2}
          maxLength={RESERVA_COMENTARIO_MAX_CHARS}
          value={form.observaciones}
          onChange={e => setForm(p => ({ ...p, observaciones: e.target.value.slice(0, RESERVA_COMENTARIO_MAX_CHARS) }))}
        />
        <p className="pt-0.5 text-right text-[10px] text-muted-foreground">
          {form.observaciones.length}/{RESERVA_COMENTARIO_MAX_CHARS}
        </p>
      </div>
      {/* El aviso al cliente ya no se decide con una casilla que se pasa por
          alto: se pregunta al final, en el paso de confirmación. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={guardarBloqueado || comprobandoSolape || buscandoMesa}
        >
          {buscandoMesa ? "Buscando mesa…" : comprobandoSolape ? "Comprobando…" : "Reservar"}
        </Button>
      </div>

      {/* PROPUESTA de la asignación automática. La reserva NO está creada: el
          sistema enseña qué mesa ha elegido y DÓNDE está (sala y zona), y solo
          se confirma con ella si el usuario acepta expresamente. El local
          mantiene siempre la última palabra sobre la mesa. */}
      <Dialog open={propuesta != null} onOpenChange={(v) => { if (!v) setPropuesta(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Mesa propuesta por el sistema
            </DialogTitle>
          </DialogHeader>
          {propuesta && (
            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Para {form.comensales} {form.comensales === 1 ? "persona" : "personas"} el{" "}
                {formatearFechaEs(form.fecha)} a las {form.hora.slice(0, 5)}, el sistema propone:
              </p>
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2">
                <div className="text-sm font-semibold">
                  Mesa {propuesta.codigo}
                  {propuesta.esUnion && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      (unión de mesas)
                    </span>
                  )}
                </div>
                {/* Dónde está: sin ubicación la propuesta no se puede revisar. */}
                <div className="text-muted-foreground">
                  {[propuesta.salaNombre, propuesta.zonaNombre].filter(Boolean).join(" · ") ||
                    "Sin ubicación registrada"}
                </div>
                <div className="text-muted-foreground">
                  Admite de {propuesta.capacidadMin} a {propuesta.capacidadMax}{" "}
                  {propuesta.capacidadMax === 1 ? "persona" : "personas"}
                </div>
              </div>
              <p className="text-muted-foreground">
                Está libre durante toda la reserva. Si prefieres otra, cancela y elígela a mano
                en el desplegable de mesa.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPropuesta(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={aceptarPropuesta}>Aceptar y reservar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NO hay mesa posible. El sistema no inventa una asignación: explica el
          motivo real, que es distinto en cada caso y lleva a una salida
          distinta. Solo cuando el problema es de CAPACIDAD tiene sentido que el
          local coloque el grupo a mano, así que solo ahí se ofrecen mesas. */}
      <Dialog open={fallo != null} onOpenChange={(v) => { if (!v) setFallo(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              No se ha podido asignar mesa automáticamente
            </DialogTitle>
          </DialogHeader>
          {fallo && (
            <div className="space-y-3 text-xs">
              {fallo.motivo === "SIN_HUECO" && (
                <p className="text-muted-foreground">
                  No hay ninguna mesa libre{" "}
                  {fallo.zonaBuscada ? `en ${zonaLabel(fallo.zonaBuscada)}` : "en todo el local"}{" "}
                  el {formatearFechaEs(form.fecha)} a las {form.hora.slice(0, 5)} durante{" "}
                  {formatearDuracionReserva(duracionEfectiva ?? 120)}. Todas están ocupadas por
                  otra reserva en esa franja: prueba con otra hora, otra duración
                  {fallo.zonaBuscada ? " u otra zona" : ""}.
                </p>
              )}
              {fallo.motivo === "SIN_MESAS" && (
                <p className="text-muted-foreground">
                  {fallo.zonaBuscada
                    ? `${zonaLabel(fallo.zonaBuscada)} no tiene mesas activas. Elige otra zona o revisa el catálogo en Configuración → Salas.`
                    : "Este local no tiene mesas activas. Revisa el catálogo en Configuración → Salas."}
                </p>
              )}
              {fallo.motivo === "SIN_CAPACIDAD" && (
                <>
                  <p className="text-muted-foreground">
                    Hay mesas libres a esa hora, pero ninguna es adecuada para{" "}
                    {form.comensales} {form.comensales === 1 ? "persona" : "personas"}
                    {fallo.zonaBuscada ? ` en ${zonaLabel(fallo.zonaBuscada)}` : ""}.
                  </p>
                  <p className="text-muted-foreground">
                    Elige tú la mesa de destino: decide el local dónde sentar al grupo.
                  </p>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto">
                    {fallo.libresNoAptas.map((m) => (
                      <button
                        type="button"
                        key={m.codigo}
                        onClick={() => elegirMesaDeFallo(m)}
                        className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left hover:bg-muted"
                      >
                        <span>
                          <span className="font-semibold">Mesa {m.codigo}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {[m.salaNombre, m.zonaNombre].filter(Boolean).join(" · ") ||
                              "Sin ubicación"}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {m.capacidadMin}–{m.capacidadMax}p
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setFallo(null)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Aviso previo a crear: detalla CADA motivo de peligro por separado
          (⏰ horario y 👥 aforo) para que se acepte sabiendo exactamente qué
          se asume. El back-office manda, pero informado. */}
      <Dialog open={aviso != null} onOpenChange={(v) => { if (!v) setAviso(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              {(() => {
                if (!aviso) return "";
                const motivos =
                  (aviso.choques.length > 0 ? 1 : 0) +
                  (aviso.aforo ? 1 : 0) +
                  (aviso.bloqueada ? 1 : 0);
                if (motivos > 1) return "Varios avisos en esta reserva";
                if (aviso.bloqueada) return "Esta mesa está bloqueada";
                if (aviso.aforo) return "El grupo no encaja en la mesa";
                return "Esta mesa ya está reservada";
              })()}
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
                  Tu reserva de {form.comensales} per ocupa la mesa {aviso.mesaCodigo} de{" "}
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
                      Mesa {c.mesa} · {c.personas} per · termina a las {c.horaFin}
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

            {/* 🔒 MOTIVO 3: la mesa está bloqueada en este turno. El bloqueo
                cierra la mesa a la web y a la asignación automática, pero
                aquí decide el local: se avisa y se deja seguir. */}
            {aviso?.bloqueada && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  Esta mesa está bloqueada
                </p>
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2">
                  <div className="font-semibold">Mesa {aviso.mesaCodigo}</div>
                  <div className="text-muted-foreground">
                    Bloqueada el {formatearFechaEs(form.fecha)} en{" "}
                    {form.turno === "COMIDA" ? "comida" : "cena"}.
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Nadie puede reservarla desde la web mientras siga bloqueada. Si
                  aun así la necesitas, puedes usarla: la decisión es del local.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAviso(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => pedirConfirmacion()}>Aceptar y continuar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Último paso de toda reserva interna: la reserva se confirma en los dos
          casos; lo único que se elige aquí es si además se avisa al cliente con
          el mismo correo que recibe cuando reserva desde la web. */}
      <Dialog open={confirmarEnvio} onOpenChange={(v) => { if (!v) setConfirmarEnvio(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar reserva</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <p className="text-muted-foreground">
              La reserva de{" "}
              <span className="font-semibold text-foreground">
                {[form.cliente, form.apellidos].filter(Boolean).join(" ").trim() || "el cliente"}
              </span>{" "}
              para el {formatearFechaEs(form.fecha)} a las {form.hora.slice(0, 5)} · {form.comensales}{" "}
              {form.comensales === 1 ? "persona" : "personas"} quedará confirmada.
            </p>
            <p className="text-muted-foreground">
              Elige si además quieres enviarle el correo de confirmación a{" "}
              <span className="font-medium text-foreground">{form.email.trim()}</span>.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => emitirReserva(false)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Solo confirmar
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => emitirReserva(true)}>
              <Mail className="h-3.5 w-3.5" />
              Notificar y confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function mapDbToReserva(row: Record<string, unknown>): Reserva {
  return {
    id: row.id as string,
    cliente: (row.cliente_nombre as string) ?? "",
    apellidos: (row.cliente_apellidos as string) ?? "",
    telefono: (row.cliente_telefono as string) ?? "",
    email: (row.cliente_email as string) ?? "",
    fecha: (row.fecha as string) ?? "",
    hora: (row.hora as string) ?? "",
    turno: (row.turno as TurnoReserva) ?? "COMIDA",
    comensales: (row.personas as number) ?? 0,
    zona: (row.zona as ZonaSala | "") ?? "",
    // OJO: `reservas.mesa` guarda el CÓDIGO ("R3", "M1+M2"), no el UUID.
    // `mesaId` se rellena después, resolviendo el código contra las mesas cargadas
    // (ver `reservasConMesa`). Aquí solo se conserva el código en crudo.
    mesaCodigo: (row.mesa as string) ?? "",
    // Siempre vacío aquí: la tabla no guarda el UUID de la mesa, solo el código.
    // Lo rellena `reservasConMesa` resolviendo el código contra las mesas ya
    // cargadas del plano.
    mesaId: "",
    estado: (row.estado as EstadoReserva) ?? "CONFIRMADA",
    observaciones: (row.notas as string) ?? "",
    clienteId: (row.cliente_id as string | null) ?? null,
    // Enganchó con una ficha existente y los datos no coinciden: hasta que
    // alguien lo revise, el nombre que se ve puede no ser el de quien reservó.
    vinculacionPendiente: row.vinculacion_estado === "PENDIENTE",
    origen: (row.origen as string | null) ?? null,
    tarjetaIntroducida: (row.tarjeta_introducida as boolean) ?? false,
    esTicket: (row.es_ticket as boolean) ?? false,
    tipoCategoria: (row.tipo_categoria as TipoReservaCategoria | null) ?? null,
    garantiaImporte: (row.garantia_importe as number | null) ?? null,
    tieneGarantia: Boolean(row.tiene_garantia ?? false),
    garantiaEstado: (row.garantia_estado as string | null) ?? null,
    garantiaTarjetaUltimos4: (row.garantia_tarjeta_ultimos4 as string | null) ?? null,
    garantiaTarjetaMarca: (row.garantia_tarjeta_marca as string | null) ?? null,
    garantiaCaptureDeadline: (row.garantia_capture_deadline as string | null) ?? null,
    garantiaCobradaAt: (row.garantia_cobrada_at as string | null) ?? null,
    tieneCancelacion: Boolean(row.tiene_cancelacion ?? false),
    cancelacionImporte: (row.cancelacion_importe as number | null) ?? null,
    cancelacionEstado: (row.cancelacion_estado as string | null) ?? null,
    cancelacionTarjetaUltimos4: (row.cancelacion_tarjeta_ultimos4 as string | null) ?? null,
    cancelacionIntentos: (row.cancelacion_intentos as number) ?? 0,
    cancelacionError: (row.cancelacion_error as string | null) ?? null,
    cancelacionProximoIntentoAt: (row.cancelacion_proximo_intento_at as string | null) ?? null,
    cancelacionCobradaAt: (row.cancelacion_cobrada_at as string | null) ?? null,
    cobroPerdonadoAt: (row.cobro_perdonado_at as string | null) ?? null,
    politicaIncumplidaAt: (row.politica_incumplida_at as string | null) ?? null,
    importePagado: (row.importe_pagado as number | null) ?? null,
    ticketProductoId: (row.ticket_producto_id as string | null) ?? null,
    ticketUnidades: (row.ticket_unidades as number | null) ?? null,
    ticketImporte: (row.ticket_importe as number | null) ?? null,
    ticketIva: (row.ticket_iva as number | null) ?? null,
    ticketCodigo: (row.ticket_codigo as string | null) ?? null,
    ticketProductoNombre: (() => {
      const p = row.reserva_ticket_productos as unknown as
        | { nombre?: string } | { nombre?: string }[] | null;
      return (Array.isArray(p) ? p[0]?.nombre : p?.nombre) ?? null;
    })(),
    // Fechas del pago del ticket. PostgREST devuelve la compra como objeto o
    // como array de uno según la relación, así que se admiten las dos formas.
    ...(() => {
      const c = row.reserva_ticket_compras as unknown as
        | { pagado_at?: string | null; canjeado_at?: string | null }
        | { pagado_at?: string | null; canjeado_at?: string | null }[]
        | null;
      const compra = Array.isArray(c) ? c[0] : c;
      return {
        ticketPagadoAt: compra?.pagado_at ?? null,
        ticketCanjeadoAt: compra?.canjeado_at ?? null,
      };
    })(),
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

/** Indicador global de cabecera en vista mes: personas + mesas de un turno. */
function KpiTurnoMes({
  icono,
  titulo,
  personas,
  reservas,
}: {
  icono: React.ReactNode;
  titulo: string;
  personas: number;
  reservas: number;
}) {
  return (
    <div
      className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-input bg-background text-xs font-semibold"
      title={`${titulo}: ${personas} personas · ${reservas} mesas reservadas`}
    >
      {icono}
      <span className="text-muted-foreground font-medium">{titulo}</span>
      <span className="inline-flex items-center gap-1">
        <Users className="h-3.5 w-3.5 text-emerald-500" />
        <span className="tabular-nums">{personas}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <LayoutGrid className="h-3.5 w-3.5 text-sky-500" />
        <span className="tabular-nums">{reservas}</span>
      </span>
    </div>
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

/**
 * Aire que se deja alrededor de las mesas al encuadrar solo, en píxeles del
 * lienzo. Sin nada de margen las mesas del borde quedarían pegadas al filo de
 * la pantalla y las etiquetas de zona se cortarían.
 */
const ENCUADRE_AUTO_MARGEN = 40;

/**
 * Recuadro que ocupan de verdad las mesas de una sala, para ampliarlo hasta
 * llenar la pantalla cuando nadie ha dibujado un encuadre en el editor.
 *
 * El lienzo mide 1200x640 pero las mesas rara vez lo llenan: suelen ocupar una
 * franja y dejar la mitad del alto vacío. Ampliando el lienzo entero se
 * ampliaba también ese vacío, y el plano quedaba pequeño en el centro con
 * franjas muertas. Midiendo dónde están las mesas, el plano crece hasta donde
 * da la pantalla.
 *
 * Entran también las decoraciones (barra, aseos, tabiques): forman parte del
 * dibujo de la sala y dejarlas fuera las cortaría por la mitad.
 */
function encuadreAutomatico(
  mesas: Mesa[],
  posiciones: Map<string, PlanoMesaPosicion>,
  mesasMeta: Map<string, MesaMeta>,
  decoraciones: SalaDecoracion[],
): { x: number; y: number; width: number; height: number } {
  const lienzoEntero = { x: 0, y: 0, width: PLANO_CANVAS_W, height: PLANO_CANVAS_H };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const sumar = (x: number, y: number, w: number, h: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };

  for (const m of mesas) {
    const pos = posiciones.get(m.id);
    if (!pos) continue;
    const forma = mesasMeta.get(m.id)?.forma ?? "cuadrada";
    const { w, h } = getPlanoMesaDims(forma, pos);
    sumar(Number(pos.x), Number(pos.y), w, h);
  }
  for (const d of decoraciones) {
    sumar(Number(d.x), Number(d.y), Number(d.width), Number(d.height));
  }

  // Sala sin nada colocado: no hay qué encuadrar y se deja el lienzo entero.
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return lienzoEntero;

  const x = Math.max(0, minX - ENCUADRE_AUTO_MARGEN);
  const y = Math.max(0, minY - ENCUADRE_AUTO_MARGEN);
  const width = Math.min(PLANO_CANVAS_W - x, maxX - x + ENCUADRE_AUTO_MARGEN);
  const height = Math.min(PLANO_CANVAS_H - y, maxY - y + ENCUADRE_AUTO_MARGEN);

  // Un recuadro diminuto (una sala con una sola mesa) ampliaría esa mesa hasta
  // llenar la pantalla. El mismo mínimo que impone el editor.
  const MIN = 200;
  if (width < MIN || height < MIN) return lienzoEntero;

  return { x, y, width, height };
}

function PlanoCanvas({
  mesas,
  posiciones,
  mesasMeta,
  zonas,
  decoraciones,
  salaTieneZonas,
  mesasResaltadasIds,
  onHoverMesa,
  onSelectMesa,
  getEstadoMesa,
  getReservasMesa,
  onEditar,
  onCambiarEstado,
  onBloquearMesa,
  onDesplazarReserva,
  onQuitarBloqueoMesa,
  onWalkIn,
  reservaMoviendo,
  onElegirDestino,
  onCancelarMover,
  esOscuro,
  encuadre,
}: {
  mesas: Mesa[];
  posiciones: Map<string, PlanoMesaPosicion>;
  mesasMeta: Map<string, MesaMeta>;
  zonas: ZonaReal[];
  decoraciones: SalaDecoracion[];
  salaTieneZonas: boolean;
  /**
   * Mesas señaladas con el raton, sea sobre el plano o sobre la lista. Es un
   * conjunto porque una reserva puede ocupar VARIAS mesas (las uniones se
   * guardan como "M1+M2"): se resaltan todas a la vez.
   */
  mesasResaltadasIds: Set<string>;
  /**
   * Camino inverso al anterior: avisa de sobre que mesa esta el raton para que
   * el listado encienda su reserva. `null` al salir de la mesa.
   */
  onHoverMesa?: (mesaId: string | null) => void;
  onSelectMesa: (m: Mesa | null) => void;
  getEstadoMesa: (m: Mesa) => string;
  getReservasMesa: (mesaId: string) => Reserva[];
  onEditar: (r: Reserva) => void;
  onCambiarEstado: (id: string, e: EstadoReserva) => void;
  /** Candado del popover: mesa concreta del plano, o null desde la lista. */
  onBloquearMesa: (m: Mesa | null, r: Reserva | null) => void;
  onDesplazarReserva: (r: Reserva) => void;
  /** Si la mesa está BLOQUEADA y se pulsa, levanta el bloqueo solo para (fecha, turno). */
  onQuitarBloqueoMesa?: (m: Mesa) => void;
  /** Alta rápida de walk-in sobre una mesa libre del plano. */
  onWalkIn?: (m: Mesa) => void;
  /**
   * Reserva "en la mano" tras pulsar Desplazar. Mientras no sea null, el plano
   * está en modo mover: el popover no se abre y el clic elige la mesa destino.
   */
  reservaMoviendo?: Reserva | null;
  onElegirDestino?: (m: Mesa) => void;
  onCancelarMover?: () => void;
  /** Tema activo de la vista: decide si los pasteles de zona se aclaran u oscurecen. */
  esOscuro: boolean;
  /**
   * Trozo del lienzo que hay que ampliar, encuadrado a mano en el editor con
   * el recuadro rojo. `null` = sin encuadrar → se ve el lienzo entero.
   */
  encuadre?: PlanoEncuadre | null;
}) {
  const moviendo = reservaMoviendo != null;
  // Qué ficha de mesa está abierta (solo una a la vez, y ninguna en modo mover).
  const [mesaPopoverAbiertaId, setMesaPopoverAbiertaId] = useState<string | null>(null);
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

  // Recuadro del lienzo que hay que ampliar.
  //
  // Sin encuadre guardado NO se coge el lienzo entero: las mesas rara vez lo
  // llenan —normalmente ocupan una franja— y ampliar el lienzo completo
  // ampliaba también todo ese aire vacío, así que el plano se veía pequeño en
  // el centro de la pantalla con franjas muertas enormes arriba y abajo. Y
  // ninguna sala tiene encuadre guardado, así que le pasaba a todas.
  //
  // En su lugar se calcula solo: se mide dónde están de verdad las mesas (con
  // sus etiquetas de zona y las decoraciones) y se amplía ese recuadro. El
  // encuadre dibujado a mano en el editor sigue mandando cuando existe.
  const vista = useMemo(() => {
    const e = encuadre;
    if (!e) return encuadreAutomatico(mesasConPos, posiciones, mesasMeta, decoraciones);
    // Se recorta al lienzo por si quedara un encuadre viejo mas grande que el
    // plano: asi nunca se amplia aire que no existe.
    // El minimo de 200 es el mismo que impone el editor: sin el, un encuadre
    // corrupto de pocos pixeles ampliaria una mesa hasta llenar la pantalla y
    // el plano quedaria inservible.
    const MIN = 200;
    const x = Math.max(0, Math.min(PLANO_CANVAS_W - MIN, e.x));
    const y = Math.max(0, Math.min(PLANO_CANVAS_H - MIN, e.y));
    return {
      x,
      y,
      width: Math.max(MIN, Math.min(PLANO_CANVAS_W - x, e.width)),
      height: Math.max(MIN, Math.min(PLANO_CANVAS_H - y, e.height)),
    };
  }, [encuadre, mesasConPos, posiciones, mesasMeta, decoraciones]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      // SIN TOPE: el plano llena todo el hueco que haya. El marco del editor es
      // el tamaño de la sala y no cambia, asi que lo unico que decide como de
      // grandes se ven las mesas es como de grandes se dibujaron DENTRO de ese
      // marco. Aqui solo se estira ese mismo marco hasta ocupar la pantalla:
      // en un monitor grande se ve grande, en un portatil mas pequeño, pero
      // siempre entero y siempre en la misma proporcion.
      //
      // Antes habia un tope (1.6, luego 2) que dejaba franjas muertas alrededor
      // en las pantallas del salon: el plano se veia pequeño aunque hubiera
      // sitio de sobra.
      // Se escala el RECUADRO encuadrado, no el lienzo entero. Antes se
      // ampliaba el lienzo completo y, como las mesas rara vez lo llenan, el
      // hueco vacio se ampliaba con ellas: el plano se veia pequeno en el
      // centro con franjas muertas alrededor. Ahora manda el encuadre, asi que
      // apretandolo en el editor las mesas llegan hasta los bordes.
      const s = Math.min(w / vista.width, h / vista.height);
      setScale(s > 0 ? s : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vista.width, vista.height]);

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
            · {reservaMoviendo.hora.slice(0, 5)} · {reservaMoviendo.comensales} per —
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
          // La ventana mide el ENCUADRE ampliado, no el lienzo entero: lo que
          // quede fuera del recuadro rojo no se ve (overflow hidden).
          width: vista.width * scale,
          height: vista.height * scale,
          position: "relative",
          overflow: "hidden",
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
          // Primero se corre el lienzo para dejar la esquina del encuadre en el
          // origen, y luego se amplia. El orden importa: al aplicarse de
          // derecha a izquierda, el desplazamiento va en coordenadas del
          // lienzo sin escalar, que es como estan guardadas las mesas.
          transform: `scale(${scale}) translate(${-vista.x}px, ${-vista.y}px)`,
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
          // `getReservasMesa` ya devuelve las reservas ORDENADAS por hora, asi
          // que la primera es la que llega antes: es la que se enseña sobre la
          // mesa cuando hay mas de una en el mismo turno.
          const firstR = rs[0];
          const isWalkIn = firstR ? esReservaWalkIn(firstR) : false;
          const isLibre = estado === "LIBRE";
          const radius = forma === "redonda" ? 9999 : 6;
          // Dos (o mas) reservas en la misma mesa y turno: la mesa se parte con
          // una linea diagonal para que se vea de un vistazo que ahi hay doble
          // servicio, sin tener que abrirla.
          const mesaCompartida = rs.length > 1;
          // En modo mover, la mesa de origen no es un destino válido y las
          // bloqueadas tampoco: se apagan para que se vea dónde SÍ se puede soltar.
          const esOrigenMover = moviendo && reservaMoviendo?.mesaId === m.id;
          const destinoInvalido = moviendo && (esOrigenMover || estado === "BLOQUEADA");
          return (
            // Popover CONTROLADO: al pulsar "Desplazar" la reserva queda en la
            // mano y el plano pasa a modo mover, pero la ficha de la mesa desde
            // la que se pulsó seguía abierta tapando las mesas destino. Con
            // `moviendo` forzamos que ninguna esté abierta mientras se mueve, y
            // el trigger tampoco vuelve a abrirla (el clic es "soltar aquí").
            <Popover
              key={m.id}
              open={moviendo ? false : mesaPopoverAbiertaId === m.id}
              onOpenChange={(abierto) => {
                if (moviendo) return;
                setMesaPopoverAbiertaId(abierto ? m.id : null);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "sala-mesa absolute flex flex-col items-center justify-center text-[11px] font-semibold border-2 transition-all cursor-pointer px-1 overflow-hidden",
                    mesaBg[estado] ?? "",
                    isLibre ? "text-zinc-900 border-black/30" : "border-black/20",
                    // Recuadro rojo SOLO mientras el raton esta encima: ni al
                    // abrir la ficha de una reserva ni al elegir una mesa se
                    // queda marcada. Al mover el raton se enciende unicamente
                    // la mesa que se esta señalando.
                    mesasResaltadasIds.has(m.id) &&
                      "!border-red-500 !border-[6px] ring-[18px] ring-red-500 ring-offset-2 ring-offset-transparent z-20",
                    moviendo && !destinoInvalido && "cursor-copy ring-2 ring-sky-500 ring-offset-1 hover:ring-4 hover:scale-105 z-10",
                    destinoInvalido && "opacity-40 cursor-not-allowed",
                  )}
                  onMouseEnter={() => onHoverMesa?.(m.id)}
                  onMouseLeave={() => onHoverMesa?.(null)}
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
                  {/* Mesa con dos reservas en el mismo turno: linea diagonal de
                      esquina a esquina. Va detras del texto (sin puntero) y en
                      el color del propio texto, asi se ve igual sobre la mesa
                      verde ocupada que sobre el pastel de una mesa libre. */}
                  {mesaCompartida && (
                    <svg
                      className="absolute inset-0 h-full w-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <line
                        x1="0"
                        y1="100"
                        x2="100"
                        y2="0"
                        stroke="currentColor"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        opacity="0.7"
                      />
                    </svg>
                  )}
                  {/* Contra-rotación para mantener el texto legible aunque la mesa esté girada. */}
                  <div
                    className="relative flex w-full min-w-0 flex-col items-center justify-center leading-tight pointer-events-none"
                    style={pos.rotation ? { transform: `rotate(${-pos.rotation}deg)` } : undefined}
                  >
                    {/* Tres lineas como mucho: la mesa mas pequeña son 60x60
                        (48 de alto si es rectangular) y con cuatro no cabia el
                        texto grande. Con reserva, la capacidad se pega a la
                        hora en la misma linea y el nombre se queda una entera
                        para el. */}
                    <span className="text-[13px] leading-none">{m.codigo}</span>
                    {firstR ? (
                      /* La hora va SIN truncar: son cinco cifras fijas y
                         cortarlas ("14:0…") destruye el dato. La capacidad se
                         queda detras porque, si algo sobra, es ella. */
                      <span className={cn("text-[10px] font-medium tabular-nums leading-tight whitespace-nowrap", isLibre ? "text-foreground/75" : "opacity-90")}>
                        {firstR.hora.slice(0, 5)} · {m.capacidad}p
                      </span>
                    ) : (
                      <span className={cn("text-[10px] font-normal mt-0.5", isLibre ? "text-foreground/70" : "opacity-75")}>
                        ({m.capacidad}p)
                      </span>
                    )}
                    {/* El NOMBRE es lo que se busca al cruzar la sala: va al
                        mismo tamaño que el codigo de mesa y en semibold.
                        Estaba en 9px y a un metro del monitor no se leia. */}
                    {firstR && (
                      <span className={cn("text-[12px] font-semibold leading-tight truncate max-w-full", isLibre ? "text-foreground/90" : "opacity-100")}>
                        {isWalkIn ? "WALK IN" : firstR.cliente}
                      </span>
                    )}
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 max-h-[min(80vh,560px)] overflow-y-auto p-3" collisionPadding={12}>
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
                  <MesaReservasPopover
                    mesa={m}
                    reservas={rs}
                    onEditar={onEditar}
                    onCambiarEstado={onCambiarEstado}
                    onBloquearMesa={onBloquearMesa}
                    onDesplazarReserva={onDesplazarReserva}
                    onWalkIn={(mesa) => {
                      setMesaPopoverAbiertaId(null);
                      onWalkIn?.(mesa);
                    }}
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

/**
 * Estados que la lista NO enseña mientras nadie toque el filtro de la columna
 * Estado, escritos como se leen en la celda (que es lo que compara el filtro).
 */
const ESTADOS_OCULTOS_LABELS: string[] = ESTADOS_OCULTOS_EN_LISTA.map(
  (e) => ESTADO_RESERVA_LABELS[e],
);

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
  /**
   * Está pidiendo las reservas del día al servidor. Se PINTA (barra superior +
   * velo sobre plano y listado): sin señal, cambiar de día parecía que no había
   * hecho nada, porque seguía el día anterior en pantalla hasta que llegaba la
   * respuesta (Iván, 2-sep).
   */
  const [loading, setLoading] = useState(true);
  /**
   * Contexto del módulo (locales, salas, planos, zonas, mesas) todavía en vuelo.
   * Va aparte de `loading` —que es el de las reservas del día— porque el
   * recuadro que bloquea la pantalla al cambiar de empresa debe esperar a las
   * DOS cosas: sin mesas ni plano la pantalla no se puede usar, aunque la lista
   * de reservas ya haya llegado.
   */
  const [cargandoContexto, setCargandoContexto] = useState(true);
  // Al cambiar de empresa la pantalla queda tapada y sin poder pulsarse hasta
  // que ESTA vista tiene los datos de la empresa nueva —no 900 ms y a ciegas—.
  useBloqueoCambioEmpresa(loading || cargandoContexto);
  /**
   * Día que se está mirando. Arranca en el `?fecha=` de la URL si lo hay, para
   * que al pinchar una reserva desde la ficha del cliente se abra directamente
   * ese día en el plano en vez de hoy.
   */
  const fechaPedida = searchParams?.get("fecha") ?? null;
  const fechaPedidaValida =
    fechaPedida && /^\d{4}-\d{2}-\d{2}$/.test(fechaPedida) ? fechaPedida : null;
  /**
   * El día que se abre sale del reloj de la EMPRESA, no del navegador.
   *
   * Con `new Date()` la pantalla abría el día del ordenador de quien mira: a
   * las 01:47 de Indonesia ya es el día siguiente, mientras que en el
   * restaurante son las 19:47 del día anterior, y sala entraba a un día vacío
   * pensando que se habían perdido las reservas de la noche.
   *
   * Y el día es el de NEGOCIO: hasta las 06:00 se sigue en el servicio de la
   * noche anterior, que es donde están las mesas que aún tiene puestas.
   */
  const hoyNegocio = () => {
    const { fecha, minutos } = ahoraEnZona(empresaActual.zonaHoraria);
    const hh = String(Math.floor(minutos / 60)).padStart(2, "0");
    return diaNegocioDe(fecha, `${hh}:00`);
  };
  const [fecha, setFecha] = useState(() => fechaPedidaValida ?? hoyNegocio());

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
  /**
   * Reservas señaladas desde el aviso de cobros. Manda sobre el resto de
   * filtros a propósito: un cobro pendiente suele estar CANCELADO, y el filtro
   * de estados lo tiene oculto, así que sin esto "Ver reservas" no enseñaba
   * nada y el aviso parecía roto.
   */
  const [idsDelAviso, setIdsDelAviso] = useState<string[] | null>(null);
  /** Sube al cobrar o perdonar para que el aviso se recalcule y la línea desaparezca. */
  const [refrescoAvisosCobro, setRefrescoAvisosCobro] = useState(0);
  // Orígenes DESMARCADOS. Se guarda lo oculto y no lo visible porque el catálogo
  // de orígenes es ABIERTO: Marketing crea campañas nuevas sin tocar código, y
  // con una lista de "marcados" cualquier origen nuevo nacería invisible y sus
  // reservas desaparecerían del listado sin que nadie entienda por qué.
  /**
   * Filtros de la CABECERA de la lista, uno por columna: `{ campo: valores }`.
   *
   * Los valores son el MISMO TEXTO que se lee en la celda (la mesa "M4", la
   * zona "Terraza", "Cancelación", "Confirmada"…), no la clave de BD: el
   * filtro se marca mirando la columna, así que las opciones tienen que ser lo
   * que ahí se ve. Columna sin nada marcado = columna sin filtrar; varias
   * columnas se combinan con Y y, dentro de una, los valores con O.
   */
  const [filtrosColumna, setFiltrosColumna] = useState<Record<string, string[]>>({});
  /**
   * Orden de la lista pedido desde una columna. En `null` manda el orden
   * natural del servicio (hora y, a igualdad, prioridad de estado), que es el
   * que necesita quien está en sala.
   */
  const [ordenColumna, setOrdenColumna] = useState<OrdenLista>(null);
  /** Marca o desmarca valores de UNA columna sin tocar las demás. */
  const setFiltroColumna = useCallback((campo: string, valores: string[]) => {
    setFiltrosColumna((prev) => {
      // La columna sin nada marcado se borra del objeto en vez de quedarse con
      // una lista vacía: así "sin filtrar" es una sola cosa y no dos.
      if (valores.length === 0) {
        if (!(campo in prev)) return prev;
        const { [campo]: _quitado, ...resto } = prev;
        return resto;
      }
      return { ...prev, [campo]: valores };
    });
  }, []);
  const [cfgReservas, setCfgReservas] = useState<EmpresaReservasConfig | null>(null);
  /** Reglas de aforo con vigencia (cupo / tamaño máximo por reserva). */
  const [reglasReservas, setReglasReservas] = useState<EmpresaReservasRegla[]>([]);
  const [tickAhora, setTickAhora] = useState(() => Date.now());
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [showNueva, setShowNueva] = useState(false);
  /**
   * El alta se abrió con "Sentar walk-in" desde una mesa del plano: el
   * formulario arranca ya en modo walk-in y no hay que acordarse de pulsar la
   * pestaña. Se limpia al cerrar para que el botón "Nueva" de la barra siga
   * dando de alta un cliente normal.
   */
  const [nuevaComoWalkIn, setNuevaComoWalkIn] = useState(false);
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
  /**
   * Mesa sobre la que esta el raton en el plano. Es el camino INVERSO al de
   * `reservaHoverId`: al pasar por una mesa con reserva se enciende en rojo su
   * fila en el listado, para encontrarla sin leer la lista entera.
   */
  const [mesaHoverId, setMesaHoverId] = useState<string | null>(null);
  /**
   * clienteId → veces que ha reservado en esta empresa. Alimenta el recuadro
   * azul junto al nombre, que solo sale a partir de la segunda reserva.
   */
  const [reservasPorCliente, setReservasPorCliente] = useState<Record<string, number>>({});
  const [guardandoDuracion, setGuardandoDuracion] = useState(false);
  /**
   * Turno y zona editables desde la ficha.
   *
   * Los dos SALEN SOLOS —el turno de la hora, la zona de la mesa— y en el 99 %
   * de las reservas eso acierta. Pero sala necesita poder corregirlos: una
   * comida que se alarga hasta la cena, o un grupo al que se le cambia de zona
   * sin moverle todavia la mesa. Antes eran texto fijo y la unica salida era
   * borrar la reserva y rehacerla.
   */
  const [guardandoTurno, setGuardandoTurno] = useState(false);
  const [guardandoZona, setGuardandoZona] = useState(false);
  // Fecha y hora editables desde la ficha. Cambiar la hora recalcula el turno
  // en el servidor (y con el, en que mapa sale la reserva), asi que aqui solo
  // se manda el dato nuevo y se recarga.
  const [fechaEdit, setFechaEdit] = useState("");
  const [horaEdit, setHoraEdit] = useState("");
  const [guardandoCuando, setGuardandoCuando] = useState(false);
  /** Aviso de peligro: la mesa ya está ocupada en esa franja. */
  /**
   * Aviso de mesa ya ocupada. `forzar` solo viene cuando el cambio se puede
   * repetir asumiendo el solape (reasignar mesa); en el resto de casos —mover
   * la hora, alargar la duración— no se ofrece, porque forzarlos pisaría
   * reservas que ni siquiera se están mirando.
   */
  const [avisoOcupada, setAvisoOcupada] = useState<
    { mensaje: string; forzar?: () => void } | null
  >(null);
  /** Confirmación de "Bloquear" una mesa para el día y turno en pantalla. */
  /**
   * Confirmación del candado. Se guarda una LISTA de mesas porque desde el
   * listado no hay mesa señalada y se bloquean todas las de la reserva
   * (una unión "M1+M2" son dos mesas físicas).
   */
  const [confirmBloqueo, setConfirmBloqueo] = useState<
    { mesas: Mesa[]; reservasActivas: number } | null
  >(null);
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  /**
   * Reserva "en la mano": se ha pulsado Desplazar y el plano está esperando a
   * que se elija la mesa destino. Mientras vale algo, el mapa entra en modo mover.
   */
  const [reservaADesplazar, setReservaADesplazar] = useState<Reserva | null>(null);
  /** Mesa destino elegida que pisaría a otras reservas: hay que confirmar. */
  const [choqueDesplazar, setChoqueDesplazar] = useState<
    {
      mesa: Mesa;
      choques: ChoqueReserva[];
      /**
       * Reserva que ocupa la mesa destino ahora mismo, cuando es UNA sola y
       * por tanto se puede permutar con ella. Si hay varias no se ofrece:
       * "intercambiar" con tres reservas a la vez no significa nada.
       */
      permutable: Reserva | null;
      /** Aviso de aforo de la mesa destino para el grupo que llega. */
      avisoAforo: string | null;
      /** Aviso de aforo de la mesa que se deja, para quien la recibiría. */
      avisoAforoOtra: string | null;
    } | null
  >(null);
  const [guardandoDesplazar, setGuardandoDesplazar] = useState(false);
  /** Fila del listado con la ficha rápida abierta (una sola, y ninguna en modo mover). */
  const [filaPopoverAbiertaId, setFilaPopoverAbiertaId] = useState<string | null>(null);

  const [showDetalleReserva, setShowDetalleReserva] = useState(false);
  // Salón para reasignar a mano las mesas de la reserva abierta.
  const [showEditorMesas, setShowEditorMesas] = useState(false);
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
   * Comentario DE ESTA RESERVA, editable desde su ficha. Antes solo se pintaba
   * si venía escrito del alta: quien atendía el teléfono con la reserva ya
   * hecha ("son celíacos", "llegan media hora tarde") no tenía dónde apuntarlo.
   * Es del día concreto, no de la persona: lo que le acompaña siempre —alergias,
   * manías, VIP— va en las observaciones de su ficha de cliente.
   */
  const [comentarioEdit, setComentarioEdit] = useState("");
  const [guardandoComentario, setGuardandoComentario] = useState(false);
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
  // Vista de dinero (políticas de cancelación, garantías y tickets).
  const [showCobros, setShowCobros] = useState(false);
  // BARRA SUPERIOR REPLEGADA. Reservas se mira durante todo el servicio y la
  // barra de herramientas del software no se usa en ese rato: ocupa alto y su
  // fondo claro rompe el tema oscuro del plano. Se repliega SOLO en la vista
  // frontal — en Configuración (`showConfig`) se está trabajando en el
  // software, así que ahí la barra baja como en cualquier otro módulo.
  //
  // Para recuperarla basta acercar el cursor al menú lateral: el menú ya se
  // expande solo por hover, y la barra acompaña ese mismo gesto.
  useModoInmersivoActivo(!showConfig && !showCobros);
  const { inmersivo, setInmersivoOscuro } = useModoInmersivo();
  // Se avisa al chrome del software (menu lateral) de que esta vista va en
  // oscuro, para que su borde derecho no se quede con el gris claro del tema
  // del software y aparezca como una linea blanca contra el azul marino.
  useEffect(() => {
    setInmersivoOscuro(esOscuro);
    return () => setInmersivoOscuro(false);
  }, [esOscuro, setInmersivoOscuro]);
  const [totalesMes, setTotalesMes] = useState<{
    comida: { personas: number; reservas: number };
    cena: { personas: number; reservas: number };
    personas: number;
    reservas: number;
  }>({ comida: { personas: 0, reservas: 0 }, cena: { personas: 0, reservas: 0 }, personas: 0, reservas: 0 });
  const [localId, setLocalId] = useState<string>("");
  const [salasLocalTodas, setSalasLocalTodas] = useState<SalaConfig[]>([]);
  const [salaActualId, setSalaActualId] = useState<string>("");
  const [navDirSala, setNavDirSala] = useState<1 | -1>(1);
  const [planoActualId, setPlanoActualId] = useState<string>("");
  const [planoSalas, setPlanoSalas] = useState<Record<string, string[]>>({});
  const [zonasReales, setZonasReales] = useState<ZonaReal[]>([]);
  const [posicionesPlano, setPosicionesPlano] = useState<Map<string, PlanoMesaPosicion>>(new Map());
  const [decoracionesPlano, setDecoracionesPlano] = useState<SalaDecoracion[]>([]);
  const [mesasMeta, setMesasMeta] = useState<Map<string, MesaMeta>>(new Map());
  const [posicionesRefresh, setPosicionesRefresh] = useState(0);
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
  //
  // OJO con `localId`: este efecto lo LEE y además lo ESCRIBE (`setLocalId` en
  // el primer arranque, cuando aún está vacío). Al estar en las dependencias,
  // esa escritura lo volvía a disparar y la carga completa —las 6 consultas—
  // se hacía DOS veces seguidas en cada entrada a Reservas: el doble de espera
  // y, de propina, todos los cálculos derivados (mesas, plano, disponibilidad)
  // repetidos. Guardamos el local ya cargado en una ref y salimos si no ha
  // cambiado de verdad: el efecto sigue reaccionando al cambio de local que
  // hace el usuario en el desplegable, pero no a su propia escritura.
  //
  // La huella lleva empresa y `posicionesRefresh` además del local: así un
  // cambio de empresa o un guardado del plano SÍ recargan, y sólo se descarta
  // la repetición que provoca el propio `setLocalId`.
  const localCargadoRef = useRef<string | null>(null);
  const huellaCarga = `${empresaActual.id}|${localId || ""}|${posicionesRefresh}`;
  useEffect(() => {
    if (localCargadoRef.current === huellaCarga) return;
    let cancelled = false;
    setCargandoContexto(true);
    (async () => {
      try {
      // Si ya hay localId seleccionado (el usuario cambió de local en el
      // dropdown), lo pasamos como override; si no, se elige el primero.
      const ctx = await loadReservasModuleContext(localId || undefined);
      if (cancelled) return;
      // Cargado: a partir de aquí, el `setLocalId` de abajo ya no relanza nada.
      localCargadoRef.current = `${empresaActual.id}|${localId || ""}|${posicionesRefresh}`;
      const d = ctx.data;
      if (!localId) {
        setLocalId(d.localId);
        // El primer arranque entra sin local y el servidor elige el primero.
        // Anotamos ESE local como cargado para que la escritura de arriba no
        // cuente como un cambio pendiente y vuelva a pedirlo todo.
        localCargadoRef.current = `${empresaActual.id}|${d.localId}|${posicionesRefresh}`;
      }
      setSalasLocalTodas(d.salas);
      const salaPrincipal = d.salas.find((s) => s.esPrincipal) ?? d.salas[0];
      setSalaActualId(salaPrincipal?.id ?? "");
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
      } finally {
        // Pase lo que pase se suelta la carga: si un fallo la dejara puesta, el
        // recuadro de "Cambiando de empresa…" no se quitaría nunca.
        if (!cancelled) setCargandoContexto(false);
      }
    })();
    return () => { cancelled = true; };
  }, [empresaActual.id, localId, posicionesRefresh, huellaCarga]);

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

  /**
   * Encuadre de la sala activa: el recuadro rojo del editor. Decide cuánto del
   * plano llena la pantalla del servicio. `null` = sin encuadrar → lienzo entero.
   * Se busca en TODAS las salas del local (no en las filtradas) para que el
   * encuadre no se pierda al filtrar por zonas.
   */
  const encuadreSalaActual = useMemo(
    () => salasLocalTodas.find((s) => s.id === salaActualId)?.encuadre ?? null,
    [salasLocalTodas, salaActualId],
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

  const decoracionesSalaActual = useMemo(
    () => decoracionesPlano.filter((d) => d.salaId === salaActualId),
    [decoracionesPlano, salaActualId],
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

  /**
   * Tamaños de grupo que ofrece la ficha de edición. Mismo criterio que al
   * crear: el tope sale de Configuración → Límites para ESA fecha y turno, y
   * si la reserva ya tiene más gente se le añade su valor para no perderlo.
   */
  const opcionesComensalesEdit = useMemo(() => {
    if (!selectedReserva) return [];
    const turnoRes =
      selectedReserva.turno === "CENA" ? "CENA" : "COMIDA";
    const max = maxpaxEfectivoDesdeReglas(
      reglasReservas,
      selectedReserva.fecha,
      turnoRes,
    );
    const tope = max != null && max > 0 ? max : MAX_COMENSALES_SIN_REGLA;
    const nums = Array.from({ length: tope }, (_, i) => i + 1);
    if (comensalesEdit > tope) nums.push(comensalesEdit);
    return nums;
  }, [selectedReserva, reglasReservas, comensalesEdit]);

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
    setComentarioEdit(selectedReserva.observaciones ?? "");
  }, [selectedReserva]);

  /**
   * Número de la última petición lanzada. Al pasar días con las flechas se
   * disparan varias seguidas y no siempre vuelven en orden: sin esto, una
   * respuesta lenta de un día anterior podía pisar a la del día que ya se está
   * mirando y dejar en pantalla reservas que no son de ese día.
   */
  const peticionReservasRef = useRef(0);

  /**
   * @param silencioso Refresco de fondo (sincronización en vivo). No enciende
   * el indicador: si lo hiciera, la pantalla parpadearía sola cada vez que
   * alguien toca una reserva desde otro puesto.
   */
  const loadReservas = useCallback(async (f?: string, silencioso = false) => {
    const idPeticion = ++peticionReservasRef.current;
    if (!silencioso) setLoading(true);
    try {
      const res = await listReservas(f);
      // Ha salido otra petición después de esta: su resultado manda.
      if (idPeticion !== peticionReservasRef.current) return;
      if (res.ok) {
        setReservas(res.data.map(mapDbToReserva));
      } else {
        toast.error("Error al cargar reservas", { description: res.error });
      }
    } catch (err) {
      if (idPeticion !== peticionReservasRef.current) return;
      toast.error("Error de conexion al cargar reservas", { description: friendlyError(err, "irSiguienteSala") });
    } finally {
      // El indicador se apaga SIEMPRE, sea o no la última petición.
      //
      // Antes solo lo apagaba la última, y con dos cargas seguidas —abrir la
      // pantalla, cambiar de fecha— bastaba con que la segunda terminase
      // primero para que la pantalla se quedara cargando para siempre. Que una
      // respuesta vieja no se pinte es correcto; que deje la pantalla colgada,
      // no.
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservas(fecha);
  }, [fecha, loadReservas]);

  /**
   * Etiquetas de las reservas del día, para la columna "Etiquetas" de la lista.
   *
   * Se piden en bloque —dos consultas para el día entero— y no reserva a
   * reserva: con 40 reservas serían 80 viajes cada vez que se pasa de día.
   *
   * Van las de la reserva y las que hereda del cliente juntas, que es como se
   * ven en la ficha: para quien está sirviendo, un "alérgico a los frutos
   * secos" pesa lo mismo esté apuntado donde esté.
   */
  const [etiquetasPorReserva, setEtiquetasPorReserva] = useState<
    Record<string, EtiquetaConOrigen[]>
  >({});

  // Solo la CLAVE (ids + cliente) dispara la recarga: `reservas` se sustituye
  // entero en cada refresco en vivo, y con el array como dependencia esto se
  // relanzaría cada pocos segundos aunque no hubiera cambiado nada.
  const claveEtiquetas = useMemo(
    () => reservas.map((r) => `${r.id}:${r.clienteId ?? ""}`).join("|"),
    [reservas],
  );

  useEffect(() => {
    let cancelado = false;
    const pares = reservas.map((r) => ({ id: r.id, clienteId: r.clienteId ?? null }));
    if (pares.length === 0) {
      setEtiquetasPorReserva({});
      return;
    }
    (async () => {
      const res = await listEtiquetasEfectivasDeReservas(pares);
      if (cancelado) return;
      // Un fallo aquí no puede tumbar la lista: las etiquetas son un extra,
      // y la reserva se sigue leyendo sin ellas.
      if (res.ok) setEtiquetasPorReserva(res.data);
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveEtiquetas]);

  /**
   * Veces que ha reservado cada cliente del día, para el recuadro azul del
   * listado. Se pide en lote (una consulta por día, no una por fila) y solo
   * para los clientes que están en pantalla.
   */
  const clienteIdsDelDia = useMemo(() => {
    const ids = new Set<string>();
    for (const r of reservas) {
      if (r.fecha === fecha && r.clienteId) ids.add(r.clienteId);
    }
    return Array.from(ids).sort();
  }, [reservas, fecha]);

  // Clave estable: sin esto el efecto se relanzaría en cada render porque el
  // array es nuevo cada vez aunque los ids sean los mismos.
  const clienteIdsKey = clienteIdsDelDia.join(",");

  useEffect(() => {
    let cancelado = false;
    if (clienteIdsKey === "") {
      setReservasPorCliente({});
      return;
    }
    (async () => {
      const res = await contarReservasPorCliente(clienteIdsKey.split(","));
      if (!cancelado && res.ok) setReservasPorCliente(res.data);
    })();
    return () => {
      cancelado = true;
    };
  }, [clienteIdsKey]);

  // Sincronización en vivo: si otra persona crea, mueve o cancela una reserva,
  // el plano y el listado se actualizan solos. Sala es la pantalla donde más
  // manos trabajan a la vez y donde un dato viejo se paga sentando mal una mesa.
  //
  // Se PAUSA mientras hay un diálogo abierto (nueva reserva, ficha, bloqueo…):
  // refrescar bajo los pies mientras rellenas un formulario perdería lo escrito.
  // Los cambios que lleguen entre medias se aplican al cerrar.
  // El filtro va contra la COLUMNA `empresa_id`, que es un UUID: hay que
  // mandar `dbId`, no el slug ("habana"). Con el slug el filtro no casaba con
  // ninguna fila y la sincronización en vivo de Reservas no saltaba nunca —en
  // silencio, porque el fallo no da error. `mesas` no tiene `empresa_id`, así
  // que se vigila aparte y sin filtro (cuelga del local, no de la empresa).
  useSincronizacionEnVivo({
    tablas: ["reservas"],
    empresaId: empresaActual.dbId ?? null,
    // Silencioso: el refresco de fondo no debe encender el indicador de carga,
    // o la pantalla parpadearía sola cada vez que otro puesto toca una reserva.
    onCambio: () => void loadReservas(fecha, true),
    // La ficha de reserva NO pausa: es justo donde hace falta el dato fresco.
    // Sus campos se guardan uno a uno en cuanto se tocan, así que no hay nada
    // a medio escribir que una recarga pueda tirar, y a cambio los avisos de
    // mesa (⏰ ocupada) reflejan lo que acaba de entrar sin cerrar la ventana.
    //
    // Los formularios de alta sí pausan: ahí hay un borrador entero sin
    // guardar y perderlo es peor que ver un dato con unos segundos de retraso.
    pausado:
      showNueva || !!selectedMesa ||
      !!confirmEstado || !!confirmBloqueo,
    // Ráfaga más corta que la de por defecto: en sala las reservas entran unas
    // detrás de otras y medio segundo de retraso ya se nota al asignar mesa.
    margenMs: 200,
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

  // Un bloqueo puede cambiar desde Configuración → Bloqueos (o desde el plano
  // de otro compañero) mientras esta pantalla está abierta. Sin esto, el plano
  // seguía pintando de negro una mesa ya desbloqueada hasta recargar.
  useSincronizacionEnVivo({
    tablas: [
      "empresa_reservas_bloqueos",
      "empresa_reservas_bloqueos_excepciones",
    ],
    // UUID, no slug: mismo motivo que en la suscripción de reservas.
    empresaId: empresaActual.dbId ?? null,
    onCambio: () => setBloqueosRefresh((n) => n + 1),
    // La ficha tampoco pausa aquí: si alguien bloquea una mesa mientras se
    // edita una reserva, el desplegable tiene que dejar de ofrecerla al
    // momento — es justo el dato que decide si esa mesa vale o no.
    pausado:
      showNueva || !!selectedMesa ||
      !!confirmEstado || !!confirmBloqueo,
  });

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

  // Config de reservas (parpadeo, duración por defecto…). Se recarga al volver
  // al view.
  useEffect(() => {
    (async () => {
      const [c, r] = await Promise.all([
        getReservasConfig(),
        listReglasReservas(),
      ]);
      if (c.ok && c.data) setCfgReservas(c.data);
      // Las reglas de aforo las necesita la ficha de edición para saber cuántas
      // personas puede ofrecer su desplegable de comensales.
      if (r.ok) setReglasReservas(r.data);
    })();
  }, []);

  // Tick para reevaluar el parpadeo y la columna TIEMPO. El contador se
  // muestra en horas y minutos (sin segundos), así que refrescar cada 30 s
  // basta para que el minuto cambie a tiempo sin repintar la lista sin parar.
  useEffect(() => {
    const id = setInterval(() => setTickAhora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  /**
   * "Ahora" en la zona de la EMPRESA, no en la del ordenador: la hora de una
   * reserva es la del restaurante, y el puesto de sala puede estar en otra
   * zona. Se recalcula con cada tick, y de ahí cuelga toda la columna TIEMPO.
   */
  const ahoraEmpresa = useMemo(
    // `tickAhora` entra de verdad en el calculo (es el instante que se lee),
    // asi que la dependencia es real: cada tick devuelve un "ahora" nuevo y
    // con el se repinta la columna TIEMPO.
    () => ahoraEnZona(empresaActual.zonaHoraria, new Date(tickAhora)),
    [empresaActual.zonaHoraria, tickAhora],
  );

  /**
   * Devuelve clase Tailwind con animación si la reserva entra en alguna de las
   * franjas configuradas como "parpadeo" en Configuración. Solo afecta
   * a reservas vivas del día actual.
   *
   * El parpadeo ROJO de la fila entera es una alarma de "se ha pasado", así que
   * se ata a la MISMA fuente que la columna TIEMPO (`calcularTiempoReserva`) y
   * solo se enciende cuando el contador está EN NEGATIVO: la reserva pasó su
   * hora sin sentarse (RETRASO) o la mesa agotó su tiempo (EXCEDIDA). Mientras
   * el contador está en positivo (aún no ha llegado su hora) la fila no
   * parpadea en rojo. Antes se calculaba con `Date` del navegador, que en otra
   * zona horaria daba el rojo con la reserva todavía por llegar.
   */
  const parpadeoClassPara = useCallback(
    (r: Reserva): string | null => {
      if (!cfgReservas) return null;
      if (r.fecha !== fecha) return null;
      if (ESTADOS_NO_OCUPANTES.includes(r.estado)) return null;
      if (r.fecha !== ahoraEmpresa.fecha) return null;

      const t = calcularTiempoReserva(r, ahoraEmpresa, cfgReservas.duracionReservaMin);

      // Rojo: SOLO con el tiempo en negativo (pasada la hora o pasado el tiempo
      // de mesa). Nunca con el contador en positivo.
      if (cfgReservas.parpadeoPasadoDuracion && t && (t.fase === "RETRASO" || t.fase === "EXCEDIDA")) {
        return "animate-pulse bg-red-500/10";
      }

      // Avisos de "está a punto de llegar": siguen mirando lo que falta, y solo
      // con el contador EN POSITIVO (la hora aún no ha llegado).
      const restantes = minutosHastaReserva(r, ahoraEmpresa);
      if (restantes != null && restantes >= 0) {
        // Próximos 0-15 min.
        if (cfgReservas.parpadeo0a15 && restantes <= 15) {
          return "animate-pulse bg-emerald-500/10";
        }
        // Próximos 15-30 min.
        if (cfgReservas.parpadeo15a30 && restantes > 15 && restantes <= 30) {
          return "animate-pulse bg-amber-500/10";
        }
      }
      return null;
    },
    [cfgReservas, fecha, ahoraEmpresa],
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

  // Mesa por su id, para no recorrer las 100 mesas por cada fila del listado.
  // La lista hacía `mesas.find(...)` dentro del `map` de reservas: en un día
  // lleno eso son miles de comparaciones, y se repetían enteras cada vez que el
  // ratón pasaba por una fila y cada 30 s con el tick del reloj. Con el mapa,
  // cada fila resuelve su mesa de una.
  const mesaPorId = useMemo(() => {
    const m = new Map<string, Mesa>();
    for (const mesa of mesas) m.set(mesa.id, mesa);
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
   * La ficha abierta sigue a la lista recargada.
   *
   * Con la sincronización en vivo activa mientras la ficha está abierta, los
   * datos pueden cambiar bajo los pies (otra persona mueve la reserva de mesa,
   * la cancela, le sube los comensales). Sin esto la ventana seguiría
   * enseñando la foto de cuando se abrió.
   *
   * Solo se reemplaza si de verdad cambió algo de lo que se muestra: hacerlo
   * en cada recarga reiniciaría los efectos que dependen de `selectedReserva`
   * y machacaría los campos que se estén editando.
   */
  useEffect(() => {
    if (!selectedReserva) return;
    const fresca = reservasResueltas.find((r) => r.id === selectedReserva.id);
    if (!fresca) {
      // La reserva ya no está en el día que se está mirando: o alguien la ha
      // borrado, o la ha movido a otra fecha. Seguir enseñando su ficha
      // invitaría a editar algo que ya no existe donde se cree que está, así
      // que se cierra y se dice por qué. No se pierde nada: cada campo de esta
      // ficha se guarda en cuanto se toca.
      //
      // Con la lista vacía no se concluye nada: es el hueco entre pedir los
      // datos y recibirlos, y cerrar ahí la ficha la haría desaparecer sola en
      // cada recarga.
      if (reservasResueltas.length === 0) return;
      setShowDetalleReserva(false);
      setSelectedReserva(null);
      toast.info("La reserva que tenías abierta ya no está en este día.");
      return;
    }
    const cambio =
      fresca.estado !== selectedReserva.estado ||
      fresca.mesaCodigo !== selectedReserva.mesaCodigo ||
      fresca.zona !== selectedReserva.zona ||
      fresca.hora !== selectedReserva.hora ||
      fresca.fecha !== selectedReserva.fecha ||
      fresca.comensales !== selectedReserva.comensales ||
      fresca.duracionMinutos !== selectedReserva.duracionMinutos ||
      // Los datos de la persona también cuentan como cambio: al resolver una
      // vinculación la ficha pasa a otro nombre y correo, y sin mirarlos aquí
      // la ficha abierta se quedaba enseñando los datos viejos.
      fresca.cliente !== selectedReserva.cliente ||
      fresca.apellidos !== selectedReserva.apellidos ||
      fresca.telefono !== selectedReserva.telefono ||
      fresca.email !== selectedReserva.email ||
      fresca.clienteId !== selectedReserva.clienteId;
    if (!cambio) return;
    setSelectedReserva((prev) => (prev && prev.id === fresca.id ? fresca : prev));
  }, [reservasResueltas, selectedReserva]);

  /**
   * Códigos de mesa de la reserva abierta. Una unión graba varias ("M1+M2").
   */
  const codigosMesaReservaAbierta = useMemo(() => {
    const codigo = (selectedReserva?.mesaCodigo ?? "").trim();
    if (!codigo) return [];
    return codigo.split("+").map((c) => c.trim().toUpperCase()).filter(Boolean);
  }, [selectedReserva]);

  /** Una reserva sobre varias mesas no se reasigna con un desplegable simple. */
  const esReservaUnion = codigosMesaReservaAbierta.length > 1;

  /** Id de la mesa actual (vacío si no tiene, o si es una unión). */
  const mesaIdReservaAbierta = useMemo(() => {
    if (esReservaUnion) return "";
    const codigo = codigosMesaReservaAbierta[0];
    if (codigo) return mesaIdPorCodigo.get(codigo) ?? "";
    return selectedReserva?.mesaId ?? "";
  }, [esReservaUnion, codigosMesaReservaAbierta, mesaIdPorCodigo, selectedReserva]);

  /**
   * ── CAMBIO DE MESA DESDE LA FICHA ──────────────────────────────────────
   *
   * Mesas que se pueden dar a la reserva abierta. Son todas las del local, no
   * solo las de su zona: mover una reserva de terraza a salón es justo el
   * cambio que hay que poder hacer desde aquí.
   */
  const mesasParaReservaAbierta = useMemo(() => {
    if (!selectedReserva) return [];
    // Las mesas bloqueadas a mano para este día y turno no se ofrecen: no es
    // que choquen con otra reserva, es que no están disponibles, y darlas a
    // elegir con un ✅ sería mentir. Se salva la que ya tiene la reserva, para
    // no vaciarle el selector si se bloqueó su mesa después de sentarla.
    const mesaActual = mesaIdReservaAbierta;
    return mesas
      .filter((m) => m.id === mesaActual || !mesasBloqueadasIds.has(m.id))
      .sort((a, b) =>
        a.codigo.localeCompare(b.codigo, undefined, { numeric: true }),
      );
  }, [mesas, selectedReserva, mesasBloqueadasIds, mesaIdReservaAbierta]);

  /**
   * Diagnóstico ✅ / ⏰ / 👥 de cada mesa para la reserva abierta.
   *
   * Se calcula sobre `reservasResueltas`, que es lo que la sincronización en
   * vivo mantiene al día: si entra o se cancela una reserva mientras la ficha
   * está abierta, los iconos cambian solos sin cerrar la ventana.
   *
   *   ⏰ solape real de franjas —no "hay algo ese día"—, comparando en minutos
   *      de jornada para que una cena a las 23:30 y otra a las 00:30 cuenten
   *      como la misma noche.
   *   👥 la capacidad del catálogo no encaja con los comensales que se están
   *      editando ahora mismo (no los guardados): al subir el grupo en el
   *      desplegable, las mesas que se quedan cortas se marcan al instante.
   *
   * La propia reserva se excluye: su mesa actual no puede chocar consigo misma.
   */
  const estadoMesasReservaAbierta = useMemo(() => {
    const out = new Map<string, EstadoMesaParaReserva>();
    if (!selectedReserva) return out;

    const duracion =
      selectedReserva.duracionMinutos ??
      cfgReservas?.duracionReservaMin ??
      DURACION_RESERVA_DEFAULT_MINUTOS;

    // Códigos de mesa ocupados en la franja que ocuparía esta reserva.
    const ocupados = new Set<string>();
    for (const r of reservasResueltas) {
      if (r.id === selectedReserva.id) continue;
      if (r.fecha !== fechaEdit) continue;
      if (ESTADOS_NO_OCUPANTES.includes(r.estado)) continue;
      const codigo = (r.mesaCodigo ?? "").trim();
      if (!codigo) continue;
      const durOtra =
        typeof r.duracionMinutos === "number" && r.duracionMinutos > 0
          ? r.duracionMinutos
          : duracion;
      if (!franjasSolapan(horaEdit, duracion, r.hora, durOtra)) continue;
      for (const c of codigo.split("+")) {
        const limpio = c.trim().toUpperCase();
        if (limpio) ocupados.add(limpio);
      }
    }

    for (const m of mesasParaReservaAbierta) {
      const meta = mesasMeta.get(m.id);
      let aforo: EstadoMesaParaReserva["aforo"] = null;
      if (meta && comensalesEdit > 0) {
        if (comensalesEdit > meta.capacidadMax) {
          aforo = { tipo: "excede", min: meta.capacidadMin, max: meta.capacidadMax };
        } else if (comensalesEdit < meta.capacidadMin) {
          aforo = { tipo: "insuficiente", min: meta.capacidadMin, max: meta.capacidadMax };
        }
      }
      out.set(m.id, {
        ocupada: ocupados.has(m.codigo.toUpperCase()),
        aforo,
      });
    }
    return out;
  }, [
    selectedReserva,
    reservasResueltas,
    mesasParaReservaAbierta,
    mesasMeta,
    cfgReservas,
    fechaEdit,
    horaEdit,
    comensalesEdit,
  ]);

  /**
   * Mesas que hay que resaltar en el plano por el hover de la lista. Se parte
   * el codigo por "+" porque una union ("M1+M2") ocupa DOS mesas fisicas y las
   * dos tienen que encenderse: `mesaId` solo guarda la primera.
   */
  /**
   * TODAS las mesas de una reserva. Una union se guarda como "M1+M2": `mesaId`
   * solo apunta a la primera, asi que hay que partir el codigo para no dejarse
   * la mitad del grupo fuera (lo usan el resaltado del plano y el candado).
   */
  const mesasIdsDeReserva = useCallback(
    (r: Reserva | null): Set<string> => {
      const ids = new Set<string>();
      if (!r) return ids;
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
    },
    [mesaIdPorCodigo],
  );

  /** Igual que el anterior, pero devolviendo las mesas del catalogo. */
  const mesasDeReserva = useCallback(
    (r: Reserva | null): Mesa[] => {
      const ids = mesasIdsDeReserva(r);
      if (ids.size === 0) return [];
      return mesas.filter((m) => ids.has(m.id));
    },
    [mesasIdsDeReserva, mesas],
  );

  const reservasDia = useMemo(() => reservasResueltas.filter(r => r.fecha === fecha), [reservasResueltas, fecha]);
  const reservasTurno = useMemo(() => reservasDia.filter(r => r.turno === turno), [reservasDia, turno]);

  const mesasResaltadasIds = useMemo(() => {
    const ids = new Set<string>();
    // Raton encima de una mesa del plano: se marca esa mesa y, si esta ocupada
    // por una reserva que junta varias ("M1+M2"), TODAS las del grupo. Pasar
    // por una sola mesa tiene que enseñar la union entera.
    if (mesaHoverId) {
      ids.add(mesaHoverId);
      for (const r of reservasTurno) {
        if (ESTADOS_NO_OCUPANTES.includes(r.estado)) continue;
        const delGrupo = mesasIdsDeReserva(r);
        if (delGrupo.has(mesaHoverId)) for (const id of delGrupo) ids.add(id);
      }
    }
    // Raton encima de una fila del listado: se marcan sus mesas (una union
    // ocupa dos, y las dos tienen que encenderse).
    if (reservaHoverId) {
      const r = reservasResueltas.find((x) => x.id === reservaHoverId);
      for (const id of mesasIdsDeReserva(r ?? null)) ids.add(id);
    }
    return ids;
  }, [
    mesaHoverId,
    reservaHoverId,
    reservasResueltas,
    reservasTurno,
    mesasIdsDeReserva,
  ]);

  /**
   * Camino INVERSO: reservas que se encienden en el listado porque el raton
   * esta encima de su mesa en el plano. Se reutiliza `mesasIdsDeReserva` para
   * que una union ("M1+M2") encienda su fila pasando por CUALQUIERA de las dos
   * mesas, no solo por la primera.
   */

  const reservasResaltadasIds = useMemo(() => {
    const ids = new Set<string>();
    if (!mesaHoverId) return ids;
    // Solo el turno que hay en pantalla: es lo unico que enseña el listado, y
    // asi el resaltado no puede encender la reserva de otro dia o turno que
    // por casualidad ocupe esa misma mesa.
    for (const r of reservasTurno) {
      if (ESTADOS_NO_OCUPANTES.includes(r.estado)) continue;
      if (mesasIdsDeReserva(r).has(mesaHoverId)) ids.add(r.id);
    }
    return ids;
  }, [mesaHoverId, reservasTurno, mesasIdsDeReserva]);
  /**
   * Texto de una reserva en una columna concreta: lo MISMO que se lee en la
   * celda. Es la fuente única del filtro por columna —de aquí salen tanto las
   * casillas que se ofrecen como la comparación al filtrar—, así que una
   * opción marcada no puede dejar de casar con su propia fila.
   *
   * Etiquetas devuelve varias: basta con que UNA coincida, igual que en el
   * resto de tablas del software con columnas multivalor.
   */
  const valoresDeColumna = useCallback(
    (r: Reserva, campo: string): string[] => {
      switch (campo) {
        case "hora":
          return [r.hora.slice(0, 5)];
        case "mesa": {
          const mesa = r.mesaId ? mesaPorId.get(r.mesaId) : undefined;
          return [mesa?.codigo ?? "—"];
        }
        case "zona":
          return [zonaLabel(r.zona ? String(r.zona) : null) || "—"];
        case "nombre":
          return [`${r.cliente || "WALK IN"} ${r.apellidos ?? ""}`.trim()];
        case "comensales":
          return [String(r.comensales)];
        case "origen":
          return [origenLabel(r.origen)];
        case "tipo":
          return [
            TIPO_RESERVA_CORTO[
              tipoDeReserva({
                esTicket: r.esTicket,
                tieneGarantia: r.tieneGarantia,
                garantiaImporte: r.garantiaImporte,
                tieneCancelacion: r.tieneCancelacion,
                cancelacionImporte: r.cancelacionImporte,
              })
            ],
          ];
        case "estado":
          return [ESTADO_RESERVA_LABELS[r.estado]];
        case "etiquetas": {
          const etqs = etiquetasPorReserva[r.id] ?? [];
          return etqs.length === 0 ? ["—"] : etqs.map((e) => e.nombre);
        }
        default:
          return [];
      }
    },
    [mesaPorId, etiquetasPorReserva],
  );

  const reservasFiltradas = useMemo(() => {
    // Señaladas desde el aviso: se enseñan esas y solo esas.
    if (idsDelAviso && idsDelAviso.length > 0) {
      const set = new Set(idsDelAviso);
      return reservasTurno
        .filter((r) => set.has(r.id))
        .sort(compararReservasPorJornada);
    }
    // Solo las columnas con algo marcado: una lista vacía es "sin filtrar" y
    // no debe descartar ninguna fila.
    const columnasFiltradas = Object.entries(filtrosColumna).filter(
      ([, valores]) => valores.length > 0,
    );
    // Sin tocar la columna Estado, la lista arranca sin canceladas, no-shows ni
    // liberadas: es el punto de partida del turno, igual en todas las empresas
    // y cada vez que se entra. Marcarlas en el filtro las devuelve a la lista.
    const ocultarCaidas = !filtrosColumna.estado?.length;
    const filtradas = reservasTurno.filter(r => {
      const q = busqueda.toLowerCase();
      const matchQ = !q || r.cliente.toLowerCase().includes(q) || r.apellidos.toLowerCase().includes(q) || r.telefono.includes(q);
      if (ocultarCaidas && ESTADOS_OCULTOS_EN_LISTA.includes(r.estado)) return false;
      // Columnas: se combinan con Y; dentro de cada una, los valores con O.
      // Estado y origen se filtran DESDE SU COLUMNA, como el resto: los dos
      // botones de la barra que hacían lo mismo ya no existen.
      const matchC = columnasFiltradas.every(([campo, valores]) =>
        valoresDeColumna(r, campo).some((v) => valores.includes(v)),
      );
      return matchQ && matchC;
    });

    if (!ordenColumna) return filtradas.sort(compararReservasPorJornada);

    // Orden pedido desde una columna. Los números (comensales) se comparan
    // como números y no como texto, o "10" quedaría antes que "2"; el resto
    // por su texto en español, que es lo que se lee en la celda.
    const { campo, direccion } = ordenColumna;
    const signo = direccion === "asc" ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      if (campo === "comensales") {
        const cmp = a.comensales - b.comensales;
        if (cmp !== 0) return signo * cmp;
        return compararReservasPorJornada(a, b);
      }
      const va = valoresDeColumna(a, campo).join(", ");
      const vb = valoresDeColumna(b, campo).join(", ");
      const cmp = va.localeCompare(vb, "es");
      if (cmp !== 0) return signo * cmp;
      // A igualdad, el orden natural del servicio: sin esto las filas empatadas
      // (todas las "Confirmada", p. ej.) salían desordenadas por hora.
      return compararReservasPorJornada(a, b);
    });
  }, [
    reservasTurno,
    busqueda,
    idsDelAviso,
    filtrosColumna,
    ordenColumna,
    valoresDeColumna,
  ]);

  /**
   * Opciones de cada columna: los valores REALES de las reservas que ya han
   * pasado por el resto de filtros de la vista, sin repetir. Se calculan
   * ignorando el filtro de la propia columna —si no, al marcar un valor
   * desaparecerían los demás y no se podría añadir un segundo.
   */
  const opcionesColumna = useCallback(
    (campo: string): string[] => {
      const otras = Object.entries(filtrosColumna).filter(
        ([c, valores]) => c !== campo && valores.length > 0,
      );
      // El punto de partida de Estado (sin canceladas, no-shows ni liberadas)
      // acota igual que un filtro puesto para las DEMÁS columnas: si esas
      // reservas no se ven, sus mesas y orígenes tampoco se ofrecen. En la
      // propia columna Estado no se aplica, o no habría forma de recuperarlas.
      const ocultarCaidas = campo !== "estado" && !filtrosColumna.estado?.length;
      const base = reservasTurno.filter((r) => {
        const q = busqueda.toLowerCase();
        const matchQ = !q || r.cliente.toLowerCase().includes(q) || r.apellidos.toLowerCase().includes(q) || r.telefono.includes(q);
        if (ocultarCaidas && ESTADOS_OCULTOS_EN_LISTA.includes(r.estado)) return false;
          const matchC = otras.every(([c, valores]) =>
          valoresDeColumna(r, c).some((v) => valores.includes(v)),
        );
        return matchQ && matchC;
      });
      const set = new Set<string>();
      base.forEach((r) => valoresDeColumna(r, campo).forEach((v) => set.add(v)));
      const lista = Array.from(set);
      // Los comensales se ordenan por su número, no como cadena.
      if (campo === "comensales") {
        return lista.sort((a, b) => Number(a) - Number(b));
      }
      return lista.sort((a, b) => a.localeCompare(b, "es"));
    },
    [
      reservasTurno,
      busqueda,
        filtrosColumna,
      valoresDeColumna,
    ],
  );

  /**
   * Color del punto de cada opción del filtro de columna.
   *
   * Solo lo llevan Estado y Etiquetas, que son las dos columnas donde el color
   * ES el dato: en sala se reconoce una cancelada por el rojo antes que por
   * leer la palabra, así que el desplegable tiene que enseñar el MISMO punto
   * que la fila. Se resuelve del texto de la opción a su valor porque las
   * opciones del filtro son ya el rótulo que se lee en la celda.
   */
  const colorOpcionEstado = useCallback((valor: string) => {
    const estado = ESTADOS_RESERVA.find(
      (e) => ESTADO_RESERVA_LABELS[e] === valor,
    );
    return estado ? { clase: ESTADO_DOT_CLASS[estado] } : null;
  }, []);

  /**
   * Las etiquetas no tienen paleta fija: cada una guarda su color, así que el
   * punto se pinta con ese hexadecimal. El "—" de las reservas sin etiqueta no
   * es una etiqueta y por eso no lleva punto.
   */
  const colorOpcionEtiqueta = useCallback(
    (valor: string) => {
      for (const etqs of Object.values(etiquetasPorReserva)) {
        const e = etqs.find((x) => x.nombre === valor);
        if (e?.color) return { hex: e.color };
      }
      return null;
    },
    [etiquetasPorReserva],
  );

  /**
   * Clases de tema para los desplegables de las cabeceras. Se pintan en un
   * portal colgado de <body>, fuera del contenedor de la vista, así que sin
   * repetírselas saldrían con el tema claro del resto del software aunque la
   * sala esté en oscuro.
   */
  const panelTemaSala = cn("sala-tema", esOscuro && "sala-oscuro");

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

  /**
   * Mesas del PLANO entero: todas las de todas las zonas de todas las salas que
   * el plano seleccionado incluye dentro del local activo. Es la base de los
   * indicadores de arriba, que son globales del plano+local y por tanto NO se
   * mueven al cambiar de sala ni de zona: solo al cambiar de plano o de local.
   */
  const mesasPlano = useMemo(() => {
    const activas = mesas.filter((m) => m.activa);
    const salasOK = new Set(salasLocal.map((s) => s.id));
    const zonasOK = new Set(
      zonasReales.filter((z) => salasOK.has(z.salaId)).map((z) => z.id),
    );
    if (zonasOK.size === 0) return activas;
    return activas.filter((m) => {
      const zonaId = mesasMeta.get(m.id)?.zonaId;
      // Sin metadatos de zona no la escondemos: mejor contarla que perderla.
      return !zonaId || zonasOK.has(zonaId);
    });
  }, [mesas, salasLocal, zonasReales, mesasMeta]);

  const capacidadTotal = mesasPlano.reduce((s, m) => s + m.capacidad, 0);

  /**
   * Reservas del día y turno que caen dentro del PLANO+LOCAL visible. La carga
   * trae las reservas de toda la empresa, así que se acotan por mesa: si la
   * reserva está sentada en una mesa que no pertenece a este plano, es de otro
   * sitio y no cuenta. Las que aún no tienen mesa asignada sí cuentan: son
   * reservas del día que están por colocar.
   */
  const reservasTurnoPlano = useMemo(() => {
    const idsPlano = new Set(mesasPlano.map((m) => m.id));
    return reservasTurno.filter((r) => !r.mesaId || idsPlano.has(r.mesaId));
  }, [reservasTurno, mesasPlano]);

  /**
   * Base de los indicadores superiores: TODAS las reservas del plano+local, sin
   * aplicar los filtros de zona, estado, origen ni búsqueda, porque el
   * indicador representa el plano completo y no lo que se esté mirando.
   *
   * Solo se descuentan las que NO asisten (canceladas y no-show): una LIBERADA
   * soltó la mesa, pero el cliente vino y comió, así que cuenta.
   */
  const reservasContables = useMemo(
    () => reservasTurnoPlano.filter(r => !ESTADOS_NO_ASISTEN.includes(r.estado)),
    [reservasTurnoPlano],
  );
  const cubiertosReservados = reservasContables.reduce((s, r) => s + r.comensales, 0);
  const mesasOcupadas = useMemo(
    () =>
      new Set(
        reservasTurnoPlano
          .filter(r => r.mesaId && !ESTADOS_NO_OCUPANTES.includes(r.estado))
          .map(r => r.mesaId),
      ).size,
    [reservasTurnoPlano],
  );

  // Índice mesaId → reservas activas del turno. Se rehace solo si cambia `reservasTurno`,
  // evitando un O(N×M) en cada render (antes hacíamos un `.filter()` por cada mesa).
  const reservasActivasPorMesa = useMemo(() => {
    const map = new Map<string, Reserva[]>();
    for (const r of reservasTurno) {
      if (ESTADOS_NO_OCUPANTES.includes(r.estado)) continue;
      // Se indexa por TODAS las mesas de la reserva, no solo por `mesaId`: en
      // una union ("M1+M2") la segunda mesa tambien esta ocupada y tiene que
      // saber quien se sienta en ella.
      for (const mesaId of mesasIdsDeReserva(r)) {
        const arr = map.get(mesaId);
        if (arr) arr.push(r);
        else map.set(mesaId, [r]);
      }
    }
    // Orden CRONOLOGICO dentro de cada mesa: cuando dos reservas comparten
    // mesa y turno, la mesa enseña la que llega antes y el popover las lista
    // de arriba abajo por hora. Todo lo que lee este mapa cuenta con ese orden.
    for (const arr of map.values()) {
      arr.sort(compararReservasPorJornada);
    }
    return map;
  }, [reservasTurno, mesasIdsDeReserva]);

  const getMesaEstadoTurno = (m: Mesa): string => {
    if (mesasBloqueadasIds.has(m.id)) return "BLOQUEADA";
    const rs = reservasActivasPorMesa.get(m.id);
    if (!rs || rs.length === 0) return "LIBRE";
    // OCUPADA = hay gente SENTADA en ella. Antes se miraba WALK_IN, que es el
    // ORIGEN de la reserva: una mesa con un walk-in que todavia no se habia
    // sentado ya salia ocupada, y una con un cliente sentado que SI habia
    // reservado salia como si estuviera libre de gente.
    //
    // SENTADA manda sobre TERMINADA cuando la mesa se comparte: mientras quede
    // alguien comiendo, la mesa no esta terminando de nada.
    if (rs.some(r => r.estado === "SENTADA")) return "OCUPADA";
    // TERMINADA: han acabado pero siguen ahi. Se pinta en rosa, aparte del
    // verde de OCUPADA, porque es la mesa que esta a punto de quedar libre.
    if (rs.some(r => r.estado === "TERMINANDO")) return "TERMINADA";
    return "RESERVADA";
  };

  const getReservasMesa = (mesaId: string): Reserva[] =>
    reservasActivasPorMesa.get(mesaId) ?? [];

  /**
   * Reservas DUPLICADAS: el mismo cliente tiene otra reserva a menos de 24
   * horas de esta. No se impide crearlas —a veces son dos mesas de verdad—,
   * pero se marcan TODAS las implicadas con un aviso de peligro que dice qué
   * día y a qué hora está la otra, para que sala lo mire y decida.
   *
   * POR QUÉ hace falta: el caso real es alguien que se equivoca al reservar
   * por la web (pone 3 personas, se da cuenta, vuelve a reservar poniendo 4)
   * y no sabe cancelar la primera. Quedan dos mesas bloqueadas para una sola
   * comida y nadie se entera hasta que llega la noche.
   *
   * POR QUÉ 24 horas y no "el mismo día": una reserva a las 23:00 y otra al
   * día siguiente a las 00:30 son días distintos de calendario y sin embargo
   * están a hora y media. El criterio es la distancia real entre las dos.
   *
   * Se agrupa por ficha de cliente, y si no la hay, por teléfono normalizado:
   * una reserva de teléfono puede no tener ficha enganchada todavía.
   *
   * Se ignoran las que ya no ocupan mesa (canceladas, no-show, liberadas): si
   * la primera está cancelada ya no hay nada que avisar.
   */
  const duplicadasPorReserva = useMemo(() => {
    // Sobre TODAS las reservas cargadas, no solo las del día en pantalla: una
    // a las 23:00 y otra al día siguiente a las 00:30 están a hora y media y
    // filtrando por día no se verían la una a la otra.
    const porCliente = new Map<string, Reserva[]>();
    for (const r of reservasResueltas) {
      if (ESTADOS_NO_OCUPANTES.includes(r.estado)) continue;
      const clave =
        r.clienteId ?? (r.telefono ? `tel:${r.telefono.replace(/\D/g, "")}` : null);
      if (!clave) continue;
      const arr = porCliente.get(clave);
      if (arr) arr.push(r);
      else porCliente.set(clave, [r]);
    }

    /** Reserva → instante, para medir la distancia entre dos. */
    const instante = (r: Reserva): number =>
      new Date(`${r.fecha}T${r.hora.slice(0, 5)}:00`).getTime();
    const VENTANA_MS = 24 * 60 * 60 * 1000;

    const out = new Map<string, ReservaDuplicada[]>();
    for (const rs of porCliente.values()) {
      if (rs.length < 2) continue;
      for (const r of rs) {
        const cercanas = rs
          .filter(
            (o) =>
              o.id !== r.id &&
              Math.abs(instante(o) - instante(r)) < VENTANA_MS,
          )
          .sort((a, b) => instante(a) - instante(b))
          .map((o) => ({ id: o.id, fecha: o.fecha, hora: o.hora }));
        if (cercanas.length > 0) out.set(r.id, cercanas);
      }
    }
    return out;
  }, [reservasResueltas]);

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
      if (/ya tiene una reserva/i.test(msg)) setAvisoOcupada({ mensaje: msg });
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
      if (/ya tiene una reserva/i.test(msg)) setAvisoOcupada({ mensaje: msg });
      else toast.error(msg);
    }
  };

  /**
   * Guarda el comentario de la reserva. Se dispara al salir del campo, igual
   * que el resto de la ficha: no hay un botón propio porque el comentario no
   * es un formulario aparte, es un dato más de la reserva. Si no ha cambiado
   * nada no se llama al servidor.
   */
  const guardarComentario = async (id: string) => {
    const valor = comentarioEdit.slice(0, RESERVA_COMENTARIO_MAX_CHARS).trim();
    const actual = (selectedReserva?.observaciones ?? "").trim();
    if (valor === actual) return;

    setGuardandoComentario(true);
    const res = await updateReserva(id, { notas: valor });
    setGuardandoComentario(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar el comentario.");
      setComentarioEdit(actual);
      return;
    }
    toast.success(valor ? "Comentario guardado" : "Comentario borrado");
    setComentarioEdit(valor);
    setActividadVersion((v) => v + 1);
    setSelectedReserva((prev) =>
      prev && prev.id === id ? { ...prev, observaciones: valor } : prev,
    );
    // El comentario también se lee en la lista del día, así que se recarga.
    loadReservas(fecha);
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
      if (/ya tiene una reserva/i.test(msg)) setAvisoOcupada({ mensaje: msg });
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
   * Cambia el TURNO de la reserva a mano.
   *
   * Normalmente lo pone la hora, y se deja en paz. Se toca cuando la hora cae
   * en la frontera y el local sabe mejor que la regla de que servicio es esa
   * mesa: una comida de sobremesa larga que ya cuenta como cena. Al guardar se
   * recarga el dia porque la reserva cambia de mapa.
   */
  const guardarTurno = async (id: string, valor: TurnoReserva) => {
    if (valor === selectedReserva?.turno) return;

    setGuardandoTurno(true);
    const res = await updateReserva(id, { turno: valor });
    setGuardandoTurno(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cambiar el turno.");
      return;
    }

    setSelectedReserva((prev) =>
      prev && prev.id === id ? { ...prev, turno: valor } : prev,
    );
    setActividadVersion((v) => v + 1);
    toast.success(valor === "CENA" ? "Pasa a cena" : "Pasa a comida");
    void loadReservas(fecha);
  };

  /**
   * Cambia la ZONA de la reserva a mano.
   *
   * La zona sale de la mesa, asi que cambiarla NO mueve a nadie de sitio: sirve
   * para las reservas que aun no tienen mesa, donde dice en que parte del local
   * se les quiere sentar. Si la reserva ya tiene mesa, el servidor vuelve a
   * derivar la zona de esa mesa en cuanto se toque, y manda la mesa.
   */
  const guardarZona = async (id: string, valor: string) => {
    if (valor === (selectedReserva?.zona ?? "")) return;

    setGuardandoZona(true);
    const res = await updateReserva(id, { zona: valor });
    setGuardandoZona(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cambiar la zona.");
      return;
    }

    // `Reserva.zona` conserva el enum antiguo de zonas fijas, pero las zonas
    // reales son las del catalogo de la empresa y llevan su propio id. El dato
    // que manda es el del servidor —que ya lo ha guardado—, aqui solo se
    // refleja para que la ficha no siga enseñando la zona vieja.
    setSelectedReserva((prev) =>
      prev && prev.id === id
        ? { ...prev, zona: valor as Reserva["zona"] }
        : prev,
    );
    setActividadVersion((v) => v + 1);
    toast.success(`Zona: ${zonaLabel(valor)}`);
    void loadReservas(fecha);
  };

  /**
   * Guarda los datos del cliente de la ficha. Un solo botón para los cuatro
   * campos, y el cambio se propaga a la ficha del cliente y a todas sus
   * reservas: el mismo cliente no puede quedar con dos teléfonos distintos.
   */
  const guardarMesasReserva = async (
    id: string,
    codigoMesas: string,
    forzar: boolean,
  ) => {
    const res = await updateReserva(id, {
      mesa: codigoMesas,
      localId: localId || null,
      forzarSolape: forzar,
    });
    if (!res.ok) {
      const msg = res.error ?? "No se pudieron guardar las mesas.";
      if (/ya tiene una reserva/i.test(msg)) {
        // Reasignar mesa SÍ se puede forzar: el usuario ya vio el ⏰ en el
        // desplegable y aquí se le dice con qué reserva choca. Si acepta, se
        // repite la misma llamada saltando el bloqueo de solape.
        setAvisoOcupada({
          mensaje: msg,
          forzar: forzar
            ? undefined
            : () => void guardarMesasReserva(id, codigoMesas, true),
        });
      } else toast.error(msg);
      return;
    }
    toast.success(
      codigoMesas
        ? `Mesas de la reserva: ${codigoMesas.split("+").join(" + ")}`
        : "Reserva sin mesa asignada",
    );
    setShowEditorMesas(false);
    setActividadVersion((v) => v + 1);
    setSelectedReserva((prev) =>
      prev && prev.id === id ? { ...prev, mesaCodigo: codigoMesas } : prev,
    );
    // La recarga del día NO se espera: el guardado ya está hecho y confirmado.
    // Bloquear el diálogo hasta que vuelva el listado entero hacía que asignar
    // una mesa pareciera lento con clientes esperando en la puerta. El servidor
    // recalcula la zona y el plano se repinta en cuanto llegue.
    void loadReservas(fecha);
  };

  /**
   * Permutar las mesas de dos reservas. Se guarda en una sola llamada: hecho
   * en dos updates, el de en medio deja a las dos reservas sobre la misma mesa
   * y el bloqueo de solape tumba el segundo, dejando el cambio a medias.
   */
  const intercambiarMesas = async (
    id: string,
    p: { otraReservaId: string; mesaDestino: string; mesaOrigen: string },
  ) => {
    const res = await intercambiarMesasReservas({
      reservaId: id,
      otraReservaId: p.otraReservaId,
      mesaDestino: p.mesaDestino,
      mesaOrigen: p.mesaOrigen,
      localId: localId || null,
    });
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron intercambiar las mesas.");
      return;
    }
    toast.success(
      `Mesas intercambiadas: ${p.mesaDestino.split("+").join(" + ")}`,
    );
    setShowEditorMesas(false);
    setActividadVersion((v) => v + 1);
    setSelectedReserva((prev) =>
      prev && prev.id === id ? { ...prev, mesaCodigo: p.mesaDestino } : prev,
    );
    // Igual que al asignar mesa: el guardado ya está confirmado y no se espera
    // a que vuelva el listado entero para devolver el control a sala.
    void loadReservas(fecha);
  };

  const guardarDatosCliente = async (id: string) => {
    if (!clienteEdit.nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    // Los apellidos también: una ficha con solo el nombre de pila no sirve para
    // encontrar a nadie en una lista de cientos de clientes, y es justo lo que
    // llenó la base heredada de "Maria" y "Jose" sueltos, imposibles de
    // distinguir. Se exige aquí y en el servidor, igual que al dar de alta.
    if (!clienteEdit.apellidos.trim()) {
      toast.error("Los apellidos son obligatorios.");
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

  /**
   * "Sentar walk-in" desde una mesa libre del plano: abre el alta con esa mesa
   * puesta y el formulario ya en modo walk-in, que es como se dan de alta los
   * clientes que llegan sin reservar.
   */
  const abrirWalkInEnMesa = (m: Mesa) => {
    setSelectedMesa(m);
    setNuevaComoWalkIn(true);
    setShowNueva(true);
  };

  /**
   * "Abrir salón" desde la ficha: enseña el plano de la sala DONDE ESTÁ la
   * mesa de la reserva, no la que hubiera en pantalla.
   *
   * Un local puede tener varias salas y la ficha se abre desde el listado, que
   * las mezcla: sin este salto, una reserva de la terraza se editaría sobre el
   * plano del comedor y sus mesas no aparecerían por ningún lado.
   */
  const abrirEditorMesas = (r: Reserva) => {
    const primerCodigo = (r.mesaCodigo ?? "").split("+")[0]?.trim().toUpperCase();
    const mesaId = primerCodigo ? mesaIdPorCodigo.get(primerCodigo) : r.mesaId;
    const zonaId = mesaId ? mesasMeta.get(mesaId)?.zonaId : null;
    const salaId = zonaId ? zonasReales.find((z) => z.id === zonaId)?.salaId : null;
    // Sin mesa (o sin poder resolverla) se abre la sala que ya se está viendo:
    // es donde el usuario está mirando y sigue pudiendo elegir mesa a mano.
    if (salaId && salaId !== salaActualId) setSalaActualId(salaId);
    setShowEditorMesas(true);
  };

  // "Editar" desde el popover: abre la ficha completa de la reserva.
  const abrirDetalleReserva = (r: Reserva) => {
    setSelectedReserva(r);
    setShowDetalleReserva(true);
  };

  // "Bloquear": deja la mesa fuera de juego solo para el día y turno que hay en
  // pantalla (bloqueo puntual, no recurrente). Si la mesa tiene reservas activas
  // se pide confirmación antes, porque bloquearla la saca del servicio.
  const pedirBloqueoMesa = (m: Mesa | null, r: Reserva | null) => {
    // Mesa pulsada en el plano → solo esa. Sin mesa (viene del listado) → todas
    // las que ocupe la reserva, que es lo que el usuario ve como "su sitio".
    const objetivo = m ? [m] : mesasDeReserva(r);
    if (objetivo.length === 0) {
      toast.error("Esta reserva no tiene mesa asignada que bloquear.");
      return;
    }
    const ids = new Set(objetivo.map((x) => x.id));
    const activas = new Set<string>();
    for (const id of ids) {
      for (const res of reservasActivasPorMesa.get(id) ?? []) activas.add(res.id);
    }
    setConfirmBloqueo({ mesas: objetivo, reservasActivas: activas.size });
  };

  /**
   * Aplica el bloqueo SOLO al turno que hay en pantalla y solo a esta fecha:
   * bloquear la comida no deja la mesa muerta por la noche.
   */
  const bloquearMesasHoy = useCallback(
    async (objetivo: Mesa[]) => {
      if (!localId) {
        toast.error("Selecciona un local antes de bloquear la mesa.");
        return;
      }
      if (objetivo.length === 0) return;
      const turnoBloqueo: TurnoRegla = turno === "COMIDA" ? "COMIDA" : "CENA";
      setGuardandoBloqueo(true);
      const res = await createBloqueo({
        localId,
        vigencia: { modo: "fechas", fechas: [fecha] },
        turno: turnoBloqueo,
        zonaIds: [],
        mesaIds: objetivo.map((m) => m.id),
        motivo: "Bloqueada desde el plano de reservas",
      });
      setGuardandoBloqueo(false);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo bloquear la mesa");
        return;
      }
      const codigos = objetivo.map((m) => m.codigo).join(", ");
      const nombreTurno = turnoBloqueo === "COMIDA" ? "comida" : "cena";
      toast.success(
        objetivo.length === 1
          ? `Mesa ${codigos} bloqueada para el ${formatearFechaEs(fecha)} (${nombreTurno})`
          : `Mesas ${codigos} bloqueadas para el ${formatearFechaEs(fecha)} (${nombreTurno})`,
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
    // La ficha desde la que se ha pulsado se cierra: tapaba el plano y no
    // dejaba pinchar la mesa destino.
    setFilaPopoverAbiertaId(null);
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
        if (/ya tiene una reserva/i.test(msg)) setAvisoOcupada({ mensaje: msg });
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
   * Intercambia las mesas de las dos reservas: la que se mueve va a la mesa
   * destino y la que estaba allí se queda con la que esta deja.
   *
   * Va en UNA sola llamada al servidor, no en dos updates: hecho por pasos, el
   * de en medio deja a las dos reservas sobre la misma mesa y el bloqueo de
   * solape tumba el segundo, dejando el cambio a medias.
   */
  const permutarDesplazamiento = useCallback(
    async (r: Reserva, mesaDestino: Mesa, otra: Reserva) => {
      setGuardandoDesplazar(true);
      const res = await intercambiarMesasReservas({
        reservaId: r.id,
        otraReservaId: otra.id,
        mesaDestino: mesaDestino.codigo,
        mesaOrigen: codigosDeMesa(r.mesaCodigo).join("+"),
        localId: localId || null,
      });
      setGuardandoDesplazar(false);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron intercambiar las mesas");
        return;
      }
      toast.success(
        `${r.cliente || "WALK IN"} a la mesa ${mesaDestino.codigo}, ${otra.cliente || "WALK IN"} a ${codigosDeMesa(r.mesaCodigo).join(" + ")}`,
      );
      setReservaADesplazar(null);
      setChoqueDesplazar(null);
      loadReservas(fecha);
    },
    [fecha, loadReservas, localId],
  );

  /**
   * Aviso de aforo de unas mesas para un grupo, o `null` si encaja. Nunca
   * impide nada: una mesa de 4 se le da a 2 si en sala lo ven claro. Solo se
   * dice, para que no sorprenda al montar.
   */
  const avisoAforoMesas = useCallback(
    (codigos: string[], personas: number): string | null => {
      let min = 0;
      let max = 0;
      let conocidas = 0;
      for (const codigo of codigos) {
        const mesa = mesas.find(
          (m) => m.codigo.toUpperCase() === codigo.toUpperCase(),
        );
        const meta = mesa ? mesasMeta.get(mesa.id) : undefined;
        if (!meta) continue;
        conocidas += 1;
        min += meta.capacidadMin;
        max += meta.capacidadMax;
      }
      if (conocidas === 0) return null;
      const donde =
        codigos.length === 1 ? `la mesa ${codigos[0]}` : codigos.join(" + ");
      if (personas > max) return `${personas} personas en ${donde}, que admite ${max}.`;
      if (personas < min)
        return `${personas} ${personas === 1 ? "persona" : "personas"} en ${donde}, pensada para ${min} como mínimo.`;
      return null;
    },
    [mesas, mesasMeta],
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
      const avisoAforo = avisoAforoMesas([mesaDestino.codigo], r.comensales);

      if (res.data.length > 0) {
        // Con UNA sola reserva enfrente se puede permutar: cada una a la mesa
        // de la otra. Con varias no se ofrece —"intercambiar" con tres a la
        // vez no significa nada— y solo queda mover encima o cancelar.
        const ocupantes = (
          reservasActivasPorMesa.get(mesaDestino.id) ?? []
        ).filter((x) => x.id !== r.id);
        const permutable =
          ocupantes.length === 1 && codigosDeMesa(r.mesaCodigo).length > 0
            ? ocupantes[0]
            : null;
        setChoqueDesplazar({
          mesa: mesaDestino,
          choques: res.data,
          permutable,
          avisoAforo,
          avisoAforoOtra: permutable
            ? avisoAforoMesas(codigosDeMesa(r.mesaCodigo), permutable.comensales)
            : null,
        });
        return;
      }
      // Mesa libre: se mueve sin preguntar, pero si el grupo no encaja en ella
      // se deja dicho. Es un dato para montar la mesa, no una pregunta.
      if (avisoAforo) toast.warning(avisoAforo);
      await aplicarDesplazamiento(r, mesaDestino);
    },
    [
      reservaADesplazar,
      mesasBloqueadasIds,
      cfgReservas,
      aplicarDesplazamiento,
      avisoAforoMesas,
      reservasActivasPorMesa,
    ],
  );

  /**
   * "Desbloquear" desde el plano. La acción de servidor decide qué hacer con el
   * bloqueo de fondo: si era puntual de este día para esta mesa lo borra (y así
   * desaparece también de Configuración → Bloqueos, que antes se quedaba con un
   * bloqueo fantasma), y si era recurrente lo levanta solo para hoy.
   */
  const handleQuitarBloqueoMesa = useCallback(
    async (m: Mesa) => {
      if (!localId) return;
      const turnoActual: "COMIDA" | "CENA" = turno === "COMIDA" ? "COMIDA" : "CENA";
      const r = await quitarBloqueoMesa({
        localId,
        fecha,
        turno: turnoActual,
        mesaId: m.id,
      });
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo quitar el bloqueo");
        return;
      }
      toast.success(
        r.soloHoy
          ? `Mesa ${m.codigo} desbloqueada solo para este día`
          : `Mesa ${m.codigo} desbloqueada`,
      );
      setBloqueosRefresh((n) => n + 1);
    },
    [localId, fecha, turno],
  );

  if (showCobros) {
    return (
      <div
        className={cn(
          "sala-tema flex flex-col h-full min-h-0 overflow-hidden",
          esOscuro && "sala-oscuro",
        )}
      >
        <CobrosReservasView onBack={() => setShowCobros(false)} />
      </div>
    );
  }

  if (showConfig) {
    return (
      <div
        className={cn(
          // `h-full`, igual que la vista principal: el alto lo da el layout.
          "sala-tema flex flex-col h-full min-h-0 overflow-hidden",
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
        // `h-full` en vez de calcular a mano sobre 100vh: el hueco ya lo da el
        // layout, que es una columna de alto completo. Restando 3.5rem la
        // cuenta fallaba al sacar la barra con el ratón (pasa a 3.5rem y el
        // reborde a 0, pero `barraReplegada` no mira el hover), y la vista
        // quedaba más alta que su sitio (Iván, 29-ago).
        "sala-tema flex flex-col overflow-hidden h-full min-h-0",
        esOscuro && "sala-oscuro",
      )}
    >
      {/* Cobros que necesitan una decisión (PRP-082 §5.6). Si no hay nada
          pendiente no se pinta nada. */}
      <div className="shrink-0 px-2 pt-2">
        <AvisoCobrosBanner
          onVerReservas={setIdsDelAviso}
          refrescarToken={refrescoAvisosCobro}
        />
        {idsDelAviso && idsDelAviso.length > 0 && (
          <button
            type="button"
            onClick={() => setIdsDelAviso(null)}
            className="mb-2 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Ver todas las reservas
          </button>
        )}
      </div>

      {/* TOP BAR — todo en una sola línea: acciones + filtros + turno + sala/zonas + vista + fecha + ajustes */}
      <div className="shrink-0 border-b bg-card px-2 py-1.5 flex items-center gap-1.5 flex-nowrap overflow-x-auto">
        {/* Acciones: NUEVA · Lista espera · Estados · Buscar — solo en vista día.
            En vista mes el bloque se oculta pero NO se colapsa: mantiene su
            hueco para que el resto de controles no cambie de sitio entre
            pantallas (misma alineación en día y en mes). */}
        <div className={cn("flex items-center gap-1.5", vista !== "dia" && "invisible pointer-events-none")} aria-hidden={vista !== "dia"} inert={vista !== "dia"}>
          <Dialog
            open={showNueva}
            onOpenChange={(v) => {
              setShowNueva(v);
              // Al cerrar manualmente, limpiamos la mesa preseleccionada para
              // que el siguiente "Nueva" desde la toolbar no la arrastre.
              if (!v) {
                setSelectedMesa(null);
                setNuevaComoWalkIn(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="text-xs h-8 gap-1.5 px-2.5"
                onClick={() => { setSelectedMesa(null); setNuevaComoWalkIn(false); }}
              >
                <Plus className="h-3.5 w-3.5" />Nueva
              </Button>
            </DialogTrigger>
            {/* Ancho generoso y contenido en 3 columnas: la reserva se rellena
                entera sin tener que bajar por el diálogo. */}
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Nueva reserva</DialogTitle></DialogHeader>
              <NuevaReservaForm
                fecha={fecha}
                turno={turno}
                mesaPreseleccionada={selectedMesa}
                tipoAltaInicial={nuevaComoWalkIn ? "WALKIN" : "CLIENTE"}
                zonasReales={zonasReales}
                mesas={mesas}
                mesasMeta={mesasMeta}
                localId={localId}
                empresaId={empresaActual.dbId ?? null}
                getEstadoMesa={getMesaEstadoTurno}
                onClose={() => setShowNueva(false)}
                onSave={async r => {
                  setReservas(prev => [...prev, r]);
                  setShowNueva(false);
                  // La mesa puede venir por id (elegida en el desplegable) o
                  // por código (propuesta automática aceptada: unión u otra sala).
                  const mesaCodigo = r.mesaId
                    ? mesaPorId.get(r.mesaId)?.codigo
                    : (r.mesaCodigo ?? undefined);
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
                    garantiaImporte: r.garantiaImporte ?? null,
                    importePagado: r.importePagado ?? null,
                    duracionMinutos: r.duracionMinutos ?? null,
                    codigoCupon: r.codigoCupon ?? null,
                    origen: r.origen ?? null,
                    // El formulario ya enseñó el aviso de mesa bloqueada y
                    // alguien lo aceptó: el servidor deja pasar la reserva.
                    forzarMesaBloqueada: r.forzarMesaBloqueada ?? false,
                  });
                  setSelectedMesa(null);
                  setNuevaComoWalkIn(false);
                  if (res.ok) {
                    loadReservas(fecha);
                    // El correo solo sale si se eligió "Notificar y confirmar":
                    // en las dos rutas la reserva queda confirmada igual.
                    if (r.notificarEmail && r.email && res.id) {
                      const notif = await notificarReservaCreadaPorEmail(res.id);
                      if (notif.ok) toast.success("Reserva confirmada y cliente notificado");
                      else toast.error(`Reserva confirmada, pero no se pudo notificar: ${notif.error ?? "error desconocido"}`);
                    } else {
                      toast.success("Reserva confirmada");
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
          {/* Solo la lupa dentro del recuadro, sin la palabra "Buscar...": el
              icono ya dice lo que hace y el texto ocupaba casi todo el campo.
              El nombre sigue en `aria-label` para quien navega con lector. */}
          <div className="relative w-[130px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              aria-label="Buscar reservas"
              className="pl-8 h-8 text-xs"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {/* Turno + capacidad — solo en vista día; en mes conserva el hueco.
            Los dos contadores son GLOBALES del plano y del local: suman todas
            las zonas de todas las salas, así que no se mueven al cambiar de
            sala ni de zona, solo al cambiar de plano o de local. */}
        <div className={cn("flex gap-1 items-center", vista !== "dia" && "invisible pointer-events-none")} aria-hidden={vista !== "dia"} inert={vista !== "dia"}>
          {/* Icono en color y el nombre del turno al lado: sol para la comida
              y luna para la cena, los mismos que ya identifican los dos turnos
              en la vista mes. El turno elegido va relleno. */}
          {(["COMIDA", "CENA"] as const).map(t => {
            const esComida = t === "COMIDA";
            const nombre = esComida ? "Comida" : "Cena";
            const Icono = esComida ? Sun : Moon;
            const activo = turno === t;
            return (
              <Button
                key={t}
                size="sm"
                variant={activo ? "default" : "outline"}
                className="h-8 gap-1.5 px-2.5"
                title={nombre}
                aria-label={nombre}
                aria-pressed={activo}
                onClick={() => setTurno(t)}
              >
                <Icono
                  className={cn(
                    "size-4",
                    // Sobre el relleno del botón activo el color de marca no
                    // contrasta: ahí el icono va del color del propio botón.
                    activo
                      ? "text-primary-foreground"
                      : esComida
                        ? "text-amber-500"
                        : "text-indigo-400",
                  )}
                />
                {nombre}
              </Button>
            );
          })}
          <div
            className="ml-1 inline-flex items-center gap-2.5 h-8 px-2.5 rounded-md border border-input bg-background text-xs font-semibold"
            title={`${turno === "COMIDA" ? "Comida" : "Cena"} · ${fecha} · total del plano completo`}
          >
            {/* En color, como los KPI del mes: en gris los dos iconos se
                confundían entre sí y con el resto de la barra. Verde las
                personas, azul las mesas. */}
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-emerald-500" />
              <span className="tabular-nums">{cubiertosReservados}</span>
              <span className="text-muted-foreground">/</span>
              <span className="tabular-nums">{capacidadTotal}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 text-sky-500" />
              <span className="tabular-nums">{mesasOcupadas}</span>
              <span className="text-muted-foreground">/</span>
              <span className="tabular-nums">{mesasPlano.length}</span>
            </span>
          </div>
        </div>

        {/* SEGUNDA FILA de la barra: los mandos del PLANO (planos, salas,
            zonas) y los de la FECHA (día/mes y el navegador de fechas).
            Van juntos en un solo bloque para que no se separen al envolver.

            Ya NO se les da el ancho entero ni un relleno hasta el plano: eso
            los mandaba a una fila para ellos solos y partía la barra en dos.
            Cabe todo en una línea, que es como se lee de un vistazo.

            `ml-auto` los empuja todo lo que da la barra sin partirla: se comen
            el hueco libre y quedan lo más a la derecha posible, arrimados al
            plano, que es sobre lo que mandan. El `ml-auto` va AQUÍ y no en el
            bloque de los ajustes (que lo tenía): con uno en cada sitio los dos
            se repartían el hueco a medias y este se quedaba a mitad de camino. */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Solo en vista día; en mes conservan el hueco (los totales del mes
              son globales y no dependen de plano, sala ni zona). */}
          <div
            className={cn(
              "flex items-center gap-1.5",
              vista !== "dia" && "invisible pointer-events-none",
            )}
            aria-hidden={vista !== "dia"}
            inert={vista !== "dia"}
          >
          </div>

        <div className="flex items-center gap-1.5">
          {/* Indicadores globales del mes (solo en vista mes). Suman TODA la
              operativa: todos los locales, planos, salas y zonas. */}
          {vista === "mes" && (
            <div className="hidden md:flex items-center gap-1.5">
              <KpiTurnoMes
                icono={<Sun className="h-3.5 w-3.5 text-amber-500" />}
                titulo="Comidas"
                personas={totalesMes.comida.personas}
                reservas={totalesMes.comida.reservas}
              />
              <KpiTurnoMes
                icono={<Moon className="h-3.5 w-3.5 text-indigo-400" />}
                titulo="Cenas"
                personas={totalesMes.cena.personas}
                reservas={totalesMes.cena.reservas}
              />
              <KpiTurnoMes
                icono={<CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />}
                titulo="Mes"
                personas={totalesMes.personas}
                reservas={totalesMes.reservas}
              />
            </div>
          )}
          {vista === "mes" ? (
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFecha(addMonths(fecha, -1))}><ChevronLeft className="h-4 w-4" /></Button>
              {/* Mismo ancho que el selector de día para que las flechas queden
                  en idéntica posición al cambiar de pantalla. */}
              <Button variant="outline" size="sm" className="text-xs h-8 w-[110px] justify-center font-medium uppercase px-2.5">{formatMes(fecha)}</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFecha(addMonths(fecha, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFecha(addDays(fecha, -1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Popover open={showDayPicker} onOpenChange={setShowDayPicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="relative text-xs h-8 w-[110px] justify-center font-medium uppercase px-2.5">
                    {formatFecha(fecha)}
                  </Button>
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
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Cambio de vista: cuadrado y solo con icono, junto al resto de
              botones de la derecha. El icono es el de la vista OPUESTA —la que
              se abre al pulsarlo—, igual que decia el texto que llevaba antes. */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title={vista === "dia" ? "Cambiar a vista Mes" : "Cambiar a vista Día"}
            aria-label={vista === "dia" ? "Cambiar a vista Mes" : "Cambiar a vista Día"}
            onClick={() => setVista(vista === "dia" ? "mes" : "dia")}
          >
            {vista === "dia" ? <CalendarDays className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setShowCobros(true)}
            title="Cobros, garantías y tickets"
            aria-label="Cobros, garantías y tickets"
          >
            <Banknote className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
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
          // Al volver de Configuración este contador sube, y con él se releen
          // el patrón de apertura y las excepciones: el calendario refleja al
          // instante cualquier cambio de horarios.
          refreshKey={posicionesRefresh}
          onTotalesChange={setTotalesMes}
          onDayClick={(iso) => {
            setFecha(iso);
            setVista("dia");
          }}
        />
      ) : (
      <>
      <div className="flex flex-1 overflow-hidden relative">
        {/* Indicador de carga ÚNICO y CENTRADO sobre toda la vista: el mismo
            spinner que el resto del software (`LoadingSpinner`). Antes cada
            panel pintaba el suyo — lista, plano y la píldora del día —, así que
            al abrir salían tres ruedas a la vez en tres sitios distintos. */}
        {loading && (
          <div
            role="status"
            aria-live="polite"
            aria-label="Cargando"
            className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
          >
            <LoadingSpinner size="lg" iconClassName="text-primary" />
          </div>
        )}
        {/* LEFT PANEL */}
        {panelOculto !== "lista" && (
        <div className={cn(
          "border-r flex flex-col bg-card overflow-hidden",
          // El ancho sale de LISTA_ANCHO_PX, que es el mismo que coloca los
          // botones de arriba sobre el plano. Lo que crece la lista lo cede el
          // plano SOLO a lo ancho: se escala solo al espacio que le queda y
          // mantiene su alto entero.
          panelOculto === "ninguno" ? "shrink-0" : "flex-1",
        )}
        style={
          panelOculto === "ninguno" ? { width: LISTA_ANCHO_PX } : undefined
        }>
          <div className={cn(LISTA_GRID, "px-3 py-2 text-[10px] font-semibold text-muted-foreground border-b bg-muted/30 uppercase tracking-wider")}>
            {/* Cada columna filtra y ordena desde su propia cabecera, como en
                el resto de tablas del software: se pincha en la columna que se
                quiere acotar, no en un botón aparte. */}
            <ColumnaListaHeader
              label="Hora"
              campo="hora"
              opciones={opcionesColumna("hora")}
              seleccionadas={filtrosColumna.hora ?? []}
              onSeleccionChange={(v) => setFiltroColumna("hora", v)}
              ordenable
              panelClassName={panelTemaSala}
              orden={ordenColumna}
              onOrdenChange={setOrdenColumna}
              ordenLabelAsc="Antes"
              ordenLabelDesc="Después"
            />
            {/* La celda enseña mesa y zona una sobre otra, así que la cabecera
                filtra por las dos: "Mesa" con su embudo y, al lado, el de zona.
                En FILA y no apilados —como Nombre y Etiquetas—: debajo de
                "Mesa" el segundo embudo quedaba suelto, sin rótulo que lo
                explicara y encima de una cabecera que ya tenía el suyo. */}
            <span className="flex min-w-0 items-center gap-1">
              <ColumnaListaHeader
                label="Mesa"
                campo="mesa"
                opciones={opcionesColumna("mesa")}
                seleccionadas={filtrosColumna.mesa ?? []}
                onSeleccionChange={(v) => setFiltroColumna("mesa", v)}
                ordenable
                panelClassName={panelTemaSala}
                orden={ordenColumna}
                onOrdenChange={setOrdenColumna}
              />
              <ColumnaListaHeader
                label="Zona"
                campo="zona"
                soloIcono
                opciones={opcionesColumna("zona")}
                seleccionadas={filtrosColumna.zona ?? []}
                onSeleccionChange={(v) => setFiltroColumna("zona", v)}
                ordenable
                panelClassName={panelTemaSala}
                orden={ordenColumna}
                onOrdenChange={setOrdenColumna}
              />
            </span>
            {/* Las etiquetas ya no tienen columna propia (se leen junto al
                telefono, dentro de esta misma celda), pero su filtro sigue
                haciendo falta: se queda aqui, en la cabecera de la columna
                donde ahora se ven. */}
            <span className="flex min-w-0 items-center gap-2">
              <ColumnaListaHeader
                label="Nombre"
                campo="nombre"
                opciones={opcionesColumna("nombre")}
                seleccionadas={filtrosColumna.nombre ?? []}
                onSeleccionChange={(v) => setFiltroColumna("nombre", v)}
                ordenable
                panelClassName={panelTemaSala}
                orden={ordenColumna}
                onOrdenChange={setOrdenColumna}
              />
              <ColumnaListaHeader
                label="Etiquetas"
                campo="etiquetas"
                soloIcono
                opciones={opcionesColumna("etiquetas")}
                seleccionadas={filtrosColumna.etiquetas ?? []}
                onSeleccionChange={(v) => setFiltroColumna("etiquetas", v)}
                colorOpcion={colorOpcionEtiqueta}
                panelClassName={panelTemaSala}
              />
            </span>
            <ColumnaListaHeader
              label="Per"
              campo="comensales"
              opciones={opcionesColumna("comensales")}
              seleccionadas={filtrosColumna.comensales ?? []}
              onSeleccionChange={(v) => setFiltroColumna("comensales", v)}
              ordenable
              panelClassName={panelTemaSala}
              orden={ordenColumna}
              onOrdenChange={setOrdenColumna}
              ordenLabelAsc="Menos"
              ordenLabelDesc="Más"
              align="center"
            />
            <ColumnaListaHeader
              label="Origen"
              campo="origen"
              opciones={opcionesColumna("origen")}
              seleccionadas={filtrosColumna.origen ?? []}
              onSeleccionChange={(v) => setFiltroColumna("origen", v)}
              ordenable
              panelClassName={panelTemaSala}
              orden={ordenColumna}
              onOrdenChange={setOrdenColumna}
            />
            <ColumnaListaHeader
              label="Tipo"
              campo="tipo"
              opciones={opcionesColumna("tipo")}
              seleccionadas={filtrosColumna.tipo ?? []}
              onSeleccionChange={(v) => setFiltroColumna("tipo", v)}
              ordenable
              panelClassName={panelTemaSala}
              orden={ordenColumna}
              onOrdenChange={setOrdenColumna}
            />
            <ColumnaListaHeader
              label="Estado"
              campo="estado"
              opciones={opcionesColumna("estado")}
              seleccionadas={filtrosColumna.estado ?? []}
              onSeleccionChange={(v) => setFiltroColumna("estado", v)}
              ocultasPorDefecto={ESTADOS_OCULTOS_LABELS}
              colorOpcion={colorOpcionEstado}
              ordenable
              panelClassName={panelTemaSala}
              orden={ordenColumna}
              onOrdenChange={setOrdenColumna}
            />
            {/* Tiempo no filtra ni ordena: es una cuenta atrás que cambia sola
                cada minuto, así que un valor marcado dejaría de casar con su
                fila al instante. Para ordenar por tiempo está Hora. */}
            <span className="truncate text-center">Tiempo</span>
          </div>
          <div className="relative flex-1 overflow-y-auto">
            {/* Mientras se pide el día, la lista se atenúa y no acepta clics: lo
                que se ve todavía es del día anterior. Sin esto parecía que la
                flecha no había hecho nada. El indicador en sí es ÚNICO y va
                centrado sobre toda la vista (abajo), no uno por panel. */}
            {loading && (
              <div className="absolute inset-0 z-20 bg-background/60 backdrop-blur-[1px]" />
            )}
            {!loading && reservasFiltradas.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Sin reservas para este turno</p>}
            {reservasFiltradas.map(r => {
              const mesa = (r.mesaId ? mesaPorId.get(r.mesaId) : undefined) ?? null;
              const blink = parpadeoClassPara(r);
              return (
                // Igual que en el plano: si se pulsa "Desplazar" desde la
                // lista, esta ficha debe cerrarse para dejar ver el plano.
                <Popover
                  key={r.id}
                  open={reservaADesplazar ? false : filaPopoverAbiertaId === r.id}
                  onOpenChange={(abierto) => {
                    if (reservaADesplazar) return;
                    setFilaPopoverAbiertaId(abierto ? r.id : null);
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      onClick={() => setSelectedReserva(r)}
                      onMouseEnter={() => setReservaHoverId(r.id)}
                      onMouseLeave={() => setReservaHoverId(null)}
                      className={cn(
                        "w-full text-[13px] border-b hover:bg-muted/40 text-left transition-colors",
                        LISTA_GRID,
                        "px-3 py-3",
                        // Lista de espera: el recuadro ENTERO en azul claro, no
                        // solo el punto de estado. Se mantiene aunque ya tenga
                        // mesa asignada, porque hasta que no cambia de estado
                        // sigue siendo alguien esperando.
                        r.estado === "LISTA_ESPERA" &&
                          "bg-sky-500/10 hover:bg-sky-500/15",
                        // ROJO = donde esta el raton, y nada mas. Funciona en
                        // los DOS sentidos: con el raton en la fila se enciende
                        // su mesa en el plano, y con el raton en la mesa se
                        // enciende esta fila. Al pinchar NO se queda marcada.
                        (reservaHoverId === r.id ||
                          reservasResaltadasIds.has(r.id)) &&
                          "ring-4 ring-red-500 ring-inset bg-red-500/5",
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
                        {/* UNION ("TI5+TI6"): el codigo ENTERO, no solo la
                            primera mesa. `mesa` resuelve unicamente la primera,
                            asi que una union se leia "TI5" y parecia que TI5 y
                            TI6 se duplicaban solas en el plano; en realidad esa
                            reserva ocupa las dos. */}
                        <span
                          className="truncate font-mono text-[15px] font-bold leading-tight"
                          title={r.mesaCodigo || mesa?.codigo || undefined}
                        >
                          {r.mesaCodigo || mesa?.codigo || "—"}
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
                            <span
                              className="flex shrink-0"
                              title="Enganchó con un cliente que ya existía y los datos no coinciden. Abre la reserva para revisarlo."
                            >
                              <AlertTriangle
                                className="size-3.5 shrink-0 text-amber-500"
                                aria-label="Datos sin revisar"
                              />
                            </span>
                          )}
                          <span
                            className="truncate font-medium"
                            title={`${r.cliente || "WALK IN"} ${r.apellidos ?? ""}`.trim()}
                          >
                            {r.cliente || "WALK IN"} {r.apellidos}
                          </span>
                          {/* Veces que ha reservado: solo a partir de la
                              segunda, para que la gente nueva no lleve un "1"
                              que no dice nada. */}
                          <ClienteReservasBadge
                            total={r.clienteId ? reservasPorCliente[r.clienteId] : undefined}
                          />
                          {/* El chip "Cupón <CODIGO>" se pinta dentro de <ReservaFlagsChips />. */}
                          <ReservaFlagsChips
                            reserva={r}
                            duplicadas={duplicadasPorReserva.get(r.id)}
                            className="shrink-0"
                          />
                        </span>
                        {/* Telefono y, pegadas a su derecha, las etiquetas: las
                            de la reserva y las que hereda de la ficha del
                            cliente, juntas y sin distinguir. A quien esta
                            sirviendo le da igual donde este apuntado que es
                            alergico; lo que necesita es verlo junto a la
                            persona, no en una columna aparte. Sin etiquetas no
                            se pinta nada: un "—" solo ensuciaria la linea. */}
                        {(r.telefono || (etiquetasPorReserva[r.id] ?? []).length > 0) && (
                          <span className="flex min-w-0 flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                            {r.telefono && (
                              // Solo el número, sin bandera y sin prefijo: en el
                              // listado del turno ensuciaban la línea. El país y
                              // el prefijo se ven en la ficha del cliente, que es
                              // donde se miran antes de llamar.
                              <span className="truncate tabular-nums">
                                {separarPrefijo(r.telefono).numero || r.telefono}
                              </span>
                            )}
                            {(etiquetasPorReserva[r.id] ?? []).map((e) => (
                              <EtiquetaChip
                                key={e.id}
                                nombre={e.nombre}
                                emoji={e.emoji}
                                color={e.color}
                                className="max-w-full shrink-0 truncate"
                              />
                            ))}
                          </span>
                        )}
                        {/* Adelanto del comentario: se lee el principio sin
                            abrir nada. Si no cabe, se corta con "...". */}
                        {r.observaciones && r.observaciones.trim() && (
                          <span className="truncate text-[10px] italic text-muted-foreground/80">
                            {r.observaciones.trim()}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 text-center tabular-nums">{r.comensales}</span>
                      <span className="min-w-0 truncate text-[11px] text-muted-foreground" title={origenLabel(r.origen)}>
                        {origenLabel(r.origen)}
                      </span>
                      {/* TIPO: qué condiciones lleva la reserva (tarjeta,
                          ticket, cupón). No aparecía en ninguna columna, así
                          que para saberlo había que abrir la ficha una por
                          una. */}
                      <TipoReservaCelda reserva={r} />
                      <StatusDot estado={r.estado} />
                      {/* TIEMPO: cuenta atrás (verde), retraso (rojo),
                          ocupación desde la hora de la reserva (azul) o
                          exceso sobre el tiempo de mesa (rojo con icono). */}
                      <ReservaTiempoCelda
                        reserva={r}
                        ahora={ahoraEmpresa}
                        duracionEmpresaMin={cfgReservas?.duracionReservaMin}
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" side="right" align="start">
                    <ReservaQuickPopover
                      mesa={mesa}
                      reserva={r}
                      desdeLista
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
          {/* Igual que en la lista: mientras llega el día pedido, el plano se
              atenúa y se bloquea. Las mesas que se ven todavía tienen el estado
              del día anterior y sentarían mal a un cliente. */}
          {loading && (
            <div className="absolute inset-0 z-30 bg-background/50 backdrop-blur-[1px]" />
          )}
          {/* Los dos mandos de CÓMO SE VE el plano, juntos en su esquina:
              mapa/listado y claro/oscuro. El tema estaba arriba entre los
              ajustes del módulo, pero no configura nada —solo cambia lo que se
              ve— y allí ocupaba sitio en una barra que no daba más de sí. */}
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/90 backdrop-blur"
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
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/90 backdrop-blur"
              onClick={alternarTema}
              title={esOscuro ? "Cambiar a vista clara" : "Cambiar a vista oscura"}
              aria-label={esOscuro ? "Cambiar a vista clara" : "Cambiar a vista oscura"}
              aria-pressed={esOscuro}
            >
              {esOscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
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
              encuadre={encuadreSalaActual}
              mesas={mesasActivas}
              posiciones={posicionesPlano}
              mesasMeta={mesasMeta}
              zonas={zonasSalaActual}
              decoraciones={decoracionesSalaActual}
              salaTieneZonas={zonasSalaActual.length > 0}
              mesasResaltadasIds={mesasResaltadasIds}
              onHoverMesa={setMesaHoverId}
              onSelectMesa={handleSelectMesa}
              getEstadoMesa={getMesaEstadoTurno}
              getReservasMesa={getReservasMesa}
              onEditar={abrirDetalleReserva}
              onCambiarEstado={cambiarEstadoReserva}
              onBloquearMesa={pedirBloqueoMesa}
              onDesplazarReserva={abrirDesplazar}
              onQuitarBloqueoMesa={handleQuitarBloqueoMesa}
              onWalkIn={abrirWalkInEnMesa}
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
                    · {reservaADesplazar.hora.slice(0, 5)} · {reservaADesplazar.comensales} per —
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
                            // Ya vienen ordenadas por hora: la primera es la
                            // que llega antes y es la que se enseña en la mesa.
                            const rs = getReservasMesa(m.id);
                            const firstR = rs[0];
                            const isWalkIn = firstR ? esReservaWalkIn(firstR) : false;
                            const isLibre = estado === "LIBRE";
                            // Doble servicio en la misma mesa y turno: se parte
                            // con una diagonal, igual que en el plano.
                            const mesaCompartida = rs.length > 1;
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
                                    onMouseEnter={() => setMesaHoverId(m.id)}
                                    onMouseLeave={() => setMesaHoverId(null)}
                                    className={cn(
                                      "relative overflow-hidden h-20 rounded-md flex flex-col items-center justify-center text-[11px] font-bold shadow-sm border-2 transition-all cursor-pointer px-1",
                                      mesaBg[estado] ?? "",
                                      isLibre ? "text-zinc-900 border-black/30" : "border-black/20",
                                      // Igual que en el plano: el rojo es solo
                                      // del raton, no se queda pegado al abrir
                                      // una reserva ni al elegir una mesa.
                                      mesasResaltadasIds.has(m.id) &&
                                        "!border-red-500 !border-[6px] ring-[18px] ring-red-500 ring-offset-2 ring-offset-transparent z-20",
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
                                    {mesaCompartida && (
                                      <svg
                                        className="absolute inset-0 h-full w-full pointer-events-none"
                                        viewBox="0 0 100 100"
                                        preserveAspectRatio="none"
                                        aria-hidden="true"
                                      >
                                        <line
                                          x1="0"
                                          y1="100"
                                          x2="100"
                                          y2="0"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          vectorEffect="non-scaling-stroke"
                                          opacity="0.7"
                                        />
                                      </svg>
                                    )}
                                    <span className="relative text-[13px] leading-none">{m.codigo}</span>
                                    <span className={cn("relative text-[10px] font-normal mt-0.5", isLibre ? "text-foreground/70" : "opacity-75")}>
                                      ({m.capacidad}p)
                                    </span>
                                    {/* Mismo criterio que en el plano: la hora
                                        y el nombre se leen de lejos. */}
                                    {firstR && (
                                      <span className={cn("relative text-[11px] font-semibold mt-1 truncate max-w-full", isLibre ? "text-foreground/90" : "opacity-100")}>
                                        {firstR.hora} {isWalkIn ? "WALK IN" : firstR.cliente}
                                      </span>
                                    )}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 max-h-[min(80vh,560px)] overflow-y-auto p-3" collisionPadding={12}>
                                  <MesaReservasPopover
                                    mesa={m}
                                    reservas={rs}
                                    onEditar={abrirDetalleReserva}
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
        {/* Ventana ESTÁTICA: la caja no se mueve ni se estira con el
            contenido. Antes crecía hacia abajo y había que arrastrarla entera
            para llegar al estado o a las etiquetas; ahora el marco queda
            quieto en pantalla y, si algún bloque largo (correos, actividad) no
            cabe, se desplaza solo ese bloque dentro de su columna. */}
        <DialogContent className="flex h-[88vh] max-w-5xl flex-col overflow-hidden p-4 gap-3 sm:rounded-lg">
          <DialogHeader className="shrink-0 pb-1">
            <DialogTitle className="text-base">Detalle de reserva</DialogTitle>
          </DialogHeader>
          {/* El marco NO se desplaza: quien se desplaza, si hace falta, es cada
              columna por dentro. Con scroll también en el contenedor salían dos
              barras anidadas y la ventana volvía a "moverse" al usarla.

              En columna en vez de rejilla porque las tres bandas se comportan
              distinto: el aviso de vinculación y las etiquetas miden lo que
              ocupan, y las dos columnas se reparten todo lo que sobra. Con
              filas de rejilla fijas, la banda no declarada (el aviso solo
              aparece a veces) descuadraba el reparto. */}
          {selectedReserva && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden text-sm">

              {/* Vinculación pendiente de revisar: va lo primero y a lo ancho
                  de las dos columnas. Es lo más importante de esta ficha —los
                  datos que se ven abajo pueden no ser los de quien reservó— y
                  no se pinta nada cuando no hay nada que revisar. */}
              <div className="md:col-span-2 empty:hidden">
                <RevisionVinculacion
                  key={`${selectedReserva.id}-${actividadVersion}`}
                  reservaId={selectedReserva.id}
                  pendiente={selectedReserva.vinculacionPendiente}
                  onResuelto={() => {
                    setActividadVersion((v) => v + 1);
                    void loadReservas(fecha);
                  }}
                />
              </div>

              {/* Banda central: las dos columnas, que son lo que crece. */}
              <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2">
              {/* ── Columna izquierda: la reserva ─────────────────────────
                  Las dos mitades van sobre fondos distintos porque cuentan
                  cosas distintas: a la izquierda lo que le pasa a ESTA reserva
                  (mesa, hora, estado, sus etiquetas, sus correos), a la derecha
                  la persona, que sigue existiendo entre reserva y reserva. Sin
                  esa separacion las dos "Etiquetas" y las dos "Actividad" se
                  leian como lo mismo. */}
              <div className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-lg border bg-muted/25 p-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ficha de la reserva
                </h3>

                {/* Tarjeta de la reserva (PRP-082): estado y cobro. Va aquí
                    arriba porque es dinero, y porque solo aparece cuando la
                    reserva lleva alguna política. */}
                <CobroPoliticaBloque
                  datos={{
                    reservaId: selectedReserva.id,
                    tieneGarantia: selectedReserva.tieneGarantia ?? false,
                    garantiaImporte: selectedReserva.garantiaImporte ?? null,
                    garantiaEstado: selectedReserva.garantiaEstado ?? null,
                    garantiaTarjetaUltimos4: selectedReserva.garantiaTarjetaUltimos4 ?? null,
                    garantiaTarjetaMarca: selectedReserva.garantiaTarjetaMarca ?? null,
                    garantiaCaptureDeadline: selectedReserva.garantiaCaptureDeadline ?? null,
                    garantiaCobradaAt: selectedReserva.garantiaCobradaAt ?? null,
                    tieneCancelacion: selectedReserva.tieneCancelacion ?? false,
                    cancelacionImporte: selectedReserva.cancelacionImporte ?? null,
                    cancelacionEstado: selectedReserva.cancelacionEstado ?? null,
                    cancelacionTarjetaUltimos4: selectedReserva.cancelacionTarjetaUltimos4 ?? null,
                    cancelacionIntentos: selectedReserva.cancelacionIntentos ?? 0,
                    cancelacionError: selectedReserva.cancelacionError ?? null,
                    cancelacionProximoIntentoAt: selectedReserva.cancelacionProximoIntentoAt ?? null,
                    cancelacionCobradaAt: selectedReserva.cancelacionCobradaAt ?? null,
                    cobroPerdonadoAt: selectedReserva.cobroPerdonadoAt ?? null,
                  }}
                  onCambio={() => {
                    void loadReservas(fecha);
                    // El aviso mira la base de datos, no la lista: sin esto la
                    // línea del cobro seguía ahí después de cobrarlo.
                    setRefrescoAvisosCobro((n) => n + 1);
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  {/* CUÁNDO y CUÁNTO, todo en una fila: fecha, hora, personas y
                      duración. Son los cuatro datos que se cambian sobre la
                      marcha ("vienen dos más", "llegan media hora tarde"), así
                      que van juntos y en pequeño arriba del todo, en vez de
                      repartidos por la ficha con la duración al final. */}
                  {/* ESTADO. Es el dato que más se toca de una reserva —llega,
                      se sienta, no aparece— así que va ARRIBA con el resto, no
                      en una rejilla de nueve botones al final de la ficha que
                      obligaba a bajar cada vez. Desplegable: los nueve estados
                      caben en una línea y se ve de un vistazo en cuál está. */}
                  <div className="col-span-2">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Estado
                    </Label>
                    <Select
                      value={selectedReserva.estado}
                      onValueChange={(v) =>
                        cambiarEstadoReserva(selectedReserva.id, v as EstadoReserva)
                      }
                    >
                      <SelectTrigger className="h-7 px-1.5 text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_RESERVA.map((e) => (
                          <SelectItem key={e} value={e}>
                            <span className="flex items-center gap-1.5">
                              <ReservaEstadoDot estado={e} className="h-2 w-2" />
                              {ESTADO_RESERVA_LABELS[e]}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] items-start gap-2">
                  {/* Fecha y hora editables: mover una reserva era el caso
                      más común y no se podía hacer desde aquí. */}
                  <div className="min-w-0">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Fecha
                    </Label>
                    {/* CALENDARIO, no campo de texto. El `<input type="date">`
                        deja teclear dentro y su formato lo pone el navegador
                        (mm/dd/yyyy en un Chrome en inglés), así que la misma
                        reserva se leía distinta según el equipo. Aquí la fecha
                        se ELIGE: no hay forma de escribir letras ni un día que
                        no exista, y siempre se ve día/mes/año. */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={guardandoCuando}
                          className="h-7 w-full justify-start px-1.5 text-xs font-medium"
                        >
                          {formatFechaDiaNegocio(fechaEdit) || "Elegir"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={fechaDesdeDiaNegocio(fechaEdit)}
                          onSelect={(d) => {
                            if (!d) return;
                            const iso = aDiaNegocio(d);
                            setFechaEdit(iso);
                            guardarCuando(selectedReserva.id, "fecha", iso);
                          }}
                          locale={es}
                          weekStartsOn={1}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Hora
                    </Label>
                    {/* Cuartos de hora, igual que al crear: aquí se podía
                        teclear 12:07 y quedaba guardado fuera de la
                        cuadrícula. Se guarda al elegir, sin esperar al blur:
                        un desplegable no tiene "terminar de escribir". */}
                    <SelectorHoraCuartos
                      value={horaEdit}
                      disabled={guardandoCuando}
                      onChange={setHoraEdit}
                      onCommit={(h) =>
                        guardarCuando(selectedReserva.id, "hora", h)
                      }
                    />
                    {/* Reserva anterior a esta regla (12:07 y similares): el
                        minuto sale vacío porque no existe esa opción. No se
                        toca sola —cambiar la hora de una reserva ajena sin
                        avisar es peor— pero se dice qué pasa y qué hacer. */}
                    {!esHoraEnCuarto(horaEdit) && (
                      <p className="pt-1 text-[10px] text-amber-700 dark:text-amber-300">
                        Estaba guardada a las {selectedReserva.hora.slice(0, 5)}. Elige
                        un minuto (:00, :15, :30 o :45) para dejarla en hora válida.
                      </p>
                    )}
                  </div>
                  {/* Comensales: editable. Antes era solo lectura y la única
                      forma de corregir "somos dos más" era borrar la reserva y
                      volver a crearla. */}
                  <div className="min-w-0">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Personas
                    </Label>
                    {/* Desplegable con el tope de Configuración → Límites
                        ("tamaño máximo por reserva"), igual que al crear: el
                        campo libre dejaba escribir grupos que la empresa no
                        acepta. Una reserva que ya tenga más gente conserva su
                        opción para no perder el dato al abrir la ficha. */}
                    <Select
                      value={String(comensalesEdit)}
                      disabled={guardandoComensales}
                      onValueChange={(v) => {
                        const n = Number(v);
                        setComensalesEdit(n);
                        guardarComensales(selectedReserva.id, n);
                      }}
                    >
                      <SelectTrigger className="h-7 px-1.5 text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      {/* Solo la cifra: la palabra ya está en el rótulo
                          PERSONAS de encima, y repetirla dentro dejaba el
                          campo tan justo que el valor salía cortado ("2…"). */}
                      <SelectContent>
                        {opcionesComensalesEdit.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* DURACIÓN (antes "Tiempo de mesa", al final de la ficha):
                      es cuánto ocupa, así que va con la hora a la que empieza.
                      Arranca en el valor por defecto de la empresa y se amplía
                      sobre la marcha —mesa que se alarga— sin tocar la
                      configuración. */}
                  <div className="min-w-0">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Duración
                    </Label>
                    <Select
                      value={duracionEdit}
                      disabled={guardandoDuracion}
                      onValueChange={(v) => {
                        setDuracionEdit(v);
                        guardarDuracion(selectedReserva.id, v);
                      }}
                    >
                      <SelectTrigger className="h-7 px-1.5 text-xs font-medium">
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
                  </div>
                  </div>
                  {/* DÓNDE se sienta: turno, zona y mesa en una sola fila,
                      justo debajo del cuándo. Turno y zona no se tocan (salen
                      de la hora y de la mesa), así que van en pequeño y le
                      dejan el sitio a la mesa, que sí se cambia. */}
                  <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-2">
                    {/* Turno y zona SE PUEDEN CAMBIAR. Los dos salen solos —el
                        turno de la hora, la zona de la mesa— y casi siempre
                        aciertan, pero sala tiene que poder corregirlos sin
                        rehacer la reserva: una comida que se alarga y ya es
                        cena, o decir en qué parte del local se quiere sentar a
                        alguien que aún no tiene mesa. */}
                    <div className="min-w-0">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Turno
                      </Label>
                      <Select
                        value={selectedReserva.turno === "CENA" ? "CENA" : "COMIDA"}
                        disabled={guardandoTurno}
                        onValueChange={(v) =>
                          guardarTurno(selectedReserva.id, v as TurnoReserva)
                        }
                      >
                        <SelectTrigger className="h-7 px-1.5 text-xs font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COMIDA">Comida</SelectItem>
                          <SelectItem value="CENA">Cena</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Zona
                      </Label>
                      <Select
                        value={selectedReserva.zona ? String(selectedReserva.zona) : ""}
                        disabled={guardandoZona || zonasSalaActual.length === 0}
                        onValueChange={(v) => guardarZona(selectedReserva.id, v)}
                      >
                        <SelectTrigger className="h-7 px-1.5 text-xs font-medium">
                          <SelectValue placeholder="Sin zona" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* La zona guardada puede no estar en la sala que se
                              está mirando (reserva de otro salón): se añade a
                              mano para que la ficha no la enseñe vacía. */}
                          {(() => {
                            const zonaActual = selectedReserva.zona
                              ? String(selectedReserva.zona)
                              : "";
                            const ids = zonasSalaActual.map((z) => z.id);
                            const todas =
                              zonaActual && !ids.includes(zonaActual)
                                ? [zonaActual, ...ids]
                                : ids;
                            return todas.map((z) => (
                              <SelectItem key={z} value={z}>
                                {zonaLabel(z)}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  {/* Mesa EDITABLE. Antes era solo lectura y para moverla
                      había que abrir el salón, aunque el cambio fuese "pásala
                      a la 12". El desplegable trae todas las mesas del local
                      con su diagnóstico (✅ / ⏰ / 👥), así que se ve cuál
                      sirve antes de elegirla.

                      Una reserva sobre una UNIÓN ("M1+M2") no se toca desde
                      aquí: el desplegable da una sola mesa y elegir una
                      soltaría la otra sin decirlo. Para eso está el salón. */}
                  <div className="min-w-0">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Mesa
                    </Label>
                    {/* Misma fila en LOS DOS casos —mesa suelta o unión—: a la
                        izquierda qué mesa es y a la derecha el recuadro para
                        ir al salón. La unión llevaba el botón a lo ancho
                        debajo, así que la ficha se veía distinta según la
                        reserva que abrieras. */}
                    {/* El boton del salon NO resta ancho: va superpuesto al
                        borde derecho de la celda. Antes se llevaba su parte de
                        la fila y el desplegable de la mesa quedaba mas estrecho
                        que los de arriba, asi que la columna no cuadraba. */}
                    <div className="relative">
                      <div className="min-w-0 pr-9">
                        {esReservaUnion ? (
                          <p className="flex h-8 items-center gap-1.5 text-sm font-medium">
                            <span className="truncate">
                              {(selectedReserva.mesaCodigo ?? "")
                                .split("+")
                                .map((c) => c.trim())
                                .join(" + ")}
                            </span>
                            {/* La unión no se toca desde un desplegable: daría
                                una sola mesa y elegir una soltaría la otra sin
                                decirlo. Se dice dónde se cambia. */}
                            <span className="shrink-0 text-[10px] font-normal text-muted-foreground">
                              (unión)
                            </span>
                          </p>
                        ) : (
                          <SelectorMesaConAvisos
                            value={mesaIdReservaAbierta}
                            onChange={(mesaId) => {
                              const m = mesas.find((x) => x.id === mesaId);
                              guardarMesasReserva(
                                selectedReserva.id,
                                m ? m.codigo : "",
                                false,
                              );
                            }}
                            mesas={mesasParaReservaAbierta}
                            estadoPorMesa={estadoMesasReservaAbierta}
                            placeholder="— Sin asignar —"
                          />
                        )}
                      </div>
                      {/* Reasignar mesas a mano: abre el salón con las de la
                          reserva ya marcadas en rojo y deja añadir o quitar
                          las que haga falta cuando el grupo crece o mengua.

                          Cuadrado y solo con el icono de la mesa: el rótulo
                          "Unir mesas" se comía el ancho del desplegable de al
                          lado y además se quedaba corto —desde aquí también se
                          cambia de mesa o se suelta una, no solo unir—. Lleva
                          `title` y `aria-label` para que se sepa qué hace. */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute right-0 top-0 size-7 shrink-0 p-0"
                        title="Modificar las mesas de la reserva"
                        aria-label="Modificar las mesas de la reserva"
                        onClick={() => abrirEditorMesas(selectedReserva)}
                      >
                        <Table2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  </div>
                </div>
                {/* El desplegable de duración vive arriba, con la hora. Aquí
                    queda solo su CONSECUENCIA: hasta qué hora se ocupa la
                    mesa, que es lo que se mira para saber si entra otro pase. */}
                <div>
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
                    // Solo la consecuencia práctica: hasta qué hora queda
                    // ocupada la mesa. Cuál es el valor por defecto de la
                    // empresa se consulta en la configuración, no hace falta
                    // repetirlo en cada ficha.
                    return (
                      <p className="text-[10px] text-muted-foreground">
                        Ocupa la mesa hasta las {fin}.
                      </p>
                    );
                  })()}
                </div>
                {/* Comentario de ESTA reserva, editable: lo que se sabe hoy de
                    esta mesa concreta. Se guarda al salir del campo, como el
                    resto de la ficha. Lo que acompaña siempre a la persona
                    —alergias, manías— va en las observaciones de su ficha de
                    cliente, no aquí. */}
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Comentarios</Label>
                  <Textarea
                    className="text-xs"
                    rows={2}
                    maxLength={RESERVA_COMENTARIO_MAX_CHARS}
                    disabled={guardandoComentario}
                    value={comentarioEdit}
                    onChange={(e) =>
                      setComentarioEdit(
                        e.target.value.slice(0, RESERVA_COMENTARIO_MAX_CHARS),
                      )
                    }
                    onBlur={() => void guardarComentario(selectedReserva.id)}
                  />
                </div>
                {/* Datos del Ticket. Todo de solo lectura: el tipo de reserva,
                    el código y el dinero quedan congelados desde el canje (lo
                    impide también la base de datos, no solo esta pantalla). */}
                {selectedReserva.esTicket && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      <Banknote className="h-3.5 w-3.5" />
                      Reserva pagada
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      {selectedReserva.ticketProductoNombre && (
                        <p className="font-medium">{selectedReserva.ticketProductoNombre}</p>
                      )}
                      {selectedReserva.ticketImporte != null && selectedReserva.ticketImporte > 0 && (
                        <p className="text-muted-foreground">
                          {(() => {
                            const uds = selectedReserva.ticketUnidades ?? selectedReserva.comensales ?? 1;
                            const total = selectedReserva.ticketImporte ?? 0;
                            const unit = uds > 0 ? total / uds : total;
                            const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
                            return uds > 1
                              ? `${uds} personas × ${eur(unit)} = ${eur(total)} total`
                              : `${eur(total)} total`;
                          })()}
                        </p>
                      )}
                      {/* CUÁNDO pagó. No es lo mismo que cuándo reservó: un
                          ticket se compra semanas antes y se canjea después,
                          así que sin esta fecha no se sabe de cuándo es el
                          dinero. Va en la zona de la empresa, no en la del
                          navegador de quien mira. */}
                      {selectedReserva.ticketPagadoAt && (
                        <p className="text-xs text-muted-foreground">
                          Pagado el{" "}
                          <span className="font-medium text-foreground">
                            {formatFechaHoraEnZona(
                              selectedReserva.ticketPagadoAt,
                              empresaActual.zonaHoraria,
                            )}
                          </span>
                        </p>
                      )}
                      {/* Cuándo usó ese ticket para coger ESTA mesa. Solo se
                          enseña si es otro día que el del pago: si compró y
                          reservó de una vez, repetir la fecha no dice nada. */}
                      {selectedReserva.ticketCanjeadoAt &&
                        selectedReserva.ticketCanjeadoAt.slice(0, 10) !==
                          (selectedReserva.ticketPagadoAt ?? "").slice(0, 10) && (
                          <p className="text-xs text-muted-foreground">
                            Canjeado el{" "}
                            <span className="font-medium text-foreground">
                              {formatFechaHoraEnZona(
                                selectedReserva.ticketCanjeadoAt,
                                empresaActual.zonaHoraria,
                              )}
                            </span>
                          </p>
                        )}
                      {selectedReserva.ticketCodigo && (
                        <p className="font-mono text-xs text-muted-foreground">
                          Código {selectedReserva.ticketCodigo}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {/* Los avisos de la reserva (nota, reconfirmacion, duplicada)
                    ya se leen en su fila de la lista: repetirlos aqui solo
                    llenaba la ficha. Se queda la insignia del canal, que dice
                    de donde vino la reserva y no se ve en ningun otro sitio. */}
                <div className="flex flex-wrap items-center gap-2">
                  <ReservaExternalBadge reserva={selectedReserva} />
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
              </div>

              {/* ── Columna derecha: el cliente ─────────────────────────── */}
              <div className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-lg border border-sky-500/25 bg-sky-500/[0.06] p-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  Ficha del cliente
                </h3>

                {/* Fiabilidad de un vistazo: si falla mucho, se decide aquí si
                    se le guarda la mesa. Cada cifra abre su detalle al pasar
                    el ratón por encima. */}
                <FichaClienteEstadisticas
                  insights={selectedInsights}
                  zonaHoraria={empresaActual.zonaHoraria}
                />

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
                    {/* Sin bandera junto al rótulo: el selector de prefijo que
                        va justo debajo ya la lleva en cada opción, así que era
                        el mismo dato dos veces en dos renglones seguidos. */}
                    <Label className="text-muted-foreground text-xs">Teléfono</Label>
                    {/* El prefijo se elige de la lista y el número se escribe
                        al lado, pero se guardan juntos: la ficha no puede
                        quedar con un número al que nadie sabe a qué país
                        llamar. */}
                    <div className="flex gap-1.5">
                      <select
                        value={separarPrefijo(clienteEdit.telefono).prefijo}
                        onChange={(e) =>
                          setClienteEdit((p) => ({
                            ...p,
                            telefono: componerTelefono(
                              e.target.value,
                              separarPrefijo(p.telefono).numero,
                            ),
                          }))
                        }
                        className="h-8 w-[86px] shrink-0 rounded-md border border-input bg-background px-1.5 text-xs"
                        title={
                          PREFIJOS_TELEFONO.find(
                            (x) => x.prefijo === separarPrefijo(clienteEdit.telefono).prefijo,
                          )?.label ?? ""
                        }
                      >
                        {PREFIJOS_TELEFONO.map((x) => (
                          <option key={x.prefijo} value={x.prefijo}>
                            {x.flag} {x.prefijo}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="tel"
                        className="h-8 flex-1 text-xs"
                        value={separarPrefijo(clienteEdit.telefono).numero}
                        onChange={(e) =>
                          setClienteEdit((p) => ({
                            ...p,
                            telefono: componerTelefono(
                              separarPrefijo(p.telefono).prefijo,
                              e.target.value,
                            ),
                          }))
                        }
                      />
                    </div>
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

                {/* Actividad DEL CLIENTE: los cambios de sus datos, se hayan
                    hecho aquí o desde su ficha. Va junto a los campos que la
                    generan, y separada de la actividad de la reserva —que está
                    más abajo y cuenta otra cosa: lo que le ha pasado a ESTA
                    reserva. Un walk-in sin ficha no tiene actividad de cliente. */}
                {selectedReserva.clienteId && (
                  <>
                    <div className="pt-2 border-t border-sky-500/20">
                      <ActividadCliente
                        key={`${selectedReserva.clienteId}-${actividadVersion}`}
                        clienteId={selectedReserva.clienteId}
                      />
                    </div>
                  </>
                )}

              </div>
              </div>

              {/* ── Etiquetas, las dos a la misma altura ─────────────────
                  Antes cada panel colgaba del final de su columna, y como las
                  columnas no miden lo mismo aparecían a alturas distintas: las
                  de la reserva a media ventana y las del cliente mucho más
                  abajo. En su propia banda, fuera de las columnas, quedan
                  siempre enfrentadas y sus chips se leen en línea. */}
              <div className="grid shrink-0 gap-3 md:grid-cols-2">
                <div className="space-y-1.5 rounded-lg border bg-muted/25 p-2.5">
                  {/* "de la reserva" en el título: el cliente tiene sus PROPIAS
                      etiquetas al lado, y sin apellido las dos se leían como la
                      misma cosa. */}
                  <Label className="text-muted-foreground text-xs">
                    Etiquetas de la reserva
                  </Label>
                  <EtiquetasPanel scope="reserva" entityId={selectedReserva.id} />
                </div>
                {/* Etiquetas DE LA PERSONA (alergias, VIP, moroso…): le
                    acompañan en todas sus reservas, a diferencia de las de la
                    reserva, que valen solo para esa noche. Un walk-in sin ficha
                    no tiene ninguna, pero el hueco se mantiene para que el
                    panel de la izquierda no se descoloque. */}
                <div className="space-y-1.5 rounded-lg border border-sky-500/25 bg-sky-500/[0.06] p-2.5">
                  <Label className="text-muted-foreground text-xs">
                    Etiquetas del cliente
                  </Label>
                  {selectedReserva.clienteId ? (
                    <EtiquetasPanel scope="cliente" entityId={selectedReserva.clienteId} />
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      Esta reserva no tiene ficha de cliente.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Guardar: fijo al pie de la ventana, fuera del área que se
              desplaza. Con la caja quieta ya no hay que bajar a buscarlo. */}
          {selectedReserva && (
            <div className="flex justify-end border-t pt-3">
              <Button
                disabled={guardandoCliente}
                onClick={() => guardarDatosCliente(selectedReserva.id)}
              >
                Guardar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Salón para reasignar mesas a mano. Se monta solo con la ficha abierta:
          las mesas y el plano que enseña son los de la sala que hay en pantalla. */}
      {selectedReserva && (
        <EditorMesasReserva
          // Remonta al abrir y al cambiar de reserva: la selección de mesas
          // siempre empieza en las que la reserva tiene grabadas ahora mismo.
          key={`${selectedReserva.id}-${showEditorMesas}`}
          abierto={showEditorMesas}
          onCerrar={() => setShowEditorMesas(false)}
          reserva={selectedReserva}
          mesas={mesasActivas}
          posiciones={posicionesPlano}
          mesasMeta={mesasMeta}
          zonas={zonasSalaActual}
          decoraciones={decoracionesSalaActual}
          esOscuro={esOscuro}
          getReservasMesa={getReservasMesa}
          onValidar={(codigo, forzar) =>
            guardarMesasReserva(selectedReserva.id, codigo, forzar)
          }
          onIntercambiar={(p) =>
            intercambiarMesas(selectedReserva.id, p)
          }
        />
      )}

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
              {confirmBloqueo
                ? confirmBloqueo.mesas.length === 1
                  ? `Bloquear mesa ${confirmBloqueo.mesas[0].codigo}`
                  : `Bloquear ${confirmBloqueo.mesas.length} mesas`
                : ""}
            </DialogTitle>
          </DialogHeader>
          {confirmBloqueo && (
            <div className="space-y-2 text-xs">
              {confirmBloqueo.mesas.length > 1 && (
                <p>
                  Se bloquean todas las mesas de la reserva:{" "}
                  <span className="font-medium">
                    {confirmBloqueo.mesas.map((m) => m.codigo).join(", ")}
                  </span>
                  .
                </p>
              )}
              <p className="text-muted-foreground">
                {confirmBloqueo.mesas.length === 1 ? "La mesa queda" : "Las mesas quedan"}{" "}
                fuera de servicio el{" "}
                <span className="font-medium text-foreground">{fecha}</span> en{" "}
                <span className="font-medium text-foreground">
                  {turno === "COMIDA" ? "comida" : "cena"}
                </span>
                . Los demás turnos y días no se tocan.
              </p>
              {confirmBloqueo.reservasActivas > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 flex gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>
                    {confirmBloqueo.mesas.length === 1 ? "Esta mesa tiene" : "Estas mesas tienen"}{" "}
                    {confirmBloqueo.reservasActivas}{" "}
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
                  onClick={() => bloquearMesasHoy(confirmBloqueo.mesas)}
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
                ({reservaADesplazar.hora.slice(0, 5)} · {reservaADesplazar.comensales} per) a la
                mesa <span className="font-medium text-foreground">{choqueDesplazar.mesa.codigo}</span>{" "}
                pisaría {choqueDesplazar.choques.length === 1 ? "esta reserva" : "estas reservas"}:
              </p>
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 divide-y divide-amber-500/20">
                {choqueDesplazar.choques.map((c) => (
                  <div key={c.reservaId} className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{c.cliente || "WALK IN"}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {c.horaInicio}–{c.horaFin} · {c.personas} per · {c.mesa}
                    </span>
                  </div>
                ))}
              </div>
              {/* Avisos de aforo. No bloquean: se dicen para que la decisión
                  se tome sabiendo con qué se va a encontrar sala al montar. */}
              {(choqueDesplazar.avisoAforo || choqueDesplazar.avisoAforoOtra) && (
                <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2">
                  {choqueDesplazar.avisoAforo && (
                    <p className="flex gap-1.5 text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                      <span>{choqueDesplazar.avisoAforo}</span>
                    </p>
                  )}
                  {choqueDesplazar.avisoAforoOtra && (
                    <p className="flex gap-1.5 text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                      <span>
                        Si se intercambian:{" "}
                        {choqueDesplazar.avisoAforoOtra.charAt(0).toLowerCase()}
                        {choqueDesplazar.avisoAforoOtra.slice(1)}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* Qué hace cada botón, con nombres reales: se lee antes de
                  pulsar, que es cuando importa. */}
              <p className="text-muted-foreground">
                {choqueDesplazar.permutable ? (
                  <>
                    <span className="font-medium text-foreground">Intercambiar</span>{" "}
                    cambia a las dos de sitio —{" "}
                    {choqueDesplazar.permutable.cliente || "WALK IN"} pasa a{" "}
                    {codigosDeMesa(reservaADesplazar.mesaCodigo).join(" + ")}.{" "}
                    <span className="font-medium text-foreground">Mover igualmente</span>{" "}
                    deja a las dos reservas sobre {choqueDesplazar.mesa.codigo}.
                  </>
                ) : (
                  "Si la mueves igualmente, las dos quedarán sobre la misma mesa a la vez."
                )}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setChoqueDesplazar(null)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={guardandoDesplazar}
                  onClick={() => aplicarDesplazamiento(reservaADesplazar, choqueDesplazar.mesa)}
                >
                  Mover igualmente
                </Button>
                {choqueDesplazar.permutable && (
                  <Button
                    size="sm"
                    disabled={guardandoDesplazar}
                    onClick={() =>
                      permutarDesplazamiento(
                        reservaADesplazar,
                        choqueDesplazar.mesa,
                        choqueDesplazar.permutable!,
                      )
                    }
                  >
                    Intercambiar
                  </Button>
                )}
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
              {avisoOcupada?.mensaje}
            </div>
            <p className="text-muted-foreground">
              Aún no se ha guardado el cambio. Puedes elegir otra mesa u hora, o
              seguir adelante: la mesa quedaría ocupada dos veces a la vez.
            </p>
          </div>
          {/* Manda el local, pero informado: el ⏰ ya avisaba en el desplegable
              y aquí se dice con qué reserva choca. Si aun así compensa (un
              grupo que se alarga, dos turnos que se solapan diez minutos), se
              puede forzar en vez de obligar a deshacer el cambio. */}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAvisoOcupada(null)}
            >
              Cancelar
            </Button>
            {avisoOcupada?.forzar && (
              <Button
                size="sm"
                onClick={() => {
                  const accion = avisoOcupada.forzar;
                  setAvisoOcupada(null);
                  accion?.();
                }}
              >
                Aceptar igualmente
              </Button>
            )}
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
