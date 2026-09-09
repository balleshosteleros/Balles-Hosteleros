/**
 * Marketing → Automatizaciones. Catálogo y tipos.
 *
 * Todo lo que hay aquí está escrito para leerse en voz alta:
 *
 *   «Cuando un cliente no se presenta → espera 1 día → mándale un WhatsApp»
 *
 * Es la pieza que decide si el submódulo lo entiende un encargado de sala o
 * solo un informático. Por eso el catálogo NO habla de webhooks, nodos ni
 * condiciones booleanas: habla de reservas, cumpleaños y clientes dormidos.
 *
 * Isomórfico: lo usan el cliente (los desplegables del editor) y el servidor
 * (el motor). No importa nada de React ni de Supabase.
 */

// ─── Disparadores ────────────────────────────────────────────

export type Disparador =
  | "reserva_nueva"
  | "visita_terminada"
  | "no_show"
  | "cliente_nuevo"
  | "cumpleanos"
  | "cliente_dormido"
  | "valoracion_recibida";

export interface DisparadorDef {
  value: Disparador;
  /** Cómo se lee en la frase: "Cuando ___". */
  label: string;
  /** Una línea explicando cuándo salta, sin tecnicismos. */
  ayuda: string;
  /** Sobre qué entidad trabaja: define qué datos hay en el contexto. */
  entidad: "reserva" | "cliente" | "resena";
  /** Ajuste numérico del disparador, si lo tiene. */
  ajuste?: {
    campo: "dias" | "dias_antes" | "nota_maxima";
    label: string;
    sufijo: string;
    defecto: number;
    min: number;
    max: number;
  };
}

export const DISPARADORES: DisparadorDef[] = [
  {
    value: "reserva_nueva",
    label: "Entra una reserva",
    ayuda: "Salta en cuanto alguien reserva mesa, venga del portal, de Google o del teléfono.",
    entidad: "reserva",
  },
  {
    value: "visita_terminada",
    label: "Un cliente ha venido",
    ayuda: "Salta cuando la reserva ya ha pasado y el cliente se sentó en la mesa.",
    entidad: "reserva",
  },
  {
    value: "no_show",
    label: "Un cliente no se presenta",
    ayuda: "Salta cuando la reserva se marca como no presentada.",
    entidad: "reserva",
  },
  {
    value: "cliente_nuevo",
    label: "Se apunta un cliente nuevo",
    ayuda: "Salta la primera vez que una persona entra en la ficha de clientes.",
    entidad: "cliente",
  },
  {
    value: "cumpleanos",
    label: "Es el cumpleaños de un cliente",
    ayuda: "Salta el día del cumpleaños, o los días antes que se indiquen.",
    entidad: "cliente",
    ajuste: { campo: "dias_antes", label: "Avisar con", sufijo: "días de antelación", defecto: 0, min: 0, max: 30 },
  },
  {
    value: "cliente_dormido",
    label: "Un cliente lleva tiempo sin venir",
    ayuda: "Salta una sola vez, cuando el cliente cumple los días indicados sin pisar el restaurante.",
    entidad: "cliente",
    ajuste: { campo: "dias", label: "Cuando lleve", sufijo: "días sin venir", defecto: 90, min: 15, max: 730 },
  },
  {
    value: "valoracion_recibida",
    label: "Llega una valoración baja",
    ayuda: "Salta cuando un cliente puntúa por debajo de la nota que se marque.",
    entidad: "resena",
    ajuste: { campo: "nota_maxima", label: "Cuando la nota sea", sufijo: "o menos (de 5)", defecto: 3, min: 1, max: 5 },
  },
];

export function disparadorDef(d: string): DisparadorDef | undefined {
  return DISPARADORES.find((x) => x.value === d);
}

// ─── Pasos ───────────────────────────────────────────────────

export type TipoPaso = "esperar" | "email" | "whatsapp" | "sms" | "aviso" | "solo_si";

export type UnidadEspera = "minutos" | "horas" | "dias";

/** La condición de un "solo si". Corta la automatización cuando no se cumple. */
export type CondicionPaso =
  | "no_ha_vuelto"
  | "acepta_marketing"
  | "es_primera_visita"
  | "visitas_min";

export interface PasoEsperar {
  tipo: "esperar";
  cantidad: number;
  unidad: UnidadEspera;
}

export interface PasoEmail {
  tipo: "email";
  asunto: string;
  texto: string;
}

export interface PasoWhatsApp {
  tipo: "whatsapp";
  texto: string;
  /** Nombre de la plantilla aprobada en Meta. Sin ella el mensaje sale por SMS. */
  plantilla?: string;
}

export interface PasoSms {
  tipo: "sms";
  texto: string;
}

export interface PasoAviso {
  tipo: "aviso";
  departamentoId: string;
  titulo: string;
  texto: string;
}

export interface PasoSoloSi {
  tipo: "solo_si";
  condicion: CondicionPaso;
  /** Solo para `visitas_min`. */
  valor?: number;
}

export type Paso = PasoEsperar | PasoEmail | PasoWhatsApp | PasoSms | PasoAviso | PasoSoloSi;

export interface PasoDef {
  value: TipoPaso;
  label: string;
  ayuda: string;
}

export const PASOS: PasoDef[] = [
  { value: "esperar", label: "Esperar", ayuda: "Deja pasar un rato antes del siguiente paso." },
  { value: "email", label: "Mandar un correo", ayuda: "Sale con la marca del restaurante." },
  { value: "whatsapp", label: "Mandar un WhatsApp", ayuda: "Necesita una plantilla aprobada; si no la hay, sale por SMS." },
  { value: "sms", label: "Mandar un SMS", ayuda: "Corto y directo. Gasta saldo." },
  { value: "aviso", label: "Avisar a un departamento", ayuda: "Notificación interna para el equipo, no para el cliente." },
  { value: "solo_si", label: "Seguir solo si…", ayuda: "Si no se cumple, la automatización para aquí." },
];

export const CONDICIONES: { value: CondicionPaso; label: string; pideValor?: boolean }[] = [
  { value: "no_ha_vuelto", label: "El cliente no ha vuelto a reservar" },
  { value: "acepta_marketing", label: "El cliente acepta recibir publicidad" },
  { value: "es_primera_visita", label: "Es la primera vez que viene" },
  { value: "visitas_min", label: "Ha venido al menos… veces", pideValor: true },
];

// ─── La automatización ───────────────────────────────────────

export type EstadoAutomatizacion = "Activo" | "Inactivo";

export interface Automatizacion {
  id: string;
  empresaId: string;
  nombre: string;
  descripcion: string | null;
  disparador: Disparador;
  disparadorConfig: Record<string, number>;
  pasos: Paso[];
  estado: EstadoAutomatizacion;
  modoPrueba: boolean;
  activadaAt: string | null;
  ejecucionesTotal: number;
  ultimaEjecucion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EjecucionResumen {
  id: string;
  automatizacionId: string;
  automatizacionNombre: string;
  entidadTipo: string;
  contexto: Record<string, unknown>;
  estado: "pendiente" | "hecha" | "cortada" | "error";
  pasoActual: number;
  ejecutarEn: string;
  historial: { paso: number; tipo: string; resultado: string; detalle?: string; at: string }[];
  ultimoError: string | null;
  createdAt: string;
}

// ─── Cómo se lee ─────────────────────────────────────────────

const UNIDAD_TEXTO: Record<UnidadEspera, [string, string]> = {
  minutos: ["minuto", "minutos"],
  horas: ["hora", "horas"],
  dias: ["día", "días"],
};

export function textoEspera(p: PasoEsperar): string {
  const [uno, varios] = UNIDAD_TEXTO[p.unidad] ?? UNIDAD_TEXTO.horas;
  return `${p.cantidad} ${p.cantidad === 1 ? uno : varios}`;
}

/** El paso, dicho en una línea. Es lo que se ve en la lista. */
export function textoPaso(p: Paso, nombreDepartamento?: string): string {
  switch (p.tipo) {
    case "esperar":
      return `Esperar ${textoEspera(p)}`;
    case "email":
      return `Correo: ${p.asunto || "sin asunto"}`;
    case "whatsapp":
      return "WhatsApp al cliente";
    case "sms":
      return "SMS al cliente";
    case "aviso":
      return `Avisar a ${nombreDepartamento ?? "un departamento"}`;
    case "solo_si": {
      const c = CONDICIONES.find((x) => x.value === p.condicion);
      const base = c?.label ?? "una condición";
      return p.condicion === "visitas_min"
        ? `Seguir solo si ha venido al menos ${p.valor ?? 2} veces`
        : `Seguir solo si ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
    }
  }
}

/** La frase completa, para la cabecera de la tarjeta. */
export function fraseAutomatizacion(a: Pick<Automatizacion, "disparador" | "pasos">): string {
  const def = disparadorDef(a.disparador);
  const cuando = def?.label ?? a.disparador;
  if (a.pasos.length === 0) return `Cuando ${cuando.toLowerCase()}, todavía no hace nada`;
  return `Cuando ${cuando.toLowerCase()} → ${a.pasos.map((p) => textoPaso(p)).join(" → ")}`;
}

// ─── Variables del texto ─────────────────────────────────────

/**
 * Los huecos que se pueden escribir en un correo o un WhatsApp. Se sustituyen
 * en el momento del envío con lo que haya en el contexto de esa ejecución.
 */
export const VARIABLES: { clave: string; label: string }[] = [
  { clave: "{nombre}", label: "Nombre del cliente" },
  { clave: "{restaurante}", label: "Nombre del restaurante" },
  { clave: "{fecha}", label: "Fecha de la reserva" },
  { clave: "{hora}", label: "Hora de la reserva" },
  { clave: "{personas}", label: "Nº de comensales" },
];

// ─── Recetas de arranque ─────────────────────────────────────

export interface Receta {
  clave: string;
  nombre: string;
  descripcion: string;
  disparador: Disparador;
  disparadorConfig: Record<string, number>;
  pasos: Paso[];
}

/**
 * Cinco automatizaciones ya escritas. Nadie empieza con una hoja en blanco:
 * se elige una, se cambian dos frases y ya está funcionando.
 *
 * Los pasos de aviso llevan `departamentoId` vacío a propósito: se rellena al
 * crearla, con el departamento que elija quien la monte.
 */
export const RECETAS: Receta[] = [
  {
    clave: "bienvenida",
    nombre: "Bienvenida al cliente nuevo",
    descripcion: "Un correo de presentación el primer día, con la carta y las reservas a un clic.",
    disparador: "cliente_nuevo",
    disparadorConfig: {},
    pasos: [
      { tipo: "esperar", cantidad: 2, unidad: "horas" },
      { tipo: "solo_si", condicion: "acepta_marketing" },
      {
        tipo: "email",
        asunto: "Bienvenido a {restaurante}",
        texto:
          "Hola {nombre},\n\nGracias por dejarnos tus datos. A partir de ahora te contaremos las novedades de la casa antes que a nadie: platos de temporada, eventos y alguna sorpresa.\n\nTe esperamos pronto.",
      },
    ],
  },
  {
    clave: "gracias_por_venir",
    nombre: "Gracias por venir",
    descripcion: "Al día siguiente de la visita, un correo dando las gracias y pidiendo opinión.",
    disparador: "visita_terminada",
    disparadorConfig: {},
    pasos: [
      { tipo: "esperar", cantidad: 1, unidad: "dias" },
      { tipo: "solo_si", condicion: "acepta_marketing" },
      {
        tipo: "email",
        asunto: "Gracias por venir a {restaurante}",
        texto:
          "Hola {nombre},\n\nGracias por comer con nosotros el {fecha}. Nos ayuda mucho saber qué tal fue: si tienes un minuto, cuéntanoslo respondiendo a este correo.\n\nHasta la próxima.",
      },
    ],
  },
  {
    clave: "cumpleanos",
    nombre: "Felicitación de cumpleaños",
    descripcion: "Una semana antes, la felicitación con una invitación para celebrarlo en casa.",
    disparador: "cumpleanos",
    disparadorConfig: { dias_antes: 7 },
    pasos: [
      { tipo: "solo_si", condicion: "acepta_marketing" },
      {
        tipo: "email",
        asunto: "Tu cumpleaños invita, {nombre}",
        texto:
          "Hola {nombre},\n\nSe acerca tu cumpleaños y queríamos ser de los primeros en felicitarte. Si te apetece celebrarlo con nosotros, reserva mesa y prepararemos algo especial.\n\nFelicidades por adelantado.",
      },
    ],
  },
  {
    clave: "te_echamos_de_menos",
    nombre: "Te echamos de menos",
    descripcion: "A los 90 días sin venir, un recordatorio para recuperar al cliente.",
    disparador: "cliente_dormido",
    disparadorConfig: { dias: 90 },
    pasos: [
      { tipo: "solo_si", condicion: "acepta_marketing" },
      {
        tipo: "email",
        asunto: "Hace tiempo que no te vemos",
        texto:
          "Hola {nombre},\n\nHace unos meses que no pasas por {restaurante} y hemos cambiado unas cuantas cosas en la carta que creemos que te van a gustar.\n\nReserva cuando quieras: tu mesa te espera.",
      },
      { tipo: "esperar", cantidad: 7, unidad: "dias" },
      { tipo: "solo_si", condicion: "no_ha_vuelto" },
      {
        tipo: "email",
        asunto: "Última llamada, {nombre}",
        texto:
          "Hola {nombre},\n\nTe escribimos una última vez por si se te pasó: seguimos aquí y nos encantaría volver a verte.\n\nUn saludo.",
      },
    ],
  },
  {
    clave: "valoracion_baja",
    nombre: "Aviso por valoración baja",
    descripcion: "Si alguien puntúa 3 o menos, el equipo se entera al momento.",
    disparador: "valoracion_recibida",
    disparadorConfig: { nota_maxima: 3 },
    pasos: [
      {
        tipo: "aviso",
        departamentoId: "",
        titulo: "Valoración baja de un cliente",
        texto: "{nombre} ha valorado la visita por debajo de lo aceptable. Conviene llamarle hoy mismo.",
      },
    ],
  },
  {
    clave: "no_show",
    nombre: "Recuperar un no presentado",
    descripcion: "Al día siguiente de un plantón, un mensaje sin reproches para que vuelva.",
    disparador: "no_show",
    disparadorConfig: {},
    pasos: [
      { tipo: "esperar", cantidad: 1, unidad: "dias" },
      {
        tipo: "email",
        asunto: "¿Lo dejamos para otro día?",
        texto:
          "Hola {nombre},\n\nTe esperábamos el {fecha} y al final no pudo ser. Sin problema: si quieres, buscamos otro hueco cuando te venga bien.\n\nUn saludo.",
      },
    ],
  },
];

// ─── Fila de BD → objeto ─────────────────────────────────────

/** Único sitio donde se traduce la fila de Supabase. Lo usan las acciones y el cron. */
export function rowToAutomatizacion(row: Record<string, unknown>): Automatizacion {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    nombre: (row.nombre as string) ?? "",
    descripcion: (row.descripcion as string) ?? null,
    disparador: row.disparador as Disparador,
    disparadorConfig: (row.disparador_config as Record<string, number>) ?? {},
    pasos: (row.pasos as Paso[]) ?? [],
    estado: (row.estado as EstadoAutomatizacion) ?? "Inactivo",
    modoPrueba: (row.modo_prueba as boolean) ?? true,
    activadaAt: (row.activada_at as string) ?? null,
    ejecucionesTotal: (row.ejecuciones_total as number) ?? 0,
    ultimaEjecucion: (row.ultima_ejecucion as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
