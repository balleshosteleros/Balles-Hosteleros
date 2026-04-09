import { useState, useMemo } from "react";
import {
  Incidencia, Actualizacion, LOCALES, ESTADOS, GRAVEDADES, AREAS, REPARADORES,
  Estado, Gravedad,
} from "@/data/mantenimiento";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { StatusBadge, GravedadBadge } from "@/components/mantenimiento/Badges";
import { IncidenciaModal } from "@/components/mantenimiento/IncidenciaModal";
import { DetalleIncidencia } from "@/components/mantenimiento/DetalleIncidencia";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Wrench, CalendarDays, Info } from "lucide-react";

const ALL = "__ALL__";
type FiltroPeriodo = "semana" | "mes" | "trimestre" | "inicio";

function getLastNaturalQuarterRange(): [Date, Date] {
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3); // 0=Q1, 1=Q2, 2=Q3, 3=Q4
  const prevQ = currentQ === 0 ? 3 : currentQ - 1;
  const year = currentQ === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const start = new Date(year, prevQ * 3, 1);
  const end = new Date(year, prevQ * 3 + 3, 0, 23, 59, 59, 999);
  return [start, end];
}

function filterByPeriodo(fecha: string, periodo: FiltroPeriodo): boolean {
  if (periodo === "inicio") return true;
  const d = new Date(fecha);
  const now = new Date();
  if (periodo === "semana") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }
  if (periodo === "mes") {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return d >= monthAgo;
  }
  if (periodo === "trimestre") {
    const [start, end] = getLastNaturalQuarterRange();
    return d >= start && d <= end;
  }
  return true;
}

export default function Mantenimiento() {
  const { datos: data, setDatos: setData } = useEmpresa();
  const [search, setSearch] = useState("");
  const [filterLocal, setFilterLocal] = useState(ALL);
  const [filterEstado, setFilterEstado] = useState(ALL);
  const [filterGravedad, setFilterGravedad] = useState(ALL);
  const [filterReparador, setFilterReparador] = useState(ALL);
  const [filterPeriodo, setFilterPeriodo] = useState<FiltroPeriodo>("inicio");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Incidencia | null>(null);
  const [detalleItem, setDetalleItem] = useState<Incidencia | null>(null);

  const filtered = useMemo(() => {
    return data.filter((i) => {
      if (filterLocal !== ALL && i.local !== filterLocal) return false;
      if (filterEstado !== ALL && i.estado !== filterEstado) return false;
      if (filterGravedad !== ALL && i.gravedad !== filterGravedad) return false;
      if (filterReparador !== ALL && i.reparador !== filterReparador) return false;
      if (!filterByPeriodo(i.fechaPublicado, filterPeriodo)) return false;
      if (search) {
        const s = search.toLowerCase();
        return i.desperfecto.toLowerCase().includes(s) || i.comentarios.toLowerCase().includes(s) || i.local.toLowerCase().includes(s);
      }
      return true;
    });
  }, [data, search, filterLocal, filterEstado, filterGravedad, filterReparador, filterPeriodo]);

  const counts = useMemo(() => ({
    PENDIENTE: data.filter((i) => i.estado === "PENDIENTE").length,
    "EN PROGRESO": data.filter((i) => i.estado === "EN PROGRESO").length,
    ESCALADO: data.filter((i) => i.estado === "ESCALADO").length,
    TERMINADO: data.filter((i) => i.estado === "TERMINADO").length,
  }), [data]);

  const gravityCounts = useMemo(() => ({
    LEVE: data.filter((i) => i.gravedad === "LEVE").length,
    MEJORA: data.filter((i) => i.gravedad === "MEJORA").length,
    GRAVE: data.filter((i) => i.gravedad === "GRAVE").length,
    "MUY GRAVE": data.filter((i) => i.gravedad === "MUY GRAVE").length,
  }), [data]);

  const updateField = (id: string, field: keyof Incidencia, value: string) => {
    setData((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleSave = (item: Incidencia) => {
    setData((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) return prev.map((i) => (i.id === item.id ? item : i));
      return [item, ...prev];
    });
  };

  const openDetail = (item: Incidencia) => {
    setEditItem(item);
    setModalOpen(true);
  };

  const openNew = () => {
    setEditItem(null);
    setModalOpen(true);
  };

  const addActualizacion = (incidenciaId: string, act: Actualizacion) => {
    setData((prev) => prev.map((i) => {
      if (i.id !== incidenciaId) return i;
      const updated = { ...i, actualizaciones: [...i.actualizaciones, act] };
      // Also update detalleItem so the panel refreshes
      setDetalleItem(updated);
      return updated;
    }));
  };

  const statCards: { label: string; key: Estado; color: string }[] = [
    { label: "PENDIENTE", key: "PENDIENTE", color: "border-status-pending bg-status-pending/10 text-status-pending" },
    { label: "EN PROGRESO", key: "EN PROGRESO", color: "border-status-progress bg-status-progress/10 text-status-progress" },
    { label: "ESCALADO", key: "ESCALADO", color: "border-status-escalated bg-status-escalated/10 text-status-escalated" },
    { label: "TERMINADO", key: "TERMINADO", color: "border-status-done bg-status-done/10 text-status-done" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">MANTENIMIENTO</h1>
            <p className="text-sm text-muted-foreground">Control de incidencias y desperfectos</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> NUEVA INCIDENCIA
        </Button>
      </div>

      {/* Stats by Estado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.key} className={`rounded-lg border-2 p-4 text-center ${s.color}`}>
            <div className="text-3xl font-black">{counts[s.key]}</div>
            <div className="text-xs font-bold mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Stats by Gravedad */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["LEVE", "MEJORA", "GRAVE", "MUY GRAVE"] as Gravedad[]).map((g) => (
          <div key={g} className="rounded-lg border bg-card p-3 text-center">
            <GravedadBadge value={g} />
            <div className="text-xl font-bold mt-1 text-foreground">{gravityCounts[g]}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg border p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar incidencias..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterLocal} onValueChange={setFilterLocal}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="LOCAL" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>TODOS</SelectItem>
            {LOCALES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="ESTADO" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>TODOS</SelectItem>
            {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterGravedad} onValueChange={setFilterGravedad}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="GRAVEDAD" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>TODAS</SelectItem>
            {GRAVEDADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterReparador} onValueChange={setFilterReparador}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="REPARADOR" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>TODOS</SelectItem>
            {REPARADORES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPeriodo} onValueChange={(v) => setFilterPeriodo(v as FiltroPeriodo)}>
          <SelectTrigger className="w-[170px]"><CalendarDays className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="PERÍODO" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="inicio">Desde el inicio</SelectItem>
            <SelectItem value="semana">Última semana</SelectItem>
            <SelectItem value="mes">Último mes</SelectItem>
            <SelectItem value="trimestre">Último trimestre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["DESPERFECTO", "LOCAL", "ESTADO", "GRAVEDAD", "APUNTA DESPERFECTO", "REPARADOR", "FECHA PUBLICADO", "COMENTARIOS", ""].map((h) => (
                <th key={h || "actions"} className="text-left px-3 py-3 text-xs font-bold text-muted-foreground tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openDetail(item)}>
                <td className="px-3 py-2.5 max-w-[250px]">
                  <span className="font-medium text-foreground line-clamp-2">{item.desperfecto}</span>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Select value={item.local} onValueChange={(v) => updateField(item.id, "local", v)}>
                    <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCALES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Select value={item.estado} onValueChange={(v) => updateField(item.id, "estado", v)}>
                    <SelectTrigger className="h-8 text-xs w-[130px] border-0 p-0">
                      <StatusBadge value={item.estado} />
                    </SelectTrigger>
                    <SelectContent>{ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Select value={item.gravedad} onValueChange={(v) => updateField(item.id, "gravedad", v)}>
                    <SelectTrigger className="h-8 text-xs w-[120px] border-0 p-0">
                      <GravedadBadge value={item.gravedad} />
                    </SelectTrigger>
                    <SelectContent>{GRAVEDADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Select value={item.apuntaDesperfecto} onValueChange={(v) => updateField(item.id, "apuntaDesperfecto", v)}>
                    <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Select value={item.reparador} onValueChange={(v) => updateField(item.id, "reparador", v)}>
                    <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{REPARADORES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <Input type="date" value={item.fechaPublicado} onChange={(e) => updateField(item.id, "fechaPublicado", e.target.value)} className="h-8 text-xs w-[130px]" />
                </td>
                <td className="px-3 py-2.5 max-w-[200px]">
                  <span className="text-xs text-muted-foreground line-clamp-2">{item.comentarios}</span>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary hover:text-primary" onClick={() => setDetalleItem(item)}>
                    <Info className="h-3.5 w-3.5" /> MÁS INFO
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No se encontraron incidencias con los filtros aplicados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-muted-foreground text-right">{filtered.length} de {data.length} incidencias</div>

      <IncidenciaModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} item={editItem} />
      {detalleItem && (
        <DetalleIncidencia open={!!detalleItem} onClose={() => setDetalleItem(null)} item={detalleItem} onAddActualizacion={addActualizacion} />
      )}
    </div>
  );
}
