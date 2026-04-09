import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, CalendarDays, List, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { CalendarioConfig } from "./CalendarioConfig";

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
  general: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  local: "bg-violet-500/10 text-violet-700 border-violet-500/20",
};

const DOT_COLORES: Record<string, string> = {
  aprobada: "bg-emerald-500",
  pendiente: "bg-amber-500",
  rechazada: "bg-destructive",
  activa: "bg-sky-500",
  finalizada: "bg-muted-foreground",
  general: "bg-amber-500",
  local: "bg-violet-500",
};

interface Props {
  modalidad: string;
  titulo: string;
  items: AusenciaItem[];
  botonNuevo: string;
  columnaExtra?: { header: string; render: (item: AusenciaItem) => React.ReactNode };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CalendarioAusencias({ modalidad, titulo, items, botonNuevo, columnaExtra }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<"calendario" | "lista">("calendario");
  const [showConfig, setShowConfig] = useState(false);
  const [mesActual, setMesActual] = useState(() => {
    const now = new Date();
    return { year: 2026, month: now.getMonth() <= 3 ? 3 : now.getMonth() };
  });

  const filtradas = useMemo(() =>
    items.filter(v => !busqueda || v.empleadoNombre.toLowerCase().includes(busqueda.toLowerCase())),
    [items, busqueda]
  );

  const cambiarMes = (dir: number) => {
    setMesActual(prev => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const daysInMonth = getDaysInMonth(mesActual.year, mesActual.month);
  const firstDay = getFirstDayOfMonth(mesActual.year, mesActual.month);
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

  const diasConEvento = useMemo(() => {
    const map = new Map<number, AusenciaItem[]>();
    filtradas.forEach(item => {
      const start = new Date(item.fechaInicio);
      const end = item.fechaFin ? new Date(item.fechaFin) : new Date(item.fechaInicio);
      const d = new Date(start);
      while (d <= end) {
        if (d.getFullYear() === mesActual.year && d.getMonth() === mesActual.month) {
          const day = d.getDate();
          if (!map.has(day)) map.set(day, []);
          map.get(day)!.push(item);
        }
        d.setDate(d.getDate() + 1);
      }
    });
    return map;
  }, [filtradas, mesActual]);

  if (showConfig) return <CalendarioConfig modalidad={modalidad} onBack={() => setShowConfig(false)} />;

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
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowConfig(true)}><Settings2 className="h-4 w-4" />Configuración</Button>
      </div>

      {vista === "calendario" ? (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cambiarMes(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-semibold">{meses[mesActual.month]} {mesActual.year}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cambiarMes(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
                <div key={d} className="bg-muted px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
              ))}
              {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-card min-h-[80px]" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const eventos = diasConEvento.get(day) || [];
                const isToday = mesActual.year === 2026 && mesActual.month === 3 && day === 6;
                return (
                  <div key={day} className={`bg-card min-h-[80px] p-1.5 ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}>
                    <span className={`text-[11px] font-medium ${isToday ? "text-primary font-bold" : "text-foreground"}`}>{day}</span>
                    <div className="mt-1 space-y-0.5">
                      {eventos.slice(0, 2).map((ev, idx) => (
                        <div key={idx} className={`flex items-center gap-1 rounded px-1 py-0.5 ${ESTADO_COLORES[ev.estado] || "bg-muted"}`}>
                          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${DOT_COLORES[ev.estado] || "bg-muted-foreground"}`} />
                          <span className="text-[9px] truncate">{ev.empleadoNombre.split(" ")[0]}</span>
                        </div>
                      ))}
                      {eventos.length > 2 && <span className="text-[9px] text-muted-foreground pl-1">+{eventos.length - 2} más</span>}
                    </div>
                  </div>
                );
              })}
            </div>
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
