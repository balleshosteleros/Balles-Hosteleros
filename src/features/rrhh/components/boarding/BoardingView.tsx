"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getEmpleadosActivos, type EmpleadoActivo } from "@/features/rrhh/actions/empleados-actions";
import {
  type ProcesoBoarding,
  type PlantillaBoarding,
  type TareaProceso,
  type TipoBoarding,
  type EstadoProceso,
} from "@/features/rrhh/data/boarding";
import {
  listPlantillas as listPlantillasAction,
  createPlantilla as createPlantillaAction,
  updatePlantilla as updatePlantillaAction,
  deletePlantilla as deletePlantillaAction,
  listProcesos as listProcesosAction,
  createProceso as createProcesoAction,
  updateProcesoTareas as updateProcesoTareasAction,
  setEstadoProceso as setEstadoProcesoAction,
  duplicarProceso as duplicarProcesoAction,
} from "@/features/rrhh/actions/boarding-actions";
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
  Plus, MoreHorizontal, Eye, Pencil, Copy, CheckCircle2, Archive, ArrowLeft, ClipboardList, Trash2, Settings,
} from "lucide-react";
import { toast } from "sonner";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { boardingIO } from "@/features/rrhh/io/boarding.io";

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
  // Empleados reales (OLA2-01) para el selector y la resolución de nombres por
  // empleado_id (= empleados.id). Procesos y plantillas son reales desde OLA2-04.
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

  const [procesos, setProcesos] = useState<ProcesoBoarding[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaBoarding[]>([]);
  const [loading, setLoading] = useState(true);

  const [vista, setVista] = useState<"listado" | "plantillas" | "detalle">("listado");
  const [procesoActivo, setProcesoActivo] = useState<ProcesoBoarding | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // OLA2-04: fuente única = BD (sin fallback al mock). Pasamos el dbId
      // explícito para evitar la carrera con la cookie de empresa activa al
      // cambiar de empresa; RLS filtra por empresa en ambos casos.
      const [pltRes, procRes] = await Promise.all([
        listPlantillasAction(empresaActual.dbId),
        listProcesosAction(empresaActual.dbId),
      ]);
      setPlantillas(pltRes.ok ? pltRes.data : []);
      setProcesos(procRes.ok ? procRes.data : []);
    } catch (err) {
      console.error("[boarding] loadData:", err);
      setPlantillas([]);
      setProcesos([]);
    } finally {
      setLoading(false);
    }
  }, [empresaActual.dbId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [buscar, setBuscar] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);

  const [showNew, setShowNew] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
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
      const emp = empleados.find((e) => e.empleadoId === p.empleadoId);
      return emp ? `${emp.nombre} ${emp.apellidos}` : "";
    }
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let list = procesos.filter((p) => {
      if (buscar.trim()) {
        const q = buscar.toLowerCase();
        const emp = empleados.find((e) => e.empleadoId === p.empleadoId);
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
    const tempId = `temp-${Date.now()}`;
    const optimista: ProcesoBoarding = {
      id: tempId,
      empleadoId: newEmpleadoId, // = empleados.id (selector real OLA2-01)
      tipo: newTipo,
      estado: "activo",
      plantillaId: plt.id,
      plantillaNombre: plt.nombre,
      fechaInicio: newFecha,
      empresaId: empresaActual.dbId ?? "",
      tareas: plt.tareas.map((t) => ({ id: t.id, nombre: t.nombre, completada: false, fechaCompletado: null, orden: t.orden })),
    };
    setProcesos((prev) => [optimista, ...prev]);
    setShowNew(false);
    const empleadoIdSel = newEmpleadoId;
    setNewEmpleadoId("");
    setNewPlantillaId("");
    const res = await createProcesoAction({
      empleadoId: empleadoIdSel,
      plantillaId: plt.id,
      plantillaNombre: plt.nombre,
      tipo: newTipo,
      fechaInicio: newFecha,
      tareas: plt.tareas.map((t) => ({ titulo: t.nombre, completada: false, orden: t.orden })),
    });
    if (res.ok) {
      setProcesos((prev) => prev.map((p) => (p.id === tempId ? res.data : p)));
      toast.success("Proceso creado correctamente");
    } else {
      setProcesos((prev) => prev.filter((p) => p.id !== tempId));
      toast.error(res.error ?? "Error al crear proceso");
    }
  }

  async function toggleTarea(tareaId: string) {
    if (!procesoActivo) return;
    const prevProceso = procesoActivo;
    const updated = { ...prevProceso, tareas: prevProceso.tareas.map((t) =>
      t.id === tareaId ? { ...t, completada: !t.completada, fechaCompletado: !t.completada ? hoy() : null } : t
    )};
    setProcesoActivo(updated);
    setProcesos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    const res = await updateProcesoTareasAction(
      updated.id,
      updated.tareas.map((t) => ({ titulo: t.nombre, completada: t.completada, orden: t.orden, fechaCompletado: t.fechaCompletado })),
    );
    if (!res.ok) {
      setProcesoActivo(prevProceso);
      setProcesos((prev) => prev.map((p) => (p.id === prevProceso.id ? prevProceso : p)));
      toast.error(res.error ?? "No se pudo guardar el cambio");
    }
  }

  async function finalizarProceso(id: string) {
    const snapshot = procesos;
    setProcesos((prev) => prev.map((p) => (p.id === id ? { ...p, estado: "finalizado" as EstadoProceso } : p)));
    if (procesoActivo?.id === id) setProcesoActivo((p) => (p ? { ...p, estado: "finalizado" } : p));
    const res = await setEstadoProcesoAction(id, "finalizado");
    if (res.ok) {
      toast.success("Proceso finalizado");
    } else {
      setProcesos(snapshot);
      if (procesoActivo?.id === id) setProcesoActivo((p) => (p ? { ...p, estado: "activo" } : p));
      toast.error(res.error ?? "No se pudo finalizar");
    }
  }

  async function archivarProceso(id: string) {
    const snapshot = procesos;
    setProcesos((prev) => prev.map((p) => (p.id === id ? { ...p, estado: "archivado" as EstadoProceso } : p)));
    const res = await setEstadoProcesoAction(id, "archivado");
    if (res.ok) {
      toast.success("Proceso archivado");
    } else {
      setProcesos(snapshot);
      toast.error(res.error ?? "No se pudo archivar");
    }
  }

  async function duplicarProceso(proc: ProcesoBoarding) {
    const res = await duplicarProcesoAction(proc.id);
    if (res.ok) {
      setProcesos((prev) => [res.data, ...prev]);
      toast.success("Proceso duplicado");
    } else {
      toast.error(res.error ?? "No se pudo duplicar");
    }
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
    const tareas = tareasLimpias.map((nombre, i) => ({ id: `t${i + 1}`, nombre, orden: i + 1 }));
    const tareasInput = tareasLimpias.map((t, i) => ({ titulo: t, orden: i + 1 }));

    if (editPlantilla) {
      const target = editPlantilla;
      const snapshot = plantillas;
      setPlantillas((prev) => prev.map((p) => (p.id === target.id ? { ...p, nombre: pltNombre, tipo: pltTipo, tareas } : p)));
      setShowPlantillaDialog(false);
      const res = await updatePlantillaAction({ id: target.id, nombre: pltNombre, tipo: pltTipo, tareas: tareasInput });
      if (res.ok) toast.success("Plantilla actualizada");
      else { setPlantillas(snapshot); toast.error(res.error ?? "Error al actualizar plantilla"); }
    } else {
      const tempId = `temp-${Date.now()}`;
      const optimista: PlantillaBoarding = { id: tempId, nombre: pltNombre, tipo: pltTipo, empresaId: empresaActual.dbId ?? "", tareas };
      setPlantillas((prev) => [...prev, optimista]);
      setShowPlantillaDialog(false);
      const res = await createPlantillaAction({ nombre: pltNombre, tipo: pltTipo, tareas: tareasInput });
      if (res.ok) { setPlantillas((prev) => prev.map((p) => (p.id === tempId ? res.data : p))); toast.success("Plantilla creada"); }
      else { setPlantillas((prev) => prev.filter((p) => p.id !== tempId)); toast.error(res.error ?? "Error al crear plantilla"); }
    }
  }

  async function eliminarPlantilla(id: string) {
    const snapshot = plantillas;
    setPlantillas((prev) => prev.filter((p) => p.id !== id));
    const res = await deletePlantillaAction(id);
    if (res.ok) toast.success("Plantilla eliminada");
    else { setPlantillas(snapshot); toast.error(res.error ?? "No se pudo eliminar"); }
  }

  // ─── DETALLE view ───────────────────────────────────────────
  if (vista === "detalle" && procesoActivo) {
    const emp = empleados.find((e) => e.empleadoId === procesoActivo.empleadoId);
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

  const columnasDef: ToolbarColumna[] = [
    { campo: "empleado", label: "Empleado" },
    { campo: "tipo", label: "Tipo" },
    { campo: "inicio", label: "Inicio" },
    { campo: "tareasCompletadas", label: "Tareas completadas" },
    { campo: "estado", label: "Estado" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (proc: ProcesoBoarding) => ReactNode }> = {
    empleado: {
      th: <TableHead key="empleado">Empleado</TableHead>,
      td: (proc) => {
        const emp = empleados.find((e) => e.empleadoId === proc.empleadoId);
        return (
          <TableCell key="empleado">
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
        );
      },
    },
    tipo: {
      th: <TableHead key="tipo">Tipo</TableHead>,
      td: (proc) => (
        <TableCell key="tipo">{tipoBadge(proc.tipo)}</TableCell>
      ),
    },
    inicio: {
      th: <TableHead key="inicio">Inicio</TableHead>,
      td: (proc) => (
        <TableCell key="inicio" className="text-sm">{proc.fechaInicio}</TableCell>
      ),
    },
    tareasCompletadas: {
      th: <TableHead key="tareasCompletadas">Tareas completadas</TableHead>,
      td: (proc) => {
        const pct = progreso(proc.tareas);
        const completadas = proc.tareas.filter((t) => t.completada).length;
        return (
          <TableCell key="tareasCompletadas">
            <div className="space-y-1 min-w-[180px]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{proc.plantillaNombre}</span>
                <span className="font-medium">{completadas}/{proc.tareas.length}</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          </TableCell>
        );
      },
    },
    estado: {
      th: <TableHead key="estado">Estado</TableHead>,
      td: (proc) => (
        <TableCell key="estado">{estadoBadge(proc.estado)}</TableCell>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <SubmoduleToolbar
        busqueda={buscar}
        onBusquedaChange={setBuscar}
        placeholderBusqueda="Buscar"
        onNuevo={() => setShowNew(true)}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        orden={orden}
        onOrdenChange={setOrden}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraIzquierda={
          <Button variant="outline" size="sm" onClick={() => setVista("plantillas")}>
            <ClipboardList className="h-4 w-4 mr-1" /> Plantillas
          </Button>
        }
        extraDerecha={
          <>
            <IOActions config={boardingIO} context={{ empresaId: empresaActual.id }} onSuccess={() => window.location.reload()} />
            <Button
              size="icon"
              variant={showConfig ? "default" : "outline"}
              className="h-9 w-9"
              onClick={() => setShowConfig((v) => !v)}
              title="Configuración"
              aria-label="Configuración"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columnasRender.map((c) => columnDefs[c.campo]?.th)}
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
              {filtered.map((proc) => (
                <TableRow key={proc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setProcesoActivo(proc); setVista("detalle"); }}>
                  {columnasRender.map((c) => columnDefs[c.campo]?.td(proc))}
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
              ))}
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
                    <SelectItem key={e.empleadoId} value={e.empleadoId}>{e.nombre} {e.apellidos}</SelectItem>
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
