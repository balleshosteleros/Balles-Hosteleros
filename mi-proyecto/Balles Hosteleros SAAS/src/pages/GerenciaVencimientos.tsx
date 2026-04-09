import { useState, useMemo } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import {
  Vencimiento, SAMPLE_VENCIMIENTOS, CATEGORIAS, FRECUENCIAS, ESTADOS_VENCIMIENTO,
  TIPOS_VENCIMIENTO, LOCALES_VENCIMIENTO, RESPONSABLES, calcularEstado,
  CategoriaVencimiento, EstadoVencimiento, Frecuencia, HistorialRevision,
} from "@/data/vencimientos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays, List, Plus, Search, ChevronLeft, ChevronRight, Clock, FileText, History,
  AlertTriangle, CheckCircle2, Timer, Eye,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";

function buildEmpresaData(): Record<string, Vencimiento[]> {
  const out: Record<string, Vencimiento[]> = {};
  for (const eid of ["habana", "bacanal"]) {
    out[eid] = SAMPLE_VENCIMIENTOS.map((v) => ({ ...v, id: `${eid}-${v.id}`, historial: v.historial.map((h) => ({ ...h, id: `${eid}-${h.id}` })) }));
  }
  return out;
}

const estadoColor: Record<EstadoVencimiento, string> = {
  "AL DÍA": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "PRÓXIMO": "bg-amber-100 text-amber-800 border-amber-300",
  "VENCIDO": "bg-red-100 text-red-800 border-red-300",
  "EN REVISIÓN": "bg-blue-100 text-blue-800 border-blue-300",
  "COMPLETADO": "bg-slate-100 text-slate-600 border-slate-300",
};

const estadoIcon: Record<EstadoVencimiento, React.ReactNode> = {
  "AL DÍA": <CheckCircle2 className="h-3 w-3" />,
  "PRÓXIMO": <Timer className="h-3 w-3" />,
  "VENCIDO": <AlertTriangle className="h-3 w-3" />,
  "EN REVISIÓN": <Eye className="h-3 w-3" />,
  "COMPLETADO": <CheckCircle2 className="h-3 w-3" />,
};

const calDotColor: Record<EstadoVencimiento, string> = {
  "AL DÍA": "bg-emerald-500",
  "PRÓXIMO": "bg-amber-500",
  "VENCIDO": "bg-red-500",
  "EN REVISIÓN": "bg-blue-500",
  "COMPLETADO": "bg-slate-400",
};

export default function GerenciaVencimientos() {
  const { empresaActual } = useEmpresa();
  const [allData, setAllData] = useState<Record<string, Vencimiento[]>>(buildEmpresaData);
  const datos = allData[empresaActual.id] ?? [];
  const setDatos = (fn: (prev: Vencimiento[]) => Vencimiento[]) => setAllData((p) => ({ ...p, [empresaActual.id]: fn(p[empresaActual.id] ?? []) }));

  const [vista, setVista] = useState<"calendario" | "lista">("lista");
  const [buscar, setBuscar] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");
  const [mesActual, setMesActual] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [selected, setSelected] = useState<Vencimiento | null>(null);

  // Form state
  const emptyForm = (): Omit<Vencimiento, "id" | "historial"> => ({
    nombre: "", tipo: TIPOS_VENCIMIENTO[0], local: LOCALES_VENCIMIENTO[0], categoria: "PERMISO" as CategoriaVencimiento,
    fechaVencimiento: "", frecuencia: "ANUAL" as Frecuencia, estado: "AL DÍA" as EstadoVencimiento,
    responsable: RESPONSABLES[0], proveedorExterno: "", observaciones: "", documentacion: "",
  });
  const [form, setForm] = useState(emptyForm());

  const datosConEstado = useMemo(() => datos.map((v) => ({ ...v, estado: calcularEstado(v.fechaVencimiento) })), [datos]);

  const filtrados = useMemo(() => {
    return datosConEstado.filter((v) => {
      if (buscar && !v.nombre.toLowerCase().includes(buscar.toLowerCase()) && !v.tipo.toLowerCase().includes(buscar.toLowerCase())) return false;
      if (filtroEstado !== "todos" && v.estado !== filtroEstado) return false;
      if (filtroCategoria !== "todos" && v.categoria !== filtroCategoria) return false;
      return true;
    }).sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime());
  }, [datosConEstado, buscar, filtroEstado, filtroCategoria]);

  const handleGuardar = () => {
    if (!form.nombre || !form.fechaVencimiento) return;
    const nuevo: Vencimiento = { ...form, id: `${empresaActual.id}-${Date.now()}`, estado: calcularEstado(form.fechaVencimiento), historial: [] };
    setDatos((prev) => [...prev, nuevo]);
    setModalOpen(false);
    setForm(emptyForm());
  };

  // Calendar helpers
  const inicioMes = startOfMonth(mesActual);
  const finMes = endOfMonth(mesActual);
  const diasMes = eachDayOfInterval({ start: inicioMes, end: finMes });
  const offsetInicio = (getDay(inicioMes) + 6) % 7; // Monday-based
  const vencimientosPorDia = useMemo(() => {
    const mapa: Record<string, Vencimiento[]> = {};
    datosConEstado.forEach((v) => {
      const key = v.fechaVencimiento;
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(v);
    });
    return mapa;
  }, [datosConEstado]);

  const resumen = useMemo(() => {
    const r = { alDia: 0, proximo: 0, vencido: 0, total: datosConEstado.length };
    datosConEstado.forEach((v) => {
      if (v.estado === "AL DÍA" || v.estado === "COMPLETADO") r.alDia++;
      else if (v.estado === "PRÓXIMO" || v.estado === "EN REVISIÓN") r.proximo++;
      else if (v.estado === "VENCIDO") r.vencido++;
    });
    return r;
  }, [datosConEstado]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">REVISIONES</h1>
          <p className="text-sm text-muted-foreground mt-1">Control centralizado de permisos, seguros, revisiones y mantenimientos periódicos</p>
        </div>
        <Button onClick={() => { setForm(emptyForm()); setModalOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo registro
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><FileText className="h-5 w-5 text-muted-foreground" /></div>
          <div><p className="text-2xl font-bold text-foreground">{resumen.total}</p><p className="text-xs text-muted-foreground">Total registros</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
          <div><p className="text-2xl font-bold text-emerald-700">{resumen.alDia}</p><p className="text-xs text-muted-foreground">Al día</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center"><Timer className="h-5 w-5 text-amber-600" /></div>
          <div><p className="text-2xl font-bold text-amber-700">{resumen.proximo}</p><p className="text-xs text-muted-foreground">Próximos</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
          <div><p className="text-2xl font-bold text-red-700">{resumen.vencido}</p><p className="text-xs text-muted-foreground">Vencidos</p></div>
        </CardContent></Card>
      </div>

      {/* Filters + View toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar vencimiento o revisión..." value={buscar} onChange={(e) => setBuscar(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {ESTADOS_VENCIMIENTO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las categorías</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-1 bg-muted rounded-lg p-1">
          <Button variant={vista === "lista" ? "secondary" : "ghost"} size="sm" onClick={() => setVista("lista")} className="gap-1.5"><List className="h-4 w-4" /> Lista</Button>
          <Button variant={vista === "calendario" ? "secondary" : "ghost"} size="sm" onClick={() => setVista("calendario")} className="gap-1.5"><CalendarDays className="h-4 w-4" /> Calendario</Button>
        </div>
      </div>

      {/* LISTA VIEW */}
      {vista === "lista" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Frecuencia</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No se encontraron registros</TableCell></TableRow>
              )}
              {filtrados.map((v) => (
                <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelected(v); setDetalleOpen(true); }}>
                  <TableCell className="font-medium">{v.nombre}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{v.categoria}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{v.local}</TableCell>
                  <TableCell className="text-sm">{format(parseISO(v.fechaVencimiento), "dd MMM yyyy", { locale: es })}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{v.frecuencia}</TableCell>
                  <TableCell className="text-sm">{v.responsable}</TableCell>
                  <TableCell>
                    <Badge className={`gap-1 ${estadoColor[v.estado]}`}>{estadoIcon[v.estado]} {v.estado}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* CALENDARIO VIEW */}
      {vista === "calendario" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => setMesActual((m) => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <h3 className="text-lg font-semibold capitalize">{format(mesActual, "MMMM yyyy", { locale: es })}</h3>
              <Button variant="ghost" size="icon" onClick={() => setMesActual((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
              {Array.from({ length: offsetInicio }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />
              ))}
              {diasMes.map((dia) => {
                const key = format(dia, "yyyy-MM-dd");
                const items = vencimientosPorDia[key] || [];
                const esHoy = isSameDay(dia, new Date());
                return (
                  <div key={key} className={`bg-background p-2 min-h-[80px] ${esHoy ? "ring-2 ring-primary/30 ring-inset" : ""}`}>
                    <span className={`text-xs font-medium ${esHoy ? "text-primary font-bold" : "text-muted-foreground"}`}>{format(dia, "d")}</span>
                    <div className="mt-1 space-y-0.5">
                      {items.slice(0, 3).map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-1 cursor-pointer hover:opacity-80"
                          onClick={() => { setSelected(v); setDetalleOpen(true); }}
                        >
                          <span className={`h-2 w-2 rounded-full shrink-0 ${calDotColor[v.estado]}`} />
                          <span className="text-[10px] truncate">{v.nombre}</span>
                        </div>
                      ))}
                      {items.length > 3 && <span className="text-[10px] text-muted-foreground">+{items.length - 3} más</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* DETALLE MODAL */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selected.nombre}
                  <Badge className={`${estadoColor[selected.estado]} gap-1`}>{estadoIcon[selected.estado]} {selected.estado}</Badge>
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="detalle">
                <TabsList className="w-full">
                  <TabsTrigger value="detalle" className="flex-1 gap-1"><FileText className="h-3.5 w-3.5" /> Detalle</TabsTrigger>
                  <TabsTrigger value="historial" className="flex-1 gap-1"><History className="h-3.5 w-3.5" /> Historial</TabsTrigger>
                </TabsList>
                <TabsContent value="detalle" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-xs text-muted-foreground">Tipo</Label><p className="text-sm font-medium">{selected.tipo}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Categoría</Label><p className="text-sm font-medium">{selected.categoria}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Local / Centro</Label><p className="text-sm font-medium">{selected.local}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Fecha de vencimiento</Label><p className="text-sm font-medium">{format(parseISO(selected.fechaVencimiento), "dd MMMM yyyy", { locale: es })}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Frecuencia</Label><p className="text-sm font-medium">{selected.frecuencia}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Responsable</Label><p className="text-sm font-medium">{selected.responsable}</p></div>
                    {selected.proveedorExterno && <div className="col-span-2"><Label className="text-xs text-muted-foreground">Proveedor / Empresa externa</Label><p className="text-sm font-medium">{selected.proveedorExterno}</p></div>}
                  </div>
                  {selected.observaciones && (
                    <div><Label className="text-xs text-muted-foreground">Observaciones</Label><p className="text-sm mt-1 text-muted-foreground">{selected.observaciones}</p></div>
                  )}
                </TabsContent>
                <TabsContent value="historial" className="mt-4">
                  {selected.historial.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">Sin revisiones anteriores registradas</p>
                  ) : (
                    <div className="space-y-3">
                      {selected.historial.map((h) => (
                        <div key={h.id} className="border rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{format(parseISO(h.fecha), "dd MMM yyyy", { locale: es })}</span>
                            <Badge variant="outline" className="text-xs">{h.resultado}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Realizado por: {h.realizadoPor}</p>
                          {h.observaciones && <p className="text-xs text-muted-foreground">{h.observaciones}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* CREAR MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo registro de vencimiento / revisión</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Permiso de terraza" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_VENCIMIENTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v as CategoriaVencimiento })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local / Centro</Label>
              <Select value={form.local} onValueChange={(v) => setForm({ ...form, local: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCALES_VENCIMIENTO.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha de vencimiento *</Label>
              <Input type="date" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} />
            </div>
            <div>
              <Label>Frecuencia</Label>
              <Select value={form.frecuencia} onValueChange={(v) => setForm({ ...form, frecuencia: v as Frecuencia })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FRECUENCIAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsable</Label>
              <Select value={form.responsable} onValueChange={(v) => setForm({ ...form, responsable: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RESPONSABLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Proveedor / Empresa externa</Label>
              <Input value={form.proveedorExterno} onChange={(e) => setForm({ ...form, proveedorExterno: e.target.value })} placeholder="Opcional" />
            </div>
            <div className="col-span-2">
              <Label>Observaciones</Label>
              <Textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={!form.nombre || !form.fechaVencimiento}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
