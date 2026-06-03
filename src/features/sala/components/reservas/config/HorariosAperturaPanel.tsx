"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

interface Props {
  config: EmpresaReservasConfig;
  onChange: (parche: Partial<EmpresaReservasConfig>) => void;
}

type Ambito = "dia_semana" | "rango" | "dias_especificos";

const DIAS_LABELS: Record<DiaSemanaKey, string> = {
  lun: "lunes", mar: "martes", mie: "miércoles", jue: "jueves",
  vie: "viernes", sab: "sábado", dom: "domingo",
};
const DIAS_ORDEN: DiaSemanaKey[] = ["lun","mar","mie","jue","vie","sab","dom"];

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

export function HorariosAperturaPanel({ config, onChange }: Props) {
  const [turno, setTurno] = useState<TurnoKey>(() => turnoPorHoraActual(config));
  const [cerrado, setCerrado] = useState(false);
  const [inicio, setInicio] = useState("20:00");
  const [fin, setFin] = useState("02:00");
  const [ambito, setAmbito] = useState<Ambito>("dia_semana");

  // Re-evalúa el turno por defecto cada minuto: cuando termine el turno actual
  // pasamos automáticamente al siguiente.
  useEffect(() => {
    const id = setInterval(() => {
      setTurno((prev) => {
        const sugerido = turnoPorHoraActual(config);
        return prev === sugerido ? prev : sugerido;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [config]);

  // Estado específico de ámbitos
  const [diaSemanaSel, setDiaSemanaSel] = useState<DiaSemanaKey>("lun");
  const [rangoIni, setRangoIni] = useState(hoyISO());
  const [rangoFin, setRangoFin] = useState(hoyISO());
  const [fechasLista, setFechasLista] = useState<string[]>([]);
  const [fechaNueva, setFechaNueva] = useState(hoyISO());
  const [motivo, setMotivo] = useState("");

  const [excepciones, setExcepciones] = useState<EmpresaReservasHorarioExcepcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aplicando, setAplicando] = useState(false);

  // Carga inicial del horario general para el turno seleccionado
  useEffect(() => {
    if (turno === "comida") {
      setInicio(config.generalInicioComida ?? "13:00");
      setFin(config.generalFinComida ?? "16:00");
      setCerrado(Boolean(config.generalCerradoComida));
    } else {
      setInicio(config.generalInicioCena ?? "20:00");
      setFin(config.generalFinCena ?? "02:00");
      setCerrado(Boolean(config.generalCerradoCena));
    }
  }, [turno, config]);

  async function cargarExcepciones() {
    const r = await listHorariosExcepciones();
    if (r.ok) setExcepciones(r.data);
    setCargando(false);
  }

  useEffect(() => {
    cargarExcepciones();
  }, []);

  function aniadirFechaLista() {
    if (!fechaNueva) return;
    if (fechasLista.includes(fechaNueva)) return;
    setFechasLista([...fechasLista, fechaNueva].sort());
  }

  function quitarFechaLista(f: string) {
    setFechasLista(fechasLista.filter((x) => x !== f));
  }

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

      // Caso semanal: escribe en la config por día de la semana elegido
      if (ambito === "dia_semana") {
        const err = validarEnDia(diaSemanaSel);
        if (err) {
          toast.error(err);
          setAplicando(false);
          return;
        }
        const parche: Record<string, unknown> = {
          [`${diaSemanaSel}_inicio_${turno}`]:  cerrado ? null : inicio,
          [`${diaSemanaSel}_fin_${turno}`]:     cerrado ? null : fin,
          [`${diaSemanaSel}_cerrado_${turno}`]: cerrado,
        };
        onChange(parche as Partial<EmpresaReservasConfig>);
        toast.success(`Horario aplicado a todos los ${DIAS_LABELS[diaSemanaSel]}`);
        setAplicando(false);
        return;
      }

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
      const r = await createHorarioExcepcion(payload);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo guardar");
      } else {
        toast.success("Excepción de horario añadida");
        setMotivo("");
        setFechasLista([]);
        cargarExcepciones();
      }
    } finally {
      setAplicando(false);
    }
  }

  async function borrarExcepcion(id: string) {
    const r = await deleteHorarioExcepcion(id);
    if (!r.ok) {
      toast.error(r.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Excepción borrada");
    cargarExcepciones();
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

      {/* Indicador genérico de slots activos para reservas (mismo para todos los días) */}
      <SlotsActivosPicker
        turno={turno}
        config={config}
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
          <Label className="text-xs">Día de la semana</Label>
          <Select value={diaSemanaSel} onValueChange={(v) => setDiaSemanaSel(v as DiaSemanaKey)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Elige día" />
            </SelectTrigger>
            <SelectContent>
              {DIAS_ORDEN.map((d) => (
                <SelectItem key={d} value={d} className="text-xs">
                  {DIAS_LABELS[d].charAt(0).toUpperCase() + DIAS_LABELS[d].slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={aplicar} disabled={aplicando}>
          {aplicando ? "Aplicando…" : "Aplicar"}
        </Button>
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
              <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="font-medium w-14">{turnoLabel(e.turno)}</span>
                <span className="flex-1 truncate">
                  {e.ambito === "fecha"  && `Día ${formateaFecha(e.fecha!)}`}
                  {e.ambito === "rango"  && `Del ${formateaFecha(e.fechaInicio!)} al ${formateaFecha(e.fechaFin!)}`}
                  {e.ambito === "dias_especificos" && `Días: ${(e.fechas ?? []).map(formateaFecha).join(", ")}`}
                  {" — "}
                  {e.cerrado ? <span className="text-destructive">Cerrado</span> : `${e.inicio?.slice(0,5)} → ${e.fin?.slice(0,5)}`}
                  {e.motivo ? ` · ${e.motivo}` : ""}
                </span>
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
 *  · Los slots se generan automáticamente entre la apertura y el cierre
 *    "general" del turno (`generalInicio*`/`generalFin*`). Si abres antes
 *    o cierras después, los nuevos slots aparecen activos sin tocar nada.
 *  · Por defecto TODOS están activos; lo que se persiste es la lista de
 *    slots desactivados (`generalSlotsInactivos*`), por eficiencia.
 *  · Auto-guarda al hacer click (vía `onChange`).
 */
function SlotsActivosPicker({
  turno,
  config,
  onChange,
}: {
  turno: TurnoKey;
  config: EmpresaReservasConfig;
  onChange: (parche: Partial<EmpresaReservasConfig>) => void;
}) {
  const ini = turno === "comida" ? config.generalInicioComida : config.generalInicioCena;
  const fin = turno === "comida" ? config.generalFinComida    : config.generalFinCena;
  const cerrado = turno === "comida" ? config.generalCerradoComida : config.generalCerradoCena;
  const slots = generarSlotsTurno(ini, fin);
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
