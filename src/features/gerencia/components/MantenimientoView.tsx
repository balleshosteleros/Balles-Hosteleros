"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { useSincronizacionEnVivo } from "@/shared/hooks/useSincronizacionEnVivo";
import {
  type Incidencia, type Actualizacion, ESTADOS, GRAVEDADES, REPARADORES,
  type Estado, type Gravedad, diasSinActualizar,
} from "@/features/empresa/data/mantenimiento";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getEmpleadosActivos, type EmpleadoActivo } from "@/features/rrhh/actions/empleados-actions";
import { listLocales } from "@/features/ajustes/actions/locales-actions";
import { listMantenimiento, createIncidenciaMantenimiento, updateIncidencia, addActualizacion as serverAddActualizacion } from "@/features/gerencia/actions/mantenimiento-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hoyEnZona, ZONA_HORARIA_FALLBACK } from "@/features/empresa/lib/zona-horaria";
import { StatusBadge, GravedadBadge } from "@/features/mantenimiento/components/Badges";
import { IncidenciaModal } from "@/features/mantenimiento/components/IncidenciaModal";
import { DetalleIncidencia } from "@/features/mantenimiento/components/DetalleIncidencia";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Info } from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  coincideBusquedaUniversal,
  colVisible,
  ordenarColumnas,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";

function mapDbToIncidencia(row: Record<string, unknown>): Incidencia {
  const actualizaciones: Actualizacion[] = Array.isArray(row.mantenimiento_actualizaciones)
    ? (row.mantenimiento_actualizaciones as Record<string, unknown>[])
        .map((a) => ({
          id: a.id as string,
          texto: (a.texto as string) ?? "",
          fecha: ((a.fecha as string) ?? "").slice(0, 10),
          apuntadoPor: (a.apuntado_por as string) ?? "",
          resultado: (a.resultado as Actualizacion["resultado"]) ?? "EN PROGRESO",
          minutos: (a.minutos as number) ?? 15,
        }))
        .sort((x, y) => x.fecha.localeCompare(y.fecha))
    : [];
  const fechaAlta = (row.fecha_publicado as string) ?? "";
  return {
    id: row.id as string,
    desperfecto: (row.desperfecto as string) ?? "",
    local: (row.local_nombre as string) ?? (row.local as string) ?? "",
    estado: (row.estado as Estado) ?? "PENDIENTE",
    gravedad: (row.gravedad as Gravedad) ?? "LEVE",
    apuntaDesperfecto: (row.apunta_desperfecto as string) ?? "",
    reparador: (row.reparador as string) ?? "",
    fechaPublicado: (row.fecha_publicado as string) ?? "",
    comentarios: (row.comentarios as string) ?? "",
    actualizaciones,
    // Sin actualizaciones, el reloj corre desde el alta: lo que interesa es
    // cuanto lleva el desperfecto sin que nadie diga nada de el.
    ultimaActualizacion: actualizaciones.length
      ? actualizaciones[actualizaciones.length - 1].fecha
      : fechaAlta,
  };
}

export function MantenimientoView() {
  const { setDatos: setContextData, empresaActual } = useEmpresa();
  const [data, setData] = useState<Incidencia[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  const [locales, setLocales] = useState<string[]>([]);
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [showConfig, setShowConfig] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Incidencia | null>(null);
  const [detalleItem, setDetalleItem] = useState<Incidencia | null>(null);

  // Hoy en la zona de la empresa: los dias sin actualizar se cuentan contra el
  // dia del local, no contra el del navegador de quien mira.
  const hoy = hoyEnZona(empresaActual.zonaHoraria ?? ZONA_HORARIA_FALLBACK);

  const loadIncidencias = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMantenimiento();
      if (res.ok) {
        const mapped = res.data.map(mapDbToIncidencia);
        setData(mapped);
        setContextData(() => mapped);
      } else {
        toast.error("Error al cargar incidencias");
      }
    } catch {
      toast.error("Error de conexion al cargar incidencias");
    } finally {
      setLoading(false);
    }
  }, [setContextData]);

  useEffect(() => {
    loadIncidencias();
  }, [loadIncidencias]);

  // Sincronizacion en vivo: las incidencias las abre y actualiza cualquiera del
  // local desde su movil (una averia no espera). Se pausa con el alta o el
  // detalle abiertos para no pisar lo que se este escribiendo.
  useSincronizacionEnVivo({
    tablas: ["mantenimiento", "mantenimiento_actualizaciones"],
    empresaId: empresaActual.id,
    onCambio: () => void loadIncidencias(),
    pausado: modalOpen || !!detalleItem,
  });

  useEffect(() => {
    let alive = true;
    getEmpleadosActivos(empresaActual.dbId).then((r) => {
      if (alive) setEmpleados(r.ok ? r.data : []);
    });
    // Locales reales grabados en esta empresa (fuente única: Ajustes → Locales).
    listLocales(empresaActual.dbId).then((r) => {
      if (alive) setLocales(r.ok ? r.data.filter((l) => l.activo).map((l) => l.nombre) : []);
    });
    return () => { alive = false; };
  }, [empresaActual.dbId]);

  const acceso = (i: Incidencia, campo: string): unknown => {
    if (campo === "fechaPublicado") return i.fechaPublicado;
    return (i as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let lista = data.filter((i) => coincideBusquedaUniversal(i, search));
    lista = aplicarFiltrosToolbar(lista as unknown as Record<string, unknown>[], filtros, (item, campo) =>
      acceso(item as unknown as Incidencia, campo),
    ) as unknown as Incidencia[];
    lista = aplicarOrdenToolbar(lista as unknown as Record<string, unknown>[], orden, (item, campo) =>
      acceso(item as unknown as Incidencia, campo),
    ) as unknown as Incidencia[];
    return lista;
  }, [data, search, filtros, orden]);

  const counts = useMemo(() => ({
    PENDIENTE: data.filter((i) => i.estado === "PENDIENTE").length,
    "EN PROGRESO": data.filter((i) => i.estado === "EN PROGRESO").length,
    ESCALADO: data.filter((i) => i.estado === "ESCALADO").length,
    TERMINADO: data.filter((i) => i.estado === "TERMINADO").length,
  }), [data]);

  const gravityCounts = useMemo(() => ({
    LEVE: data.filter((i) => i.gravedad === "LEVE").length,
    GRAVE: data.filter((i) => i.gravedad === "GRAVE").length,
    "MUY GRAVE": data.filter((i) => i.gravedad === "MUY GRAVE").length,
  }), [data]);

  const updateField = async (id: string, field: keyof Incidencia, value: string) => {
    setData((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
    // Map component field names to server action params
    const fieldMap: Record<string, string> = {
      local: "localNombre", estado: "estado", gravedad: "gravedad",
      apuntaDesperfecto: "apuntaDesperfecto", reparador: "reparador",
      fechaPublicado: "fechaPublicado", comentarios: "comentarios",
      desperfecto: "desperfecto",
    };
    const serverField = fieldMap[field];
    if (serverField) {
      const res = await updateIncidencia(id, { [serverField]: value });
      if (!res.ok) { toast.error("Error al actualizar campo"); loadIncidencias(); }
    }
  };

  const handleSave = async (item: Incidencia) => {
    const exists = data.find((i) => i.id === item.id);
    setData((prev) => exists ? prev.map((i) => i.id === item.id ? item : i) : [item, ...prev]);

    if (exists) {
      const res = await updateIncidencia(item.id, {
        desperfecto: item.desperfecto,
        localNombre: item.local,
        estado: item.estado,
        gravedad: item.gravedad,
        apuntaDesperfecto: item.apuntaDesperfecto,
        reparador: item.reparador,
        comentarios: item.comentarios,
        fechaPublicado: item.fechaPublicado,
      });
      if (res.ok) toast.success("Incidencia actualizada");
      else { toast.error("Error al actualizar incidencia"); loadIncidencias(); }
    } else {
      const res = await createIncidenciaMantenimiento({
        desperfecto: item.desperfecto,
        localNombre: item.local,
        estado: item.estado,
        gravedad: item.gravedad,
        apuntaDesperfecto: item.apuntaDesperfecto,
        reparador: item.reparador,
        comentarios: item.comentarios,
        fechaPublicado: item.fechaPublicado,
      });
      if (res.ok) { toast.success("Incidencia creada"); loadIncidencias(); }
      else { toast.error(res.error ?? "Error al crear incidencia"); loadIncidencias(); }
    }
  };

  const addActualizacionHandler = async (incidenciaId: string, act: Actualizacion) => {
    setData((prev) => prev.map((i) => {
      if (i.id !== incidenciaId) return i;
      const updated = { ...i, actualizaciones: [...i.actualizaciones, act] };
      setDetalleItem(updated);
      return updated;
    }));
    const res = await serverAddActualizacion(
      incidenciaId, act.texto, act.apuntadoPor, act.resultado, act.minutos, act.fecha
    );
    if (res.ok) {
      toast.success("Actualización guardada");
      loadIncidencias(); // el estado de la incidencia sigue al resultado elegido
    } else {
      toast.error(res.error ?? "Error al agregar actualizacion");
      loadIncidencias();
    }
  };

  const statCards: { label: string; key: Estado; color: string }[] = [
    { label: "PENDIENTE", key: "PENDIENTE", color: "border-status-pending bg-status-pending/10 text-status-pending" },
    { label: "EN PROGRESO", key: "EN PROGRESO", color: "border-status-progress bg-status-progress/10 text-status-progress" },
    { label: "ESCALADO", key: "ESCALADO", color: "border-status-escalated bg-status-escalated/10 text-status-escalated" },
    { label: "TERMINADO", key: "TERMINADO", color: "border-status-done bg-status-done/10 text-status-done" },
  ];

  const columnasDef: ToolbarColumna[] = [
    { campo: "desperfecto", label: "Desperfecto", bloqueada: true },
    { campo: "local", label: "Local" },
    { campo: "estado", label: "Estado" },
    { campo: "gravedad", label: "Gravedad" },
    { campo: "apuntaDesperfecto", label: "Apuntado por" },
    { campo: "reparador", label: "Reparador" },
    { campo: "fechaPublicado", label: "Fecha" },
    { campo: "ultimaActualizacion", label: "Última actualización" },
    { campo: "comentarios", label: "Comentarios" },
  ];

  const apuntaOpciones = useMemo(
    () => [...new Set(data.map((i) => i.apuntaDesperfecto).filter(Boolean))].sort(),
    [data],
  );
  const desperfectoOpciones = useMemo(
    () => [...new Set(data.map((i) => i.desperfecto).filter(Boolean))].sort(),
    [data],
  );
  const comentariosOpciones = useMemo(
    () => [...new Set(data.map((i) => i.comentarios).filter(Boolean))].sort(),
    [data],
  );

  const columnDefs: Record<string, { th: ReactNode; td: (item: Incidencia) => ReactNode }> = {
    desperfecto: {
      th: (
        <TableColumnHeader
          key="desperfecto"
          label="Desperfecto"
          campo="desperfecto"
          filtroTipo="lista"
          opciones={desperfectoOpciones}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (item) => (
        <td key="desperfecto" className="px-3 py-2.5 max-w-[250px]">
          <span className="font-medium text-foreground line-clamp-2">{item.desperfecto}</span>
        </td>
      ),
    },
    local: {
      th: (
        <TableColumnHeader
          key="local"
          label="Local"
          campo="local"
          filtroTipo="lista"
          opciones={locales}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (item) => (
        <td key="local" className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <Select value={item.local} onValueChange={(v) => updateField(item.id, "local", v)}>
            <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue placeholder="Local" /></SelectTrigger>
            <SelectContent>
              {item.local && !locales.includes(item.local) && (
                <SelectItem value={item.local}>{item.local}</SelectItem>
              )}
              {locales.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
      ),
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
          label="Estado"
          campo="estado"
          filtroTipo="lista"
          opciones={ESTADOS}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (item) => (
        <td key="estado" className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <Select value={item.estado} onValueChange={(v) => updateField(item.id, "estado", v)}>
            <SelectTrigger className="h-8 text-xs w-[130px] border-0 p-0"><StatusBadge value={item.estado} /></SelectTrigger>
            <SelectContent>{ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </td>
      ),
    },
    gravedad: {
      th: (
        <TableColumnHeader
          key="gravedad"
          label="Gravedad"
          campo="gravedad"
          filtroTipo="lista"
          opciones={GRAVEDADES}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (item) => (
        <td key="gravedad" className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <Select value={item.gravedad} onValueChange={(v) => updateField(item.id, "gravedad", v)}>
            <SelectTrigger className="h-8 text-xs w-[120px] border-0 p-0"><GravedadBadge value={item.gravedad} /></SelectTrigger>
            <SelectContent>{GRAVEDADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </td>
      ),
    },
    apuntaDesperfecto: {
      th: (
        <TableColumnHeader
          key="apuntaDesperfecto"
          label="Apuntado por"
          campo="apuntaDesperfecto"
          filtroTipo="lista"
          opciones={apuntaOpciones}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (item) => (
        <td key="apuntaDesperfecto" className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <Select value={item.apuntaDesperfecto} onValueChange={(v) => updateField(item.id, "apuntaDesperfecto", v)}>
            <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue placeholder="Empleado" /></SelectTrigger>
            <SelectContent>
              {item.apuntaDesperfecto && !empleados.some((e) => e.nombreCompleto === item.apuntaDesperfecto) && (
                <SelectItem value={item.apuntaDesperfecto}>{item.apuntaDesperfecto}</SelectItem>
              )}
              {empleados.map((e) => (
                <SelectItem key={e.empleadoId} value={e.nombreCompleto}>
                  {e.nombreCompleto}
                  {(e.puesto || e.departamento) && (
                    <span className="text-muted-foreground">
                      {" — "}{[e.puesto, e.departamento].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
      ),
    },
    reparador: {
      th: (
        <TableColumnHeader
          key="reparador"
          label="Reparador"
          campo="reparador"
          filtroTipo="lista"
          opciones={REPARADORES}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (item) => (
        <td key="reparador" className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <Select value={item.reparador} onValueChange={(v) => updateField(item.id, "reparador", v)}>
            <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>{REPARADORES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </td>
      ),
    },
    fechaPublicado: {
      th: (
        <TableColumnHeader
          key="fechaPublicado"
          label="Fecha"
          campo="fechaPublicado"
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (item) => (
        <td key="fechaPublicado" className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <Input type="date" value={item.fechaPublicado} onChange={(e) => updateField(item.id, "fechaPublicado", e.target.value)} className="h-8 text-xs w-[130px]" />
        </td>
      ),
    },
    ultimaActualizacion: {
      th: (
        <TableColumnHeader
          key="ultimaActualizacion"
          label="Última actualización"
          campo="ultimaActualizacion"
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (item) => {
        const dias = diasSinActualizar(item.ultimaActualizacion, hoy);
        const nunca = item.actualizaciones.length === 0;
        // Cuantos mas dias sin noticias, mas llama la atencion: es la senal de
        // que el desperfecto se esta quedando olvidado.
        const color =
          dias >= 90 ? "text-severity-critical"
          : dias >= 30 ? "text-severity-serious"
          : "text-muted-foreground";
        return (
          <td key="ultimaActualizacion" className="px-3 py-2.5 whitespace-nowrap">
            <span className={cn("block text-[11px] font-bold leading-tight", color)}>
              {dias === 0 ? "Hoy" : `${dias} ${dias === 1 ? "día" : "días"} sin actualizar`}
            </span>
            <span className="block text-xs text-foreground">
              {item.ultimaActualizacion || "—"}
              {nunca && <span className="text-muted-foreground"> (alta)</span>}
            </span>
          </td>
        );
      },
    },
    comentarios: {
      th: (
        <TableColumnHeader
          key="comentarios"
          label="Comentarios"
          campo="comentarios"
          filtroTipo="lista"
          opciones={comentariosOpciones}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (item) => (
        <td key="comentarios" className="px-3 py-2.5 max-w-[200px]">
          <span className="text-xs text-muted-foreground line-clamp-2">{item.comentarios}</span>
        </td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.key} className={`rounded-lg border-2 p-4 text-center ${s.color}`}>
            <div className="text-3xl font-black">{counts[s.key]}</div>
            <div className="text-xs font-bold mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(["LEVE", "GRAVE", "MUY GRAVE"] as Gravedad[]).map((g) => (
          <div key={g} className="rounded-lg border bg-card p-3 text-center">
            <GravedadBadge value={g} />
            <div className="text-xl font-bold mt-1 text-foreground">{gravityCounts[g]}</div>
          </div>
        ))}
      </div>

      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        onNuevo={() => { setEditItem(null); setModalOpen(true); }}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <Button size="icon" variant={showConfig ? "default" : "outline"} className="h-9 w-9" onClick={() => setShowConfig((v) => !v)} title="Configuración" aria-label="Configuración">
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        }
      />

      <ResizableColumnsProvider storageKey="gerencia-mantenimiento">
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columnasRender.map((c) => columnDefs[c.campo]?.th)}
              <th className="relative px-3 py-1.5 text-xs font-bold text-muted-foreground whitespace-nowrap text-left" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => { setEditItem(item); setModalOpen(true); }}>
                {columnasRender.map((c) => columnDefs[c.campo]?.td(item))}
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary" onClick={() => setDetalleItem(item)}>
                    <Info className="h-3.5 w-3.5" /> Más info
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={columnasRender.length + 1} className="text-center py-12 text-muted-foreground">No se encontraron incidencias.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </ResizableColumnsProvider>
      <div className="text-xs text-muted-foreground text-right">{filtered.length} de {data.length} incidencias</div>

      <IncidenciaModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} item={editItem} />
      {detalleItem && (
        <DetalleIncidencia open={!!detalleItem} onClose={() => setDetalleItem(null)} item={detalleItem} onAddActualizacion={addActualizacionHandler} />
      )}
    </div>
  );
}
