"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectorOpcion } from "@/components/ui/selector-opcion";
import { formatearFechaEs } from "@/shared/lib/fecha";

/**
 * Selector de fecha PROPIO — sustituye al `<input type="date">` nativo.
 *
 * El calendario del navegador no se puede estilar: sale con esquinas en pico,
 * tipografía del sistema y en el idioma del navegador, distinto en cada equipo.
 * Este va siempre igual: redondeado, en español y en día/mes/año, la regla del
 * proyecto para toda fecha que se lee en pantalla.
 *
 * Trabaja con la CADENA "AAAA-MM-DD" en `value`/`onChange`, igual que el input
 * nativo, para poder sustituirlo sin tocar la lógica de los formularios. El
 * `Date` solo existe dentro del calendario, así que la zona horaria del
 * navegador nunca puede desplazar el día.
 */

/** "2026-09-05" → Date local a mediodía (mediodía = inmune a saltos de huso). */
function isoADate(iso: string | null | undefined): Date | undefined {
  if (!iso || iso.length < 10) return undefined;
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return undefined;
  return new Date(a, m - 1, d, 12, 0, 0, 0);
}

/** Date → "AAAA-MM-DD" leyendo el día LOCAL, nunca el UTC de `toISOString()`. */
function dateAIso(fecha: Date): string {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

export interface SelectorFechaProps {
  /** Fecha en "AAAA-MM-DD". Cadena vacía = sin elegir. */
  value: string;
  onChange: (valor: string) => void;
  /** Primera fecha elegible, "AAAA-MM-DD". */
  min?: string;
  /** Última fecha elegible, "AAAA-MM-DD". */
  max?: string;
  id?: string;
  /** Obligatorio: el asterisco lo pinta la etiqueta, aquí solo se anota. */
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Clases del botón disparador: hereda el alto y borde del formulario. */
  className?: string;
  /** Empieza abierto por este mes cuando aún no hay fecha (p. ej. nacimiento). */
  mesPorDefecto?: string;
  /**
   * Color del día elegido, en hex. El calendario se pinta en un portal fuera
   * del formulario, así que `--brand` no le llega por herencia y hay que
   * pasárselo. Sin color, negro.
   */
  colorMarca?: string | null;
  /** Color del número sobre `colorMarca`. Sin él, blanco. */
  colorMarcaTexto?: string | null;
  "aria-label"?: string;
}

export function SelectorFecha({
  value,
  onChange,
  min,
  max,
  id,
  required = false,
  disabled,
  placeholder = "dd/mm/aaaa",
  className,
  mesPorDefecto,
  colorMarca,
  colorMarcaTexto,
  "aria-label": ariaLabel,
}: SelectorFechaProps) {
  const [abierto, setAbierto] = React.useState(false);
  // Mes que se está mostrando. Hace falta controlarlo para que los
  // desplegables propios de mes y año puedan moverlo.
  const [mesVisible, setMesVisible] = React.useState<Date | undefined>(undefined);

  const seleccionada = isoADate(value);
  const desde = isoADate(min);
  const hasta = isoADate(max);

  // Sin fecha elegida el calendario abriría por el mes actual, que en una fecha
  // de nacimiento deja al usuario a decenas de clics de su año.
  const mesInicial = seleccionada ?? isoADate(mesPorDefecto) ?? hasta ?? desde;

  // Los desplegables de mes/año solo se ganan el sitio cuando el rango cubre
  // varios años (nacimiento). Para elegir día de reserva sobran.
  const conDesplegables =
    !!desde && !!hasta && hasta.getFullYear() - desde.getFullYear() >= 2;

  const deshabilitadas = [
    ...(desde ? [{ before: desde }] : []),
    ...(hasta ? [{ after: hasta }] : []),
  ];

  // En ordenador sobra ancho: se enseñan DOS meses en horizontal para elegir
  // el finde que viene sin pasar de mes. En móvil no cabe y va uno vertical.
  // Con desplegables de año (nacimiento) tampoco: ahí se salta por año.
  const [pantallaAncha, setPantallaAncha] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const aplicar = () => setPantallaAncha(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);
  const meses = pantallaAncha && !conDesplegables ? 2 : 1;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm",
            "transition-colors hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {value ? formatearFechaEs(value) : placeholder}
            {required && !value ? <span className="sr-only"> (obligatorio)</span> : null}
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
        </button>
      </PopoverTrigger>

      {/* Ancho automático: el mes manda, no el ancho fijo del popover base. */}
      <PopoverContent
        align="start"
        className="w-auto rounded-2xl border-zinc-200/80 p-0 shadow-xl"
        style={
          {
            ...(colorMarca ? { ["--brand" as string]: colorMarca } : {}),
            ...(colorMarcaTexto ? { ["--brand-fg" as string]: colorMarcaTexto } : {}),
          } as React.CSSProperties
        }
      >
        <DayPicker
          mode="single"
          locale={es}
          weekStartsOn={1}
          selected={seleccionada}
          defaultMonth={mesInicial}
          disabled={deshabilitadas.length > 0 ? deshabilitadas : undefined}
          fromDate={desde}
          toDate={hasta}
          // Con rango largo (nacimientos) el desplegable de año evita
          // recorrer el calendario mes a mes. Con rango corto no aporta y
          // ensucia: bastan las flechas.
          // Los desplegables nativos de react-day-picker son `<select>` del
          // sistema: se sustituyen por los nuestros en `components.Caption`.
          month={mesVisible ?? mesInicial}
          onMonthChange={setMesVisible}
          onSelect={(dia) => {
            if (!dia) return;
            onChange(dateAIso(dia));
            setAbierto(false);
          }}
          numberOfMonths={meses}
          showOutsideDays
          className="p-3"
          classNames={{
            // Dos meses van uno al lado del otro; uno solo, en columna.
            months: meses > 1 ? "flex flex-row gap-5" : "flex flex-col",
            month: "space-y-3",
            caption: cn(
              "relative flex items-center pt-1 pb-1",
              // Con desplegables las flechas van a los extremos y los
              // selectores al centro; sin ellos, el mes centrado.
              conDesplegables ? "justify-between gap-2 px-1" : "justify-center",
            ),
            // Con desplegables, react-day-picker pinta ADEMÁS el mes y el año
            // en texto: salían duplicados bajo los selectores.
            caption_label: conDesplegables
              ? "hidden"
              : "text-sm font-semibold capitalize text-zinc-900",
            dropdown:
              "cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm font-medium capitalize text-zinc-900 outline-none focus:border-zinc-300",
            // El halo del foco automático al abrir marcaba el mes como si
            // estuviera seleccionado.
            caption_dropdowns: "flex items-center gap-1.5 [&_*]:ring-0",
            dropdown_month: "capitalize",
            vhidden: "sr-only",
            nav: "flex items-center",
            nav_button:
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-30",
            // Con dos meses las flechas van en los extremos del conjunto, no
            // sobre cada mes: react-day-picker las pinta una sola vez.
            nav_button_previous: conDesplegables ? "" : "absolute left-1",
            nav_button_next: conDesplegables ? "" : "absolute right-1",
            table: "w-full border-collapse",
            head_row: "flex",
            head_cell: "w-9 text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400",
            row: "mt-1 flex w-full",
            cell: "relative h-9 w-9 p-0 text-center text-sm",
            // Círculo completo: la clave de que no se vean picos en las esquinas.
            day: "inline-flex h-9 w-9 items-center justify-center rounded-full font-normal text-zinc-700 transition-colors hover:bg-zinc-100",
            // El color sale de Imagen de marca (`--brand`), con negro de
            // reserva: cada empresa ve su calendario con su color sin tocar nada.
            day_selected:
              "!bg-[var(--brand,#18181b)] !text-[var(--brand-fg,#fff)] font-semibold hover:!bg-[var(--brand,#18181b)]",
            day_today: "font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-200",
            day_outside: "text-zinc-300",
            // Los días no elegibles se apagan; tacharlos gritaba demasiado.
            day_disabled: "!text-zinc-300 hover:bg-transparent",
            day_hidden: "invisible",
          }}
          components={{
            IconLeft: () => <ChevronLeft className="h-4 w-4" />,
            IconRight: () => <ChevronRight className="h-4 w-4" />,
            // Cabecera con NUESTROS desplegables cuando el rango abarca años
            // (nacimiento). Los del calendario son `<select>` del sistema:
            // listas diminutas del navegador, incómodas de acertar.
            ...(conDesplegables
              ? {
                  Caption: ({ displayMonth }: { displayMonth: Date }) => (
                    <CabeceraMesAno
                      mes={displayMonth}
                      desde={desde}
                      hasta={hasta}
                      onCambio={setMesVisible}
                      colorMarca={colorMarca}
                      colorMarcaTexto={colorMarcaTexto}
                    />
                  ),
                }
              : {}),
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Nombres de los meses en español, para el desplegable propio. */
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Cabecera del calendario con mes y año en NUESTROS desplegables.
 *
 * Los que trae react-day-picker son `<select>` nativos: listas del sistema,
 * estrechas y difíciles de acertar cuando hay cien años que recorrer. Estos
 * son los mismos que el resto del formulario, con el color de la empresa.
 */
function CabeceraMesAno({
  mes,
  desde,
  hasta,
  onCambio,
  colorMarca,
  colorMarcaTexto,
}: {
  mes: Date;
  desde?: Date;
  hasta?: Date;
  onCambio: (d: Date) => void;
  colorMarca?: string | null;
  colorMarcaTexto?: string | null;
}) {
  const anoActual = mes.getFullYear();
  const anoMin = desde?.getFullYear() ?? anoActual - 100;
  const anoMax = hasta?.getFullYear() ?? anoActual;

  // Años del más reciente al más antiguo: en una fecha de nacimiento se busca
  // mucho más cerca de hoy que de hace un siglo.
  const anos = React.useMemo(() => {
    const lista: number[] = [];
    for (let a = anoMax; a >= anoMin; a--) lista.push(a);
    return lista;
  }, [anoMin, anoMax]);

  // Un mes fuera del rango no se ofrece (p. ej. los posteriores a hoy en el
  // año en curso: nadie ha nacido el mes que viene).
  const mesFueraDeRango = (i: number) => {
    const primero = new Date(anoActual, i, 1);
    const ultimo = new Date(anoActual, i + 1, 0);
    if (desde && ultimo < desde) return true;
    if (hasta && primero > hasta) return true;
    return false;
  };

  return (
    <div className="flex items-center gap-1.5 px-1 pb-1 pt-1">
      <SelectorOpcion
        value={String(mes.getMonth())}
        onChange={(v) => onCambio(new Date(anoActual, Number(v), 1))}
        aria-label="Mes"
        opciones={MESES.map((nombre, i) => ({
          value: String(i),
          label: nombre,
          disabled: mesFueraDeRango(i),
        }))}
        anchoPanel="w-44"
        colorMarca={colorMarca}
        colorMarcaTexto={colorMarcaTexto}
        className="h-9 flex-1"
      />
      <SelectorOpcion
        value={String(anoActual)}
        onChange={(v) => onCambio(new Date(Number(v), mes.getMonth(), 1))}
        aria-label="Año"
        opciones={anos.map((a) => ({ value: String(a), label: String(a) }))}
        anchoPanel="w-32"
        colorMarca={colorMarca}
        colorMarcaTexto={colorMarcaTexto}
        className="h-9 w-28 shrink-0"
      />
    </div>
  );
}
