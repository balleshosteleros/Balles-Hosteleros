"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { ESTADO_FICHAJE_LABEL, ESTADO_FICHAJE_COLOR, TIPOS_INCIDENCIA_LABEL, TIPO_FICHAJE_LABEL, TIPO_FICHAJE_BADGE } from "@/features/rrhh/data/fichajes";
import type { EstadoFichaje, Fichaje, LocalGeo, ConfigFichajes, TipoFichajeCodigo } from "@/features/rrhh/data/fichajes";
import { listFichajes, ficharSalida, updateFichaje, crearFichajeManual } from "@/features/rrhh/actions/fichajes-actions";
import { listEmpleados } from "@/features/rrhh/actions/empleados-actions";
import { obtenerPosicionActual } from "@/features/rrhh/utils/geo";
import {
  getFichajeGeoStatus,
  FICHAJE_GEO_STATUS_LABEL,
} from "@/features/rrhh/utils/fichaje-geo-status";
import { GeoBadge } from "@/features/rrhh/components/fichajes/geo-badge";
import { FichajeUbicacionMiniMap } from "@/features/rrhh/components/fichajes/FichajeUbicacionMiniMap";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { toast } from "sonner";

async function intentarGeo() {
  try {
    return await obtenerPosicionActual();
  } catch {
    return null;
  }
}

type EmpleadoOpcion = { id: string; nombre: string };

const initialManualForm = () => ({
  empleadoId: "",
  fecha: new Date().toISOString().split("T")[0],
  horaEntrada: "",
  horaSalida: "",
  pausaInicio: "",
  pausaFin: "",
  observaciones: "",
});
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Settings, Settings2, ClipboardList, History } from "lucide-react";
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
import { fichajesIO } from "@/features/rrhh/io/fichajes.io";
import { formatHorasDecimal } from "@/shared/lib/timeUtils";

function mapDbToFichaje(row: Record<string, unknown>): Fichaje {
  const localRaw = row.locales as
    | {
        id: string;
        nombre: string;
        lat: number | null;
        lng: number | null;
        radio_metros: number;
        color: string;
      }
    | null;
  const local: LocalGeo | null = localRaw
    ? {
        id: localRaw.id,
        nombre: localRaw.nombre,
        lat: localRaw.lat,
        lng: localRaw.lng,
        radioMetros: localRaw.radio_metros,
        color: localRaw.color,
      }
    : null;

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
    tipo: ((row.tipo as TipoFichajeCodigo) ?? "ENT") as TipoFichajeCodigo,
    // ─── Auditoría geográfica (PRP-037, TASK-002.02) ────────────────────
    latEntrada: (row.lat_entrada as number | null) ?? null,
    lngEntrada: (row.lng_entrada as number | null) ?? null,
    precisionEntradaMetros: (row.precision_entrada_metros as number | null) ?? null,
    latSalida: (row.lat_salida as number | null) ?? null,
    lngSalida: (row.lng_salida as number | null) ?? null,
    precisionSalidaMetros: (row.precision_salida_metros as number | null) ?? null,
    modoTeletrabajo: Boolean(row.modo_teletrabajo),
    local,
    distanciaEntradaMetros: (row.distancia_entrada_metros as number | null) ?? null,
    distanciaSalidaMetros: (row.distancia_salida_metros as number | null) ?? null,
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
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [fichajeModal, setFichajeModal] = useState<Fichaje | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showNuevo, setShowNuevo] = useState(false);
  const [empleadosOpts, setEmpleadosOpts] = useState<EmpleadoOpcion[]>([]);
  const [manualForm, setManualForm] = useState(initialManualForm());
  const [savingManual, setSavingManual] = useState(false);
  const [detalleNotas, setDetalleNotas] = useState("");
  const [savingDetalle, setSavingDetalle] = useState(false);

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

  useEffect(() => {
    setDetalleNotas(fichajeModal?.observaciones ?? "");
  }, [fichajeModal]);

  const openNuevoDialog = useCallback(async () => {
    setManualForm(initialManualForm());
    setShowNuevo(true);
    const res = await listEmpleados();
    if (res.ok) {
      const opciones: EmpleadoOpcion[] = (res.data as Array<Record<string, unknown>>)
        .filter((e) => (e.estado as string) === "Activo")
        .map((e) => ({
          id: e.id as string,
          nombre: `${(e.nombre as string) ?? ""} ${(e.apellidos as string) ?? ""}`.trim(),
        }));
      setEmpleadosOpts(opciones);
    } else {
      toast.error("No se pudo cargar la lista de empleados");
    }
  }, []);

  const submitFichajeManual = useCallback(async () => {
    if (!manualForm.empleadoId) {
      toast.error("Selecciona un empleado");
      return;
    }
    if (!manualForm.horaEntrada) {
      toast.error("La hora de entrada es obligatoria");
      return;
    }
    setSavingManual(true);
    const res = await crearFichajeManual({
      empleadoId: manualForm.empleadoId,
      fecha: manualForm.fecha,
      horaEntrada: manualForm.horaEntrada,
      horaSalida: manualForm.horaSalida || null,
      pausaInicio: manualForm.pausaInicio || null,
      pausaFin: manualForm.pausaFin || null,
      observaciones: manualForm.observaciones || null,
    });
    setSavingManual(false);
    if (res.ok) {
      toast.success("Fichaje creado");
      setShowNuevo(false);
      loadFichajes();
    } else {
      toast.error(res.error ?? "Error al crear el fichaje");
    }
  }, [manualForm, loadFichajes]);

  const incidencias = useMemo(() => fichajes.filter(f => Boolean(f.incidencia)).map(f => ({
    id: f.id,
    fichajeId: f.id,
    empleadoNombre: f.empleadoNombre,
    fecha: f.fecha,
    tipo: "fichaje_incompleto" as const,
    descripcion: f.incidencia ?? "Incidencia detectada",
    resuelta: false,
  })), [fichajes]);

  const dptos = useMemo(() => [...new Set(fichajes.map(f => f.departamento))].sort(), [fichajes]);

  const acceso = (f: Fichaje, campo: string): unknown => {
    if (campo === "estado") return ESTADO_FICHAJE_LABEL[f.estado];
    if (campo === "departamento") return f.departamento;
    if (campo === "centro") return f.centro;
    if (campo === "horasTotales") return f.horasTotales;
    if (campo === "fecha") return f.fecha;
    if (campo === "empleado") return f.empleadoNombre;
    if (campo === "geo") {
      // Para orden: usar distancia (null → Infinity sortea al final asc).
      // Para filtro: el campo es categórico derivado; se aplica fuera del
      // flujo genérico (ver useMemo fichajesFiltrados).
      return f.distanciaEntradaMetros ?? Number.POSITIVE_INFINITY;
    }
    return (f as unknown as Record<string, unknown>)[campo];
  };

  const fichajesFiltrados = useMemo(() => {
    let lista = fichajes.filter(f => {
      if (busqueda && !f.empleadoNombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
      return true;
    });

    // Filtro geo: el status es un categórico derivado (`getFichajeGeoStatus`),
    // no un campo directo del fichaje. Se aplica fuera de aplicarFiltrosToolbar
    // igual que el filtro "empresas" hace en EmpleadosView.
    const filtrosGeo = filtros.filter((fi) => fi.campo === "geo");
    const otrosFiltros = filtros.filter((fi) => fi.campo !== "geo");
    lista = aplicarFiltrosToolbar(lista, otrosFiltros, acceso);
    if (filtrosGeo.length > 0) {
      lista = lista.filter((fic) => {
        const status = getFichajeGeoStatus(fic, fic.local ?? null);
        const label = FICHAJE_GEO_STATUS_LABEL[status];
        return filtrosGeo.every((filtro) =>
          filtro.valores?.includes(label),
        );
      });
    }

    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [fichajes, busqueda, filtros, orden]);

  const incidenciasPendientes = incidencias.filter(i => !i.resuelta);

  const columnasDef: ToolbarColumna[] = [
    { campo: "empleado", label: "Empleado" },
    { campo: "fecha", label: "Fecha" },
    { campo: "entrada", label: "Entrada" },
    { campo: "salida", label: "Salida" },
    { campo: "pausa", label: "Descanso" },
    { campo: "horas", label: "Horas" },
    { campo: "tipo", label: "Tipo" },
    { campo: "geo", label: "Geo" },
  ];

  function formatHora(s: string | null): string {
    if (!s) return "—";
    if (s.includes("T")) {
      return new Date(s).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    }
    return s.slice(0, 5);
  }

  const columnDefs: Record<string, { th: ReactNode; td: (f: Fichaje) => ReactNode }> = {
    empleado: {
      th: <TableHead key="empleado">Empleado</TableHead>,
      td: (f) => (
        <TableCell key="empleado"><div><p className="font-medium text-sm">{f.empleadoNombre}</p><p className="text-xs text-muted-foreground">{f.departamento}</p></div></TableCell>
      ),
    },
    fecha: {
      th: <TableHead key="fecha">Fecha</TableHead>,
      td: (f) => (
        <TableCell key="fecha" className="text-sm">{f.fecha}</TableCell>
      ),
    },
    entrada: {
      th: <TableHead key="entrada">Entrada</TableHead>,
      td: (f) => (
        <TableCell key="entrada" className="text-sm">{formatHora(f.horaEntrada)}</TableCell>
      ),
    },
    salida: {
      th: <TableHead key="salida">Salida</TableHead>,
      td: (f) => (
        <TableCell key="salida" className="text-sm">{formatHora(f.horaSalida)}</TableCell>
      ),
    },
    pausa: {
      th: <TableHead key="pausa">Descanso</TableHead>,
      td: (f) => (
        <TableCell key="pausa" className="text-sm">{f.pausaInicio && f.pausaFin ? `${f.pausaInicio.slice(0,5)}–${f.pausaFin.slice(0,5)}` : "—"}</TableCell>
      ),
    },
    horas: {
      th: <TableHead key="horas" className="text-right">Horas</TableHead>,
      td: (f) => (
        <TableCell key="horas" className="text-sm text-right font-medium">{f.horaSalida ? formatHorasDecimal(f.horasTotales) : "—"}</TableCell>
      ),
    },
    tipo: {
      th: <TableHead key="tipo">Tipo</TableHead>,
      td: (f) => {
        const codigo = (f.tipo ?? "ENT") as TipoFichajeCodigo;
        return (
          <TableCell key="tipo">
            <Badge variant="outline" className={`text-xs ${TIPO_FICHAJE_BADGE[codigo]}`}>
              {TIPO_FICHAJE_LABEL[codigo]}
            </Badge>
          </TableCell>
        );
      },
    },
    geo: {
      // Esta columna usa TableColumnHeader (en vez de TableHead simple) para
      // exponer el filtro de lista y el orden por distancia desde la propia
      // celda de cabecera. Mismo patrón que EmpleadosView aplica a "empresas".
      th: (
        <TableColumnHeader
          key="geo"
          label="Geo"
          campo="geo"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
          filtroTipo="lista"
          opciones={Object.values(FICHAJE_GEO_STATUS_LABEL)}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (f) => (
        <TableCell key="geo">
          <GeoBadge fichaje={f} />
        </TableCell>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="fichajes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fichajes" className="gap-1"><ClipboardList className="h-4 w-4" />Fichajes</TabsTrigger>
          <TabsTrigger value="historial" className="gap-1"><History className="h-4 w-4" />Historial</TabsTrigger>
          <TabsTrigger value="incidencias" className="gap-1"><AlertTriangle className="h-4 w-4" />Incidencias</TabsTrigger>
          <TabsTrigger value="config" aria-label="Configuración" className="ml-auto"><Settings2 className="h-4 w-4" strokeWidth={1.75} /></TabsTrigger>
        </TabsList>

        <TabsContent value="fichajes" className="space-y-4">
          <SubmoduleToolbar
            busqueda={busqueda}
            onBusquedaChange={setBusqueda}
            placeholderBusqueda="Buscar"
            onNuevo={openNuevoDialog}
            filtros={filtros}
            onFiltrosChange={setFiltros}
            orden={orden}
            onOrdenChange={setOrden}
            columnas={columnasDef}
            columnasVisibles={columnasVisibles}
            onColumnasVisiblesChange={setColumnasVisibles}
            columnasOrden={columnasOrden}
            onColumnasOrdenChange={setColumnasOrden}
            extraDerecha={
              <>
                <IOActions
                  config={fichajesIO}
                  context={{ empresaId: empresaActual.id }}
                  exportRecords={fichajesFiltrados}
                  onSuccess={() => window.location.reload()}
                />
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
            <Table>
              <TableHeader>
                <TableRow>
                  {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fichajesFiltrados.map(f => (
                  <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setFichajeModal(f)}>
                    {columnasRender.map((c) => columnDefs[c.campo]?.td(f))}
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
                  <TableHead>Tipo</TableHead><TableHead>Incidencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...fichajes].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(f => {
                  const codigo = (f.tipo ?? "ENT") as TipoFichajeCodigo;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium text-sm">{f.empleadoNombre}</TableCell>
                      <TableCell className="text-sm">{f.fecha}</TableCell>
                      <TableCell className="text-sm">{formatHora(f.horaEntrada)}</TableCell>
                      <TableCell className="text-sm">{formatHora(f.horaSalida)}</TableCell>
                      <TableCell className="text-sm text-right">{f.horaSalida ? formatHorasDecimal(f.horasTotales) : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-xs ${TIPO_FICHAJE_BADGE[codigo]}`}>{TIPO_FICHAJE_LABEL[codigo]}</Badge></TableCell>
                      <TableCell className="text-sm">{f.incidencia ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  );
                })}
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
                  <TableRow
                    key={i.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      const fichaje = fichajes.find((f) => f.id === i.fichajeId);
                      if (fichaje) setFichajeModal(fichaje);
                    }}
                  >
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
                <div><Label className="font-medium">Descansos activos</Label><p className="text-xs text-muted-foreground">Permitir registrar descansos dentro del fichaje</p></div>
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
                <div><span className="text-muted-foreground">Tipo:</span>
                  {(() => {
                    const c = (fichajeModal.tipo ?? "ENT") as TipoFichajeCodigo;
                    return (
                      <Badge variant="outline" className={`mt-1 text-xs ${TIPO_FICHAJE_BADGE[c]}`}>
                        {TIPO_FICHAJE_LABEL[c]}
                      </Badge>
                    );
                  })()}
                </div>
                <div><span className="text-muted-foreground">Entrada:</span><p className="font-medium">{formatHora(fichajeModal.horaEntrada)}</p></div>
                <div><span className="text-muted-foreground">Salida:</span><p className="font-medium">{formatHora(fichajeModal.horaSalida)}</p></div>
                <div><span className="text-muted-foreground">Descanso:</span><p className="font-medium">{fichajeModal.pausaInicio && fichajeModal.pausaFin ? `${fichajeModal.pausaInicio.slice(0,5)} – ${fichajeModal.pausaFin.slice(0,5)}` : "—"}</p></div>
                <div><span className="text-muted-foreground">Horas totales:</span><p className="font-semibold">{fichajeModal.horaSalida ? formatHorasDecimal(fichajeModal.horasTotales) : "—"}</p></div>
              </div>
              {fichajeModal.incidencia && <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3"><p className="text-sm font-medium text-destructive">{fichajeModal.incidencia}</p></div>}
              <div className="space-y-1.5">
                <Label className="text-xs">Ubicación</Label>
                <FichajeUbicacionMiniMap fichaje={fichajeModal} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Observaciones RRHH</Label>
                <Textarea
                  value={detalleNotas}
                  onChange={(e) => setDetalleNotas(e.target.value)}
                  placeholder="Añade contexto o corrección manual"
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {fichajeModal && (
              <Button
                variant="outline"
                disabled={savingDetalle}
                onClick={async () => {
                  setSavingDetalle(true);
                  const res = await updateFichaje(fichajeModal.id, { notas: detalleNotas });
                  setSavingDetalle(false);
                  if (res.ok) {
                    toast.success("Observaciones guardadas");
                    setFichajeModal((prev) => prev ? { ...prev, observaciones: detalleNotas } : prev);
                    loadFichajes();
                  } else {
                    toast.error(res.error ?? "No se pudieron guardar las observaciones");
                  }
                }}
              >
                {savingDetalle ? "Guardando…" : "Guardar observaciones"}
              </Button>
            )}
            {fichajeModal && fichajeModal.incidencia && fichajeModal.horaSalida && (
              <Button
                disabled={savingDetalle}
                onClick={async () => {
                  setSavingDetalle(true);
                  const res = await updateFichaje(fichajeModal.id, {
                    notas: detalleNotas,
                    incidencia: null,
                    estado: "completado",
                  });
                  setSavingDetalle(false);
                  if (res.ok) {
                    toast.success("Incidencia resuelta");
                    setFichajeModal((prev) => prev ? {
                      ...prev,
                      observaciones: detalleNotas,
                      incidencia: null,
                      estado: "completado",
                    } : prev);
                    loadFichajes();
                  } else {
                    toast.error(res.error ?? "No se pudo resolver la incidencia");
                  }
                }}
              >
                Resolver incidencia
              </Button>
            )}
            {fichajeModal && !fichajeModal.horaSalida && fichajeModal.horaEntrada && (
              <Button onClick={async () => {
                const geo = await intentarGeo();
                const res = await ficharSalida(fichajeModal.id, geo);
                if (res.ok) { toast.success("Salida registrada"); setFichajeModal(null); loadFichajes(); }
                else toast.error(res.error ?? "Error al fichar salida");
              }}>Fichar salida</Button>
            )}
            <Button variant="outline" onClick={() => setFichajeModal(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNuevo} onOpenChange={(v) => !savingManual && setShowNuevo(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo fichaje manual</DialogTitle>
            <CardDescription className="text-xs">
              Crea un fichaje a un empleado sin pasar por el botón &quot;Fichar&quot; de Mi Panel. Quedará marcado como validado por ti.
            </CardDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <Label className="text-xs">Empleado</Label>
              <select
                className="w-full border rounded-md h-9 px-2 bg-background"
                value={manualForm.empleadoId}
                onChange={(e) => setManualForm((f) => ({ ...f, empleadoId: e.target.value }))}
              >
                <option value="">Selecciona un empleado…</option>
                {empleadosOpts.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.nombre || "—"}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={manualForm.fecha}
                  onChange={(e) => setManualForm((f) => ({ ...f, fecha: e.target.value }))}
                />
              </div>
              <div />
              <div className="space-y-1">
                <Label className="text-xs">Hora entrada</Label>
                <Input
                  type="time"
                  value={manualForm.horaEntrada}
                  onChange={(e) => setManualForm((f) => ({ ...f, horaEntrada: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hora salida (opcional)</Label>
                <Input
                  type="time"
                  value={manualForm.horaSalida}
                  onChange={(e) => setManualForm((f) => ({ ...f, horaSalida: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pausa inicio (opcional)</Label>
                <Input
                  type="time"
                  value={manualForm.pausaInicio}
                  onChange={(e) => setManualForm((f) => ({ ...f, pausaInicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pausa fin (opcional)</Label>
                <Input
                  type="time"
                  value={manualForm.pausaFin}
                  onChange={(e) => setManualForm((f) => ({ ...f, pausaFin: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observaciones</Label>
              <Input
                placeholder="Motivo del registro manual"
                value={manualForm.observaciones}
                onChange={(e) => setManualForm((f) => ({ ...f, observaciones: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevo(false)} disabled={savingManual}>
              Cancelar
            </Button>
            <Button onClick={submitFichajeManual} disabled={savingManual}>
              {savingManual ? "Guardando…" : "Crear fichaje"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
