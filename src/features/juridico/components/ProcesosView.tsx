"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Search, Info, FileText, Settings, SlidersHorizontal, X } from "lucide-react";

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
  const [filterEstado, setFilterEstado] = useState(ALL);
  const [filterGravedad, setFilterGravedad] = useState(ALL);
  const [filterTipo, setFilterTipo] = useState(ALL);
  const [filterJuridico, setFilterJuridico] = useState(ALL);
  const [estadoExpediente, setEstadoExpediente] = useState<"abiertos" | "cerrados" | "todos">("abiertos");
  const [showConfig, setShowConfig] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  const properCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const countIn = <T,>(arr: ProcesoJuridico[], key: (p: ProcesoJuridico) => T, value: T) =>
    arr.filter((p) => key(p) === value).length;

  const activeFilterCount =
    (search ? 1 : 0) +
    (filterEstado !== ALL ? 1 : 0) +
    (filterGravedad !== ALL ? 1 : 0) +
    (filterTipo !== ALL ? 1 : 0) +
    (filterJuridico !== ALL ? 1 : 0) +
    (estadoExpediente !== "abiertos" ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setFilterEstado(ALL);
    setFilterGravedad(ALL);
    setFilterTipo(ALL);
    setFilterJuridico(ALL);
    setEstadoExpediente("abiertos");
  };

  const filtered = useMemo(() => {
    return baseData.filter((p) => {
      if (filterEstado !== ALL && p.estado !== filterEstado) return false;
      if (filterGravedad !== ALL && p.gravedad !== filterGravedad) return false;
      if (filterTipo !== ALL && p.tipo !== filterTipo) return false;
      if (filterJuridico !== ALL && p.juridico !== filterJuridico) return false;
      if (search) {
        const s = search.toLowerCase();
        return p.titulo.toLowerCase().includes(s) || p.descripcion.toLowerCase().includes(s) || p.juridico.toLowerCase().includes(s);
      }
      return true;
    });
  }, [baseData, search, filterEstado, filterGravedad, filterTipo, filterJuridico]);

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

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg border p-3">
          <Button variant="primary" size="sm" onClick={openNew}><Plus className="h-4 w-4" />Nuevo</Button>
          <div className="flex-1" />
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar expedientes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" aria-label="Filtrar">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtrar
                {activeFilterCount > 0 && (
                  <Badge className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px] rounded-full">{activeFilterCount}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Filtros</span>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 px-2 text-xs gap-1">
                    <X className="h-3 w-3" /> Limpiar
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Expedientes</label>
                <Select value={estadoExpediente} onValueChange={(v) => setEstadoExpediente(v as typeof estadoExpediente)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abiertos">Abierto ({abiertos.length})</SelectItem>
                    <SelectItem value="cerrados">Cerrado ({cerrados.length})</SelectItem>
                    <SelectItem value="todos">Todos ({data.length})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <Select value={filterEstado} onValueChange={setFilterEstado}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos ({baseData.length})</SelectItem>
                    {ESTADOS_PROCESO.map((e) => (
                      <SelectItem key={e} value={e}>{properCase(e)} ({countIn(baseData, (p) => p.estado, e)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Gravedad</label>
                <Select value={filterGravedad} onValueChange={setFilterGravedad}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas ({baseData.length})</SelectItem>
                    {GRAVEDADES_PROCESO.map((g) => (
                      <SelectItem key={g} value={g}>{properCase(g)} ({countIn(baseData, (p) => p.gravedad, g)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos ({baseData.length})</SelectItem>
                    {TIPOS_PROCESO.map((t2) => (
                      <SelectItem key={t2} value={t2}>{t2} ({countIn(baseData, (p) => p.tipo, t2)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Responsable</label>
                <Select value={filterJuridico} onValueChange={setFilterJuridico}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos ({baseData.length})</SelectItem>
                    {JURIDICOS.map((j) => (
                      <SelectItem key={j} value={j}>{j} ({countIn(baseData, (p) => p.juridico, j)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="icon"
            variant={showConfig ? "default" : "ghost"}
            className="h-8 w-8"
            onClick={() => setShowConfig((v) => !v)}
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>

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
                    {["EXPEDIENTE", "TIPO", "RESPONSABLE", "FECHA", "ESTADO", "GRAVEDAD", "PDF", ""].map((h) => (
                      <th key={h || "actions"} className="text-left px-3 py-3 text-xs font-bold text-muted-foreground tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(item)}>
                      <td className="px-3 py-2.5 max-w-[280px]">
                        <span className="font-medium text-foreground line-clamp-2">{item.titulo}</span>
                        <span className="text-[11px] text-muted-foreground block">{item.empresa}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{item.tipo}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{item.juridico}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">{item.fecha}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Select value={item.estado} onValueChange={(v) => updateField(item.id, "estado", v)}>
                          <SelectTrigger className="h-8 text-xs w-[130px] border-0 p-0">
                            <EstadoProcesoBadge value={item.estado} />
                          </SelectTrigger>
                          <SelectContent>{ESTADOS_PROCESO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Select value={item.gravedad} onValueChange={(v) => updateField(item.id, "gravedad", v)}>
                          <SelectTrigger className="h-8 text-xs w-[120px] border-0 p-0">
                            <GravedadProcesoBadge value={item.gravedad} />
                          </SelectTrigger>
                          <SelectContent>{GRAVEDADES_PROCESO.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
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
