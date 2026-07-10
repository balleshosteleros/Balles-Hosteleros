import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Plus, CalendarDays, List, AlertCircle, Info } from "lucide-react";
import { ConfigButton } from "@/shared/components/config-button";
import { CalendarioConfig } from "./CalendarioConfig";
import { useFestivos, type FestivoInfo } from "@/features/rrhh/hooks/useFestivos";
import { CalendarRangeToggle, CalendarRangeNav } from "@/shared/components/calendar/CalendarRangeToggle";
import { useCalendarRange, type CalendarRangeMode } from "@/shared/components/calendar/calendar-range";
import { cn } from "@/lib/utils";

interface AusenciaItem {
  id: string;
  empleadoNombre: string;
  departamento: string;
  fechaInicio: string;
  fechaFin?: string;
  estado: string;
  detalle?: string;
  tipo?: string;
}

const ESTADO_COLORES: Record<string, string> = {
  aprobada: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  pendiente: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  rechazada: "bg-destructive/10 text-destructive border-destructive/20",
  activa: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  finalizada: "bg-muted text-muted-foreground border-border",
  nacional: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  autonomico: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  local: "bg-violet-500/10 text-violet-700 border-violet-500/20",
};

const DOT_COLORES: Record<string, string> = {
  aprobada: "bg-emerald-500",
  pendiente: "bg-amber-500",
  rechazada: "bg-destructive",
  activa: "bg-sky-500",
  finalizada: "bg-muted-foreground",
  nacional: "bg-rose-500",
  autonomico: "bg-amber-500",
  local: "bg-violet-500",
};

const TIPO_FESTIVO_LABEL: Record<string, string> = {
  nacional: "Nacional",
  autonomico: "Autonómico",
  local: "Local",
};

const DIAS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_INI = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

interface Props {
  modalidad: string;
  titulo: string;
  items: AusenciaItem[];
  botonNuevo: string;
  columnaExtra?: { header: string; render: (item: AusenciaItem) => React.ReactNode };
  empresaId?: string;
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayMon(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function rangeMonths(mode: CalendarRangeMode, anchor: Date): { year: number; month: number }[] {
  if (mode === "TRIMESTRAL") {
    const q = Math.floor(anchor.getMonth() / 3) * 3;
    return Array.from({ length: 3 }, (_, i) => ({ year: anchor.getFullYear(), month: q + i }));
  }
  if (mode === "SEMESTRAL") {
    const s = anchor.getMonth() < 6 ? 0 : 6;
    return Array.from({ length: 6 }, (_, i) => ({ year: anchor.getFullYear(), month: s + i }));
  }
  if (mode === "ANUAL") {
    return Array.from({ length: 12 }, (_, i) => ({ year: anchor.getFullYear(), month: i }));
  }
  return [{ year: anchor.getFullYear(), month: anchor.getMonth() }];
}

export function CalendarioAusencias({ modalidad, items, botonNuevo, columnaExtra }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<"calendario" | "lista">("calendario");
  const [showConfig, setShowConfig] = useState(false);
  const rango = useCalendarRange("MENSUAL");
  const { festivoEnFecha } = useFestivos(rango.anchor.getFullYear());

  const filtradas = useMemo(() =>
    items.filter(v => !busqueda || v.empleadoNombre.toLowerCase().includes(busqueda.toLowerCase())),
    [items, busqueda]
  );

  const eventosPorFecha = useMemo(() => {
    const map = new Map<string, AusenciaItem[]>();
    filtradas.forEach(item => {
      const start = new Date(item.fechaInicio);
      const end = item.fechaFin ? new Date(item.fechaFin) : new Date(item.fechaInicio);
      const d = new Date(start);
      while (d <= end) {
        const key = toISO(d.getFullYear(), d.getMonth(), d.getDate());
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
        d.setDate(d.getDate() + 1);
      }
    });
    return map;
  }, [filtradas]);

  if (showConfig) return <CalendarioConfig modalidad={modalidad} onBack={() => setShowConfig(false)} />;

  const meses = rangeMonths(rango.mode, rango.anchor);
  const esMultiMes = rango.mode === "TRIMESTRAL" || rango.mode === "SEMESTRAL" || rango.mode === "ANUAL";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empleado..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
          <Button variant={vista === "calendario" ? "secondary" : "ghost"} size="sm" className="gap-1 h-8" onClick={() => setVista("calendario")}>
            <CalendarDays className="h-3.5 w-3.5" />Calendario
          </Button>
          <Button variant={vista === "lista" ? "secondary" : "ghost"} size="sm" className="gap-1 h-8" onClick={() => setVista("lista")}>
            <List className="h-3.5 w-3.5" />Lista
          </Button>
        </div>
        <Button size="sm" className="gap-1"><Plus className="h-4 w-4" />{botonNuevo}</Button>
        <ConfigButton onClick={() => setShowConfig(true)} className="ml-auto" />
      </div>

      {vista === "calendario" ? (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CalendarRangeToggle mode={rango.mode} onChange={rango.setMode} />
              <CalendarRangeNav
                label={rango.label}
                onPrev={rango.prev}
                onNext={rango.next}
                onToday={rango.goToToday}
                isToday={rango.isToday}
                minWidth={180}
              />
            </div>

            {rango.mode === "DIARIO" && (
              <VistaDiaria
                anchor={rango.anchor}
                eventosPorFecha={eventosPorFecha}
                festivoEnFecha={festivoEnFecha}
              />
            )}

            {rango.mode === "SEMANAL" && (
              <VistaSemanal
                anchor={rango.anchor}
                eventosPorFecha={eventosPorFecha}
                festivoEnFecha={festivoEnFecha}
              />
            )}

            {rango.mode === "MENSUAL" && (
              <MesGrande
                year={meses[0].year}
                month={meses[0].month}
                eventosPorFecha={eventosPorFecha}
                festivoEnFecha={festivoEnFecha}
              />
            )}

            {esMultiMes && (
              <div className={cn(
                "grid gap-3",
                rango.mode === "TRIMESTRAL" && "grid-cols-1 md:grid-cols-3",
                rango.mode === "SEMESTRAL" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                rango.mode === "ANUAL" && "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
              )}>
                {meses.map(({ year, month }) => (
                  <MesMini
                    key={`${year}-${month}`}
                    year={year}
                    month={month}
                    eventosPorFecha={eventosPorFecha}
                    festivoEnFecha={festivoEnFecha}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Hasta</TableHead>
                {columnaExtra && <TableHead>{columnaExtra.header}</TableHead>}
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium text-sm">{v.empleadoNombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{v.departamento}</TableCell>
                  <TableCell className="text-sm">{v.fechaInicio}</TableCell>
                  <TableCell className="text-sm">{v.fechaFin || "—"}</TableCell>
                  {columnaExtra && <TableCell className="text-sm">{columnaExtra.render(v)}</TableCell>}
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${ESTADO_COLORES[v.estado] ?? ""}`}>
                      {v.estado.charAt(0).toUpperCase() + v.estado.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtradas.length === 0 && (
                <TableRow><TableCell colSpan={columnaExtra ? 6 : 5} className="text-center py-8 text-muted-foreground">Sin registros</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function FestivoMarker({ festivoEnFecha, fechaISO, compact }: { festivoEnFecha: (f: string) => FestivoInfo | null; fechaISO: string; compact?: boolean }) {
  const festivoInfo = festivoEnFecha(fechaISO);
  if (!festivoInfo) return null;
  if (compact) {
    return (
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-1.5 w-1.5 rounded-full",
          festivoInfo.tipo === "festivo" ? "bg-rose-500" : "bg-sky-500",
        )}
        title={festivoInfo.festivo.nombre}
      />
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "absolute top-1 right-1 h-4 w-4 rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform",
            festivoInfo.tipo === "festivo" ? "bg-rose-500 text-white" : "bg-sky-500 text-white",
          )}
          aria-label={festivoInfo.tipo === "festivo" ? "Festivo" : "Víspera de festivo"}
        >
          {festivoInfo.tipo === "festivo" ? <AlertCircle className="h-3 w-3" /> : <Info className="h-3 w-3" />}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 p-3 text-xs">
        <div className="flex items-center gap-2 font-semibold">
          {festivoInfo.tipo === "festivo"
            ? <><AlertCircle className="h-3.5 w-3.5 text-rose-500" /> Festivo</>
            : <><Info className="h-3.5 w-3.5 text-sky-500" /> Víspera de festivo</>}
        </div>
        <div className="mt-2 space-y-1">
          <div className="text-foreground font-medium">{festivoInfo.festivo.nombre}</div>
          <div className="text-muted-foreground">{festivoInfo.festivo.fecha}</div>
          <div className="flex items-center gap-1.5 pt-1">
            <Badge variant="outline" className={`text-[10px] ${ESTADO_COLORES[festivoInfo.festivo.tipo] ?? ""}`}>
              {TIPO_FESTIVO_LABEL[festivoInfo.festivo.tipo] ?? festivoInfo.festivo.tipo}
            </Badge>
            {festivoInfo.festivo.region && (
              <Badge variant="outline" className="text-[10px]">{festivoInfo.festivo.region}</Badge>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function VistaDiaria({
  anchor,
  eventosPorFecha,
}: {
  anchor: Date;
  eventosPorFecha: Map<string, AusenciaItem[]>;
  festivoEnFecha: (f: string) => FestivoInfo | null;
}) {
  const fechaISO = toISO(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const eventos = eventosPorFecha.get(fechaISO) ?? [];
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b">
        <div className="text-sm font-semibold capitalize">
          {anchor.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>
      <div className="p-4 space-y-2">
        {eventos.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">Sin registros para este día.</div>
        ) : eventos.map((ev) => (
          <div key={ev.id} className={cn("flex items-center gap-2 rounded-md border px-3 py-2", ESTADO_COLORES[ev.estado])}>
            <div className={cn("h-2 w-2 rounded-full", DOT_COLORES[ev.estado])} />
            <div className="text-sm font-medium">{ev.empleadoNombre}</div>
            <div className="text-xs text-muted-foreground ml-auto">{ev.departamento}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VistaSemanal({
  anchor,
  eventosPorFecha,
  festivoEnFecha,
}: {
  anchor: Date;
  eventosPorFecha: Map<string, AusenciaItem[]>;
  festivoEnFecha: (f: string) => FestivoInfo | null;
}) {
  const iso = (anchor.getDay() + 6) % 7;
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - iso);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const hoy = new Date();

  return (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
      {DIAS_SHORT.map(d => (
        <div key={d} className="bg-muted px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
      ))}
      {dias.map((d, idx) => {
        const fechaISO = toISO(d.getFullYear(), d.getMonth(), d.getDate());
        const eventos = eventosPorFecha.get(fechaISO) ?? [];
        const isToday = d.toDateString() === hoy.toDateString();
        return (
          <div key={idx} className={cn("relative bg-card min-h-[140px] p-1.5", isToday && "ring-2 ring-primary ring-inset")}>
            <span className={cn("text-[11px] font-medium", isToday ? "text-primary font-bold" : "text-foreground")}>
              {d.getDate()} {DIAS_INI[idx]}
            </span>
            <FestivoMarker festivoEnFecha={festivoEnFecha} fechaISO={fechaISO} />
            <div className="mt-1 space-y-0.5">
              {eventos.slice(0, 4).map((ev, i) => (
                <div key={i} className={cn("flex items-center gap-1 rounded px-1 py-0.5", ESTADO_COLORES[ev.estado] || "bg-muted")}>
                  <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_COLORES[ev.estado] || "bg-muted-foreground")} />
                  <span className="text-[10px] truncate">{ev.empleadoNombre.split(" ")[0]}</span>
                </div>
              ))}
              {eventos.length > 4 && <span className="text-[9px] text-muted-foreground pl-1">+{eventos.length - 4} más</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MesGrande({
  year,
  month,
  eventosPorFecha,
  festivoEnFecha,
}: {
  year: number;
  month: number;
  eventosPorFecha: Map<string, AusenciaItem[]>;
  festivoEnFecha: (f: string) => FestivoInfo | null;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayMon(year, month);
  const hoy = new Date();

  return (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
      {DIAS_SHORT.map(d => (
        <div key={d} className="bg-muted px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
      ))}
      {Array.from({ length: firstDay }).map((_, i) => (
        <div key={`empty-${i}`} className="bg-card min-h-[80px]" />
      ))}
      {Array.from({ length: daysInMonth }).map((_, i) => {
        const day = i + 1;
        const fechaISO = toISO(year, month, day);
        const eventos = eventosPorFecha.get(fechaISO) ?? [];
        const isToday = hoy.getFullYear() === year && hoy.getMonth() === month && hoy.getDate() === day;
        return (
          <div key={day} className={cn("relative bg-card min-h-[80px] p-1.5", isToday && "ring-2 ring-primary ring-inset")}>
            <span className={cn("text-[11px] font-medium", isToday ? "text-primary font-bold" : "text-foreground")}>{day}</span>
            <FestivoMarker festivoEnFecha={festivoEnFecha} fechaISO={fechaISO} />
            <div className="mt-1 space-y-0.5">
              {eventos.slice(0, 2).map((ev, idx) => (
                <div key={idx} className={cn("flex items-center gap-1 rounded px-1 py-0.5", ESTADO_COLORES[ev.estado] || "bg-muted")}>
                  <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_COLORES[ev.estado] || "bg-muted-foreground")} />
                  <span className="text-[9px] truncate">{ev.empleadoNombre.split(" ")[0]}</span>
                </div>
              ))}
              {eventos.length > 2 && <span className="text-[9px] text-muted-foreground pl-1">+{eventos.length - 2} más</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MesMini({
  year,
  month,
  eventosPorFecha,
  festivoEnFecha,
}: {
  year: number;
  month: number;
  eventosPorFecha: Map<string, AusenciaItem[]>;
  festivoEnFecha: (f: string) => FestivoInfo | null;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayMon(year, month);
  const hoy = new Date();

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-2.5 py-1.5 bg-muted/30 border-b text-center text-[11px] font-semibold uppercase tracking-wider">
        {MESES[month]} <span className="text-muted-foreground">{year}</span>
      </div>
      <div className="grid grid-cols-7 text-[9px] text-muted-foreground bg-muted/10">
        {DIAS_INI.map((d, i) => (
          <div key={i} className="px-1 py-0.5 text-center font-semibold">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 p-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`e-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const fechaISO = toISO(year, month, day);
          const eventos = eventosPorFecha.get(fechaISO) ?? [];
          const count = eventos.length;
          const isToday = hoy.getFullYear() === year && hoy.getMonth() === month && hoy.getDate() === day;
          const dominante = eventos[0]?.estado;
          return (
            <div
              key={day}
              title={count > 0 ? `${count} registro${count === 1 ? "" : "s"}` : undefined}
              className={cn(
                "relative aspect-square flex items-center justify-center text-[9px] rounded",
                isToday && "bg-primary/10 text-primary font-bold",
                !isToday && "text-foreground/70",
              )}
            >
              {day}
              <FestivoMarker festivoEnFecha={festivoEnFecha} fechaISO={fechaISO} compact />
              {count > 0 && dominante && (
                <span className={cn("absolute bottom-0.5 h-1 w-1 rounded-full", DOT_COLORES[dominante] || "bg-muted-foreground")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
