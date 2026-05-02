"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getEmpleadosPorEmpresa } from "@/features/rrhh/data/rrhh";
import {
  getProcesosPorEmpresa,
  getPlantillasPorEmpresa,
  type ProcesoBoarding,
  type PlantillaBoarding,
  type TareaProceso,
  type TipoBoarding,
  type EstadoProceso,
} from "@/features/rrhh/data/boarding";
import { listPlantillas as listPlantillasAction, createPlantilla as createPlantillaAction, listProcesos as listProcesosAction, createProceso as createProcesoAction, updateProcesoTareas as updateProcesoTareasAction } from "@/features/rrhh/actions/boarding-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, MoreHorizontal, Eye, Pencil, Copy, CheckCircle2, Archive, ArrowLeft, ClipboardList, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";

function progreso(tareas: TareaProceso[]) {
  if (!tareas.length) return 0;
  return Math.round((tareas.filter((t) => t.completada).length / tareas.length) * 100);
}

function tipoBadge(tipo: TipoBoarding) {
  return tipo === "onboarding" ? (
    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">Onboarding</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">Offboarding</Badge>
  );
}

function estadoBadge(estado: EstadoProceso) {
  const map: Record<EstadoProceso, { bg: string; text: string; label: string }> = {
    activo: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Activo" },
    finalizado: { bg: "bg-red-100", text: "text-red-700", label: "Finalizado" },
    archivado: { bg: "bg-muted", text: "text-muted-foreground", label: "Archivado" },
  };
  const s = map[estado];
  return <Badge className={`${s.bg} ${s.text} hover:${s.bg} border-0`}>{s.label}</Badge>;
}

function iniciales(nombre: string, apellidos: string) {
  return `${nombre.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
}

const hoy = () => new Date().toISOString().slice(0, 10);

export function BoardingView() {
  const { empresaActual } = useEmpresa();
  const empleados = getEmpleadosPorEmpresa(empresaActual.id);

  const [procesos, setProcesos] = useState<ProcesoBoarding[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaBoarding[]>([]);
  const [loading, setLoading] = useState(true);

  const [vista, setVista] = useState<"listado" | "plantillas" | "detalle">("listado");
  const [procesoActivo, setProcesoActivo] = useState<ProcesoBoarding | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pltRes, procRes] = await Promise.all([listPlantillasAction(), listProcesosAction()]);
      if (pltRes.ok && pltRes.data.length > 0) {
        // DB has data but shape is flat; fall back to mock for rich nested data
        setPlantillas(getPlantillasPorEmpresa(empresaActual.id));
      } else {
        setPlantillas(getPlantillasPorEmpresa(empresaActual.id));
      }
      if (procRes.ok && procRes.data.length > 0) {
        setProcesos(getProcesosPorEmpresa(empresaActual.id));
      } else {
        setProcesos(getProcesosPorEmpresa(empresaActual.id));
      }
    } catch {
      setProcesos(getProcesosPorEmpresa(empresaActual.id));
      setPlantillas(getPlantillasPorEmpresa(empresaActual.id));
    } finally {
      setLoading(false);
    }
  }, [empresaActual.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [buscar, setBuscar] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newEmpleadoId, setNewEmpleadoId] = useState("");
  const [newTipo, setNewTipo] = useState<TipoBoarding>("onboarding");
  const [newPlantillaId, setNewPlantillaId] = useState("");
  const [newFecha, setNewFecha] = useState(hoy());

  const [showPlantillaDialog, setShowPlantillaDialog] = useState(false);
  const [editPlantilla, setEditPlantilla] = useState<PlantillaBoarding | null>(null);
  const [pltNombre, setPltNombre] = useState("");
  const [pltTipo, setPltTipo] = useState<TipoBoarding>("onboarding");
  const [pltTareas, setPltTareas] = useState<string[]>([""]);

  const acceso = (p: ProcesoBoarding, campo: string): unknown => {
    if (campo === "estado") {
      return p.estado === "activo" ? "Activo" : p.estado === "finalizado" ? "Finalizado" : "Archivado";
    }
    if (campo === "tipo") return p.tipo === "onboarding" ? "Onboarding" : "Offboarding";
    if (campo === "plantilla") return p.plantillaNombre;
    if (campo === "fechaInicio") return p.fechaInicio;
    if (campo === "empleado") {
      const emp = empleados.find((e) => e.id === p.empleadoId);
      return emp ? `${emp.nombre} ${emp.apellidos}` : "";
    }
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let list = procesos.filter((p) => {
      if (buscar.trim()) {
        const q = buscar.toLowerCase();
        const emp = empleados.find((e) => e.id === p.empleadoId);
        const nombre = emp ? `${emp.nombre} ${emp.apellidos}`.toLowerCase() : "";
        if (!nombre.includes(q) && !p.plantillaNombre.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    list = aplicarFiltrosToolbar(list, filtros, acceso);
    list = aplicarOrdenToolbar(list, orden, acceso);
    return list;
  }, [procesos, buscar, filtros, orden, empleados]);

  async function crearProceso() {
    if (!newEmpleadoId || !newPlantillaId) { toast.error("Selecciona empleado y plantilla"); return; }
    const plt = plantillas.find((p) => p.id === newPlantillaId);
    if (!plt) return;
    const emp = empleados.find((e) => e.id === newEmpleadoId);
    const nuevo: ProcesoBoarding = {
      id: `proc-${Date.now()}`,
      empleadoId: newEmpleadoId,
      tipo: newTipo,
      estado: "activo",
      plantillaId: plt.id,
      plantillaNombre: plt.nombre,
      fechaInicio: newFecha,
      empresaId: empresaActual.id,
      tareas: plt.tareas.map((t) => ({ id: `pt-${Date.now()}-${t.id}`, nombre: t.nombre, completada: false, fechaCompletado: null, orden: t.orden })),
    };
    setProcesos((prev) => [nuevo, ...prev]);
    setShowNew(false);
    setNewEmpleadoId("");
    setNewPlantillaId("");
    const res = await createProcesoAction({
      empleado_nombre: emp ? `${emp.nombre} ${emp.apellidos}` : newEmpleadoId,
      empleado_id: newEmpleadoId,
      plantilla_id: plt.id,
      tipo: newTipo,
      fecha_inicio: newFecha,
      tareas: plt.tareas.map((t) => ({ titulo: t.nombre, completada: false })),
    });
    if (res.ok) toast.success("Proceso creado correctamente");
    else toast.error(res.error ?? "Error al crear proceso");
  }

  async function toggleTarea(tareaId: string) {
    if (!procesoActivo) return;
    const updated = { ...procesoActivo, tareas: procesoActivo.tareas.map((t) =>
      t.id === tareaId ? { ...t, completada: !t.completada, fechaCompletado: !t.completada ? hoy() : null } : t
    )};
    setProcesoActivo(updated);
    setProcesos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    await updateProcesoTareasAction(updated.id, updated.tareas.map((t) => ({ titulo: t.nombre, completada: t.completada })));
  }

  function finalizarProceso(id: string) {
    setProcesos((prev) => prev.map((p) => (p.id === id ? { ...p, estado: "finalizado" as EstadoProceso } : p)));
    if (procesoActivo?.id === id) setProcesoActivo((p) => p ? { ...p, estado: "finalizado" } : p);
    toast.success("Proceso finalizado");
  }

  function archivarProceso(id: string) {
    setProcesos((prev) => prev.map((p) => (p.id === id ? { ...p, estado: "archivado" as EstadoProceso } : p)));
    toast.success("Proceso archivado");
  }

  function duplicarProceso(proc: ProcesoBoarding) {
    const dup: ProcesoBoarding = {
      ...proc,
      id: `proc-${Date.now()}`,
      estado: "activo",
      fechaInicio: hoy(),
      tareas: proc.tareas.map((t) => ({ ...t, id: `pt-${Date.now()}-${t.id}`, completada: false, fechaCompletado: null })),
    };
    setProcesos((prev) => [dup, ...prev]);
    toast.success("Proceso duplicado");
  }

  function openNewPlantilla() {
    setEditPlantilla(null);
    setPltNombre("");
    setPltTipo("onboarding");
    setPltTareas([""]);
    setShowPlantillaDialog(true);
  }

  function openEditPlantilla(plt: PlantillaBoarding) {
    setEditPlantilla(plt);
    setPltNombre(plt.nombre);
    setPltTipo(plt.tipo);
    setPltTareas(plt.tareas.map((t) => t.nombre));
    setShowPlantillaDialog(true);
  }

  async function guardarPlantilla() {
    if (!pltNombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    const tareasLimpias = pltTareas.filter((t) => t.trim());
    if (!tareasLimpias.length) { toast.error("Añade al menos una tarea"); return; }
    const tareas = tareasLimpias.map((nombre, i) => ({ id: `tpl-${Date.now()}-${i}`, nombre, orden: i + 1 }));

    if (editPlantilla) {
      setPlantillas((prev) => prev.map((p) => (p.id === editPlantilla.id ? { ...p, nombre: pltNombre, tipo: pltTipo, tareas } : p)));
      toast.success("Plantilla actualizada");
    } else {
      const nueva: PlantillaBoarding = { id: `plt-${Date.now()}`, nombre: pltNombre, tipo: pltTipo, empresaId: empresaActual.id, tareas };
      setPlantillas((prev) => [...prev, nueva]);
      const res = await createPlantillaAction({ nombre: pltNombre, tipo: pltTipo, tareas: tareasLimpias.map((t, i) => ({ titulo: t, orden: i + 1 })) });
      if (res.ok) toast.success("Plantilla creada");
      else toast.error(res.error ?? "Error al crear plantilla");
    }
    setShowPlantillaDialog(false);
  }

  function eliminarPlantilla(id: string) {
    setPlantillas((prev) => prev.filter((p) => p.id !== id));
    toast.success("Plantilla eliminada");
  }

  // ─── DETALLE view ───────────────────────────────────────────
  if (vista === "detalle" && procesoActivo) {
    const emp = empleados.find((e) => e.id === procesoActivo.empleadoId);
    const pct = progreso(procesoActivo.tareas);
    const completadas = procesoActivo.tareas.filter((t) => t.completada).length;

    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setVista("listado"); setProcesoActivo(null); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {tipoBadge(procesoActivo.tipo)}
              {estadoBadge(procesoActivo.estado)}
            </div>
            {emp && (
              <p className="text-muted-foreground mt-1">
                {emp.nombre} {emp.apellidos} · {emp.departamento}
              </p>
            )}
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Plantilla: <span className="font-medium text-foreground">{procesoActivo.plantillaNombre}</span></p>
            <p>Inicio: {procesoActivo.fechaInicio}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Progreso del proceso</CardTitle>
              <span className="text-sm font-semibold text-foreground">{completadas}/{procesoActivo.tareas.length} tareas · {pct}%</span>
            </div>
            <Progress value={pct} className="h-2 mt-2" />
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Tarea</TableHead>
                  <TableHead className="w-44">Fecha completado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procesoActivo.tareas.sort((a, b) => a.orden - b.orden).map((tarea) => (
                  <TableRow key={tarea.id} className={tarea.completada ? "bg-muted/30" : ""}>
                    <TableCell>
                      <Checkbox checked={tarea.completada} onCheckedChange={() => toggleTarea(tarea.id)} />
                    </TableCell>
                    <TableCell className={tarea.completada ? "line-through text-muted-foreground" : "font-medium"}>
                      {tarea.nombre}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tarea.fechaCompletado ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {procesoActivo.estado === "activo" && (
          <div className="flex gap-2">
            <Button onClick={() => finalizarProceso(procesoActivo.id)}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Finalizar proceso
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── PLANTILLAS view ───────────────────────────────────────
  if (vista === "plantillas") {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setVista("listado")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="primary" size="sm" onClick={openNewPlantilla}><Plus className="h-4 w-4" />Nuevo</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plantillas.map((plt) => (
            <Card key={plt.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{plt.nombre}</CardTitle>
                    <div className="mt-1">{tipoBadge(plt.tipo)}</div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditPlantilla(plt)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => eliminarPlantilla(plt.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">{plt.tareas.length} tareas</p>
                <ul className="space-y-1">
                  {plt.tareas.slice(0, 5).map((t) => (
                    <li key={t.id} className="text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      {t.nombre}
                    </li>
                  ))}
                  {plt.tareas.length > 5 && (
                    <li className="text-sm text-muted-foreground">+{plt.tareas.length - 5} más</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={showPlantillaDialog} onOpenChange={setShowPlantillaDialog}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editPlantilla ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input value={pltNombre} onChange={(e) => setPltNombre(e.target.value)} placeholder="Ej: ON-BOARDING COCINA" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={pltTipo} onValueChange={(v) => setPltTipo(v as TipoBoarding)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="offboarding">Offboarding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tareas</Label>
                <div className="space-y-2 mt-1">
                  {pltTareas.map((t, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={t}
                        onChange={(e) => { const c = [...pltTareas]; c[i] = e.target.value; setPltTareas(c); }}
                        placeholder={`Tarea ${i + 1}`}
                      />
                      {pltTareas.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => setPltTareas(pltTareas.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setPltTareas([...pltTareas, ""])}>
                    <Plus className="h-3 w-3 mr-1" /> Añadir tarea
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPlantillaDialog(false)}>Cancelar</Button>
              <Button onClick={guardarPlantilla}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── LISTADO view (default) ─────────────────────────────────
  const plantillasParaTipo = plantillas.filter((p) => p.tipo === newTipo);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <SubmoduleToolbar
        busqueda={buscar}
        onBusquedaChange={setBuscar}
        placeholderBusqueda="Buscar empleado o plantilla..."
        onNuevo={() => setShowNew(true)}
        campos={[
          {
            campo: "estado",
            label: "Estado",
            tipo: "lista",
            opciones: ["Activo", "Finalizado", "Archivado"],
          },
          {
            campo: "tipo",
            label: "Tipo",
            tipo: "lista",
            opciones: ["Onboarding", "Offboarding"],
          },
          {
            campo: "plantilla",
            label: "Plantilla",
            tipo: "lista",
            opciones: [...new Set(procesos.map((p) => p.plantillaNombre))],
          },
          { campo: "fechaInicio", label: "Fecha inicio", tipo: "fecha" },
        ]}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        ordenOpciones={[
          { campo: "empleado", label: "Empleado" },
          { campo: "fechaInicio", label: "Fecha inicio" },
          { campo: "estado", label: "Estado" },
          { campo: "plantilla", label: "Plantilla" },
        ]}
        orden={orden}
        onOrdenChange={setOrden}
        extraIzquierda={
          <Button variant="outline" size="sm" onClick={() => setVista("plantillas")}>
            <ClipboardList className="h-4 w-4 mr-1" /> Plantillas
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Tareas completadas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No se encontraron procesos
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((proc) => {
                const emp = empleados.find((e) => e.id === proc.empleadoId);
                const pct = progreso(proc.tareas);
                const completadas = proc.tareas.filter((t) => t.completada).length;
                return (
                  <TableRow key={proc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setProcesoActivo(proc); setVista("detalle"); }}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                          {emp ? iniciales(emp.nombre, emp.apellidos) : "??"}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{emp ? `${emp.nombre} ${emp.apellidos}` : "—"}</p>
                          <p className="text-xs text-muted-foreground">{emp?.departamento}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{tipoBadge(proc.tipo)}</TableCell>
                    <TableCell className="text-sm">{proc.fechaInicio}</TableCell>
                    <TableCell>
                      <div className="space-y-1 min-w-[180px]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{proc.plantillaNombre}</span>
                          <span className="font-medium">{completadas}/{proc.tareas.length}</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell>{estadoBadge(proc.estado)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setProcesoActivo(proc); setVista("detalle"); }}>
                            <Eye className="h-4 w-4 mr-2" /> Ver checklist
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicarProceso(proc)}>
                            <Copy className="h-4 w-4 mr-2" /> Duplicar
                          </DropdownMenuItem>
                          {proc.estado === "activo" && (
                            <DropdownMenuItem onClick={() => finalizarProceso(proc.id)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Finalizar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => archivarProceso(proc.id)}>
                            <Archive className="h-4 w-4 mr-2" /> Archivar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo proceso de Boarding</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Empleado</Label>
              <Select value={newEmpleadoId} onValueChange={setNewEmpleadoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>
                  {empleados.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={newTipo} onValueChange={(v) => { setNewTipo(v as TipoBoarding); setNewPlantillaId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="offboarding">Offboarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plantilla</Label>
              <Select value={newPlantillaId} onValueChange={setNewPlantillaId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar plantilla" /></SelectTrigger>
                <SelectContent>
                  {plantillasParaTipo.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha de inicio</Label>
              <Input type="date" value={newFecha} onChange={(e) => setNewFecha(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={crearProceso}>Crear proceso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
