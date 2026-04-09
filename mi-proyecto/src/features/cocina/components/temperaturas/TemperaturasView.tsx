import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Plus, Search, Thermometer, AlertTriangle, CheckCircle, Settings2, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import {
  EquipoFrio, RegistroTemperatura, TipoEquipo, EstadoEquipo, AreaTemp,
  evaluarEstado,
} from "@/features/cocina/data/temperaturas";

const TIPOS: TipoEquipo[] = ["NEVERA", "CONGELADOR", "CÁMARA", "BOTELLERO", "OTRO"];

interface Props {
  area: AreaTemp;
  equiposIniciales: EquipoFrio[];
  registrosIniciales: RegistroTemperatura[];
}

export default function TemperaturasView({ area, equiposIniciales, registrosIniciales }: Props) {
  const { empresaActual } = useEmpresa();
  const [equipos, setEquipos] = useState<EquipoFrio[]>(equiposIniciales);
  const [registros, setRegistros] = useState<RegistroTemperatura[]>(registrosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroEquipo, setFiltroEquipo] = useState("TODOS");
  const [showNuevoRegistro, setShowNuevoRegistro] = useState(false);
  const [showNuevoEquipo, setShowNuevoEquipo] = useState(false);
  const [selectedEquipo, setSelectedEquipo] = useState<EquipoFrio | null>(null);

  const hoy = new Date().toISOString().split("T")[0];

  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      const equipo = equipos.find(e => e.id === r.equipoId);
      const matchBusqueda = !busqueda || equipo?.nombre.toLowerCase().includes(busqueda.toLowerCase()) || r.empleado.toLowerCase().includes(busqueda.toLowerCase());
      const matchEstado = filtroEstado === "TODOS" || r.estado === filtroEstado;
      const matchEquipo = filtroEquipo === "TODOS" || r.equipoId === filtroEquipo;
      return matchBusqueda && matchEstado && matchEquipo;
    }).sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));
  }, [registros, equipos, busqueda, filtroEstado, filtroEquipo]);

  const alertasHoy = registros.filter(r => r.fecha === hoy && r.estado === "ALERTA").length;
  const okHoy = registros.filter(r => r.fecha === hoy && r.estado === "OK").length;
  const equiposActivos = equipos.filter(e => e.estado === "ACTIVO").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TEMPERATURAS — {area}</h1>
          <p className="text-muted-foreground text-sm">{empresaActual.nombre} — Control de temperaturas y trazabilidad</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showNuevoEquipo} onOpenChange={setShowNuevoEquipo}>
            <DialogTrigger asChild><Button variant="outline"><Settings2 className="h-4 w-4 mr-2" />Nuevo equipo</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Nuevo equipo</DialogTitle></DialogHeader>
              <NuevoEquipoForm area={area} onSave={eq => { setEquipos(prev => [...prev, eq]); setShowNuevoEquipo(false); }} onClose={() => setShowNuevoEquipo(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={showNuevoRegistro} onOpenChange={setShowNuevoRegistro}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Registrar temperatura</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Registrar temperatura</DialogTitle></DialogHeader>
              <NuevoRegistroForm equipos={equipos.filter(e => e.estado === "ACTIVO")} onSave={r => { setRegistros(prev => [...prev, r]); setShowNuevoRegistro(false); }} onClose={() => setShowNuevoRegistro(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{equiposActivos}</p><p className="text-xs text-muted-foreground">Equipos activos</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{okHoy + alertasHoy}</p><p className="text-xs text-muted-foreground">Registros hoy</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="flex items-center justify-center gap-1"><CheckCircle className="h-4 w-4 text-green-600" /><p className="text-2xl font-bold text-green-600">{okHoy}</p></div><p className="text-xs text-muted-foreground">OK hoy</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="flex items-center justify-center gap-1"><AlertTriangle className="h-4 w-4 text-red-600" /><p className="text-2xl font-bold text-red-600">{alertasHoy}</p></div><p className="text-xs text-muted-foreground">Alertas hoy</p></CardContent></Card>
      </div>

      <Tabs defaultValue="registros">
        <TabsList>
          <TabsTrigger value="registros"><Thermometer className="h-4 w-4 mr-1" />Registros</TabsTrigger>
          <TabsTrigger value="equipos"><Settings2 className="h-4 w-4 mr-1" />Equipos</TabsTrigger>
          <TabsTrigger value="historico"><BarChart3 className="h-4 w-4 mr-1" />Histórico</TabsTrigger>
        </TabsList>

        {/* REGISTROS */}
        <TabsContent value="registros">
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar equipo o empleado..." className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="TODOS">Todos</SelectItem><SelectItem value="OK">Solo OK</SelectItem><SelectItem value="ALERTA">Solo alertas</SelectItem></SelectContent>
            </Select>
            <Select value={filtroEquipo} onValueChange={setFiltroEquipo}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="TODOS">Todos los equipos</SelectItem>{equipos.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium">Fecha</th>
                  <th className="text-left p-3 font-medium">Hora</th>
                  <th className="text-left p-3 font-medium">Equipo</th>
                  <th className="text-left p-3 font-medium">Temp.</th>
                  <th className="text-left p-3 font-medium">Rango</th>
                  <th className="text-left p-3 font-medium">Estado</th>
                  <th className="text-left p-3 font-medium">Empleado</th>
                  <th className="text-left p-3 font-medium">Medidas tomadas</th>
                </tr></thead>
                <tbody>
                  {registrosFiltrados.map(r => {
                    const eq = equipos.find(e => e.id === r.equipoId);
                    return (
                      <tr key={r.id} className="border-b hover:bg-muted/20">
                        <td className="p-3">{r.fecha}</td>
                        <td className="p-3">{r.hora}</td>
                        <td className="p-3 font-medium">{eq?.nombre ?? "—"}</td>
                        <td className="p-3 font-mono font-semibold">{r.temperatura}°C</td>
                        <td className="p-3 text-xs text-muted-foreground">{eq ? `${eq.rangoMin}° / ${eq.rangoMax}°` : "—"}</td>
                        <td className="p-3">
                          {r.estado === "OK"
                            ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">OK</Badge>
                            : <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">ALERTA</Badge>}
                        </td>
                        <td className="p-3">{r.empleado}</td>
                        <td className="p-3 text-muted-foreground text-xs max-w-[250px] truncate">{r.medidasTomadas || "—"}</td>
                      </tr>
                    );
                  })}
                  {registrosFiltrados.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin registros</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EQUIPOS */}
        <TabsContent value="equipos">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {equipos.map(eq => {
              const ultimoReg = registros.filter(r => r.equipoId === eq.id).sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`))[0];
              return (
                <Card key={eq.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedEquipo(eq)}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{eq.nombre}</h3>
                      <Badge variant={eq.estado === "ACTIVO" ? "default" : "secondary"}>{eq.estado}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{eq.tipo} — {eq.ubicacion}</p>
                    <p className="text-xs">Rango: <span className="font-mono">{eq.rangoMin}°C — {eq.rangoMax}°C</span></p>
                    {ultimoReg && (
                      <div className="flex items-center gap-2 text-xs pt-1 border-t">
                        <span>Último: <strong className="font-mono">{ultimoReg.temperatura}°C</strong></span>
                        <Badge variant="outline" className={ultimoReg.estado === "OK" ? "bg-green-50 text-green-700 border-green-300" : "bg-red-50 text-red-700 border-red-300"}>{ultimoReg.estado}</Badge>
                        <span className="text-muted-foreground">{ultimoReg.fecha}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico" className="space-y-6">
          {equipos.filter(e => e.estado === "ACTIVO").map(eq => {
            const regs = registros.filter(r => r.equipoId === eq.id).sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
            if (regs.length === 0) return null;
            const chartData = regs.map(r => ({ label: `${r.fecha.slice(5)} ${r.hora}`, temp: r.temperatura }));
            return (
              <Card key={eq.id}>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{eq.nombre} — Histórico</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="°" />
                      <Tooltip formatter={(v: number) => `${v}°C`} />
                      <ReferenceLine y={eq.rangoMax} stroke="hsl(0 70% 55%)" strokeDasharray="4 4" label={{ value: `Max ${eq.rangoMax}°`, fontSize: 10, fill: "hsl(0 70% 55%)" }} />
                      <ReferenceLine y={eq.rangoMin} stroke="hsl(210 70% 55%)" strokeDasharray="4 4" label={{ value: `Min ${eq.rangoMin}°`, fontSize: 10, fill: "hsl(210 70% 55%)" }} />
                      <Line type="monotone" dataKey="temp" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Detalle equipo */}
      <Dialog open={!!selectedEquipo} onOpenChange={() => setSelectedEquipo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Equipo: {selectedEquipo?.nombre}</DialogTitle></DialogHeader>
          {selectedEquipo && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-muted-foreground">Tipo</Label><p>{selectedEquipo.tipo}</p></div>
                <div><Label className="text-muted-foreground">Ubicación</Label><p>{selectedEquipo.ubicacion}</p></div>
                <div><Label className="text-muted-foreground">Rango permitido</Label><p className="font-mono">{selectedEquipo.rangoMin}°C — {selectedEquipo.rangoMax}°C</p></div>
                <div><Label className="text-muted-foreground">Estado</Label><Badge variant={selectedEquipo.estado === "ACTIVO" ? "default" : "secondary"}>{selectedEquipo.estado}</Badge></div>
              </div>
              {selectedEquipo.observaciones && <div><Label className="text-muted-foreground">Observaciones</Label><p>{selectedEquipo.observaciones}</p></div>}
              <div className="pt-2 border-t">
                <p className="font-medium mb-2">Últimos registros</p>
                {registros.filter(r => r.equipoId === selectedEquipo.id).sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`)).slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-xs py-1">
                    <span>{r.fecha} {r.hora}</span>
                    <span className="font-mono font-semibold">{r.temperatura}°C</span>
                    <Badge variant="outline" className={r.estado === "OK" ? "bg-green-50 text-green-700 border-green-300" : "bg-red-50 text-red-700 border-red-300"}>{r.estado}</Badge>
                    <span className="text-muted-foreground">{r.empleado}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Formulario nuevo equipo ── */
function NuevoEquipoForm({ area, onSave, onClose }: { area: AreaTemp; onSave: (e: EquipoFrio) => void; onClose: () => void }) {
  const [form, setForm] = useState({ nombre: "", tipo: "NEVERA" as TipoEquipo, ubicacion: "", rangoMin: 0, rangoMax: 5, observaciones: "" });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nombre *</Label><Input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
        <div><Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v as TipoEquipo }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Ubicación</Label><Input value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Mín. (°C)</Label><Input type="number" value={form.rangoMin} onChange={e => setForm(p => ({ ...p, rangoMin: Number(e.target.value) }))} /></div>
          <div><Label>Máx. (°C)</Label><Input type="number" value={form.rangoMax} onChange={e => setForm(p => ({ ...p, rangoMax: Number(e.target.value) }))} /></div>
        </div>
      </div>
      <div><Label>Observaciones</Label><Textarea value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button disabled={!form.nombre} onClick={() => onSave({ ...form, id: `eq-${Date.now()}`, area, estado: "ACTIVO" })}>Crear equipo</Button>
      </div>
    </div>
  );
}

/* ── Formulario nuevo registro ── */
function NuevoRegistroForm({ equipos, onSave, onClose }: { equipos: EquipoFrio[]; onSave: (r: RegistroTemperatura) => void; onClose: () => void }) {
  const [form, setForm] = useState({ equipoId: "", temperatura: 0, empleado: "", observaciones: "", medidasTomadas: "" });
  const equipo = equipos.find(e => e.id === form.equipoId);
  const estado = equipo ? evaluarEstado(form.temperatura, equipo.rangoMin, equipo.rangoMax) : "OK";
  const isAlerta = estado === "ALERTA";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Equipo *</Label>
          <Select value={form.equipoId} onValueChange={v => setForm(p => ({ ...p, equipoId: v }))}>
            <SelectTrigger><SelectValue placeholder="Seleccionar equipo" /></SelectTrigger>
            <SelectContent>{equipos.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} ({e.tipo})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Temperatura (°C) *</Label><Input type="number" step={0.1} value={form.temperatura} onChange={e => setForm(p => ({ ...p, temperatura: Number(e.target.value) }))} /></div>
        <div><Label>Empleado *</Label><Input value={form.empleado} onChange={e => setForm(p => ({ ...p, empleado: e.target.value }))} /></div>
      </div>
      {equipo && (
        <div className={`p-3 rounded-lg border text-sm ${isAlerta ? "bg-red-50 border-red-300" : "bg-green-50 border-green-300"}`}>
          <div className="flex items-center gap-2">
            {isAlerta ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <CheckCircle className="h-4 w-4 text-green-600" />}
            <span className="font-medium">{isAlerta ? "FUERA DE RANGO" : "DENTRO DE RANGO"}</span>
            <span className="text-muted-foreground">({equipo.rangoMin}°C — {equipo.rangoMax}°C)</span>
          </div>
        </div>
      )}
      {isAlerta && (
        <div>
          <Label className="text-red-600">Medidas tomadas * (obligatorio en alertas)</Label>
          <Textarea placeholder="Describe qué medidas se han tomado..." value={form.medidasTomadas} onChange={e => setForm(p => ({ ...p, medidasTomadas: e.target.value }))} />
        </div>
      )}
      <div><Label>Observaciones</Label><Textarea value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button disabled={!form.equipoId || !form.empleado || (isAlerta && !form.medidasTomadas)} onClick={() => {
          const now = new Date();
          onSave({
            ...form, id: `rt-${Date.now()}`, estado,
            fecha: now.toISOString().split("T")[0],
            hora: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
          });
        }}>Guardar registro</Button>
      </div>
    </div>
  );
}
