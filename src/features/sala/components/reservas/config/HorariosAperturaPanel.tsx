"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Check, ChevronRight, DoorClosed, DoorOpen, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  EmpresaReservasConfig,
  EmpresaReservasHorarioExcepcion,
  TurnoKey,
  DiaSemanaKey,
  SemanaHorarioInicioKey,
  SemanaHorarioFinKey,
  SemanaHorarioCerradoKey,
} from "@/features/sala/data/reservas";
import { DIA_SEMANA_KEY, generarSlotsTurno } from "@/features/sala/data/reservas";
import {
  createHorarioExcepcion,
  deleteHorarioExcepcion,
  listHorariosExcepciones,
} from "@/features/sala/actions/reservas-horarios-excepciones-actions";
import {
  esFilaNueva,
  useListaPendiente,
} from "@/features/sala/reglas/hooks/useListaPendiente";
import type { PanelPendienteHandle } from "./LimitesReglas";

interface Props {
  config: EmpresaReservasConfig;
  onChange: (parche: Partial<EmpresaReservasConfig>) => void;
  /** La pestaña lo usa para volcar las excepciones pendientes al guardar. */
  handleRef?: RefObject<PanelPendienteHandle | null>;
  onDirtyChange?: () => void;
}

type Ambito = "dia_semana" | "rango" | "dias_especificos";

const DIAS_LABELS: Record<DiaSemanaKey, string> = {
  lun: "lunes", mar: "martes", mie: "miércoles", jue: "jueves",
  vie: "viernes", sab: "sábado", dom: "domingo",
};
const DIAS_ORDEN: DiaSemanaKey[] = ["lun","mar","mie","jue","vie","sab","dom"];

/** "lunes", "lunes y martes", "lunes, martes y jueves", "todos los días". */
function listaDias(dias: DiaSemanaKey[]): string {
  const orden = DIAS_ORDEN.filter((d) => dias.includes(d));
  if (orden.length === 0) return "ningún día";
  if (orden.length === DIAS_ORDEN.length) return "todos los días";
  const nombres = orden.map((d) => DIAS_LABELS[d]);
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

function hoyISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formateaFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function turnoLabel(t: TurnoKey): string {
  return t === "comida" ? "Comida" : "Cena";
}

const MIN_POR_DIA = 1440;

function aMinutos(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

function intervaloMinutos(inicio: string, fin: string): [number, number] {
  const s = aMinutos(inicio);
  let e = aMinutos(fin);
  if (e <= s) e += MIN_POR_DIA;
  return [s, e];
}

interface VentanaTurno {
  cerrado: boolean;
  inicio: string;
  fin: string;
}

function ventanaEfectiva(
  cfg: EmpresaReservasConfig,
  dia: DiaSemanaKey,
  t: TurnoKey,
): VentanaTurno | null {
  const cerradoKey = `${dia}_cerrado_${t}` as SemanaHorarioCerradoKey;
  const inicioKey = `${dia}_inicio_${t}` as SemanaHorarioInicioKey;
  const finKey = `${dia}_fin_${t}` as SemanaHorarioFinKey;
  if (cfg[cerradoKey] === true) return { cerrado: true, inicio: "", fin: "" };
  const diaIni = cfg[inicioKey];
  const diaFin = cfg[finKey];
  if (diaIni && diaFin) return { cerrado: false, inicio: diaIni, fin: diaFin };
  if (t === "comida") {
    if (cfg.generalCerradoComida) return { cerrado: true, inicio: "", fin: "" };
    if (cfg.generalInicioComida && cfg.generalFinComida) {
      return { cerrado: false, inicio: cfg.generalInicioComida, fin: cfg.generalFinComida };
    }
  } else {
    if (cfg.generalCerradoCena) return { cerrado: true, inicio: "", fin: "" };
    if (cfg.generalInicioCena && cfg.generalFinCena) {
      return { cerrado: false, inicio: cfg.generalInicioCena, fin: cfg.generalFinCena };
    }
  }
  return null;
}

// Comida debe terminar antes (o justo cuando) empieza cena. Nunca pueden solaparse
// ni invertirse el orden. Devuelve un mensaje de error o null si todo cuadra.
function validaOrdenComidaCena(
  comida: VentanaTurno | null,
  cena: VentanaTurno | null,
): string | null {
  if (!comida || comida.cerrado || !cena || cena.cerrado) return null;
  const [, ce] = intervaloMinutos(comida.inicio, comida.fin);
  const [ds] = intervaloMinutos(cena.inicio, cena.fin);
  if (ce > ds) {
    return "El horario de comida debe terminar antes de que empiece el de cena. No pueden solaparse.";
  }
  return null;
}

function rangoFechasIso(ini: string, fin: string): string[] {
  const out: string[] = [];
  const start = new Date(`${ini}T00:00:00`);
  const end = new Date(`${fin}T00:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
  }
  return out;
}

function diasSemanaUnicos(fechas: string[]): DiaSemanaKey[] {
  const set = new Set<DiaSemanaKey>();
  for (const f of fechas) {
    const d = new Date(`${f}T00:00:00`);
    set.add(DIA_SEMANA_KEY[d.getDay()]);
  }
  return [...set];
}

/**
 * Decide qué turno mostrar por defecto en función de la hora actual:
 *  - mientras la comida esté activa → "comida"
 *  - mientras la cena esté activa → "cena"
 *  - si ningún turno está activo → el siguiente que toque (en minutos)
 * Aplica la ventana general como fallback si el día no tiene horario propio.
 */
function turnoPorHoraActual(cfg: EmpresaReservasConfig): TurnoKey {
  const ahora = new Date();
  const dia = DIA_SEMANA_KEY[ahora.getDay()];
  const minActual = ahora.getHours() * 60 + ahora.getMinutes();
  const comida = ventanaEfectiva(cfg, dia, "comida");
  const cena   = ventanaEfectiva(cfg, dia, "cena");
  const dentro = (v: VentanaTurno | null): boolean => {
    if (!v || v.cerrado) return false;
    const [ini, fin] = intervaloMinutos(v.inicio, v.fin);
    const mNorm = minActual < ini ? minActual + MIN_POR_DIA : minActual;
    return mNorm >= ini && mNorm < fin;
  };
  if (dentro(comida)) return "comida";
  if (dentro(cena))   return "cena";
  // Ninguno activo: el más cercano en el futuro
  const distanciaA = (v: VentanaTurno | null): number => {
    if (!v || v.cerrado) return Number.POSITIVE_INFINITY;
    const [ini] = intervaloMinutos(v.inicio, v.fin);
    let d = ini - minActual;
    if (d <= 0) d += MIN_POR_DIA;
    return d;
  };
  return distanciaA(comida) <= distanciaA(cena) ? "comida" : "cena";
}

export function HorariosAperturaPanel({
  config,
  onChange,
  handleRef,
  onDirtyChange,
}: Props) {
  const [turno, setTurno] = useState<TurnoKey>(() => turnoPorHoraActual(config));
  const [cerrado, setCerrado] = useState(false);
  const [inicio, setInicio] = useState("20:00");
  const [fin, setFin] = useState("02:00");
  const [ambito, setAmbito] = useState<Ambito>("dia_semana");

  // Siempre apunta al config más reciente sin provocar re-suscripciones.
  const configRef = useRef(config);
  configRef.current = config;

  // Re-evalúa el turno por defecto cada minuto: cuando termine el turno actual
  // pasamos automáticamente al siguiente. Lee config por ref para no reiniciar
  // el temporizador en cada guardado de slots.
  useEffect(() => {
    const id = setInterval(() => {
      setTurno((prev) => {
        const sugerido = turnoPorHoraActual(configRef.current);
        return prev === sugerido ? prev : sugerido;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Estado específico de ámbitos
  // Se pueden marcar varios días a la vez y aplicarles el mismo horario de una
  // pasada. Siempre hay al menos uno: sin días no habría nada que cambiar.
  const [diasSemanaSel, setDiasSemanaSel] = useState<DiaSemanaKey[]>(["lun"]);
  // El horario que se precarga y con el que se compara es el del primero de la
  // selección, en orden de semana: es el que representa lo que se está editando.
  const diaSemanaRef = DIAS_ORDEN.find((d) => diasSemanaSel.includes(d)) ?? "lun";
  const [rangoIni, setRangoIni] = useState(hoyISO());
  const [rangoFin, setRangoFin] = useState(hoyISO());
  const [fechasLista, setFechasLista] = useState<string[]>([]);
  const [fechaNueva, setFechaNueva] = useState(hoyISO());
  const [motivo, setMotivo] = useState("");

  const [cargando, setCargando] = useState(true);
  const [aplicando, setAplicando] = useState(false);

  // Las excepciones se crean y se borran, nunca se editan: no hay acción de
  // update en el servidor. El hook lo admite igual.
  const lista = useListaPendiente<
    EmpresaReservasHorarioExcepcion,
    Parameters<typeof createHorarioExcepcion>[0]
  >({
    idDe: (e) => e.id,
    aInput: (e) => ({
      turno: e.turno,
      ambito: e.ambito,
      fecha: e.fecha,
      fechaInicio: e.fechaInicio,
      fechaFin: e.fechaFin,
      fechas: e.fechas,
      inicio: e.inicio,
      fin: e.fin,
      cerrado: e.cerrado,
      motivo: e.motivo,
    }),
  });
  const { filas: excepciones, cambios, hayCambios, cargar: cargarLista } = lista;

  // Precarga el horario al cambiar de turno, de día o de ámbito. Sin esto, al
  // pasar del lunes al martes seguirías viendo los valores del lunes y creerías
  // estar editando un día que no es.
  // OJO: depende SOLO de esos tres. Si dependiera también de `config`, cada
  // click en un slot (que llama a onChange y muta config) revertiría lo que el
  // usuario acaba de tocar arriba — p. ej. pasar de "Cerrado" a "Abierto".
  useEffect(() => {
    const cfg = configRef.current;
    // En ámbito semanal manda el día elegido; si ese día no tiene horario
    // propio, se cae al general, que es lo que heredaría de verdad.
    const ventana =
      ambito === "dia_semana" ? ventanaEfectiva(cfg, diaSemanaRef, turno) : null;
    const porDefecto = turno === "comida"
      ? { inicio: "13:00", fin: "16:00" }
      : { inicio: "20:00", fin: "02:00" };

    if (ambito === "dia_semana") {
      setCerrado(ventana?.cerrado ?? false);
      setInicio(ventana && !ventana.cerrado ? ventana.inicio : porDefecto.inicio);
      setFin(ventana && !ventana.cerrado ? ventana.fin : porDefecto.fin);
      return;
    }

    if (turno === "comida") {
      setInicio(cfg.generalInicioComida ?? porDefecto.inicio);
      setFin(cfg.generalFinComida ?? porDefecto.fin);
      setCerrado(Boolean(cfg.generalCerradoComida));
    } else {
      setInicio(cfg.generalInicioCena ?? porDefecto.inicio);
      setFin(cfg.generalFinCena ?? porDefecto.fin);
      setCerrado(Boolean(cfg.generalCerradoCena));
    }
  }, [turno, diaSemanaRef, ambito]);

  const cargarExcepciones = useCallback(async () => {
    const r = await listHorariosExcepciones();
    if (r.ok) cargarLista(r.data);
    setCargando(false);
  }, [cargarLista]);

  useEffect(() => {
    cargarExcepciones();
  }, [cargarExcepciones]);

  const guardarExcepciones = useCallback(async (): Promise<boolean> => {
    for (const id of cambios.borrar) {
      const r = await deleteHorarioExcepcion(id);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo borrar una excepción de horario");
        return false;
      }
    }
    for (const input of cambios.crear) {
      const r = await createHorarioExcepcion(input);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo crear una excepción de horario");
        return false;
      }
    }
    await cargarExcepciones();
    return true;
  }, [cambios, cargarExcepciones]);

  function aniadirFechaLista() {
    if (!fechaNueva) return;
    if (fechasLista.includes(fechaNueva)) return;
    setFechasLista([...fechasLista, fechaNueva].sort());
  }

  function quitarFechaLista(f: string) {
    setFechasLista(fechasLista.filter((x) => x !== f));
  }

  /**
   * Traduce el horario que se está editando arriba a un parche de config para
   * TODOS los días marcados. Se escriben esos días y nada más: la ventana
   * general (horas y cerrado) NUNCA se toca aquí. Es el horario que heredan los
   * días sin horario propio, así que pisarla al editar los lunes cambiaba de
   * paso todos los demás días. Cambiar los lunes es cambiar los lunes.
   * Devuelve null si la validación comida/cena lo impide (ya ha avisado).
   */
  const parcheHorarioSemanal = useCallback((): Partial<EmpresaReservasConfig> | null => {
    if (diasSemanaSel.length === 0) {
      toast.error("Elige al menos un día de la semana");
      return null;
    }
    const ventanaEdicion: VentanaTurno = cerrado
      ? { cerrado: true, inicio: "", fin: "" }
      : { cerrado: false, inicio, fin };
    const otroTurno: TurnoKey = turno === "comida" ? "cena" : "comida";

    // Cada día se valida por separado: el otro turno puede tener horas
    // distintas en cada uno, y basta con que choque en uno para no aplicar nada.
    const parche: Record<string, unknown> = {};
    for (const dia of diasSemanaSel) {
      const otra = ventanaEfectiva(configRef.current, dia, otroTurno);
      const err = turno === "comida"
        ? validaOrdenComidaCena(ventanaEdicion, otra)
        : validaOrdenComidaCena(otra, ventanaEdicion);
      if (err) {
        toast.error(`En ${DIAS_LABELS[dia]}: ${err}`);
        return null;
      }
      parche[`${dia}_inicio_${turno}`]  = cerrado ? null : inicio;
      parche[`${dia}_fin_${turno}`]     = cerrado ? null : fin;
      parche[`${dia}_cerrado_${turno}`] = cerrado;
    }
    return parche as Partial<EmpresaReservasConfig>;
  }, [cerrado, inicio, fin, turno, diasSemanaSel]);

  /**
   * ¿El horario que se ve arriba difiere del guardado en ALGUNO de los días
   * marcados? Sin esto, cambiar la hora y pulsar Guardar no haría nada: el
   * borrador vive solo aquí y el botón de la cabecera no se enteraría de que
   * hay algo que escribir. Basta con que un día difiera, porque el horario se
   * aplica a todos los marcados por igual.
   * Solo aplica al ámbito semanal; en rango y días específicos el borrador se
   * materializa como excepción, y eso ya lo cuenta la lista.
   */
  const horarioSemanalPendiente =
    ambito === "dia_semana" &&
    (cerrado || (Boolean(inicio) && Boolean(fin))) &&
    diasSemanaSel.some((dia) => {
      const guardada = ventanaEfectiva(config, dia, turno);
      if (cerrado) return guardada?.cerrado !== true;
      return (
        guardada?.cerrado !== false ||
        guardada.inicio !== inicio ||
        guardada.fin !== fin
      );
    });

  useEffect(() => {
    onDirtyChange?.();
  }, [hayCambios, horarioSemanalPendiente, onDirtyChange]);

  // El Guardar de la cabecera pide primero el horario que se ve arriba, lo
  // fusiona con el resto de campos de config y lo escribe todo de una vez;
  // después llama a `guardar` para las excepciones, que van a su propia tabla.
  useImperativeHandle(
    handleRef,
    () => ({
      hayCambios: hayCambios || horarioSemanalPendiente,
      guardar: guardarExcepciones,
      parcheConfigPendiente: () =>
        horarioSemanalPendiente ? parcheHorarioSemanal() : {},
    }),
    [hayCambios, horarioSemanalPendiente, parcheHorarioSemanal, guardarExcepciones],
  );

  async function aplicar() {
    if (!cerrado && (!inicio || !fin)) {
      toast.error("Indica hora de apertura y cierre");
      return;
    }
    setAplicando(true);
    try {
      // Comida y cena nunca pueden solaparse: comida SIEMPRE antes que cena.
      const ventanaEdicion: VentanaTurno = cerrado
        ? { cerrado: true, inicio: "", fin: "" }
        : { cerrado: false, inicio, fin };
      const otroTurno: TurnoKey = turno === "comida" ? "cena" : "comida";

      const validarEnDia = (dia: DiaSemanaKey): string | null => {
        const otra = ventanaEfectiva(config, dia, otroTurno);
        return turno === "comida"
          ? validaOrdenComidaCena(ventanaEdicion, otra)
          : validaOrdenComidaCena(otra, ventanaEdicion);
      };

      // Solo llega aquí desde rango o días específicos: el patrón semanal ya no
      // tiene botón, lo vuelca el Guardar de la cabecera.
      // Casos que crean excepción por rango/lista
      let payload: Parameters<typeof createHorarioExcepcion>[0];
      if (ambito === "rango") {
        if (rangoFin < rangoIni) {
          toast.error("La fecha fin debe ser igual o posterior");
          setAplicando(false);
          return;
        }
        const dias = diasSemanaUnicos(rangoFechasIso(rangoIni, rangoFin));
        for (const dia of dias) {
          const err = validarEnDia(dia);
          if (err) {
            toast.error(`En ${DIAS_LABELS[dia]}: ${err}`);
            setAplicando(false);
            return;
          }
        }
        payload = {
          turno,
          ambito: "rango",
          fechaInicio: rangoIni,
          fechaFin: rangoFin,
          cerrado,
          inicio: cerrado ? null : inicio,
          fin: cerrado ? null : fin,
          motivo: motivo.trim() || null,
        };
      } else {
        // dias_especificos
        if (fechasLista.length === 0) {
          toast.error("Añade al menos una fecha");
          setAplicando(false);
          return;
        }
        const dias = diasSemanaUnicos(fechasLista);
        for (const dia of dias) {
          const err = validarEnDia(dia);
          if (err) {
            toast.error(`En ${DIAS_LABELS[dia]}: ${err}`);
            setAplicando(false);
            return;
          }
        }
        payload = {
          turno,
          ambito: "dias_especificos",
          fechas: fechasLista,
          cerrado,
          inicio: cerrado ? null : inicio,
          fin: cerrado ? null : fin,
          motivo: motivo.trim() || null,
        };
      }
      // No se escribe todavía: la excepción queda en la lista, en espera del
      // Guardar de la cabecera.
      lista.anadir({
        id: lista.nuevoIdTemporal(),
        empresaId: "",
        turno: payload.turno,
        ambito: payload.ambito,
        fecha: payload.fecha ?? null,
        fechaInicio: payload.fechaInicio ?? null,
        fechaFin: payload.fechaFin ?? null,
        fechas: payload.fechas ?? null,
        inicio: payload.inicio ?? null,
        fin: payload.fin ?? null,
        cerrado: payload.cerrado,
        motivo: payload.motivo ?? null,
        createdAt: "",
        updatedAt: "",
      });
      toast.success("Excepción lista. Pulsa Guardar para aplicarla.");
      setMotivo("");
      setFechasLista([]);
    } finally {
      setAplicando(false);
    }
  }

  async function borrarExcepcion(id: string) {
    lista.quitar(id);
  }

  return (
    <div className="space-y-4 rounded-md border bg-card p-4">
      <div>
        <h4 className="text-sm font-semibold">Horario de apertura y cierre</h4>
        <p className="text-xs text-muted-foreground">
          Define cuándo aceptas reservas en cada turno. Aplícalo a un día concreto de la semana
          (se repite siempre), a un rango entre dos fechas, o a días específicos del calendario.
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          El horario de comida debe terminar antes de que empiece el de cena. Nunca pueden solaparse:
          si comida cubre todo el día, no podrás configurar cena.
        </p>
      </div>

      {/* Fila 1: turno + cierre + horario */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="block text-xs">Turno</Label>
          <div className="inline-flex rounded-md border bg-background p-0.5">
            {(["comida","cena"] as TurnoKey[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTurno(t)}
                className={cn(
                  "px-3 h-8 rounded text-xs font-medium transition-colors",
                  turno === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {turnoLabel(t)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="block text-xs">Estado</Label>
          <div className="inline-flex rounded-md border bg-background p-0.5">
            {([
              { value: false, label: "Abierto", Icon: DoorOpen },
              { value: true,  label: "Cerrado", Icon: DoorClosed },
            ] as { value: boolean; label: string; Icon: typeof DoorOpen }[]).map(({ value, label, Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => setCerrado(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 h-8 rounded text-xs font-medium transition-colors",
                  cerrado === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Horario <span className="text-muted-foreground font-normal">| Apertura y cierre de reservas</span>
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              disabled={cerrado}
              className="h-8 w-28 text-xs"
            />
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Input
              type="time"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              disabled={cerrado}
              className="h-8 w-28 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Indicador genérico de slots activos para reservas (mismo para todos los días).
          Refleja EN VIVO el estado y las horas que estás editando arriba, no lo guardado. */}
      <SlotsActivosPicker
        turno={turno}
        config={config}
        cerrado={cerrado}
        inicio={inicio}
        fin={fin}
        onChange={onChange}
      />

      <Separator />

      {/* Fila 2: ámbito */}
      <div className="space-y-2">
        <Label className="text-xs">Aplicar esta configuración a</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            { value: "dia_semana",       label: "Todos los…" },
            { value: "rango",            label: "Entre dos fechas" },
            { value: "dias_especificos", label: "Días específicos" },
          ] as { value: Ambito; label: string }[]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAmbito(opt.value)}
              className={cn(
                "px-3 h-8 rounded border text-xs font-medium transition-colors",
                ambito === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-input hover:bg-muted",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-medium">Orden de importancia si hay solapamiento</span> (gana el más específico):{" "}
          <span className="font-medium">1.</span> Días específicos{" "}
          <span className="text-muted-foreground/70">›</span>{" "}
          <span className="font-medium">2.</span> Entre dos fechas{" "}
          <span className="text-muted-foreground/70">›</span>{" "}
          <span className="font-medium">3.</span> Patrón semanal (todos los lunes, martes…).
        </p>
      </div>

      {/* Sub-controles según ámbito */}
      {ambito === "dia_semana" && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            Días de la semana{" "}
            <span className="font-normal text-muted-foreground">
              | marca todos los que quieras
            </span>
          </Label>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex rounded-md border bg-background p-0.5">
              {DIAS_ORDEN.map((d) => {
                const activo = diasSemanaSel.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={activo}
                    onClick={() =>
                      setDiasSemanaSel((prev) =>
                        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                      )
                    }
                    className={cn(
                      "px-3 h-8 rounded text-xs font-medium capitalize transition-colors",
                      activo
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {DIAS_LABELS[d].slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() =>
                setDiasSemanaSel((prev) =>
                  prev.length === DIAS_ORDEN.length ? [] : [...DIAS_ORDEN],
                )
              }
            >
              {diasSemanaSel.length === DIAS_ORDEN.length ? "Ninguno" : "Todos"}
            </Button>
          </div>
          {/* El horario que se ve arriba es el del primer día marcado. Si los
              días elegidos hoy tienen horarios distintos, aplicar los iguala. */}
          <p className="text-[10px] text-muted-foreground">
            {diasSemanaSel.length === 0
              ? "Marca al menos un día para poder aplicar el horario."
              : `Se aplicará el mismo horario a ${listaDias(diasSemanaSel)}.`}
          </p>
        </div>
      )}

      {ambito === "rango" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={rangoIni}
              onChange={(e) => setRangoIni(e.target.value)}
              className="h-8 w-40 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={rangoFin}
              onChange={(e) => setRangoFin(e.target.value)}
              className="h-8 w-40 text-xs"
            />
          </div>
        </div>
      )}

      {ambito === "dias_especificos" && (
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Añadir fecha</Label>
              <Input
                type="date"
                value={fechaNueva}
                onChange={(e) => setFechaNueva(e.target.value)}
                className="h-8 w-40 text-xs"
              />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={aniadirFechaLista} className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
            </Button>
          </div>
          {fechasLista.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {fechasLista.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 rounded bg-muted px-2 h-7 text-xs"
                >
                  {formateaFecha(f)}
                  <button
                    type="button"
                    onClick={() => quitarFechaLista(f)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Quitar ${f}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Motivo (solo en excepciones por rango/lista) */}
      {ambito !== "dia_semana" && (
        <div className="space-y-1.5 max-w-md">
          <Label className="text-xs">Motivo (opcional)</Label>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: San Valentín, evento privado, vacaciones…"
            className="h-8 text-xs"
          />
        </div>
      )}

      {/* El patrón semanal no tiene botón propio: lo que se ve arriba ya queda
          pendiente y lo escribe el Guardar de la cabecera. Rango y días
          específicos sí lo necesitan: crean una excepción en la lista de abajo. */}
      <div className="flex items-center justify-end gap-3">
        <p className="text-[10px] text-muted-foreground">
          {ambito === "dia_semana"
            ? `Solo cambia ${listaDias(diasSemanaSel)}. Pulsa Guardar arriba para aplicarlo.`
            : "Se añade abajo como pendiente; pulsa Guardar arriba para aplicarla."}
        </p>
        {ambito !== "dia_semana" && (
          <Button type="button" size="sm" variant="outline" onClick={aplicar} disabled={aplicando}>
            {aplicando ? "Aplicando…" : "Añadir excepción"}
          </Button>
        )}
      </div>

      {/* Listado de excepciones activas */}
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-semibold">Excepciones de horario activas</h5>
          <span className="text-[10px] text-muted-foreground">
            Sobrescriben el horario semanal en las fechas indicadas.
          </span>
        </div>
        {cargando ? (
          <p className="text-xs text-muted-foreground">Cargando…</p>
        ) : excepciones.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin excepciones. Las que añadas aquí aparecerán abajo.</p>
        ) : (
          <ul className="divide-y rounded border">
            {excepciones.map((e) => (
              <li
                key={e.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-xs",
                  esFilaNueva(e.id) && "bg-amber-50/60 dark:bg-amber-950/20",
                )}
              >
                <span className="font-medium w-14">{turnoLabel(e.turno)}</span>
                <span className="flex-1 truncate">
                  {e.ambito === "fecha"  && `Día ${formateaFecha(e.fecha!)}`}
                  {e.ambito === "rango"  && `Del ${formateaFecha(e.fechaInicio!)} al ${formateaFecha(e.fechaFin!)}`}
                  {e.ambito === "dias_especificos" && `Días: ${(e.fechas ?? []).map(formateaFecha).join(", ")}`}
                  {" — "}
                  {e.cerrado ? <span className="text-destructive">Cerrado</span> : `${e.inicio?.slice(0,5)} → ${e.fin?.slice(0,5)}`}
                  {e.motivo ? ` · ${e.motivo}` : ""}
                </span>
                {esFilaNueva(e.id) && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    Sin guardar
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => borrarExcepcion(e.id)}
                  aria-label="Borrar excepción"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Selector genérico de slots de 15 min activos para reservas.
 *
 * Reglas:
 *  · Aplica IGUAL a todos los días del turno (no se diferencia por día).
 *  · Los slots se generan entre la apertura y el cierre que el usuario tiene
 *    EN PANTALLA (estado en vivo), no lo último guardado: así al cambiar la
 *    hora o pasar de Cerrado a Abierto los slots se actualizan al instante.
 *  · Por defecto TODOS están activos; lo que se persiste es la lista de
 *    slots desactivados (`generalSlotsInactivos*`), por eficiencia.
 *  · Auto-guarda al hacer click (vía `onChange`).
 */
function SlotsActivosPicker({
  turno,
  config,
  cerrado,
  inicio,
  fin,
  onChange,
}: {
  turno: TurnoKey;
  config: EmpresaReservasConfig;
  cerrado: boolean;
  inicio: string;
  fin: string;
  onChange: (parche: Partial<EmpresaReservasConfig>) => void;
}) {
  const slots = cerrado ? [] : generarSlotsTurno(inicio, fin);
  const inactivosKey: keyof EmpresaReservasConfig =
    turno === "comida" ? "generalSlotsInactivosComida" : "generalSlotsInactivosCena";
  const inactivos = new Set<string>(
    (turno === "comida" ? config.generalSlotsInactivosComida : config.generalSlotsInactivosCena) ?? [],
  );

  function toggle(slot: string) {
    const next = new Set(inactivos);
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    onChange({ [inactivosKey]: [...next].sort() } as Partial<EmpresaReservasConfig>);
  }

  function setTodos(activo: boolean) {
    onChange({ [inactivosKey]: activo ? [] : [...slots] } as Partial<EmpresaReservasConfig>);
  }

  const activosCount = slots.length - [...inactivos].filter((s) => slots.includes(s)).length;

  return (
    <div className="space-y-2 rounded border border-dashed bg-muted/30 p-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Label className="text-xs">
            Slots activos para reservas{" "}
            <span className="text-muted-foreground font-normal">
              | mismos para todos los días de {turnoLabel(turno).toLowerCase()} · 15 min
            </span>
          </Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Por defecto todos activos. Desmarca los huecos en los que NO quieras aceptar reservas.
          </p>
        </div>
        {slots.length > 0 && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">
              {activosCount}/{slots.length} activos
            </span>
            <button
              type="button"
              onClick={() => setTodos(true)}
              className="rounded border bg-background px-2 h-7 hover:bg-muted"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTodos(false)}
              className="rounded border bg-background px-2 h-7 hover:bg-muted"
            >
              Ninguno
            </button>
          </div>
        )}
      </div>

      {cerrado ? (
        <p className="text-xs text-muted-foreground italic">
          Turno cerrado: no hay slots configurables.
        </p>
      ) : slots.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Configura la hora de apertura y cierre general del turno para ver los slots.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((s) => {
            const activo = !inactivos.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className={cn(
                  "inline-flex items-center gap-1 h-7 rounded border px-2 text-xs font-medium transition-colors",
                  activo
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-input hover:bg-muted line-through",
                )}
                aria-pressed={activo}
                aria-label={`${s} ${activo ? "activo" : "inactivo"}`}
              >
                {activo && <Check className="h-3 w-3" />}
                {s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
