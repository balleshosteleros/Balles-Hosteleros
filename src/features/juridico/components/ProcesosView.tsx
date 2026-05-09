"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getProcesosPorEmpresa, ESTADOS_PROCESO, GRAVEDADES_PROCESO, TIPOS_PROCESO, JURIDICOS,
  type ProcesoJuridico, type EstadoProceso, type ActualizacionProceso, type DocumentoProceso,
  type GravedadProceso, type TipoProceso,
} from "@/features/juridico/data/procesos-juridicos";
import { listProcesos, createProceso, updateProceso } from "@/features/juridico/actions/procesos-actions";
import { toast } from "sonner";
import { EstadoProcesoBadge, GravedadProcesoBadge } from "@/features/juridico/components/BadgesProceso";
import { DetalleProceso } from "@/features/juridico/components/DetalleProceso";
import { ProcesoModal } from "@/features/juridico/components/ProcesoModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Info, FileText, Settings } from "lucide-react";
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
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";

const ALL = "__ALL__";

function mapDbToProceso(row: Record<string, unknown>, empresa: string, empresaId: string): ProcesoJuridico {
  const docsDb = Array.isArray(row.documentos) ? (row.documentos as Array<Record<string, unknown>>) : [];
  const actsDb = Array.isArray(row.actualizaciones) ? (row.actualizaciones as Array<Record<string, unknown>>) : [];
  return {
    id: row.id as string,
    titulo: (row.titulo as string) ?? "",
    empresa,
    empresaId,
    tipo: ((row.tipo as string) ?? "Otro") as TipoProceso,
    juridico: (row.abogado as string) ?? "",
    fecha: (row.fecha_inicio as string) ?? (row.created_at as string) ?? "",
    estado: ((row.estado as string)?.toUpperCase() ?? "ABIERTO") as EstadoProceso,
    gravedad: ((row.gravedad as string)?.toUpperCase() ?? "LEVE") as GravedadProceso,
    descripcion: (row.descripcion as string) ?? "",
    documentos: docsDb.map((d) => ({
      id: d.id as string,
      nombre: (d.nombre as string) ?? "",
      descripcion: (d.descripcion as string) ?? "",
      categoria: ((d.categoria as string) ?? "Otro") as DocumentoProceso["categoria"],
      url: (d.url as string) ?? "#",
      tipo: (d.tipo_mime as string) ?? "pdf",
      subidoPor: (d.subido_por as string) ?? "",
      fechaSubida: (d.fecha_documento as string) ?? "",
    })),
    actualizaciones: actsDb
      .slice()
      .sort((a, b) => ((a.fecha as string) ?? "").localeCompare((b.fecha as string) ?? ""))
      .map((a) => ({
        id: a.id as string,
        texto: (a.texto as string) ?? "",
        fecha: (a.fecha as string) ?? "",
        apuntadoPor: (a.apuntado_por as string) ?? "",
        documentos: [],
      })),
  };
}

export function ProcesosView() {
  const pathname = usePathname();
  useEffect(() => { sessionStorage.setItem("juridico_last", pathname); }, [pathname]);
  const { empresaActual } = useEmpresa();
  const [data, setData] = useState<ProcesoJuridico[]>(() => getProcesosPorEmpresa(empresaActual.id));
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [estadoExpediente, setEstadoExpediente] = useState<"abiertos" | "cerrados" | "todos">("abiertos");
  const [showConfig, setShowConfig] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProcesoJuridico | null>(null);
  const [detalleItem, setDetalleItem] = useState<ProcesoJuridico | null>(null);

  const loadProcesos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProcesos();
      if (res.ok && res.data.length > 0) {
        setData(res.data.map((r: Record<string, unknown>) => mapDbToProceso(r, empresaActual.nombre, empresaActual.id)));
      } else if (res.ok && res.data.length === 0) {
        // Fallback to mock data when DB is empty
        setData(getProcesosPorEmpresa(empresaActual.id));
      } else {
        toast.error("Error al cargar procesos");
        setData(getProcesosPorEmpresa(empresaActual.id));
      }
    } catch {
      toast.error("Error de conexion al cargar procesos");
      setData(getProcesosPorEmpresa(empresaActual.id));
    } finally {
      setLoading(false);
    }
  }, [empresaActual.id, empresaActual.nombre]);

  useEffect(() => {
    loadProcesos();
  }, [loadProcesos]);

  const isCerrado = (e: EstadoProceso) => e === "CERRADO";

  const baseData = estadoExpediente === "cerrados"
    ? data.filter((p) => isCerrado(p.estado))
    : estadoExpediente === "abiertos"
    ? data.filter((p) => !isCerrado(p.estado))
    : data;

  const acceso = (p: ProcesoJuridico, campo: string): unknown => {
    if (campo === "estado") return p.estado;
    if (campo === "gravedad") return p.gravedad;
    if (campo === "tipo") return p.tipo;
    if (campo === "juridico") return p.juridico;
    if (campo === "fecha") return p.fecha;
    if (campo === "titulo") return p.titulo;
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let lista = baseData.filter((p) => {
      if (search) {
        const s = search.toLowerCase();
        return p.titulo.toLowerCase().includes(s) || p.descripcion.toLowerCase().includes(s) || p.juridico.toLowerCase().includes(s);
      }
      return true;
    });
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [baseData, search, filtros, orden]);

  const abiertos = data.filter((p) => !isCerrado(p.estado));
  const cerrados = data.filter((p) => isCerrado(p.estado));

  const handleSave = async (item: ProcesoJuridico) => {
    const exists = data.find((p) => p.id === item.id);
    // Optimistic update
    setData((prev) => {
      if (exists) return prev.map((p) => (p.id === item.id ? item : p));
      return [item, ...prev];
    });

    try {
      if (exists) {
        const res = await updateProceso(item.id, {
          titulo: item.titulo,
          tipo: item.tipo,
          descripcion: item.descripcion,
          abogado: item.juridico,
          estado: item.estado,
        });
        if (res.ok) {
          toast.success("Expediente actualizado");
        } else {
          toast.error("Error al actualizar expediente");
          loadProcesos();
        }
      } else {
        const res = await createProceso({
          titulo: item.titulo,
          tipo: item.tipo,
          descripcion: item.descripcion,
          abogado: item.juridico,
          fecha_inicio: item.fecha,
        });
        if (res.ok) {
          toast.success("Expediente creado");
          loadProcesos();
        } else {
          toast.error(res.error ?? "Error al crear expediente");
          loadProcesos();
        }
      }
    } catch {
      toast.error("Error de conexion");
      loadProcesos();
    }
  };

  const updateField = async (id: string, field: keyof ProcesoJuridico, value: string) => {
    setData((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

    const fieldMap: Record<string, string> = { estado: "estado", gravedad: "gravedad", juridico: "abogado" };
    const dbField = fieldMap[field] ?? field;
    try {
      const res = await updateProceso(id, { [dbField]: value });
      if (!res.ok) {
        toast.error("Error al actualizar campo");
        loadProcesos();
      }
    } catch {
      toast.error("Error de conexion");
      loadProcesos();
    }
  };

  const addActualizacion = (procesoId: string, act: ActualizacionProceso) => {
    setData((prev) => prev.map((p) => {
      if (p.id !== procesoId) return p;
      const updated = { ...p, actualizaciones: [...p.actualizaciones, act] };
      setDetalleItem(updated);
      return updated;
    }));
  };

  const addDocumento = (procesoId: string, doc: DocumentoProceso) => {
    setData((prev) => prev.map((p) => {
      if (p.id !== procesoId) return p;
      const updated = { ...p, documentos: [...p.documentos, doc] };
      setDetalleItem(updated);
      return updated;
    }));
  };

  const removeDocumento = (procesoId: string, docId: string) => {
    setData((prev) => prev.map((p) => {
      if (p.id !== procesoId) return p;
      const updated = { ...p, documentos: p.documentos.filter((d) => d.id !== docId) };
      setDetalleItem(updated);
      return updated;
    }));
  };

  const replaceDocumentos = (procesoId: string, docs: DocumentoProceso[]) => {
    setData((prev) => prev.map((p) => {
      if (p.id !== procesoId) return p;
      const updated = { ...p, documentos: docs };
      setDetalleItem(updated);
      return updated;
    }));
  };

  const openEdit = (item: ProcesoJuridico) => { setEditItem(item); setModalOpen(true); };
  const openNew = () => { setEditItem(null); setModalOpen(true); };

  const columnasDef: ToolbarColumna[] = [
    { campo: "titulo", label: "Expediente", bloqueada: true },
    { campo: "tipo", label: "Tipo" },
    { campo: "juridico", label: "Responsable" },
    { campo: "fecha", label: "Fecha" },
    { campo: "estado", label: "Estado" },
    { campo: "gravedad", label: "Gravedad" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (item: ProcesoJuridico) => ReactNode }> = {
    titulo: {
      th: <TableColumnHeader key="titulo" label="EXPEDIENTE" />,
      td: (item) => (
        <td key="titulo" className="px-3 py-2.5 max-w-[280px]">
          <span className="font-medium text-foreground line-clamp-2">{item.titulo}</span>
          <span className="text-[11px] text-muted-foreground block">{item.empresa}</span>
        </td>
      ),
    },
    tipo: {
      th: <TableColumnHeader key="tipo" label="TIPO" />,
      td: (item) => (
        <td key="tipo" className="px-3 py-2.5 text-xs whitespace-nowrap">{item.tipo}</td>
      ),
    },
    juridico: {
      th: <TableColumnHeader key="juridico" label="RESPONSABLE" />,
      td: (item) => (
        <td key="juridico" className="px-3 py-2.5 text-xs whitespace-nowrap">{item.juridico}</td>
      ),
    },
    fecha: {
      th: <TableColumnHeader key="fecha" label="FECHA" />,
      td: (item) => (
        <td key="fecha" className="px-3 py-2.5 whitespace-nowrap text-xs">{item.fecha}</td>
      ),
    },
    estado: {
      th: <TableColumnHeader key="estado" label="ESTADO" />,
      td: (item) => (
        <td key="estado" className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <Select value={item.estado} onValueChange={(v) => updateField(item.id, "estado", v)}>
            <SelectTrigger className="h-8 text-xs w-[130px] border-0 p-0">
              <EstadoProcesoBadge value={item.estado} />
            </SelectTrigger>
            <SelectContent>{ESTADOS_PROCESO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </td>
      ),
    },
    gravedad: {
      th: <TableColumnHeader key="gravedad" label="GRAVEDAD" />,
      td: (item) => (
        <td key="gravedad" className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <Select value={item.gravedad} onValueChange={(v) => updateField(item.id, "gravedad", v)}>
            <SelectTrigger className="h-8 text-xs w-[120px] border-0 p-0">
              <GravedadProcesoBadge value={item.gravedad} />
            </SelectTrigger>
            <SelectContent>{GRAVEDADES_PROCESO.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="space-y-4">
        <SubmoduleToolbar
          busqueda={search}
          onBusquedaChange={setSearch}
          placeholderBusqueda="Buscar"
          onNuevo={openNew}
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
            <Select value={estadoExpediente} onValueChange={(v) => setEstadoExpediente(v as typeof estadoExpediente)}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="abiertos">Abierto ({abiertos.length})</SelectItem>
                <SelectItem value="cerrados">Cerrado ({cerrados.length})</SelectItem>
                <SelectItem value="todos">Todos ({data.length})</SelectItem>
              </SelectContent>
            </Select>
          }
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

        {showConfig ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estados</CardTitle>
                <CardDescription className="text-xs">Estados disponibles para los expedientes.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {ESTADOS_PROCESO.map((e) => <EstadoProcesoBadge key={e} value={e} />)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gravedad</CardTitle>
                <CardDescription className="text-xs">Niveles de gravedad para priorización.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {GRAVEDADES_PROCESO.map((g) => <GravedadProcesoBadge key={g} value={g} />)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tipos de proceso</CardTitle>
                <CardDescription className="text-xs">Clasificación de expedientes jurídicos.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {TIPOS_PROCESO.map((t2) => <Badge key={t2} variant="outline">{t2}</Badge>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Responsables jurídicos</CardTitle>
                <CardDescription className="text-xs">Abogados y despachos asignados.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {JURIDICOS.map((j) => <Badge key={j} variant="outline">{j}</Badge>)}
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                    <th key="pdf" className="text-left px-3 py-3 text-xs font-bold text-muted-foreground tracking-wide whitespace-nowrap">PDF</th>
                    <th key="actions" className="text-left px-3 py-3 text-xs font-bold text-muted-foreground tracking-wide whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(item)}>
                      {columnasRender.map((c) => columnDefs[c.campo]?.td(item))}
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {item.documentos.length > 0 ? (
                          <Badge variant="outline" className="gap-1 text-[10px]"><FileText className="h-3 w-3" /> {item.documentos.length}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary hover:text-primary" onClick={() => setDetalleItem(item)}>
                          <Info className="h-3.5 w-3.5" /> DETALLE
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No se encontraron expedientes con los filtros aplicados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-muted-foreground text-right">{filtered.length} de {baseData.length} expedientes</div>
          </>
        )}
      </div>

      <ProcesoModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} item={editItem} empresa={empresaActual.nombre} empresaId={empresaActual.id} />
      {detalleItem && (
        <DetalleProceso
          open={!!detalleItem}
          onClose={() => setDetalleItem(null)}
          item={detalleItem}
          onAddActualizacion={addActualizacion}
          onAddDocumento={addDocumento}
          onRemoveDocumento={removeDocumento}
          onReplaceDocumentos={replaceDocumentos}
        />
      )}
    </div>
  );
}
