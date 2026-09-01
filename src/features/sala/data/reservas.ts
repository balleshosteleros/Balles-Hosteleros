export type EstadoMesa = "LIBRE" | "OCUPADA" | "RESERVADA" | "BLOQUEADA";

/**
 * 9 estados canónicos de una reserva — fuente única para toda la app.
 * NO_SHOW / NO_RECONFIRMADA / LISTA_ESPERA usan guion bajo (BD); la app traduce
 * los labels al castellano natural.
 */
export type EstadoReserva =
  | "CONFIRMADA"
  | "RECONFIRMADA"
  | "NO_RECONFIRMADA"
  | "LISTA_ESPERA"
  | "LIBERADA"
  | "WALK_IN"
  | "TERMINANDO"
  | "NO_SHOW"
  | "CANCELADA";

export const ESTADOS_RESERVA: EstadoReserva[] = [
  "CONFIRMADA",
  "RECONFIRMADA",
  "NO_RECONFIRMADA",
  "LISTA_ESPERA",
  "LIBERADA",
  "WALK_IN",
  "TERMINANDO",
  "NO_SHOW",
  "CANCELADA",
];

/**
 * Estados que liberan la MESA: no ocupan sitio físico, así que no cuentan en la
 * detección de solape, en la asignación automática ni en la disponibilidad del
 * motor web. LIBERADA entra aquí precisamente porque soltó la mesa y esa mesa
 * se puede volver a vender.
 *
 * OJO: no confundir con `ESTADOS_NO_ASISTEN` (totales visibles). Una reserva
 * LIBERADA no ocupa mesa, pero el cliente SÍ vino: cuenta en los totales.
 * Importar SIEMPRE desde aquí para no duplicar el set.
 */
export const ESTADOS_NO_OCUPANTES: EstadoReserva[] = [
  "CANCELADA",
  "NO_SHOW",
  "LIBERADA",
];

/**
 * Estados que NO cuentan en los totales que ve el usuario (comensales del
 * turno, mesas ocupadas, desglose por nº de personas, totales del calendario).
 *
 * Solo los que realmente NO asisten: canceladas y no-shows. El resto —incluida
 * LIBERADA, que es gente que vino y ya terminó— sí cuenta como clientes
 * atendidos; excluirla hacía que los totales del día se quedaran cortos.
 */
export const ESTADOS_NO_ASISTEN: EstadoReserva[] = [
  "CANCELADA",
  "NO_SHOW",
];

/**
 * Prioridad de ordenación cuando dos reservas comparten hora: compromiso real
 * primero (confirmada/reconfirmada), luego lista de espera, liberadas, resto.
 */
export const ESTADO_ORDEN_PRIORIDAD: Record<EstadoReserva, number> = {
  CONFIRMADA: 0,
  RECONFIRMADA: 0,
  LISTA_ESPERA: 1,
  LIBERADA: 2,
  NO_RECONFIRMADA: 3,
  WALK_IN: 3,
  TERMINANDO: 3,
  NO_SHOW: 3,
  CANCELADA: 3,
};

/**
 * Paleta visual de cada estado. Clases Tailwind para chip (badge) y para el
 * punto sólido. Único origen — `ReservaEstadoBadge` y `ReservasView` importan
 * desde aquí.
 */
export const ESTADO_BADGE_CLASS: Record<EstadoReserva, string> = {
  CONFIRMADA:      "bg-emerald-600/20 text-emerald-400 border-emerald-600/40",
  RECONFIRMADA:    "bg-sky-600/20 text-sky-400 border-sky-600/40",
  NO_RECONFIRMADA: "bg-amber-600/20 text-amber-400 border-amber-600/40",
  LISTA_ESPERA:    "bg-violet-600/20 text-violet-400 border-violet-600/40",
  LIBERADA:        "bg-yellow-600/20 text-yellow-300 border-yellow-600/40",
  WALK_IN:         "bg-orange-600/20 text-orange-300 border-orange-600/40",
  TERMINANDO:      "bg-cyan-600/20 text-cyan-300 border-cyan-600/40",
  NO_SHOW:         "bg-red-600/20 text-red-400 border-red-600/40",
  CANCELADA:       "bg-red-900/20 text-red-500 border-red-800/40",
};

export const ESTADO_DOT_CLASS: Record<EstadoReserva, string> = {
  CONFIRMADA:      "bg-emerald-500",
  RECONFIRMADA:    "bg-sky-500",
  NO_RECONFIRMADA: "bg-amber-500",
  LISTA_ESPERA:    "bg-violet-500",
  LIBERADA:        "bg-yellow-500",
  WALK_IN:         "bg-orange-400",
  TERMINANDO:      "bg-cyan-500",
  NO_SHOW:         "bg-red-500",
  CANCELADA:       "bg-red-800",
};

export type ZonaSala = "SALA" | "BARRA" | "TERRAZA_INTERIOR" | "TERRAZA_EXTERIOR" | "PRIVADO";

/**
 * Categoría económica de la reserva (campo "Tipo de reserva" en el formulario).
 * - gratis: sin compromiso económico, ningún campo extra
 * - politica: aplica una política de cancelación con importe retenido si cancela
 * - cupon: el cliente ya ha pagado por adelantado (se guarda el importe pagado)
 * - ticket: la reserva incluye un producto-ticket vendido (cena evento, brunch, etc.)
 */
export type TipoReservaCategoria = "gratis" | "politica" | "cupon" | "ticket";

export const TIPO_RESERVA_CATEGORIAS: TipoReservaCategoria[] = ["gratis", "politica", "cupon", "ticket"];

export const TIPO_RESERVA_CATEGORIA_LABELS: Record<TipoReservaCategoria, string> = {
  gratis: "Gratis",
  politica: "Política de cancelación",
  cupon: "Cupón",
  ticket: "Ticket",
};

export const ZONAS_SALA: ZonaSala[] = ["SALA", "BARRA", "TERRAZA_INTERIOR", "TERRAZA_EXTERIOR", "PRIVADO"];
export type TurnoReserva = "COMIDA" | "CENA";
export type TipoMesa = "MESA" | "BARRA" | "RESERVADO" | "TABURETE";

export const ZONAS_LABELS: Record<ZonaSala, string> = {
  SALA: "Sala",
  BARRA: "Barra",
  TERRAZA_INTERIOR: "Terraza Interior",
  TERRAZA_EXTERIOR: "Terraza Exterior",
  PRIVADO: "Privado",
};

/**
 * Etiqueta legible de una zona.
 *
 * ZONAS_LABELS solo cubre las 5 zonas canónicas, pero las zonas reales del
 * plano son de texto libre (p.ej. "REDONDAS"), así que indexar el mapa a pelo
 * devuelve `undefined` y se pinta literalmente en pantalla. Aquí caemos a la
 * propia zona formateada en sentence case.
 */
export function zonaLabel(zona: string | null | undefined): string {
  if (!zona) return "—";
  const canonica = ZONAS_LABELS[zona as ZonaSala];
  if (canonica) return canonica;
  return zona
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}

export const ESTADO_RESERVA_LABELS: Record<EstadoReserva, string> = {
  CONFIRMADA:      "Confirmada",
  RECONFIRMADA:    "Reconfirmada",
  NO_RECONFIRMADA: "No reconfirmada",
  LISTA_ESPERA:    "Lista de espera",
  LIBERADA:        "Liberada",
  WALK_IN:         "Walk in",
  TERMINANDO:      "Terminando",
  NO_SHOW:         "No show",
  CANCELADA:       "Cancelada",
};

export const ESTADO_MESA_LABELS: Record<EstadoMesa, string> = {
  LIBRE: "Libre",
  OCUPADA: "Sentada",
  RESERVADA: "Reservada",
  BLOQUEADA: "Bloqueada",
};

export interface Mesa {
  id: string;
  codigo: string;
  numero: number;
  zona: ZonaSala;
  capacidad: number;
  estado: EstadoMesa;
  tipo: TipoMesa;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  combinable: boolean;
  activa: boolean;
}

export interface Reserva {
  id: string;
  cliente: string;
  apellidos: string;
  telefono: string;
  email: string;
  fecha: string;
  hora: string;
  turno: TurnoReserva;
  comensales: number;
  zona: ZonaSala | "";
  /** UUID de la mesa. Resuelto en cliente desde `mesaCodigo` (la BD guarda el código). */
  mesaId: string;
  /** Código de mesa tal cual lo guarda la columna `reservas.mesa` (p.ej. "R3", "M1+M2"). */
  mesaCodigo?: string;
  estado: EstadoReserva;
  observaciones: string;
  empleadoId?: string;
  clienteId?: string | null;
  /**
   * La reserva enganchó con una ficha que ya existía (mismo email o teléfono)
   * pero el resto de datos no coinciden, y nadie lo ha revisado todavía. El
   * nombre que se ve es el de la ficha, no necesariamente el de quien reservó.
   */
  vinculacionPendiente?: boolean;
  origen?: string | null;
  // Flags acumulables (PRP-047)
  tarjetaIntroducida?: boolean;
  esTicket?: boolean;
  tipoCategoria?: TipoReservaCategoria | null;
  garantiaImporte?: number | null;
  importePagado?: number | null;
  // PRP-051: ticket comprado al reservar.
  ticketProductoId?: string | null;
  ticketUnidades?: number | null;
  ticketImporte?: number | null;
  ticketIva?: number | null;
  pagoPendiente?: boolean;
  bloqueada?: boolean;
  grupoId?: string | null;
  codigoId?: string | null;
  /** Código de 6 chars del cupón aplicado (PRP-052). */
  codigo?: string | null;
  reconfirmadaAt?: string | null;
  externalId?: string | null;
  externalOrigen?: string | null;
  /**
   * Duración de ESTA reserva en minutos. NULL/undefined = se usa la default
   * de empresa (`EmpresaReservasConfig.duracionReservaMin`). Solo editable por
   * reserva; no expone configuración general.
   */
  duracionMinutos?: number | null;
  /**
   * Instante UTC en que se dio de alta la reserva. Informativo: dice con
   * cuánta antelación se pidió la mesa, que es distinto de la fecha para la
   * que se pidió. No se edita nunca.
   */
  createdAt?: string | null;
}

// --- INSIGHTS DE CLIENTE (computados al abrir detalle de reserva) ---
export interface ClienteInsights {
  clienteId: string | null;
  visitasTotal: number;
  visitasConValoracion: number;
  visitasSinValoracion: number;
  otrosLocalesGrupo: number;
  /** Veces que reservó y no se presentó. Decide si se le guarda la mesa. */
  noShows: number;
  /** Reservas que canceló él mismo. */
  canceladas: number;
}

/** Convención para detectar reservas creadas por un Channel Manager. */
export const CHANNEL_MANAGER_ORIGEN_PREFIX = "channel-";
export function esOrigenChannelManager(origen: string | null | undefined): boolean {
  if (!origen) return false;
  const o = origen.toLowerCase();
  return o.startsWith(CHANNEL_MANAGER_ORIGEN_PREFIX) || o === "channelmanager" || o === "channel manager";
}

// Las etiquetas de reserva y de cliente viven en
// `@/features/sala/actions/sala-etiquetas-actions` (agrupadas por categoría y
// asignables en M:N). El catálogo plano antiguo se eliminó.

// Tipos de cupones (PRP-052) viven en `@/features/sala/cupones/data/cupones`.
// La tabla `reserva_codigos` fue rediseñada en esa migración.

// --- CONFIGURACIÓN DE RESERVAS POR EMPRESA ---
// Aforo y máximo por reserva viven en `empresa_reservas_reglas` (PRP-050).
// Esta config persiste horario, antelación y duración de reserva (para
// detección de solape al asignar mesa).
export type DiaSemanaKey = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom";
export type TurnoKey = "comida" | "cena";

/** Mapea Date.getDay() (0=domingo) a la clave del día usada en la config. */
export const DIA_SEMANA_KEY: DiaSemanaKey[] = ["dom","lun","mar","mie","jue","vie","sab"];

/** Claves planas de horario por día × turno (inicio, fin, cerrado). */
export type SemanaHorarioInicioKey  = `${DiaSemanaKey}_inicio_${TurnoKey}`;
export type SemanaHorarioFinKey     = `${DiaSemanaKey}_fin_${TurnoKey}`;
export type SemanaHorarioCerradoKey = `${DiaSemanaKey}_cerrado_${TurnoKey}`;
export type SemanaHorarios =
  & { [K in SemanaHorarioInicioKey]:  string | null }
  & { [K in SemanaHorarioFinKey]:     string | null }
  & { [K in SemanaHorarioCerradoKey]: boolean | null };

export type EmpresaReservasConfig = SemanaHorarios & {
  empresaId: string;
  antelacionMinMinutos: number;
  antelacionMaxDias: number;
  /**
   * Duración por defecto de una reserva, en minutos. Aplica a todos los planos
   * y a todas las reservas: define la ventana durante la cual una mesa queda
   * ocupada y se usa para bloquear nuevas reservas que solapen con una
   * existente. Rango admitido: 15–360 (6 h). Default 120.
   */
  duracionReservaMin: number;
  // Horario general (heredable por días sin valor propio)
  generalInicioComida: string | null;
  generalFinComida:    string | null;
  generalInicioCena:   string | null;
  generalFinCena:      string | null;
  generalCerradoComida: boolean;
  generalCerradoCena:   boolean;
  /**
   * Slots de 15 min ("HH:MM") DESACTIVADOS para reservas. Aplica IGUAL a
   * todos los días del turno (genérico). Empty = todos los slots entre
   * apertura y cierre están activos. Si la apertura/cierre cambia, los
   * nuevos slots aparecen activos sin necesidad de tocar nada.
   */
  generalSlotsInactivosComida: string[];
  generalSlotsInactivosCena:   string[];
  // Política de cancelación (texto fijo en código; solo estas dos cifras
  // y el mensaje opcional son configurables por empresa).
  cancelacionActiva: boolean;         // interruptor: si está apagada, no se aplica
  cancelacionHorasAntes: number;      // entero 1–168, horas completas
  cancelacionImporteEur: number;      // €, mín 1.00, máx 2 decimales
  cancelacionPersonalizarMensaje: boolean;
  cancelacionMensajePersonalizado: string | null;
  // Política de garantía: importe que se retiene al confirmar la reserva y se
  // libera al presentarse el cliente. Independiente de la de cancelación:
  // cada una tiene su propio interruptor y pueden convivir.
  garantiaActiva: boolean;
  garantiaImporteEur: number;         // €, mín 1.00, máx 2 decimales
  garantiaModo: GarantiaModo;         // fijo por reserva o multiplicado por comensal
  garantiaDesdePax: number;           // 0 = todas las reservas
  garantiaPersonalizarMensaje: boolean;
  garantiaMensajePersonalizado: string | null;
  // Mensaje al pedir tarjeta al SELECCIONAR UN PRODUCTO (PRP-051, tipo_categoria='ticket').
  // El toggle vive en el tab de Ticket; el texto se añade al correo cuando aplique.
  productoPersonalizarMensaje: boolean;
  productoMensajePersonalizado: string | null;
  // Reconfirmación automática por correo.
  //   · `reconfirmacionActiva = false` → master OFF, no se envía ningún correo
  //     de reconfirmación (ni cron ni inmediato).
  //   · `reconfirmacionActiva = true`  → el correo se envía a la misma hora
  //     que la reserva, `reconfirmacionDiasAntes` días antes (1–7). Si la
  //     reserva entra con MENOS antelación que ese lead time:
  //       · `reconfirmacionEnvioInmediato = true`  → envía inmediatamente tras
  //         la confirmación.
  //       · `reconfirmacionEnvioInmediato = false` → no envía reconfirmación.
  reconfirmacionActiva: boolean;
  reconfirmacionDiasAntes: number;
  reconfirmacionEnvioInmediato: boolean;
  // Recordatorio automático por correo (X horas antes de la reserva).
  recordatorioActivo: boolean;
  recordatorioHorasAntes: number;
  // Solicitud de valoración por correo (X horas DESPUÉS de la reserva).
  // Es la única regla: se aplica igual a toda reserva de cualquier cliente.
  valoracionEmailActivo: boolean;
  valoracionEmailHorasDespues: number;

  // Comportamiento del motor web y avisos de servicio (final de la pestaña
  // "Configuración" de Reservas).
  cerrarMotorWebActivo: boolean;
  cerrarMotorWebComida: string | null; // HH:MM
  cerrarMotorWebCena:   string | null; // HH:MM

  maxPersonasHoraActivo: boolean;
  maxPersonasHoraModo:   MaxPersonasHoraModo;
  maxPersonasHoraGlobal: number | null;
  maxPersonasHoraReglas: MaxPersonasReglaTramo[];

  parpadeoPasadoDuracion: boolean;
  parpadeo0a15:           boolean;
  parpadeo15a30:          boolean;

};

/**
 * Los campos obligatorios del alta de reserva NO viven aquí: nombre, apellidos,
 * fecha, hora, comensales, turno, estado y mesa se exigen siempre por código (la
 * zona se deduce de la mesa), y los dos únicos configurables —teléfono y email—
 * se marcan en Ajustes → Departamentos → Sala → Reservas, que es la barrera de
 * seguridad superior. Se leen con `useReglasSubmodulo("sala", "reservas")`.
 */

/** Límite de caracteres de nombre y apellidos en el alta de reserva. */
export const RESERVA_NOMBRE_MAX_CHARS = 50;
export const RESERVA_APELLIDOS_MAX_CHARS = 80;

/**
 * Tope del comentario de una reserva. Equivale a dos frases cortas: lo justo
 * para un aviso útil ("Alergia al marisco. Vienen con carrito.") sin que se
 * convierta en un texto que ya no cabe en la lista ni se puede leer de un
 * vistazo. Rige en TODOS los sitios desde los que se crea o edita una reserva:
 * alta manual, lista de espera, ficha y portal público.
 */
export const RESERVA_COMENTARIO_MAX_CHARS = 140;

/** Modo del tope "número máximo de personas en misma hora". */
export type MaxPersonasHoraModo = "mismo" | "diferente_hora" | "diferente_tramo";

export const MAX_PERSONAS_HORA_MODOS: MaxPersonasHoraModo[] = [
  "mismo",
  "diferente_hora",
  "diferente_tramo",
];

export const MAX_PERSONAS_HORA_MODO_LABELS: Record<MaxPersonasHoraModo, string> = {
  mismo: "Mismo en todas las horas",
  diferente_hora: "Diferente según hora",
  diferente_tramo: "Diferente según tramo horario",
};

export interface MaxPersonasReglaTramo {
  inicio: string; // HH:MM
  fin: string;    // HH:MM
  max: number;
}

export const CANCELACION_HORAS_MIN = 1;
export const CANCELACION_HORAS_MAX = 168; // 1 semana
export const CANCELACION_HORAS_DEFAULT = 6;
export const CANCELACION_IMPORTE_MIN = 1.0;
export const CANCELACION_IMPORTE_MAX = 9999.99;
export const CANCELACION_IMPORTE_DEFAULT = 10.0;

/**
 * Modo de cálculo del importe retenido en garantía:
 *   · "reserva"  → se retiene el importe tal cual, sea cual sea el grupo.
 *   · "comensal" → el importe se multiplica por el número de personas.
 */
export type GarantiaModo = "reserva" | "comensal";

export const GARANTIA_MODOS: GarantiaModo[] = ["reserva", "comensal"];

export const GARANTIA_MODO_LABELS: Record<GarantiaModo, string> = {
  reserva: "Por reserva",
  comensal: "Por comensal",
};

export const GARANTIA_IMPORTE_MIN = 1.0;
export const GARANTIA_IMPORTE_MAX = 9999.99;
export const GARANTIA_IMPORTE_DEFAULT = 20.0;

/** Comensales a partir de los cuales se pide garantía. 0 = todas las reservas. */
export const GARANTIA_DESDE_PAX_OPCIONES = [0, 2, 4, 6, 8, 10, 12, 15, 20] as const;

/**
 * Texto fijo (idéntico para todas las empresas) que se muestra en la
 * configuración de la política de garantía y en el correo al cliente cuando la
 * reserva la lleva.
 */
export const GARANTIA_TEXTO_FIJO =
  "Al efectuar la reserva se retiene un importe en garantía con los datos de " +
  "la tarjeta del cliente. El importe se libera al presentarse en el " +
  "restaurante y se pierde en caso de no presentación.";

/**
 * Texto fijo (idéntico para todas las empresas) que se muestra en la
 * configuración de políticas de cancelación y en el correo al cliente
 * cuando la reserva usa política de cancelación.
 */
export const CANCELACION_TEXTO_FIJO =
  "Las reservas efectuadas con política de cancelación serán gratuitas. " +
  "Al efectuar la reserva, el cliente proporciona los datos de su tarjeta. " +
  "Se cargará una cantidad en cuenta al cliente en caso de no presentación " +
  "o cancelación de última hora.";

/**
 * Tope del desplegable de comensales cuando la empresa no ha configurado
 * ninguna regla de "tamaño máximo por reserva" (métrica `maxpax`).
 *
 * No es un límite de negocio, solo evita que el selector se quede sin opciones
 * en una empresa recién creada: en cuanto se configura el máximo en
 * Configuración → Reservas → Límites, manda ese valor.
 */
export const MAX_COMENSALES_SIN_REGLA = 50;

/**
 * Tope técnico del campo "personas" en las entradas públicas. No es una regla
 * de negocio (esa la pone `maxpax` en Configuración → Límites): solo evita que
 * llegue un número absurdo por la API del portal. La configuración de la
 * empresa manda siempre por debajo de este techo.
 */
export const MAX_COMENSALES_ENTRADA = 200;

/** Límites del campo `duracionReservaMin` (ver migración 20260602160000). */
export const DURACION_RESERVA_MIN_MINUTOS = 15;
export const DURACION_RESERVA_MAX_MINUTOS = 360;
export const DURACION_RESERVA_DEFAULT_MINUTOS = 120;
/** Salto entre opciones de duración: cuartos de hora. */
export const DURACION_RESERVA_PASO_MINUTOS = 15;

/**
 * Duración en horas y minutos, tal y como se piensa en sala ("1 h 15 min" = una
 * hora y cuarto). En minutos sueltos (los 195 de "3 h 15 min") nadie calcula de
 * cabeza cuánto ocupa realmente una mesa. La unidad se escribe siempre, también
 * en los tramos mixtos: un "1, 15" a secas no se lee como hora y cuarto.
 */
export function formatearDuracionReserva(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hora" : `${h} horas`;
  return `${h} h ${m} min`;
}

/**
 * Tramos seleccionables de duración: de 15 minutos a 6 horas, de cuarto en
 * cuarto de hora. Se genera en vez de escribirse a mano para que no pueda
 * desalinearse de los límites de la migración.
 */
export const DURACION_RESERVA_OPCIONES: { minutos: number; label: string }[] =
  Array.from(
    {
      length:
        (DURACION_RESERVA_MAX_MINUTOS - DURACION_RESERVA_MIN_MINUTOS) /
          DURACION_RESERVA_PASO_MINUTOS +
        1,
    },
    (_, i) => {
      const minutos =
        DURACION_RESERVA_MIN_MINUTOS + i * DURACION_RESERVA_PASO_MINUTOS;
      return { minutos, label: formatearDuracionReserva(minutos) };
    },
  );

/** Límites de `reconfirmacionDiasAntes` (ver migración 20260602180000). */
export const RECONFIRMACION_DIAS_MIN = 1;
export const RECONFIRMACION_DIAS_MAX = 7;
export const RECONFIRMACION_DIAS_DEFAULT = 1;

/**
 * Granularidad fija de los huecos de reserva: 00, 15, 30 y 45. No es
 * configurable — todo el sistema (motor web, sala, indicadores y validaciones)
 * trabaja con este grid y no acepta horas intermedias.
 */
export const RESERVA_SLOT_MIN = 15;

/**
 * Genera los slots "HH:MM" de duración `RESERVA_SLOT_MIN` entre `inicio` y
 * `fin` (formato "HH:MM"; soporta cruzar medianoche cuando fin < inicio).
 * Devuelve array vacío si el intervalo está vacío o las horas no son válidas.
 */
export function generarSlotsTurno(inicio: string | null, fin: string | null): string[] {
  if (!inicio || !fin) return [];
  const [hi, mi] = inicio.slice(0, 5).split(":").map(Number);
  const [hf, mf] = fin.slice(0, 5).split(":").map(Number);
  if (![hi, mi, hf, mf].every((n) => Number.isFinite(n))) return [];
  const ini = hi * 60 + mi;
  let f = hf * 60 + mf;
  if (f <= ini) f += 24 * 60;
  const out: string[] = [];
  for (let m = ini; m < f; m += RESERVA_SLOT_MIN) {
    const real = m % (24 * 60);
    const h = Math.floor(real / 60);
    const mm = real % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out;
}

// --- EXCEPCIONES DE HORARIO POR ÁMBITO ---
export type HorarioAmbito = "fecha" | "rango" | "dias_especificos";

export interface EmpresaReservasHorarioExcepcion {
  id: string;
  empresaId: string;
  turno: TurnoKey;
  ambito: HorarioAmbito;
  fecha: string | null;        // ambito = 'fecha'
  fechaInicio: string | null;  // ambito = 'rango'
  fechaFin: string | null;     // ambito = 'rango'
  fechas: string[] | null;     // ambito = 'dias_especificos'
  inicio: string | null;       // null si cerrado
  fin: string | null;          // null si cerrado
  cerrado: boolean;
  motivo: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- ADJUNTOS ---
export interface ReservaAdjunto {
  id: string;
  empresaId: string;
  reservaId: string;
  storagePath: string;
  nombreOriginal: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface ListaEspera {
  id: string;
  cliente: string;
  telefono: string;
  comensales: number;
  zona: ZonaSala | "";
  hora: string;
  fecha: string;
  observaciones: string;
  estado: "ESPERANDO" | "ASIGNADO" | "CANCELADO";
}

// --- SAMPLE DATA ---
const hoy = "2026-04-07";

export const SAMPLE_MESAS: Mesa[] = [
  // SALA
  { id: "s1", codigo: "A1", numero: 1, zona: "SALA", capacidad: 6, tipo: "MESA", estado: "LIBRE", x: 72, y: 6, ancho: 5, alto: 6, combinable: true, activa: true },
  { id: "s2", codigo: "A2", numero: 2, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "RESERVADA", x: 72, y: 15, ancho: 5, alto: 5, combinable: true, activa: true },
  { id: "s3", codigo: "A3", numero: 3, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "LIBRE", x: 72, y: 23, ancho: 5, alto: 5, combinable: true, activa: true },
  { id: "s4", codigo: "A4", numero: 4, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "OCUPADA", x: 72, y: 31, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "s5", codigo: "A5", numero: 5, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "LIBRE", x: 72, y: 39, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "s6", codigo: "A6", numero: 6, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "LIBRE", x: 72, y: 47, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "s7", codigo: "C1", numero: 7, zona: "SALA", capacidad: 4, tipo: "MESA", estado: "RESERVADA", x: 80, y: 6, ancho: 5, alto: 6, combinable: true, activa: true },
  { id: "s8", codigo: "C2", numero: 8, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "LIBRE", x: 80, y: 15, ancho: 5, alto: 5, combinable: true, activa: true },
  { id: "s9", codigo: "C3", numero: 9, zona: "SALA", capacidad: 4, tipo: "MESA", estado: "OCUPADA", x: 80, y: 23, ancho: 5, alto: 6, combinable: false, activa: true },
  { id: "s10", codigo: "C4", numero: 10, zona: "SALA", capacidad: 3, tipo: "MESA", estado: "LIBRE", x: 88, y: 6, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "s11", codigo: "C5", numero: 11, zona: "SALA", capacidad: 3, tipo: "MESA", estado: "LIBRE", x: 88, y: 14, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "s12", codigo: "C6", numero: 12, zona: "SALA", capacidad: 6, tipo: "MESA", estado: "LIBRE", x: 88, y: 22, ancho: 6, alto: 6, combinable: false, activa: true },
  // VIP
  { id: "v1", codigo: "VIP1", numero: 13, zona: "SALA", capacidad: 5, tipo: "RESERVADO", estado: "OCUPADA", x: 64, y: 18, ancho: 6, alto: 7, combinable: false, activa: true },
  // TERRAZA INTERIOR
  { id: "ti1", codigo: "TI1", numero: 14, zona: "TERRAZA_INTERIOR", capacidad: 7, tipo: "MESA", estado: "RESERVADA", x: 48, y: 8, ancho: 5, alto: 7, combinable: true, activa: true },
  { id: "ti2", codigo: "TI2", numero: 15, zona: "TERRAZA_INTERIOR", capacidad: 7, tipo: "MESA", estado: "RESERVADA", x: 55, y: 8, ancho: 5, alto: 7, combinable: true, activa: true },
  { id: "ti3", codigo: "TI3", numero: 16, zona: "TERRAZA_INTERIOR", capacidad: 6, tipo: "MESA", estado: "OCUPADA", x: 48, y: 20, ancho: 5, alto: 6, combinable: false, activa: true },
  { id: "ti4", codigo: "TI4", numero: 17, zona: "TERRAZA_INTERIOR", capacidad: 3, tipo: "MESA", estado: "LIBRE", x: 55, y: 20, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "ti5", codigo: "TI5", numero: 18, zona: "TERRAZA_INTERIOR", capacidad: 3, tipo: "MESA", estado: "LIBRE", x: 55, y: 28, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "ti6", codigo: "TI6", numero: 19, zona: "TERRAZA_INTERIOR", capacidad: 4, tipo: "MESA", estado: "OCUPADA", x: 48, y: 38, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "ti7", codigo: "TI7", numero: 20, zona: "TERRAZA_INTERIOR", capacidad: 3, tipo: "MESA", estado: "LIBRE", x: 55, y: 38, ancho: 5, alto: 5, combinable: false, activa: true },
  // TERRAZA EXTERIOR
  { id: "te1", codigo: "TE1", numero: 21, zona: "TERRAZA_EXTERIOR", capacidad: 5, tipo: "MESA", estado: "LIBRE", x: 32, y: 8, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te2", codigo: "TE2", numero: 22, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 32, y: 18, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te3", codigo: "TE3", numero: 23, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 32, y: 28, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te4", codigo: "TE4", numero: 24, zona: "TERRAZA_EXTERIOR", capacidad: 5, tipo: "MESA", estado: "LIBRE", x: 32, y: 38, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te5", codigo: "TE5", numero: 25, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 22, y: 8, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te6", codigo: "TE6", numero: 26, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 22, y: 18, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te7", codigo: "TE7", numero: 27, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 12, y: 8, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te8", codigo: "TE8", numero: 28, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 12, y: 18, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te9", codigo: "TE9", numero: 29, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 22, y: 28, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te10", codigo: "TE10", numero: 30, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 22, y: 38, ancho: 5, alto: 5, combinable: false, activa: true },
  // BARRA
  { id: "b1", codigo: "B1", numero: 31, zona: "BARRA", capacidad: 2, tipo: "BARRA", estado: "LIBRE", x: 82, y: 52, ancho: 4, alto: 5, combinable: false, activa: true },
  { id: "b2", codigo: "B2", numero: 32, zona: "BARRA", capacidad: 2, tipo: "BARRA", estado: "OCUPADA", x: 87, y: 52, ancho: 4, alto: 5, combinable: false, activa: true },
  { id: "b3", codigo: "B3", numero: 33, zona: "BARRA", capacidad: 2, tipo: "BARRA", estado: "LIBRE", x: 82, y: 60, ancho: 4, alto: 5, combinable: false, activa: true },
  { id: "b4", codigo: "B4", numero: 34, zona: "BARRA", capacidad: 2, tipo: "BARRA", estado: "LIBRE", x: 87, y: 60, ancho: 4, alto: 5, combinable: false, activa: true },
  { id: "b5", codigo: "R1", numero: 35, zona: "BARRA", capacidad: 4, tipo: "BARRA", estado: "LIBRE", x: 64, y: 30, ancho: 5, alto: 5, combinable: false, activa: true },
  // PRIVADO
  { id: "p1", codigo: "R1T", numero: 36, zona: "PRIVADO", capacidad: 4, tipo: "RESERVADO", estado: "LIBRE", x: 58, y: 72, ancho: 7, alto: 7, combinable: false, activa: true },
  { id: "p2", codigo: "R2T", numero: 37, zona: "PRIVADO", capacidad: 4, tipo: "RESERVADO", estado: "LIBRE", x: 68, y: 72, ancho: 7, alto: 7, combinable: false, activa: true },
];

export const SAMPLE_RESERVAS: Reserva[] = [
  { id: "r1", cliente: "María", apellidos: "García López", telefono: "612345678", email: "maria@email.com", fecha: hoy, hora: "14:00", turno: "COMIDA", comensales: 4, zona: "SALA", mesaId: "s2", estado: "CONFIRMADA", observaciones: "Cumpleaños" },
  { id: "r2", cliente: "Carlos", apellidos: "López Ruiz", telefono: "698765432", email: "carlos@email.com", fecha: hoy, hora: "21:00", turno: "CENA", comensales: 2, zona: "TERRAZA_EXTERIOR", mesaId: "te1", estado: "NO_RECONFIRMADA", observaciones: "" },
  { id: "r3", cliente: "Ana", apellidos: "Martínez Sanz", telefono: "655443322", email: "ana@email.com", fecha: "2026-04-08", hora: "14:30", turno: "COMIDA", comensales: 6, zona: "SALA", mesaId: "s12", estado: "CONFIRMADA", observaciones: "Alergia frutos secos" },
  { id: "r4", cliente: "Pedro", apellidos: "Ruiz Fernández", telefono: "633221100", email: "pedro@email.com", fecha: hoy, hora: "21:30", turno: "CENA", comensales: 8, zona: "PRIVADO", mesaId: "p1", estado: "CONFIRMADA", observaciones: "Cena de empresa" },
  { id: "r5", cliente: "Laura", apellidos: "Fernández Gil", telefono: "677889900", email: "", fecha: hoy, hora: "14:00", turno: "COMIDA", comensales: 2, zona: "", mesaId: "", estado: "NO_RECONFIRMADA", observaciones: "" },
  { id: "r6", cliente: "Lorena", apellidos: "Melchor", telefono: "611223344", email: "", fecha: hoy, hora: "23:30", turno: "CENA", comensales: 7, zona: "TERRAZA_INTERIOR", mesaId: "ti1", estado: "CONFIRMADA", observaciones: "" },
  { id: "r7", cliente: "Lorena", apellidos: "Melchor", telefono: "611223344", email: "", fecha: hoy, hora: "23:30", turno: "CENA", comensales: 7, zona: "TERRAZA_INTERIOR", mesaId: "ti2", estado: "CONFIRMADA", observaciones: "" },
  { id: "r8", cliente: "Alejandra", apellidos: "Camargo", telefono: "622334455", email: "", fecha: hoy, hora: "20:15", turno: "CENA", comensales: 2, zona: "SALA", mesaId: "v1", estado: "WALK_IN", observaciones: "" },
  { id: "r9", cliente: "Jonas", apellidos: "Mamba", telefono: "644556677", email: "", fecha: hoy, hora: "00:30", turno: "CENA", comensales: 4, zona: "SALA", mesaId: "s10", estado: "WALK_IN", observaciones: "" },
  { id: "r10", cliente: "Carlos", apellidos: "Gil García", telefono: "655667788", email: "", fecha: hoy, hora: "00:30", turno: "CENA", comensales: 4, zona: "SALA", mesaId: "s9", estado: "WALK_IN", observaciones: "" },
  { id: "r11", cliente: "", apellidos: "", telefono: "", email: "", fecha: hoy, hora: "20:00", turno: "CENA", comensales: 2, zona: "SALA", mesaId: "s4", estado: "WALK_IN", observaciones: "" },
  { id: "r12", cliente: "", apellidos: "", telefono: "", email: "", fecha: hoy, hora: "20:00", turno: "CENA", comensales: 4, zona: "SALA", mesaId: "s7", estado: "WALK_IN", observaciones: "" },
  { id: "r13", cliente: "", apellidos: "", telefono: "", email: "", fecha: hoy, hora: "20:00", turno: "CENA", comensales: 3, zona: "TERRAZA_INTERIOR", mesaId: "ti6", estado: "WALK_IN", observaciones: "" },
];

export const SAMPLE_LISTA_ESPERA: ListaEspera[] = [
  { id: "le1", cliente: "Raúl Gómez", telefono: "611222333", comensales: 4, zona: "SALA", hora: "21:00", fecha: hoy, observaciones: "Prefiere interior", estado: "ESPERANDO" },
  { id: "le2", cliente: "Marta Díaz", telefono: "622333444", comensales: 2, zona: "", hora: "21:30", fecha: hoy, observaciones: "", estado: "ESPERANDO" },
];

/**
 * Etiqueta legible del canal por el que entró la reserva (PORTAL_PROPIO,
 * GOOGLE_RWG…). Sin origen = alta manual desde el back-office.
 *
 * Vive aquí y no en la vista porque la lista de sala y el histórico de la
 * ficha del cliente tienen que leer el canal igual: si cada una lo formatea
 * por su cuenta, la misma reserva sale con dos nombres distintos.
 */
export function origenLabel(origen: string | null | undefined): string {
  if (!origen) return "Manual";
  // Todo lo que entra por el motor de reservas de la web se lee igual: "Web".
  // Da igual que venga del enlace pelado o de un enlace de campaña con su
  // palabra clave — el canal es el mismo y en sala se pregunta por el canal.
  const clave = origen.toUpperCase();
  if (clave === "RESERVA_WEB" || clave === "PORTAL_PROPIO" || clave === "WEB") {
    return "Web";
  }
  const limpio = origen.replace(/_/g, " ").toLowerCase();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/** Milisegundos que tiene un día entero. */
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Días ENTEROS transcurridos entre dos instantes.
 *
 * Cuenta bloques completos de 24 horas, no cambios de fecha en el calendario:
 * una reserva hecha ayer a las 23:00 y mirada hoy a las 09:00 lleva 0 días,
 * no 1, porque no han pasado 24 horas. Se trunca siempre hacia abajo.
 *
 * Al contar tiempo real y no días de calendario, el resultado no depende de la
 * zona horaria: da igual desde dónde se mire.
 *
 * Devuelve `null` si la fecha no es válida, y 0 si el instante es futuro (una
 * reserva no puede haberse creado dentro de un rato).
 */
export function diasEnterosTranscurridos(
  iso: string | null | undefined,
  ahora: number = Date.now(),
): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const transcurrido = ahora - t;
  if (transcurrido < 0) return 0;
  return Math.floor(transcurrido / MS_POR_DIA);
}

/**
 * "Hoy" / "Hace 1 día" / "Hace 5 días", según los días enteros pasados.
 * Devuelve "" si la fecha no es válida.
 */
export function etiquetaDiasTranscurridos(
  iso: string | null | undefined,
  ahora: number = Date.now(),
): string {
  const dias = diasEnterosTranscurridos(iso, ahora);
  if (dias === null) return "";
  if (dias === 0) return "Hoy";
  return `Hace ${dias} ${dias === 1 ? "día" : "días"}`;
}
