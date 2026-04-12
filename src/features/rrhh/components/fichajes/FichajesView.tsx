"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { ESTADO_FICHAJE_LABEL, ESTADO_FICHAJE_COLOR, TIPOS_INCIDENCIA_LABEL } from "@/features/rrhh/data/fichajes";
import type { EstadoFichaje, Fichaje, ConfigFichajes } from "@/features/rrhh/data/fichajes";
import { listFichajes, ficharEntrada, ficharSalida, updateFichaje } from "@/features/rrhh/actions/fichajes-actions";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, AlertTriangle, CheckCircle2, Search, Filter, Plus, Settings2, ClipboardList, History } from "lucide-react";

function mapDbToFichaje(row: Record<string, unknown>): Fichaje {
  return {
    id: row.id as string,
    empleadoId: (row.empleado_id as string) ?? "",
    empleadoNombre: (row.empleado_nombre as string) ?? "",
    fecha: (row.fecha as string) ?? "",
    horaEntrada: (row.hora_entrada as string | null) ?? null,
    horaSalida: (row.hora_salida as string | null) ?? null,
    pausaInicio: (row.pausa_inicio as string | null) ?? null,
    pausaFin: (row.pausa_fin as string | null) ?? null,
    horasTotales: (row.horas_totales as number) ?? 0,
    estado: (row.estado as EstadoFichaje) ?? "pendiente",
    incidencia: (row.incidencia as string | null) ?? null,
    validadoPor: (row.validado_por as string | null) ?? null,
    observaciones: (row.observaciones as string | null) ?? null,
    departamento: (row.departamento as string) ?? "",
    centro: (row.centro as string) ?? "",
  };
}

export function FichajesView() {
  const { empresaActual } = useEmpresa();
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ConfigFichajes>({
    permitirManual: true,
    requiereValidacion: true,
    toleranciaMinutos: 10,
    pausasActivas: true,
  });
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroDpto, setFiltroDpto] = useState<string>("todos");
  const [fichajeModal, setFichajeModal] = useState<Fichaje | null>(null);

  const loadFichajes = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await listFichajes(today);
      if (res.ok) {
        setFichajes(res.data.map(mapDbToFichaje));
      } else {
        toast.error("Error al cargar fichajes");
      }
    } catch {
      toast.error("Error de conexion al cargar fichajes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFichajes();
  }, [loadFichajes]);

  const incidencias = useMemo(() => fichajes.filter(f => f.estado === "incidencia").map(f => ({
    id: f.id,
    fichajeId: f.id,
    empleadoNombre: f.empleadoNombre,
    fecha: f.fecha,
    tipo: "fichaje_incompleto" as const,
    descripcion: f.incidencia ?? "Incidencia detectada",
    resuelta: false,
  })), [fichajes]);

  const dptos = useMemo(() => [...new Set(fichajes.map(f => f.departamento))].sort(), [fichajes]);

  const fichajesFiltrados = useMemo(() => {
    return fichajes.filter(f => {
      if (busqueda && !f.empleadoNombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
      if (filtroEstado !== "todos" && f.estado !== filtroEstado) return false;
      if (filtroDpto !== "todos" && f.departamento !== filtroDpto) return false;
      return true;
    });
  }, [fichajes, busqueda, filtroEstado, filtroDpto]);

  const kpis = useMemo(() => {
    const total = fichajes.length;
    const completos = fichajes.filter(f => f.estado === "completo" || f.estado === "validado").length;
    const conIncidencia = fichajes.filter(f => f.estado === "incidencia").length;
    const horasTotales = fichajes.reduce((s, f) => s + f.horasTotales, 0);
    return { total, completos, conIncidencia, horasTotales };
  }, [fichajes]);

  const incidenciasPendientes = incidencias.filter(i => !i.resuelta);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4 text-center"><Clock className="mx-auto h-5 w-5 text-muted-foreground mb-1" /><p className="text-2xl font-bold">{kpis.total}</p><p className="text-xs text-muted-foreground">Fichajes registrados</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center"><CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500 mb-1" /><p className="text-2xl font-bold">{kpis.completos}</p><p className="text-xs text-muted-foreground">Completos / Validados</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center"><AlertTriangle className="mx-auto h-5 w-5 text-destructive mb-1" /><p className="text-2xl font-bold">{kpis.conIncidencia}</p><p className="text-xs text-muted-foreground">Con incidencias</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center"><Clock className="mx-auto h-5 w-5 text-sky-500 mb-1" /><p className="text-2xl font-bold">{kpis.horasTotales.toFixed(1)}h</p><p className="text-xs text-muted-foreground">Horas totales</p></CardContent></Card>
      </div>

      <Tabs defaultValue="fichajes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fichajes" className="gap-1"><ClipboardList className="h-4 w-4" />Fichajes</TabsTrigger>
          <TabsTrigger value="historial" className="gap-1"><History className="h-4 w-4" />Historial</TabsTrigger>
          <TabsTrigger value="incidencias" className="gap-1"><AlertTriangle className="h-4 w-4" />Incidencias</TabsTrigger>
          <TabsTrigger value="config" className="gap-1"><Settings2 className="h-4 w-4" />Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="fichajes" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar empleado..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {(Object.keys(ESTADO_FICHAJE_LABEL) as EstadoFichaje[]).map(e => (
                  <SelectItem key={e} value={e}>{ESTADO_FICHAJE_LABEL[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroDpto} onValueChange={setFiltroDpto}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los departamentos</SelectItem>
                {dptos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-1" onClick={async () => {
              const res = await ficharEntrada();
              if (res.ok) { toast.success("Entrada registrada"); loadFichajes(); }
              else toast.error(res.error ?? "Error al fichar entrada");
            }}><Plus className="h-4 w-4" />Fichar entrada</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead><TableHead>Fecha</TableHead><TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead><TableHead>Pausa</TableHead><TableHead className="text-right">Horas</TableHead>
                  <TableHead>Estado</TableHead><TableHead>Validado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fichajesFiltrados.map(f => (
                  <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setFichajeModal(f)}>
                    <TableCell><div><p className="font-medium text-sm">{f.empleadoNombre}</p><p className="text-xs text-muted-foreground">{f.departamento}</p></div></TableCell>
                    <TableCell className="text-sm">{f.fecha}</TableCell>
                    <TableCell className="text-sm font-mono">{f.horaEntrada ?? "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{f.horaSalida ?? "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{f.pausaInicio && f.pausaFin ? `${f.pausaInicio}-${f.pausaFin}` : "—"}</TableCell>
                    <TableCell className="text-sm text-right font-semibold">{f.horasTotales > 0 ? `${f.horasTotales.toFixed(1)}h` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 text-xs">
                        <span className={`h-2 w-2 rounded-full ${ESTADO_FICHAJE_COLOR[f.estado]}`} />
                        {ESTADO_FICHAJE_LABEL[f.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.validadoPor ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {fichajesFiltrados.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin fichajes para los filtros seleccionados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Historial de fichajes</CardTitle><CardDescription>Registro completo ordenado cronológicamente</CardDescription></CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead><TableHead>Fecha</TableHead><TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead><TableHead className="text-right">Horas</TableHead>
                  <TableHead>Incidencia</TableHead><TableHead>Validación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...fichajes].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium text-sm">{f.empleadoNombre}</TableCell>
                    <TableCell className="text-sm">{f.fecha}</TableCell>
                    <TableCell className="text-sm font-mono">{f.horaEntrada ?? "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{f.horaSalida ?? "—"}</TableCell>
                    <TableCell className="text-sm text-right">{f.horasTotales > 0 ? `${f.horasTotales.toFixed(1)}h` : "—"}</TableCell>
                    <TableCell className="text-sm">{f.incidencia ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{f.validadoPor ?? <span className="text-muted-foreground">Pendiente</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="incidencias" className="space-y-4">
          {incidenciasPendientes.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium">{incidenciasPendientes.length} incidencia(s) pendiente(s) de resolver</span>
            </div>
          )}
          <Card>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Empleado</TableHead><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Descripción</TableHead><TableHead>Estado</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {incidencias.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium text-sm">{i.empleadoNombre}</TableCell>
                    <TableCell className="text-sm">{i.fecha}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{TIPOS_INCIDENCIA_LABEL[i.tipo]}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px]">{i.descripcion}</TableCell>
                    <TableCell>
                      {i.resuelta
                        ? <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-xs">Resuelta</Badge>
                        : <Badge variant="destructive" className="text-xs">Pendiente</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Configuración de fichajes</CardTitle><CardDescription>Ajustes generales del sistema de fichajes</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div><Label className="font-medium">Permitir fichaje manual</Label><p className="text-xs text-muted-foreground">Los empleados pueden registrar fichajes manualmente</p></div>
                <Switch checked={config.permitirManual} onCheckedChange={v => setConfig(c => ({ ...c, permitirManual: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div><Label className="font-medium">Requiere validación</Label><p className="text-xs text-muted-foreground">Los fichajes deben ser validados por un responsable</p></div>
                <Switch checked={config.requiereValidacion} onCheckedChange={v => setConfig(c => ({ ...c, requiereValidacion: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div><Label className="font-medium">Pausas activas</Label><p className="text-xs text-muted-foreground">Permitir registrar pausas dentro del fichaje</p></div>
                <Switch checked={config.pausasActivas} onCheckedChange={v => setConfig(c => ({ ...c, pausasActivas: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div><Label className="font-medium">Tolerancia horaria (minutos)</Label><p className="text-xs text-muted-foreground">Margen antes de generar incidencia por desfase</p></div>
                <Input type="number" className="w-20" value={config.toleranciaMinutos} onChange={e => setConfig(c => ({ ...c, toleranciaMinutos: Number(e.target.value) }))} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!fichajeModal} onOpenChange={() => setFichajeModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de fichaje</DialogTitle></DialogHeader>
          {fichajeModal && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Empleado:</span><p className="font-medium">{fichajeModal.empleadoNombre}</p></div>
                <div><span className="text-muted-foreground">Departamento:</span><p className="font-medium">{fichajeModal.departamento}</p></div>
                <div><span className="text-muted-foreground">Fecha:</span><p className="font-medium">{fichajeModal.fecha}</p></div>
                <div><span className="text-muted-foreground">Estado:</span>
                  <Badge variant="outline" className="gap-1 mt-1">
                    <span className={`h-2 w-2 rounded-full ${ESTADO_FICHAJE_COLOR[fichajeModal.estado]}`} />
                    {ESTADO_FICHAJE_LABEL[fichajeModal.estado]}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground">Entrada:</span><p className="font-mono font-medium">{fichajeModal.horaEntrada ?? "—"}</p></div>
                <div><span className="text-muted-foreground">Salida:</span><p className="font-mono font-medium">{fichajeModal.horaSalida ?? "—"}</p></div>
                <div><span className="text-muted-foreground">Pausa:</span><p className="font-mono font-medium">{fichajeModal.pausaInicio && fichajeModal.pausaFin ? `${fichajeModal.pausaInicio} - ${fichajeModal.pausaFin}` : "—"}</p></div>
                <div><span className="text-muted-foreground">Horas totales:</span><p className="font-semibold">{fichajeModal.horasTotales > 0 ? `${fichajeModal.horasTotales.toFixed(2)}h` : "—"}</p></div>
              </div>
              {fichajeModal.incidencia && <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3"><p className="text-sm font-medium text-destructive">{fichajeModal.incidencia}</p></div>}
              {fichajeModal.observaciones && <div><span className="text-muted-foreground">Observaciones:</span><p>{fichajeModal.observaciones}</p></div>}
              {fichajeModal.validadoPor && <div><span className="text-muted-foreground">Validado por:</span><p className="font-medium">{fichajeModal.validadoPor}</p></div>}
            </div>
          )}
          <DialogFooter>
            {fichajeModal && !fichajeModal.horaSalida && fichajeModal.horaEntrada && (
              <Button onClick={async () => {
                const res = await ficharSalida(fichajeModal.id);
                if (res.ok) { toast.success("Salida registrada"); setFichajeModal(null); loadFichajes(); }
                else toast.error(res.error ?? "Error al fichar salida");
              }}>Fichar salida</Button>
            )}
            <Button variant="outline" onClick={() => setFichajeModal(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
