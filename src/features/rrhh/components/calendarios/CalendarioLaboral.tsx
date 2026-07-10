import { useState, useMemo, useEffect } from "react";
import { getTurnosPorEmpresa } from "@/features/rrhh/data/calendarios";
import { useFestivos, type FestivoInfo } from "@/features/rrhh/hooks/useFestivos";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getEmpleadosActivos, type EmpleadoActivo } from "@/features/rrhh/actions/empleados-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, Clock, Search, AlertCircle, Info, CalendarDays, List } from "lucide-react";
import { ConfigButton } from "@/shared/components/config-button";
import { CalendarioConfig } from "./CalendarioConfig";
import { CalendarRangeToggle, CalendarRangeNav } from "@/shared/components/calendar/CalendarRangeToggle";
import { useCalendarRange, type CalendarRangeMode } from "@/shared/components/calendar/calendar-range";
import { cn } from "@/lib/utils";

const HORAS = Array.from({ length: 24 }, (_, i) => i);
const DIAS_INI = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function parseHora(h: string): number {
  const [hh] = h.split(":").map(Number);
  return hh;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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

export function CalendarioLaboral({ empresaId }: { empresaId: string }) {
  const { empresaActual } = useEmpresa();
  const turnos = getTurnosPorEmpresa(empresaId);
  // OLA2-01: empleados reales (fuente única). Turnos y festivos siguen siendo
  // mock (indexados por slug) hasta OLA2-05, por eso conservamos el prop
  // empresaId para ellos y usamos empresaActual.dbId (uuid) para los empleados.
  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  useEffect(() => {
    let alive = true;
    getEmpleadosActivos(empresaActual.dbId).then((r) => {
      if (alive) setEmpleados(r.ok ? r.data : []);
    });
    return () => {
      alive = false;
    };
  }, [empresaActual.dbId]);
  const rango = useCalendarRange("MENSUAL");
  const { festivoEnFecha } = useFestivos(rango.anchor.getFullYear());
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<"calendario" | "lista">("calendario");
  const [filtroDpto, setFiltroDpto] = useState("todos");
  const [filtroVista, setFiltroVista] = useState("todos");
  const [showConfig, setShowConfig] = useState(false);

  const dptos = useMemo(() => [...new Set(empleados.map(e => e.departamento).filter((d): d is string => !!d))].sort(), [empleados]);

  const fechaISO = toISODate(rango.anchor);
  const turnosDia = useMemo(() => turnos.filter(t => t.fecha === fechaISO), [turnos, fechaISO]);
  const empleadosConTurno = new Set(turnosDia.map(t => t.empleadoId));

  const turnosPorFecha = useMemo(() => {
    const map = new Map<string, typeof turnos>();
    for (const t of turnos) {
      if (!map.has(t.fecha)) map.set(t.fecha, []);
      map.get(t.fecha)!.push(t);
    }
    return map;
  }, [turnos]);

  const empleadosFiltrados = useMemo(() => {
    return empleados.filter(e => {
      if (busqueda && !`${e.nombre} ${e.apellidos}`.toLowerCase().includes(busqueda.toLowerCase())) return false;
      if (filtroDpto !== "todos" && e.departamento !== filtroDpto) return false;
      if (filtroVista === "con_horario" && !empleadosConTurno.has(e.empleadoId)) return false;
      if (filtroVista === "sin_horario" && empleadosConTurno.has(e.empleadoId)) return false;
      return true;
    });
  }, [empleados, busqueda, filtroDpto, filtroVista, empleadosConTurno]);

  if (showConfig) return <CalendarioConfig modalidad="laboral" onBack={() => setShowConfig(false)} />;

  const festivoInfo = festivoEnFecha(fechaISO);
  const turnosFiltrados = turnos.filter(t =>
    !busqueda || t.empleadoNombre.toLowerCase().includes(busqueda.toLowerCase())
  );

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
        <Button size="sm" className="gap-1"><Plus className="h-4 w-4" />Registrar turno</Button>
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
              <>
                <div className="flex flex-wrap items-center gap-3">
                  {festivoInfo && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "h-7 px-2.5 rounded-full flex items-center gap-1 text-[11px] font-semibold shadow-sm",
                            festivoInfo.tipo === "festivo" ? "bg-rose-500 text-white" : "bg-sky-500 text-white",
                          )}
                        >
                          {festivoInfo.tipo === "festivo" ? <AlertCircle className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                          {festivoInfo.tipo === "festivo" ? "Festivo" : "Víspera"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" className="w-64 p-3 text-xs">
                        <div className="font-semibold">{festivoInfo.festivo.nombre}</div>
                        <div className="text-muted-foreground mt-1">{festivoInfo.festivo.fecha}</div>
                        {festivoInfo.festivo.region && (
                          <div className="text-[10px] text-muted-foreground mt-1">{festivoInfo.festivo.region}</div>
                        )}
                      </PopoverContent>
                    </Popover>
                  )}
                  <Select value={filtroDpto} onValueChange={setFiltroDpto}>
                    <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los dptos.</SelectItem>
                      {dptos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filtroVista} onValueChange={setFiltroVista}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="con_horario">Con horario</SelectItem>
                      <SelectItem value="sin_horario">Sin horario</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border bg-card overflow-x-auto">
                  <div className="min-w-[1200px]">
                    <div className="flex border-b sticky top-0 bg-card z-10">
                      <div className="w-[200px] shrink-0 px-4 py-2 text-xs font-semibold text-muted-foreground border-r flex items-center gap-1">
                        <Users className="h-3 w-3" /> Empleado
                      </div>
                      <div className="flex-1 flex">
                        {HORAS.map(h => (
                          <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground py-2 border-r last:border-r-0">
                            {String(h).padStart(2, "0")}
                          </div>
                        ))}
                      </div>
                    </div>
                    {empleadosFiltrados.map(emp => {
                      const turnosEmp = turnosDia.filter(t => t.empleadoId === emp.empleadoId);
                      return (
                        <div key={emp.empleadoId} className="flex border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                          <div className="w-[200px] shrink-0 px-4 py-3 border-r">
                            <p className="text-sm font-medium truncate">{emp.nombre} {emp.apellidos}</p>
                            <p className="text-[10px] text-muted-foreground">{emp.departamento}</p>
                          </div>
                          <div className="flex-1 relative" style={{ height: 52 }}>
                            {turnosEmp.map(t => {
                              const inicio = parseHora(t.horaInicio);
                              let fin = parseHora(t.horaFin);
                              if (fin <= inicio) fin = 24;
                              const left = `${(inicio / 24) * 100}%`;
                              const width = `${((fin - inicio) / 24) * 100}%`;
                              return (
                                <div
                                  key={t.id}
                                  className={cn(
                                    "absolute top-2 h-8 rounded-md flex items-center justify-center text-[10px] font-semibold text-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity",
                                    t.color,
                                  )}
                                  style={{ left, width, minWidth: 30 }}
                                  title={`${t.horaInicio} - ${t.horaFin} (${t.horasPrevistas}h)`}
                                >
                                  {t.horaInicio}-{t.horaFin}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {empleadosFiltrados.length === 0 && (
                      <div className="py-12 text-center text-muted-foreground text-sm">Sin empleados para los filtros seleccionados</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> Total turnos hoy: <span className="font-semibold text-foreground">{turnosDia.length}</span></div>
                  <div className="flex items-center gap-1"><Users className="h-3 w-3" /> Empleados con turno: <span className="font-semibold text-foreground">{empleadosConTurno.size}</span></div>
                  <div className="flex items-center gap-1">Horas previstas: <span className="font-semibold text-foreground">{turnosDia.reduce((s, t) => s + t.horasPrevistas, 0)}h</span></div>
                </div>
              </>
            )}

            {rango.mode === "SEMANAL" && (
              <SemanaTurnos
                inicio={rango.range.start}
                turnosPorFecha={turnosPorFecha}
                festivoEnFecha={festivoEnFecha}
              />
            )}

            {rango.mode === "MENSUAL" && (
              <MesGrande
                year={rango.anchor.getFullYear()}
                month={rango.anchor.getMonth()}
                turnosPorFecha={turnosPorFecha}
                festivoEnFecha={festivoEnFecha}
                onDayClick={(d) => {
                  rango.setAnchor(d);
                  rango.setMode("DIARIO");
                }}
              />
            )}

            {(rango.mode === "TRIMESTRAL" || rango.mode === "SEMESTRAL" || rango.mode === "ANUAL") && (
              <div className={cn(
                "grid gap-3",
                rango.mode === "TRIMESTRAL" && "grid-cols-1 md:grid-cols-3",
                rango.mode === "SEMESTRAL" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                rango.mode === "ANUAL" && "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
              )}>
                {rangeMonths(rango.mode, rango.anchor).map(({ year, month }) => (
                  <MesMini key={`${year}-${month}`} year={year} month={month} turnosPorFecha={turnosPorFecha} festivoEnFecha={festivoEnFecha} />
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
                <TableHead>Fecha</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {turnosFiltrados.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-sm">{t.empleadoNombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.departamento}</TableCell>
                  <TableCell className="text-sm">{t.fecha}</TableCell>
                  <TableCell className="text-sm">{t.horaInicio}</TableCell>
                  <TableCell className="text-sm">{t.horaFin}</TableCell>
                  <TableCell className="text-sm">{t.horasPrevistas}h</TableCell>
                </TableRow>
              ))}
              {turnosFiltrados.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin registros</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function SemanaTurnos({
  inicio,
  turnosPorFecha,
  festivoEnFecha,
}: {
  inicio: Date;
  turnosPorFecha: Map<string, ReturnType<typeof getTurnosPorEmpresa>>;
  festivoEnFecha: (fechaISO: string) => FestivoInfo | null;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
  const hoy = new Date();

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="grid grid-cols-7 divide-x border-b">
        {dias.map((d, idx) => {
          const fechaISO = toISODate(d);
          const turnos = turnosPorFecha.get(fechaISO) ?? [];
          const festivoInfo = festivoEnFecha(fechaISO);
          const isToday = d.toDateString() === hoy.toDateString();
          return (
            <div key={idx} className={cn("flex flex-col min-h-[300px]", isToday && "bg-primary/[0.04]")}>
              <div className="px-2 py-2 text-center border-b bg-muted/20">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{DIAS_SHORT[idx]}</div>
                <div className={cn("text-sm font-bold mt-0.5", isToday && "text-primary")}>{d.getDate()}</div>
                {festivoInfo && (
                  <span className={cn(
                    "inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase",
                    festivoInfo.tipo === "festivo" ? "bg-rose-500 text-white" : "bg-sky-500 text-white",
                  )}>
                    {festivoInfo.tipo === "festivo" ? "Festivo" : "Víspera"}
                  </span>
                )}
              </div>
              <div className="flex-1 p-1.5 space-y-1">
                {turnos.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/40 text-center py-4">—</div>
                ) : (
                  turnos.slice(0, 8).map((t) => (
                    <div
                      key={t.id}
                      className={cn("rounded px-1.5 py-1 text-[10px] font-medium text-white truncate", t.color)}
                      title={`${t.horaInicio}–${t.horaFin}`}
                    >
                      {t.horaInicio}–{t.horaFin}
                    </div>
                  ))
                )}
                {turnos.length > 8 && (
                  <div className="text-[9px] text-muted-foreground text-center">+{turnos.length - 8} más</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MesGrande({
  year,
  month,
  turnosPorFecha,
  festivoEnFecha,
  onDayClick,
}: {
  year: number;
  month: number;
  turnosPorFecha: Map<string, ReturnType<typeof getTurnosPorEmpresa>>;
  festivoEnFecha: (fechaISO: string) => FestivoInfo | null;
  onDayClick?: (d: Date) => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = indexLunes(new Date(year, month, 1));
  const hoy = new Date();
  const max = Math.max(1, ...Array.from(turnosPorFecha.values()).map((arr) => arr.length));

  return (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
      {DIAS_SHORT.map(d => (
        <div key={d} className="bg-muted px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
      ))}
      {Array.from({ length: firstDay }).map((_, i) => (
        <div key={`e-${i}`} className="bg-card min-h-[80px]" />
      ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const fechaISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const turnos = turnosPorFecha.get(fechaISO) ?? [];
          const isToday = hoy.getFullYear() === year && hoy.getMonth() === month && hoy.getDate() === day;
          const festivoInfo = festivoEnFecha(fechaISO);
          const intensity = Math.min(1, turnos.length / max);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick?.(new Date(year, month, day))}
              className={cn(
                "relative bg-card min-h-[80px] p-1.5 flex flex-col text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                isToday && "ring-2 ring-primary ring-inset",
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className={cn("text-[11px] font-medium", isToday ? "text-primary font-bold" : "text-foreground")}>{day}</span>
                {festivoInfo && (
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    festivoInfo.tipo === "festivo" ? "bg-rose-500" : "bg-sky-500",
                  )} title={festivoInfo.festivo.nombre} />
                )}
              </div>
              {turnos.length > 0 && (
                <div className="mt-1 flex-1 flex flex-col justify-center items-center gap-0.5">
                  <div
                    className="w-full rounded"
                    style={{
                      height: 8,
                      background: `rgba(99, 102, 241, ${0.2 + intensity * 0.7})`,
                    }}
                  />
                  <span className="text-[10px] font-semibold text-foreground/80">{turnos.length} turno{turnos.length === 1 ? "" : "s"}</span>
                </div>
              )}
            </button>
          );
        })}
    </div>
  );
}

function MesMini({
  year,
  month,
  turnosPorFecha,
  festivoEnFecha,
}: {
  year: number;
  month: number;
  turnosPorFecha: Map<string, ReturnType<typeof getTurnosPorEmpresa>>;
  festivoEnFecha: (fechaISO: string) => FestivoInfo | null;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = indexLunes(new Date(year, month, 1));
  const hoy = new Date();
  const max = Math.max(1, ...Array.from(turnosPorFecha.values()).map((arr) => arr.length));

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
          const fechaISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const turnos = turnosPorFecha.get(fechaISO) ?? [];
          const isToday = hoy.getFullYear() === year && hoy.getMonth() === month && hoy.getDate() === day;
          const festivoInfo = festivoEnFecha(fechaISO);
          const intensity = Math.min(1, turnos.length / max);
          return (
            <div
              key={day}
              title={turnos.length > 0 ? `${turnos.length} turno${turnos.length === 1 ? "" : "s"}` : undefined}
              className={cn(
                "relative aspect-square flex items-center justify-center text-[9px] rounded",
                isToday && "ring-1 ring-primary text-primary font-bold",
              )}
              style={turnos.length > 0 ? {
                background: `rgba(99, 102, 241, ${0.15 + intensity * 0.55})`,
              } : undefined}
            >
              {day}
              {festivoInfo && (
                <span className={cn(
                  "absolute top-0 left-0 h-1 w-1 rounded-full",
                  festivoInfo.tipo === "festivo" ? "bg-rose-500" : "bg-sky-500",
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
