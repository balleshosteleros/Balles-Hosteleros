"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getProcesosPorEmpresa, ESTADOS_PROCESO, GRAVEDADES_PROCESO, TIPOS_PROCESO, JURIDICOS,
  type ProcesoJuridico, type EstadoProceso, type ActualizacionProceso, type DocumentoProceso,
} from "@/features/juridico/data/procesos-juridicos";
import { EstadoProcesoBadge, GravedadProcesoBadge } from "@/features/juridico/components/BadgesProceso";
import { DetalleProceso } from "@/features/juridico/components/DetalleProceso";
import { ProcesoModal } from "@/features/juridico/components/ProcesoModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Search, Info, FileText, Settings2 } from "lucide-react";

const ALL = "__ALL__";

export function ProcesosView() {
  const pathname = usePathname();
  useEffect(() => { sessionStorage.setItem("juridico_last", pathname); }, [pathname]);
  const { empresaActual } = useEmpresa();
  const [data, setData] = useState<ProcesoJuridico[]>(() => getProcesosPorEmpresa(empresaActual.id));
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState(ALL);
  const [filterGravedad, setFilterGravedad] = useState(ALL);
  const [filterTipo, setFilterTipo] = useState(ALL);
  const [filterJuridico, setFilterJuridico] = useState(ALL);
  const [tab, setTab] = useState<"abiertos" | "cerrados" | "config">("abiertos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProcesoJuridico | null>(null);
  const [detalleItem, setDetalleItem] = useState<ProcesoJuridico | null>(null);

  useMemo(() => {
    setData(getProcesosPorEmpresa(empresaActual.id));
  }, [empresaActual.id]);

  const isCerrado = (e: EstadoProceso) => e === "CERRADO" || e === "ARCHIVADO";

  const baseData = tab === "cerrados" ? data.filter((p) => isCerrado(p.estado)) : tab === "abiertos" ? data.filter((p) => !isCerrado(p.estado)) : data;

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

  const counts: Record<string, number> = {};
  ESTADOS_PROCESO.forEach((e) => { counts[e] = data.filter((p) => p.estado === e).length; });
  const gravityCounts: Record<string, number> = {};
  GRAVEDADES_PROCESO.forEach((g) => { gravityCounts[g] = data.filter((p) => p.gravedad === g).length; });

  const handleSave = (item: ProcesoJuridico) => {
    setData((prev) => {
      const exists = prev.find((p) => p.id === item.id);
      if (exists) return prev.map((p) => (p.id === item.id ? item : p));
      return [item, ...prev];
    });
  };

  const updateField = (id: string, field: keyof ProcesoJuridico, value: string) => {
    setData((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
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

  const openEdit = (item: ProcesoJuridico) => { setEditItem(item); setModalOpen(true); };
  const openNew = () => { setEditItem(null); setModalOpen(true); };

  const estadoCards: { key: EstadoProceso; color: string }[] = [
    { key: "PENDIENTE", color: "border-status-pending bg-status-pending/10 text-status-pending" },
    { key: "EN PROCESO", color: "border-status-progress bg-status-progress/10 text-status-progress" },
    { key: "REVISIÓN", color: "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" },
    { key: "ESCALADO", color: "border-status-escalated bg-status-escalated/10 text-status-escalated" },
    { key: "CERRADO", color: "border-status-done bg-status-done/10 text-status-done" },
    { key: "ARCHIVADO", color: "border-border bg-muted text-muted-foreground" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-end">
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> NUEVO EXPEDIENTE</Button>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {estadoCards.map((s) => (
          <div key={s.key} className={`rounded-lg border-2 p-3 text-center ${s.color}`}>
            <div className="text-2xl font-black">{counts[s.key]}</div>
            <div className="text-[10px] font-bold mt-0.5">{s.key}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {GRAVEDADES_PROCESO.map((g) => (
          <div key={g} className="rounded-lg border bg-card p-3 text-center">
            <GravedadProcesoBadge value={g} />
            <div className="text-xl font-bold mt-1 text-foreground">{gravityCounts[g]}</div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="abiertos" className="gap-1.5">
            Abiertos <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{abiertos.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="cerrados" className="gap-1.5">
            Cerrados <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{cerrados.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5"><Settings2 className="h-4 w-4" /> Configuración</TabsTrigger>
        </TabsList>

        {(["abiertos", "cerrados"] as const).map((t) => (
          <TabsContent key={t} value={t} className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg border p-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar expedientes…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {ESTADOS_PROCESO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterGravedad} onValueChange={setFilterGravedad}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Gravedad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {GRAVEDADES_PROCESO.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {TIPOS_PROCESO.map((t2) => <SelectItem key={t2} value={t2}>{t2}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterJuridico} onValueChange={setFilterJuridico}>
                <SelectTrigger className="w-[210px]"><SelectValue placeholder="Jurídico" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {JURIDICOS.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-card rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["EXPEDIENTE", "TIPO", "JURÍDICO", "FECHA", "ESTADO", "GRAVEDAD", "PDF", ""].map((h) => (
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
          </TabsContent>
        ))}

        <TabsContent value="config" className="mt-4 space-y-4">
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
        </TabsContent>
      </Tabs>

      <ProcesoModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} item={editItem} empresa={empresaActual.nombre} empresaId={empresaActual.id} />
      {detalleItem && (
        <DetalleProceso open={!!detalleItem} onClose={() => setDetalleItem(null)} item={detalleItem} onAddActualizacion={addActualizacion} onAddDocumento={addDocumento} />
      )}
    </div>
  );
}
