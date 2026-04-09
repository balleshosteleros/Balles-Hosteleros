import { useMemo, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useMarketing } from "@/features/marketing/contexts/marketing-context";
import { ItemCalendario, REDES_SOCIALES, RedSocial, EstadoPublicacion, ESTADOS_PUBLICACION } from "@/features/marketing/data/marketing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, List, LayoutGrid } from "lucide-react";

const ALL = "__ALL__";

function getRedColor(red: RedSocial) {
  return REDES_SOCIALES.find((r) => r.id === red)?.color ?? "hsl(var(--muted))";
}

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

type Vista = "mensual" | "semanal" | "lista";

interface Props {
  onSelect: (item: ItemCalendario) => void;
  onNew: () => void;
}

export function CalendarioView({ onSelect, onNew }: Props) {
  const { empresaActual } = useEmpresa();
  const { getItems } = useMarketing();
  const items = getItems(empresaActual.id);

  const [vista, setVista] = useState<Vista>("mensual");
  const [mesOffset, setMesOffset] = useState(0);
  const [filtroRed, setFiltroRed] = useState(ALL);
  const [filtroEstado, setFiltroEstado] = useState(ALL);

  const hoy = new Date();
  const mesBase = new Date(hoy.getFullYear(), hoy.getMonth() + mesOffset, 1);
  const mesLabel = mesBase.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

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

  // Calendar grid for monthly view
  const diasMes = new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 0).getDate();
  const primerDia = new Date(mesBase.getFullYear(), mesBase.getMonth(), 1).getDay();
  const offset = primerDia === 0 ? 6 : primerDia - 1; // Monday start

  const semanaActual = useMemo(() => {
    const start = new Date(hoy);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const getItemsForDate = (dateStr: string) => filtrados.filter((it) => it.fecha === dateStr);

  const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const renderItem = (it: ItemCalendario, compact = false) => {
    const red = it.tipo === "publicacion" ? it.redSocial : it.redSocialRelacionada;
    const redInfo = REDES_SOCIALES.find((r) => r.id === red);
    return (
      <button
        key={it.id}
        onClick={() => onSelect(it)}
        className={`w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate border-l-2 hover:opacity-80 transition-opacity ${it.tipo === "evento" ? "bg-accent/50" : "bg-card"}`}
        style={{ borderLeftColor: redInfo?.color ?? "hsl(var(--muted))" }}
      >
        {!compact && redInfo && <span className="font-bold mr-1">{redInfo.icon}</span>}
        {it.titulo}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
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
          <Button size="sm" variant={vista === "mensual" ? "default" : "outline"} className="h-8 text-xs gap-1" onClick={() => setVista("mensual")}>
            <LayoutGrid className="h-3.5 w-3.5" /> Mes
          </Button>
          <Button size="sm" variant={vista === "semanal" ? "default" : "outline"} className="h-8 text-xs gap-1" onClick={() => setVista("semanal")}>
            <CalendarDays className="h-3.5 w-3.5" /> Semana
          </Button>
          <Button size="sm" variant={vista === "lista" ? "default" : "outline"} className="h-8 text-xs gap-1" onClick={() => setVista("lista")}>
            <List className="h-3.5 w-3.5" /> Lista
          </Button>
        </div>
      </div>

      {/* Monthly View */}
      {vista === "mensual" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMesOffset((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-sm font-semibold capitalize text-foreground">{mesLabel}</h3>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMesOffset((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div key={d} className="bg-muted/50 p-2 text-center text-[10px] font-bold text-muted-foreground uppercase">{d}</div>
            ))}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-card min-h-[80px] p-1" />
            ))}
            {Array.from({ length: diasMes }).map((_, i) => {
              const day = i + 1;
              const dateStr = formatDate(new Date(mesBase.getFullYear(), mesBase.getMonth(), day));
              const dayItems = getItemsForDate(dateStr);
              const isToday = dateStr === formatDate(hoy);
              return (
                <div key={day} className={`bg-card min-h-[80px] p-1 ${isToday ? "ring-2 ring-primary/30 ring-inset" : ""}`}>
                  <span className={`text-[11px] font-medium ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{day}</span>
                  <div className="space-y-0.5 mt-0.5">
                    {dayItems.slice(0, 3).map((it) => renderItem(it, true))}
                    {dayItems.length > 3 && <span className="text-[9px] text-muted-foreground">+{dayItems.length - 3} más</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly View */}
      {vista === "semanal" && (
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {semanaActual.map((d) => {
            const dateStr = formatDate(d);
            const dayItems = getItemsForDate(dateStr);
            const isToday = dateStr === formatDate(hoy);
            return (
              <div key={dateStr} className={`bg-card min-h-[200px] p-2 ${isToday ? "ring-2 ring-primary/30 ring-inset" : ""}`}>
                <div className="text-center mb-2">
                  <div className="text-[10px] text-muted-foreground uppercase">
                    {d.toLocaleDateString("es-ES", { weekday: "short" })}
                  </div>
                  <div className={`text-sm font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{d.getDate()}</div>
                </div>
                <div className="space-y-1">
                  {dayItems.map((it) => renderItem(it))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {vista === "lista" && (
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
