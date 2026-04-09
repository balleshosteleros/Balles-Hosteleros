"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Descuento, ResultadoMensual, buildDefaultDescuentos, buildDefaultResultados } from "@/features/gerencia/data/descuentos";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts";
import { Search, Plus, Pencil, Trash2, Eye, BarChart3, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

const allDescuentos: Record<string, Descuento[]> = {};
const allResultados: Record<string, ResultadoMensual[]> = {};
function getDescuentos(id: string) { if (!allDescuentos[id]) allDescuentos[id] = buildDefaultDescuentos(); return allDescuentos[id]; }
function getResultados(id: string) { if (!allResultados[id]) allResultados[id] = buildDefaultResultados(); return allResultados[id]; }

const PIE_COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "hsl(210 60% 55%)",
  "hsl(340 50% 55%)", "hsl(160 45% 50%)", "hsl(40 70% 55%)",
  "hsl(270 40% 55%)", "hsl(20 60% 55%)", "hsl(190 50% 50%)", "hsl(0 50% 55%)",
];

export default function DescuentosPage() {
  const { empresaActual } = useEmpresa();
  const [descuentos, setDescuentos] = useState<Descuento[]>(() => getDescuentos(empresaActual.id));
  const [resultados, setResultados] = useState<ResultadoMensual[]>(() => getResultados(empresaActual.id));
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<"todos" | "activo" | "inactivo">("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [editando, setEditando] = useState<Descuento | null>(null);
  const [detalle, setDetalle] = useState<Descuento | null>(null);
  const [form, setForm] = useState<Partial<Descuento>>({});

  const [lastEmpresa, setLastEmpresa] = useState(empresaActual.id);
  if (lastEmpresa !== empresaActual.id) {
    setLastEmpresa(empresaActual.id);
    setDescuentos(getDescuentos(empresaActual.id));
    setResultados(getResultados(empresaActual.id));
  }

  const filtrados = useMemo(() => {
    let list = descuentos;
    if (filtroActivo === "activo") list = list.filter((d) => d.activo);
    if (filtroActivo === "inactivo") list = list.filter((d) => !d.activo);
    if (busqueda.trim()) { const q = busqueda.toLowerCase(); list = list.filter((d) => d.codigo.toLowerCase().includes(q) || d.ejecucion.toLowerCase().includes(q)); }
    return list;
  }, [descuentos, busqueda, filtroActivo]);

  function openCrear() { setEditando(null); setForm({ codigo: "", ejecucion: "", tenerEnCuenta: "", activo: true, observaciones: "" }); setModalOpen(true); }
  function openEditar(d: Descuento) { setEditando(d); setForm({ ...d }); setModalOpen(true); }

  function guardar() {
    if (!form.codigo?.trim()) { toast.error("El código es obligatorio"); return; }
    const ahora = new Date().toISOString().slice(0, 10);
    if (editando) {
      const updated = descuentos.map((d) => d.id === editando.id ? { ...d, ...form, ultimaActualizacion: ahora } as Descuento : d);
      setDescuentos(updated); allDescuentos[empresaActual.id] = updated; toast.success("Descuento actualizado");
    } else {
      const nuevo: Descuento = { id: `d-${Date.now()}`, codigo: form.codigo!, ejecucion: form.ejecucion || "", tenerEnCuenta: form.tenerEnCuenta || "", activo: form.activo ?? true, observaciones: form.observaciones || "", creadoPor: "Usuario", fechaCreacion: ahora, ultimaActualizacion: ahora };
      const updated = [...descuentos, nuevo];
      setDescuentos(updated); allDescuentos[empresaActual.id] = updated; toast.success("Descuento creado");
    }
    setModalOpen(false);
  }

  function toggleActivo(d: Descuento) {
    const updated = descuentos.map((x) => x.id === d.id ? { ...x, activo: !x.activo, ultimaActualizacion: new Date().toISOString().slice(0, 10) } : x);
    setDescuentos(updated); allDescuentos[empresaActual.id] = updated;
  }

  function eliminar(d: Descuento) {
    const updated = descuentos.filter((x) => x.id !== d.id);
    setDescuentos(updated); allDescuentos[empresaActual.id] = updated; toast.success("Descuento eliminado");
  }

  const chartMensualTotal = useMemo(() => resultados.map((r) => ({ mes: r.etiqueta, total: r.datos.reduce((s, d) => s + d.totalDescontado, 0), usos: r.datos.reduce((s, d) => s + d.usos, 0) })), [resultados]);
  const ultimoMes = resultados[resultados.length - 1];
  const pieData = useMemo(() => ultimoMes ? ultimoMes.datos.map((d) => ({ name: d.codigoDescuento, value: d.totalDescontado })) : [], [ultimoMes]);
  const chartConfig = { total: { label: "Total descontado (€)", color: "hsl(var(--primary))" }, usos: { label: "Nº de usos", color: "hsl(210 60% 55%)" } };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DESCUENTOS</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de descuentos operativos del restaurante</p>
        </div>

        <Tabs defaultValue="listado" className="space-y-4">
          <TabsList>
            <TabsTrigger value="listado" className="gap-2"><FileText className="h-4 w-4" /> Listado</TabsTrigger>
            <TabsTrigger value="resultados" className="gap-2"><BarChart3 className="h-4 w-4" /> Resultados</TabsTrigger>
          </TabsList>

          <TabsContent value="listado" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar descuento…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9" />
              </div>
              <Select value={filtroActivo} onValueChange={(v) => setFiltroActivo(v as "todos" | "activo" | "inactivo")}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={openCrear} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nuevo descuento</Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Código</TableHead>
                      <TableHead>Ejecución</TableHead>
                      <TableHead>A tener en cuenta</TableHead>
                      <TableHead className="w-[90px] text-center">Activo</TableHead>
                      <TableHead className="w-[140px]">Actualizado</TableHead>
                      <TableHead className="w-[120px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No se encontraron descuentos</TableCell></TableRow>}
                    {filtrados.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-semibold text-foreground">{d.codigo}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[250px] truncate">{d.ejecucion}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[220px] truncate">{d.tenerEnCuenta}</TableCell>
                        <TableCell className="text-center"><Switch checked={d.activo} onCheckedChange={() => toggleActivo(d)} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.ultimaActualizacion}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setDetalle(d); setDetalleOpen(true); }}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => openEditar(d)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => eliminar(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resultados" className="space-y-6">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Subir PDF de resultados</CardTitle>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Funcionalidad preparada para integración con backend")}><Upload className="h-4 w-4" /> Subir PDF</Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Sube el PDF exportado del software del restaurante para extraer automáticamente los datos de descuentos del mes.</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total descontado (último mes)</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{ultimoMes ? `${ultimoMes.datos.reduce((s, d) => s + d.totalDescontado, 0).toLocaleString("es-ES")} €` : "—"}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Usos totales (último mes)</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{ultimoMes ? ultimoMes.datos.reduce((s, d) => s + d.usos, 0).toLocaleString("es-ES") : "—"}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tipos de descuento usados</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{ultimoMes ? ultimoMes.datos.length : "—"}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Evolución mensual — Total descontado</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={chartMensualTotal}><CartesianGrid strokeDasharray="3 3" className="stroke-border/40" /><XAxis dataKey="mes" className="text-xs" /><YAxis className="text-xs" /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Evolución mensual — Número de usos</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <LineChart data={chartMensualTotal}><CartesianGrid strokeDasharray="3 3" className="stroke-border/40" /><XAxis dataKey="mes" className="text-xs" /><YAxis className="text-xs" /><ChartTooltip content={<ChartTooltipContent />} /><Line type="monotone" dataKey="usos" stroke="hsl(210 60% 55%)" strokeWidth={2} dot={{ r: 4 }} /></LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {pieData.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Distribución por tipo — {ultimoMes?.etiqueta}</CardTitle></CardHeader>
                <CardContent className="flex justify-center">
                  <div className="h-[320px] w-full max-w-lg">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>{pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><ChartTooltip /></PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>Histórico mensual global</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Mes</TableHead><TableHead className="text-right">Total descontado</TableHead><TableHead className="text-right">Usos</TableHead><TableHead className="text-right">Tipos</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {resultados.map((r) => (
                      <TableRow key={r.id}><TableCell className="font-medium">{r.etiqueta}</TableCell><TableCell className="text-right">{r.datos.reduce((s, d) => s + d.totalDescontado, 0).toLocaleString("es-ES")} €</TableCell><TableCell className="text-right">{r.datos.reduce((s, d) => s + d.usos, 0)}</TableCell><TableCell className="text-right">{r.datos.length}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editando ? "Editar descuento" : "Nuevo descuento"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Código *</Label><Input value={form.codigo ?? ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ej: CHUPITO" /></div>
              <div className="space-y-2"><Label>Ejecución</Label><Textarea rows={3} value={form.ejecucion ?? ""} onChange={(e) => setForm({ ...form, ejecucion: e.target.value })} placeholder="Descripción operativa…" /></div>
              <div className="space-y-2"><Label>A tener en cuenta</Label><Textarea rows={3} value={form.tenerEnCuenta ?? ""} onChange={(e) => setForm({ ...form, tenerEnCuenta: e.target.value })} placeholder="Condiciones y reglas…" /></div>
              <div className="space-y-2"><Label>Observaciones internas</Label><Textarea rows={2} value={form.observaciones ?? ""} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
              <div className="flex items-center gap-3"><Label>Activo</Label><Switch checked={form.activo ?? true} onCheckedChange={(v) => setForm({ ...form, activo: v })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={guardar}>{editando ? "Guardar cambios" : "Crear descuento"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Detalle del descuento</DialogTitle></DialogHeader>
            {detalle && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground">{detalle.codigo}</h3>
                  <Badge variant={detalle.activo ? "default" : "secondary"}>{detalle.activo ? "Activo" : "Inactivo"}</Badge>
                </div>
                <div className="space-y-3 text-sm">
                  <div><p className="font-medium mb-1">Ejecución</p><p className="text-muted-foreground">{detalle.ejecucion || "—"}</p></div>
                  <div><p className="font-medium mb-1">A tener en cuenta</p><p className="text-muted-foreground">{detalle.tenerEnCuenta || "—"}</p></div>
                  <div><p className="font-medium mb-1">Observaciones</p><p className="text-muted-foreground">{detalle.observaciones || "—"}</p></div>
                  <div className="flex gap-6 text-xs text-muted-foreground pt-2 border-t">
                    <span>Creado: {detalle.fechaCreacion}</span>
                    <span>Actualizado: {detalle.ultimaActualizacion}</span>
                    <span>Por: {detalle.creadoPor}</span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
