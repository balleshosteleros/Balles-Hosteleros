import { useMemo, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useMarketing } from "@/features/marketing/contexts/marketing-context";
import { ItemCalendario, REDES_SOCIALES, RedSocial, EstadoPublicacion, ESTADOS_PUBLICACION } from "@/features/marketing/data/marketing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, List } from "lucide-react";
import { CalendarRangeToggle, CalendarRangeNav } from "@/shared/components/calendar/CalendarRangeToggle";
import { useCalendarRange, type CalendarRangeMode } from "@/shared/components/calendar/calendar-range";
import { cn } from "@/lib/utils";

const ALL = "__ALL__";
const DIAS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_INI = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function getEstadoBadge(estado: EstadoPublicacion) {
  const map: Record<EstadoPublicacion, string> = {
    borrador: "bg-muted text-muted-foreground",
    programada: "bg-blue-100 text-blue-700",
    publicada: "bg-green-100 text-green-700",
    fallida: "bg-red-100 text-red-700",
    cancelada: "bg-muted text-muted-foreground line-through",
  };
  return map[estado] ?? "";
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function indexLunes(d: Date): number {
  return (d.getDay() + 6) % 7;
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

interface Props {
  onSelect: (item: ItemCalendario) => void;
  onNew: () => void;
}

export function CalendarioView({ onSelect, onNew }: Props) {
  const { empresaActual } = useEmpresa();
  const { getItems } = useMarketing();
  const items = getItems(empresaActual.id);

  const rango = useCalendarRange("MENSUAL");
  const [vistaLista, setVistaLista] = useState(false);
  const [filtroRed, setFiltroRed] = useState(ALL);
  const [filtroEstado, setFiltroEstado] = useState(ALL);

  const filtrados = useMemo(() => {
    return items.filter((it) => {
      if (filtroRed !== ALL) {
        const red = it.tipo === "publicacion" ? it.redSocial : it.redSocialRelacionada;
        if (red !== filtroRed) return false;
      }
      if (filtroEstado !== ALL && it.estado !== filtroEstado) return false;
      return true;
    });
  }, [items, filtroRed, filtroEstado]);

  const itemsPorFecha = useMemo(() => {
    const map = new Map<string, ItemCalendario[]>();
    for (const it of filtrados) {
      if (!map.has(it.fecha)) map.set(it.fecha, []);
      map.get(it.fecha)!.push(it);
    }
    return map;
  }, [filtrados]);

  const getItemsForDate = (dateStr: string) => itemsPorFecha.get(dateStr) ?? [];

  const renderItem = (it: ItemCalendario, compact = false) => {
    const red = it.tipo === "publicacion" ? it.redSocial : it.redSocialRelacionada;
    const redInfo = REDES_SOCIALES.find((r) => r.id === red);
    return (
      <button
        key={it.id}
        onClick={() => onSelect(it)}
        className={cn(
          "w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate border-l-2 hover:opacity-80 transition-opacity",
          it.tipo === "evento" ? "bg-accent/50" : "bg-card",
        )}
        style={{ borderLeftColor: redInfo?.color ?? "hsl(var(--muted))" }}
      >
        {!compact && redInfo && <span className="font-bold mr-1">{redInfo.icon}</span>}
        {it.titulo}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Select value={filtroRed} onValueChange={setFiltroRed}>
            <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Red social" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las redes</SelectItem>
              {REDES_SOCIALES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {ESTADOS_PUBLICACION.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant={!vistaLista ? "default" : "outline"} className="h-8 text-xs gap-1" onClick={() => setVistaLista(false)}>
            <CalendarDays className="h-3.5 w-3.5" /> Calendario
          </Button>
          <Button size="sm" variant={vistaLista ? "default" : "outline"} className="h-8 text-xs gap-1" onClick={() => setVistaLista(true)}>
            <List className="h-3.5 w-3.5" /> Lista
          </Button>
        </div>
      </div>

      {!vistaLista && (
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
      )}

      {!vistaLista && rango.mode === "DIARIO" && (
        <VistaDiaria anchor={rango.anchor} items={getItemsForDate(formatDate(rango.anchor))} onSelect={onSelect} />
      )}

      {!vistaLista && rango.mode === "SEMANAL" && (
        <VistaSemanal inicio={rango.range.start} getItemsForDate={getItemsForDate} renderItem={renderItem} />
      )}

      {!vistaLista && rango.mode === "MENSUAL" && (
        <MesGrande year={rango.anchor.getFullYear()} month={rango.anchor.getMonth()} getItemsForDate={getItemsForDate} renderItem={renderItem} />
      )}

      {!vistaLista && (rango.mode === "TRIMESTRAL" || rango.mode === "SEMESTRAL" || rango.mode === "ANUAL") && (
        <div className={cn(
          "grid gap-3",
          rango.mode === "TRIMESTRAL" && "grid-cols-1 md:grid-cols-3",
          rango.mode === "SEMESTRAL" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          rango.mode === "ANUAL" && "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
        )}>
          {rangeMonths(rango.mode, rango.anchor).map(({ year, month }) => (
            <MesMini key={`${year}-${month}`} year={year} month={month} getItemsForDate={getItemsForDate} />
          ))}
        </div>
      )}

      {vistaLista && (
        <div className="space-y-2">
          {filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay elementos que mostrar.</p>
          ) : (
            filtrados
              .sort((a, b) => a.fecha.localeCompare(b.fecha))
              .map((it) => {
                const red = it.tipo === "publicacion" ? it.redSocial : it.redSocialRelacionada;
                const redInfo = REDES_SOCIALES.find((r) => r.id === red);
                return (
                  <button
                    key={it.id}
                    onClick={() => onSelect(it)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors text-left"
                  >
                    <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: redInfo?.color ?? "hsl(var(--muted))" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">{it.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.fecha} · {it.hora}
                        {it.tipo === "evento" && " · Evento"}
                        {redInfo && ` · ${redInfo.label}`}
                      </p>
                    </div>
                    <Badge className={`text-[10px] shrink-0 ${getEstadoBadge(it.estado)}`}>{ESTADOS_PUBLICACION.find((e) => e.value === it.estado)?.label}</Badge>
                  </button>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}

function VistaDiaria({
  anchor,
  items,
  onSelect,
}: {
  anchor: Date;
  items: ItemCalendario[];
  onSelect: (it: ItemCalendario) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b text-sm font-semibold capitalize">
        {anchor.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
      <div className="p-3 space-y-2">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Sin publicaciones para este día.</div>
        ) : items.map((it) => {
          const red = it.tipo === "publicacion" ? it.redSocial : it.redSocialRelacionada;
          const redInfo = REDES_SOCIALES.find((r) => r.id === red);
          return (
            <button
              key={it.id}
              onClick={() => onSelect(it)}
              className="w-full flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-accent/30 transition-colors text-left"
            >
              <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: redInfo?.color ?? "hsl(var(--muted))" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">{it.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {it.hora}
                  {it.tipo === "evento" && " · Evento"}
                  {redInfo && ` · ${redInfo.label}`}
                </p>
              </div>
              <Badge className={`text-[10px] shrink-0 ${getEstadoBadge(it.estado)}`}>
                {ESTADOS_PUBLICACION.find((e) => e.value === it.estado)?.label}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VistaSemanal({
  inicio,
  getItemsForDate,
  renderItem,
}: {
  inicio: Date;
  getItemsForDate: (dateStr: string) => ItemCalendario[];
  renderItem: (it: ItemCalendario, compact?: boolean) => React.ReactNode;
}) {
  const hoy = new Date();
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
  return (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
      {dias.map((d) => {
        const dateStr = formatDate(d);
        const dayItems = getItemsForDate(dateStr);
        const isToday = dateStr === formatDate(hoy);
        return (
          <div key={dateStr} className={cn("bg-card min-h-[200px] p-2", isToday && "ring-2 ring-primary/30 ring-inset")}>
            <div className="text-center mb-2">
              <div className="text-[10px] text-muted-foreground uppercase">
                {d.toLocaleDateString("es-ES", { weekday: "short" })}
              </div>
              <div className={cn("text-sm font-bold", isToday ? "text-primary" : "text-foreground")}>{d.getDate()}</div>
            </div>
            <div className="space-y-1">
              {dayItems.map((it) => renderItem(it))}
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
  getItemsForDate,
  renderItem,
}: {
  year: number;
  month: number;
  getItemsForDate: (dateStr: string) => ItemCalendario[];
  renderItem: (it: ItemCalendario, compact?: boolean) => React.ReactNode;
}) {
  const diasMes = new Date(year, month + 1, 0).getDate();
  const offset = indexLunes(new Date(year, month, 1));
  const hoy = new Date();

  return (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
      {DIAS_SHORT.map((d) => (
        <div key={d} className="bg-muted/50 p-2 text-center text-[10px] font-bold text-muted-foreground uppercase">{d}</div>
      ))}
      {Array.from({ length: offset }).map((_, i) => (
        <div key={`empty-${i}`} className="bg-card min-h-[80px] p-1" />
      ))}
      {Array.from({ length: diasMes }).map((_, i) => {
        const day = i + 1;
        const dateStr = formatDate(new Date(year, month, day));
        const dayItems = getItemsForDate(dateStr);
        const isToday = dateStr === formatDate(hoy);
        return (
          <div key={day} className={cn("bg-card min-h-[80px] p-1", isToday && "ring-2 ring-primary/30 ring-inset")}>
            <span className={cn("text-[11px] font-medium", isToday ? "text-primary font-bold" : "text-muted-foreground")}>{day}</span>
            <div className="space-y-0.5 mt-0.5">
              {dayItems.slice(0, 3).map((it) => renderItem(it, true))}
              {dayItems.length > 3 && <span className="text-[9px] text-muted-foreground">+{dayItems.length - 3} más</span>}
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
  getItemsForDate,
}: {
  year: number;
  month: number;
  getItemsForDate: (dateStr: string) => ItemCalendario[];
}) {
  const diasMes = new Date(year, month + 1, 0).getDate();
  const offset = indexLunes(new Date(year, month, 1));
  const hoy = new Date();
  const counts = Array.from({ length: diasMes }, (_, i) => {
    const dateStr = formatDate(new Date(year, month, i + 1));
    return getItemsForDate(dateStr).length;
  });
  const max = Math.max(1, ...counts);

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
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`e-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: diasMes }).map((_, i) => {
          const day = i + 1;
          const dateStr = formatDate(new Date(year, month, day));
          const items = getItemsForDate(dateStr);
          const count = items.length;
          const isToday = formatDate(hoy) === dateStr;
          const intensity = Math.min(1, count / max);
          return (
            <div
              key={day}
              title={count > 0 ? `${count} publicación${count === 1 ? "" : "es"}` : undefined}
              className={cn(
                "relative aspect-square flex items-center justify-center text-[9px] rounded",
                isToday && "ring-1 ring-primary text-primary font-bold",
              )}
              style={count > 0 ? { background: `rgba(59, 130, 246, ${0.15 + intensity * 0.55})` } : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
