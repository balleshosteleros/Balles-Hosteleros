"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle, CheckCircle, Settings } from "lucide-react";
import {
  EquipoFrio, RegistroTemperatura, TipoEquipo, EstadoEquipo, AreaTemp,
  evaluarEstado,
} from "@/features/cocina/data/temperaturas";
import {
  listEquipos, createEquipo as serverCreateEquipo, registrarTemperatura, listRegistros,
} from "@/features/cocina/actions/temperaturas-actions";
import { toast } from "sonner";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";

const TIPOS: TipoEquipo[] = ["NEVERA", "CONGELADOR", "CÁMARA", "BOTELLERO", "OTRO"];

// --- Helper: map DB row → EquipoFrio ---
function mapDbToEquipo(row: Record<string, unknown>): EquipoFrio {
  return {
    id: row.id as string,
    nombre: (row.nombre as string) ?? "",
    tipo: ((row.tipo as string) ?? "NEVERA") as TipoEquipo,
    area: ((row.area as string) ?? "COCINA") as AreaTemp,
    ubicacion: (row.ubicacion as string) ?? "",
    rangoMin: (row.temp_min as number) ?? 0,
    rangoMax: (row.temp_max as number) ?? 5,
    estado: ((row.estado as string) ?? "ACTIVO") as EstadoEquipo,
    observaciones: (row.observaciones as string) ?? "",
  };
}

// --- Helper: map DB row → RegistroTemperatura ---
function mapDbToRegistro(row: Record<string, unknown>): RegistroTemperatura {
  const createdAt = (row.created_at as string) ?? "";
  const fecha = createdAt.slice(0, 10);
  const hora = createdAt.length >= 16 ? createdAt.slice(11, 16) : "";
  return {
    id: row.id as string,
    equipoId: (row.equipo_id as string) ?? "",
    fecha,
    hora,
    temperatura: (row.temperatura as number) ?? 0,
    estado: ((row.estado as string) ?? "OK") as "OK" | "ALERTA",
    empleado: (row.registrado_por as string) ?? "",
    medidasTomadas: (row.medidas_tomadas as string) ?? "",
    observaciones: (row.notas as string) ?? "",
  };
}

interface Props {
  area: AreaTemp;
  equiposIniciales?: EquipoFrio[];
  registrosIniciales?: RegistroTemperatura[];
}

export default function TemperaturasView({ area, equiposIniciales, registrosIniciales }: Props) {
  const [equipos, setEquipos] = useState<EquipoFrio[]>(equiposIniciales ?? []);
  const [registros, setRegistros] = useState<RegistroTemperatura[]>(registrosIniciales ?? []);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [eqRes, regRes] = await Promise.all([listEquipos(), listRegistros()]);
      if (eqRes.ok) {
        const allEquipos = (eqRes.data as Record<string, unknown>[]).map(mapDbToEquipo);
        setEquipos(allEquipos.filter(e => e.area === area));
      } else {
        toast.error("Error al cargar equipos");
      }
      if (regRes.ok) {
        const allRegistros = (regRes.data as Record<string, unknown>[]).map(mapDbToRegistro);
        // Filter registros to only those belonging to equipos in this area
        const areaEquipoIds = new Set(equipos.map(e => e.id));
        // Use fresh equipo data for filtering
        if (eqRes.ok) {
          const areaEqs = (eqRes.data as Record<string, unknown>[]).map(mapDbToEquipo).filter(e => e.area === area);
          const ids = new Set(areaEqs.map(e => e.id));
          setRegistros(allRegistros.filter(r => ids.has(r.equipoId)));
        } else {
          setRegistros(allRegistros.filter(r => areaEquipoIds.has(r.equipoId)));
        }
      } else {
        toast.error("Error al cargar registros");
      }
    } catch {
      toast.error("Error de conexión al cargar datos de temperatura");
    } finally {
      setLoading(false);
    }
  }, [area]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  const [busqueda, setBusqueda] = useState("");
  const [showNuevoRegistro, setShowNuevoRegistro] = useState(false);
  const [showNuevoEquipo, setShowNuevoEquipo] = useState(false);
  const [selectedEquipo, setSelectedEquipo] = useState<EquipoFrio | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);

  const equiposNombres = useMemo(() => equipos.map(e => e.nombre).sort(), [equipos]);

  const registrosFiltrados = useMemo(() => {
    let lista = registros.filter(r => {
      const equipo = equipos.find(e => e.id === r.equipoId);
      return !busqueda
        || equipo?.nombre.toLowerCase().includes(busqueda.toLowerCase())
        || r.empleado.toLowerCase().includes(busqueda.toLowerCase());
    });
    lista = aplicarFiltrosToolbar(lista, filtros, (r, campo) => {
      if (campo === "equipo") return equipos.find(e => e.id === r.equipoId)?.nombre ?? "";
      if (campo === "estado") return r.estado;
      return (r as unknown as Record<string, unknown>)[campo];
    });
    lista = aplicarOrdenToolbar(lista, orden, (r, campo) => {
      if (campo === "equipo") return equipos.find(e => e.id === r.equipoId)?.nombre ?? "";
      return (r as unknown as Record<string, unknown>)[campo];
    });
    return orden ? lista : lista.sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));
  }, [registros, equipos, busqueda, filtros, orden]);

  // --- Server-wired handlers ---
  const handleCreateEquipo = async (eq: EquipoFrio) => {
    setEquipos(prev => [...prev, eq]);
    setShowNuevoEquipo(false);
    toast.success("Equipo creado");
    try {
      const res = await serverCreateEquipo({
        nombre: eq.nombre,
        tipo: eq.tipo,
        ubicacion: eq.ubicacion,
        temp_min: eq.rangoMin,
        temp_max: eq.rangoMax,
      });
      if (!res.ok) { toast.error("Error al crear equipo en servidor"); loadData(); }
    } catch {
      toast.error("Error de conexión al crear equipo");
      loadData();
    }
  };

  const handleRegistrarTemp = async (r: RegistroTemperatura) => {
    setRegistros(prev => [...prev, r]);
    setShowNuevoRegistro(false);
    toast.success("Temperatura registrada");
    try {
      const res = await registrarTemperatura({
        equipo_id: r.equipoId,
        temperatura: r.temperatura,
        notas: r.observaciones || r.medidasTomadas || undefined,
      });
      if (!res.ok) { toast.error("Error al registrar temperatura en servidor"); loadData(); }
    } catch {
      toast.error("Error de conexión al registrar temperatura");
      loadData();
    }
  };

  if (loading) {
    return <LoadingSpinner className="p-6 min-h-[300px]" size="lg" />;
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "fecha", label: "Fecha", bloqueada: true },
    { campo: "hora", label: "Hora" },
    { campo: "equipo", label: "Equipo" },
    { campo: "temperatura", label: "Temp." },
    { campo: "rango", label: "Rango" },
    { campo: "estado", label: "Estado" },
    { campo: "empleado", label: "Empleado" },
    { campo: "medidas", label: "Medidas tomadas" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (r: RegistroTemperatura) => ReactNode }> = {
    fecha: {
      th: (
        <TableColumnHeader
          key="fecha"
          label="Fecha"
          campo="fecha"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (r) => <td key="fecha" className="p-3">{r.fecha}</td>,
    },
    hora: {
      th: (
        <TableColumnHeader
          key="hora"
          label="Hora"
          campo="hora"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (r) => <td key="hora" className="p-3">{r.hora}</td>,
    },
    equipo: {
      th: (
        <TableColumnHeader
          key="equipo"
          label="Equipo"
          campo="equipo"
          filtroTipo="lista"
          opciones={equiposNombres}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (r) => {
        const eq = equipos.find(e => e.id === r.equipoId);
        return <td key="equipo" className="p-3 font-medium">{eq?.nombre ?? "—"}</td>;
      },
    },
    temperatura: {
      th: (
        <TableColumnHeader
          key="temperatura"
          label="Temp."
          campo="temperatura"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (r) => <td key="temperatura" className="p-3 font-mono font-semibold">{r.temperatura}°C</td>,
    },
    rango: {
      th: <TableColumnHeader key="rango" label="Rango" />,
      td: (r) => {
        const eq = equipos.find(e => e.id === r.equipoId);
        return <td key="rango" className="p-3 text-xs text-muted-foreground">{eq ? `${eq.rangoMin}° / ${eq.rangoMax}°` : "—"}</td>;
      },
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
          label="Estado"
          campo="estado"
          filtroTipo="lista"
          opciones={["OK", "ALERTA"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (r) => (
        <td key="estado" className="p-3">
          {r.estado === "OK"
            ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">OK</Badge>
            : <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">ALERTA</Badge>}
        </td>
      ),
    },
    empleado: {
      th: <TableColumnHeader key="empleado" label="Empleado" />,
      td: (r) => <td key="empleado" className="p-3">{r.empleado}</td>,
    },
    medidas: {
      th: <TableColumnHeader key="medidas" label="Medidas tomadas" />,
      td: (r) => <td key="medidas" className="p-3 text-muted-foreground text-xs max-w-[250px] truncate">{r.medidasTomadas || "—"}</td>,
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
        onNuevo={() => setShowNuevoRegistro(true)}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
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
        }
      />

      <Dialog open={showNuevoEquipo} onOpenChange={setShowNuevoEquipo}>
        <DialogContent><DialogHeader><DialogTitle>Nuevo equipo</DialogTitle></DialogHeader>
          <NuevoEquipoForm area={area} onSave={handleCreateEquipo} onClose={() => setShowNuevoEquipo(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={showNuevoRegistro} onOpenChange={setShowNuevoRegistro}>
        <DialogContent><DialogHeader><DialogTitle>Registrar temperatura</DialogTitle></DialogHeader>
          <NuevoRegistroForm equipos={equipos.filter(e => e.estado === "ACTIVO")} onSave={handleRegistrarTemp} onClose={() => setShowNuevoRegistro(false)} />
        </DialogContent>
      </Dialog>

      <ResizableColumnsProvider storageKey="cocina-temperaturas">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                </tr>
              </thead>
              <tbody>
                {registrosFiltrados.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/20">
                    {columnasRender.map((c) => columnDefs[c.campo]?.td(r))}
                  </tr>
                ))}
                {registrosFiltrados.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin registros</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </ResizableColumnsProvider>

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
