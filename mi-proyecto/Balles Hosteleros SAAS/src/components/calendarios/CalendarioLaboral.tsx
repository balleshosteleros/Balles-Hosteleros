import { useState, useMemo } from "react";
import { getTurnosPorEmpresa } from "@/data/calendarios";
import { getEmpleadosPorEmpresa } from "@/data/rrhh";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Users, Clock, Search, Settings2 } from "lucide-react";
import { CalendarioConfig } from "./CalendarioConfig";

const HORAS = Array.from({ length: 24 }, (_, i) => i);

function parseHora(h: string): number {
  const [hh] = h.split(":").map(Number);
  return hh;
}

export function CalendarioLaboral({ empresaId }: { empresaId: string }) {
  const turnos = getTurnosPorEmpresa(empresaId);
  const empleados = getEmpleadosPorEmpresa(empresaId);
  const [fecha, setFecha] = useState("2026-04-06");
  const [busqueda, setBusqueda] = useState("");
  const [filtroDpto, setFiltroDpto] = useState("todos");
  const [filtroVista, setFiltroVista] = useState("todos");
  const [showConfig, setShowConfig] = useState(false);

  const dptos = useMemo(() => [...new Set(empleados.map(e => e.departamento))].sort(), [empleados]);
  const turnosDia = useMemo(() => turnos.filter(t => t.fecha === fecha), [turnos, fecha]);
  const empleadosConTurno = new Set(turnosDia.map(t => t.empleadoId));

  const empleadosFiltrados = useMemo(() => {
    return empleados.filter(e => {
      if (busqueda && !`${e.nombre} ${e.apellidos}`.toLowerCase().includes(busqueda.toLowerCase())) return false;
      if (filtroDpto !== "todos" && e.departamento !== filtroDpto) return false;
      if (filtroVista === "con_horario" && !empleadosConTurno.has(e.id)) return false;
      if (filtroVista === "sin_horario" && empleadosConTurno.has(e.id)) return false;
      return true;
    });
  }, [empleados, busqueda, filtroDpto, filtroVista, empleadosConTurno]);

  const cambiarFecha = (dir: number) => {
    const d = new Date(fecha);
    d.setDate(d.getDate() + dir);
    setFecha(d.toISOString().split("T")[0]);
  };

  const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const fechaObj = new Date(fecha + "T12:00:00");
  const diaSemana = diasSemana[fechaObj.getDay()];

  if (showConfig) return <CalendarioConfig modalidad="laboral" onBack={() => setShowConfig(false)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cambiarFecha(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold px-2 min-w-[140px] text-center">{diaSemana}, {fecha}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cambiarFecha(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empleado..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
        </div>
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
        <Button size="sm" className="gap-1"><Plus className="h-4 w-4" />Asignar turno</Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowConfig(true)}><Settings2 className="h-4 w-4" />Configuración</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
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
              const turnosEmp = turnosDia.filter(t => t.empleadoId === emp.id);
              return (
                <div key={emp.id} className="flex border-b last:border-b-0 hover:bg-muted/30 transition-colors">
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
                          className={`absolute top-2 h-8 rounded-md ${t.color} flex items-center justify-center text-[10px] font-semibold text-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity`}
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
      </Card>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> Total turnos hoy: <span className="font-semibold text-foreground">{turnosDia.length}</span></div>
        <div className="flex items-center gap-1"><Users className="h-3 w-3" /> Empleados con turno: <span className="font-semibold text-foreground">{empleadosConTurno.size}</span></div>
        <div className="flex items-center gap-1">Horas previstas: <span className="font-semibold text-foreground">{turnosDia.reduce((s, t) => s + t.horasPrevistas, 0)}h</span></div>
      </div>
    </div>
  );
}
