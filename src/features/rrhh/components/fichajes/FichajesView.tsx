"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { ESTADO_FICHAJE_LABEL, TIPO_FICHAJE_LABEL, TIPO_FICHAJE_BADGE, fichajeColorBadge } from "@/features/rrhh/data/fichajes";
import type { EstadoFichaje, Fichaje, LocalGeo, ConfigFichajes, TipoFichajeCodigo } from "@/features/rrhh/data/fichajes";
import { listFichajes, crearFichajeManual } from "@/features/rrhh/actions/fichajes-actions";
import { listTiposFichaje, type TipoFichajeRow } from "@/features/rrhh/actions/horarios-config-actions";
import { listEmpleados } from "@/features/rrhh/actions/empleados-actions";
import { FichajeDetalleDialog } from "@/features/rrhh/components/fichajes/FichajeDetalleDialog";
import { listLocales } from "@/features/ajustes/actions/locales-actions";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { toast } from "sonner";

type EmpleadoOpcion = { id: string; nombre: string };

const initialManualForm = () => ({
  empleadoId: "",
  fecha: new Date().toISOString().split("T")[0],
  horaEntrada: "",
  horaSalida: "",
  observaciones: "",
});
import { Card, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Settings } from "lucide-react";
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
    horaEntradaReal: (row.hora_entrada_real as string | null) ?? null,
    horaSalidaReal: (row.hora_salida_real as string | null) ?? null,
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
    cierreAnticipado: Boolean(row.cierre_anticipado),
    cierreAnticipadoMotivo: (row.cierre_anticipado_motivo as string | null) ?? null,
  };
}

export function FichajesView() {
  const { empresaActual } = useEmpresa();
  const empresaActivaRef = useRef(empresaActual.id);
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [, setLoading] = useState(true);
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
  const [locales, setLocales] = useState<LocalGeo[]>([]);
  const [tiposFichaje, setTiposFichaje] = useState<TipoFichajeRow[]>([]);
  // Rango de fechas del histórico. Vacío = todos los fichajes desde el inicio.
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const loadFichajes = useCallback(async () => {
    const empresaId = empresaActivaRef.current;
    if (!empresaId) {
      setFichajes([]);
      setFichajeModal(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Histórico completo: sin filtro de fecha en servidor. El acotado por
      // rango (fechaDesde/fechaHasta) se hace en cliente.
      const res = await listFichajes();
      if (empresaId !== empresaActivaRef.current) return;
      if (res.ok) {
        const next = res.data.map(mapDbToFichaje);
        setFichajes(next);
        // Sincronizar el modal de detalle si sigue abierto, para que tras
        // guardar observaciones o resolver incidencia el contenido muestre
        // los datos frescos sin tener que cerrar y reabrir.
        setFichajeModal((curr) =>
          curr ? next.find((f) => f.id === curr.id) ?? null : null,
        );
      } else {
        toast.error("Error al cargar fichajes");
      }
    } catch {
      if (empresaId !== empresaActivaRef.current) return;
      toast.error("Error de conexion al cargar fichajes");
    } finally {
      if (empresaId === empresaActivaRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    empresaActivaRef.current = empresaActual.id;
    setFichajes([]);
    setLocales([]);
    setFichajeModal(null);
    loadFichajes();
  }, [empresaActual.id, loadFichajes]);

  // Catálogo de tipos de fichaje de la empresa (color + label por código) para
  // pintar el badge de cada fichaje según el color configurado en su tipo.
  useEffect(() => {
    let cancelado = false;
    const empresaId = empresaActual.id;
    if (!empresaId) {
      setTiposFichaje([]);
      return;
    }
    listTiposFichaje(empresaId).then((res) => {
      if (!cancelado && res.ok) setTiposFichaje(res.data);
    });
    return () => {
      cancelado = true;
    };
  }, [empresaActual.id]);

  // Mapa código → { color (clases badge), label } para resolver el aspecto del
  // tipo. Fallback a las constantes legacy (ENT/SAL/…) si el código no está en
  // el catálogo de la empresa.
  const tipoBadge = useCallback(
    (codigoRaw?: string | null): { className: string; label: string } => {
      const codigo = (codigoRaw ?? "").toUpperCase();
      const cfg = tiposFichaje.find((t) => t.codigo.toUpperCase() === codigo);
      if (cfg) return { className: fichajeColorBadge(cfg.color), label: cfg.nombre };
      const legacy = (codigoRaw ?? "ENT") as TipoFichajeCodigo;
      return {
        className: TIPO_FICHAJE_BADGE[legacy] ?? TIPO_FICHAJE_BADGE.NOR,
        label: TIPO_FICHAJE_LABEL[legacy] ?? legacy,
      };
    },
    [tiposFichaje],
  );

  // Carga de locales con su geolocalización para pintar círculos en la tab Mapa.
  // Se re-carga al cambiar de empresa activa para preservar multi-tenant.
  useEffect(() => {
    let cancelado = false;
    const empresaId = empresaActual.id;
    if (!empresaId) {
      setLocales([]);
      return;
    }
    (async () => {
      const res = await listLocales(empresaId);
      if (cancelado) return;
      if (res.ok) {
        const data = res.data as Array<{
          id: string;
          nombre: string;
          lat: number | null;
          lng: number | null;
          radio_metros: number;
          color: string;
        }>;
        setLocales(
          data.map((l) => ({
            id: l.id,
            nombre: l.nombre,
            lat: l.lat,
            lng: l.lng,
            radioMetros: l.radio_metros,
            color: l.color,
          })),
        );
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaActual.id]);

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

  const _dptos = useMemo(() => [...new Set(fichajes.map(f => f.departamento))].sort(), [fichajes]);

  const acceso = (f: Fichaje, campo: string): unknown => {
    if (campo === "estado") return ESTADO_FICHAJE_LABEL[f.estado];
    if (campo === "departamento") return f.departamento;
    if (campo === "centro") return f.centro;
    if (campo === "horasTotales") return f.horasTotales;
    if (campo === "fecha") return f.fecha;
    if (campo === "empleado") return f.empleadoNombre;
    if (campo === "local") return f.local?.nombre ?? "—";
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
      // Rango de fechas (histórico). f.fecha es "YYYY-MM-DD", comparable como string.
      if (fechaDesde && f.fecha < fechaDesde) return false;
      if (fechaHasta && f.fecha > fechaHasta) return false;
      return true;
    });

    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [fichajes, busqueda, filtros, orden, fechaDesde, fechaHasta]);

  const columnasDef: ToolbarColumna[] = [
    { campo: "empleado", label: "Empleado" },
    { campo: "fecha", label: "Fecha" },
    { campo: "entrada", label: "Entrada" },
    { campo: "salida", label: "Salida" },
    { campo: "horas", label: "Horas" },
    { campo: "tipo", label: "Tipo" },
    { campo: "local", label: "Local" },
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
        <TableCell key="empleado">
          <div>
            <p className="flex items-center gap-1.5 font-medium text-sm">
              {(f.incidencia?.toUpperCase().includes("SOLAPAD") ?? false) && (
                <AlertTriangle
                  className="h-4 w-4 shrink-0 text-red-600"
                  aria-label="Turnos de empresas distintas solapados — error de configuración"
                />
              )}
              {f.cierreAnticipado && (
                <AlertTriangle
                  className="h-4 w-4 shrink-0 text-amber-500"
                  aria-label="Fichaje paralizado antes de tiempo — a revisar"
                />
              )}
              {f.empleadoNombre}
            </p>
            <p className="text-xs text-muted-foreground">{f.departamento}</p>
          </div>
        </TableCell>
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
    horas: {
      th: <TableHead key="horas" className="text-right">Horas</TableHead>,
      td: (f) => (
        <TableCell key="horas" className="text-sm text-right font-medium">{f.horaSalida ? formatHorasDecimal(f.horasTotales) : "—"}</TableCell>
      ),
    },
    tipo: {
      th: <TableHead key="tipo">Tipo</TableHead>,
      td: (f) => {
        const { className, label } = tipoBadge(f.tipo);
        return (
          <TableCell key="tipo">
            <Badge variant="outline" className={`text-xs ${className}`}>
              {label}
            </Badge>
          </TableCell>
        );
      },
    },
    local: {
      // El cliente filtra los fichajes por local desde la propia cabecera
      // (filtro de lista con los nombres de locales de la empresa). Mismo
      // patrón que EmpleadosView aplica a "empresas".
      th: (
        <TableColumnHeader
          key="local"
          label="Local"
          campo="local"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
          filtroTipo="lista"
          opciones={locales.map((l) => l.nombre)}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (f) => (
        <TableCell key="local" className="text-sm">{f.local?.nombre ?? "—"}</TableCell>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );


  return (
    <div className="p-6 space-y-6">
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
              onClick={() => setShowConfig(true)}
              title="Configuración"
              aria-label="Configuración"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs text-muted-foreground">Histórico desde</span>
        <Input
          type="date"
          value={fechaDesde}
          max={fechaHasta || undefined}
          onChange={(e) => setFechaDesde(e.target.value)}
          className="h-8 w-auto text-xs"
        />
        <span className="text-xs text-muted-foreground">hasta</span>
        <Input
          type="date"
          value={fechaHasta}
          min={fechaDesde || undefined}
          onChange={(e) => setFechaHasta(e.target.value)}
          className="h-8 w-auto text-xs"
        />
        {(fechaDesde || fechaHasta) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => {
              setFechaDesde("");
              setFechaHasta("");
            }}
          >
            Ver todo
          </Button>
        )}
      </div>
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
              <TableRow><TableCell colSpan={columnasRender.length} className="text-center py-8 text-muted-foreground">Sin fichajes para los filtros seleccionados</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuración de fichajes</DialogTitle>
            <CardDescription className="text-xs">Ajustes generales del sistema de fichajes</CardDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="flex items-center justify-between">
              <div><Label className="font-medium">Permitir fichaje manual</Label><p className="text-xs text-muted-foreground">Los empleados pueden registrar fichajes manualmente</p></div>
              <Switch checked={config.permitirManual} onCheckedChange={v => setConfig(c => ({ ...c, permitirManual: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div><Label className="font-medium">Requiere validación</Label><p className="text-xs text-muted-foreground">Los fichajes deben ser validados por un responsable</p></div>
              <Switch checked={config.requiereValidacion} onCheckedChange={v => setConfig(c => ({ ...c, requiereValidacion: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div><Label className="font-medium">Tolerancia horaria (minutos)</Label><p className="text-xs text-muted-foreground">Margen antes de generar incidencia por desfase</p></div>
              <Input type="number" className="w-20" value={config.toleranciaMinutos} onChange={e => setConfig(c => ({ ...c, toleranciaMinutos: Number(e.target.value) }))} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FichajeDetalleDialog
        fichaje={fichajeModal}
        open={!!fichajeModal}
        onOpenChange={(open) => {
          if (!open) setFichajeModal(null);
        }}
        onUpdated={loadFichajes}
        tipoBadge={tipoBadge}
      />


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
