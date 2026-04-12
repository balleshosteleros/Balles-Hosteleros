"use client";

import { useState, useMemo } from "react";
import {
  type Incidencia, type Actualizacion, LOCALES, ESTADOS, GRAVEDADES, AREAS, REPARADORES,
  type Estado, type Gravedad,
} from "@/features/empresa/data/mantenimiento";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { StatusBadge, GravedadBadge } from "@/features/mantenimiento/components/Badges";
import { IncidenciaModal } from "@/features/mantenimiento/components/IncidenciaModal";
import { DetalleIncidencia } from "@/features/mantenimiento/components/DetalleIncidencia";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, CalendarDays, Info } from "lucide-react";

const ALL = "__ALL__";
type FiltroPeriodo = "semana" | "mes" | "trimestre" | "inicio";

function getLastNaturalQuarterRange(): [Date, Date] {
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3);
  const prevQ = currentQ === 0 ? 3 : currentQ - 1;
  const year = currentQ === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return [new Date(year, prevQ * 3, 1), new Date(year, prevQ * 3 + 3, 0, 23, 59, 59, 999)];
}

function filterByPeriodo(fecha: string, periodo: FiltroPeriodo): boolean {
  if (periodo === "inicio") return true;
  const d = new Date(fecha);
  const now = new Date();
  if (periodo === "semana") { const w = new Date(now); w.setDate(w.getDate() - 7); return d >= w; }
  if (periodo === "mes") { const m = new Date(now); m.setMonth(m.getMonth() - 1); return d >= m; }
  if (periodo === "trimestre") { const [s, e] = getLastNaturalQuarterRange(); return d >= s && d <= e; }
  return true;
}

export function MantenimientoView() {
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

  const filtered = useMemo(() => data.filter((i) => {
    if (filterLocal !== ALL && i.local !== filterLocal) return false;
    if (filterEstado !== ALL && i.estado !== filterEstado) return false;
    if (filterGravedad !== ALL && i.gravedad !== filterGravedad) return false;
    if (filterReparador !== ALL && i.reparador !== filterReparador) return false;
    if (!filterByPeriodo(i.fechaPublicado, filterPeriodo)) return false;
    if (search) { const s = search.toLowerCase(); return i.desperfecto.toLowerCase().includes(s) || i.comentarios.toLowerCase().includes(s) || i.local.toLowerCase().includes(s); }
    return true;
  }), [data, search, filterLocal, filterEstado, filterGravedad, filterReparador, filterPeriodo]);

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

  const updateField = (id: string, field: keyof Incidencia, value: string) =>
    setData((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));

  const handleSave = (item: Incidencia) =>
    setData((prev) => prev.find((i) => i.id === item.id) ? prev.map((i) => i.id === item.id ? item : i) : [item, ...prev]);

  const addActualizacion = (incidenciaId: string, act: Actualizacion) =>
    setData((prev) => prev.map((i) => {
      if (i.id !== incidenciaId) return i;
      const updated = { ...i, actualizaciones: [...i.actualizaciones, act] };
      setDetalleItem(updated);
      return updated;
    }));

  const statCards: { label: string; key: Estado; color: string }[] = [
    { label: "PENDIENTE", key: "PENDIENTE", color: "border-status-pending bg-status-pending/10 text-status-pending" },
    { label: "EN PROGRESO", key: "EN PROGRESO", color: "border-status-progress bg-status-progress/10 text-status-progress" },
    { label: "ESCALADO", key: "ESCALADO", color: "border-status-escalated bg-status-escalated/10 text-status-escalated" },
    { label: "TERMINADO", key: "TERMINADO", color: "border-status-done bg-status-done/10 text-status-done" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-end">
        <Button onClick={() => { setEditItem(null); setModalOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> NUEVA INCIDENCIA
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.key} className={`rounded-lg border-2 p-4 text-center ${s.color}`}>
            <div className="text-3xl font-black">{counts[s.key]}</div>
            <div className="text-xs font-bold mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["LEVE", "MEJORA", "GRAVE", "MUY GRAVE"] as Gravedad[]).map((g) => (
          <div key={g} className="rounded-lg border bg-card p-3 text-center">
            <GravedadBadge value={g} />
            <div className="text-xl font-bold mt-1 text-foreground">{gravityCounts[g]}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg border p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar incidencias..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {[
          { value: filterLocal, onChange: setFilterLocal, placeholder: "LOCAL", items: LOCALES },
          { value: filterEstado, onChange: setFilterEstado, placeholder: "ESTADO", items: ESTADOS },
          { value: filterGravedad, onChange: setFilterGravedad, placeholder: "GRAVEDAD", items: GRAVEDADES },
          { value: filterReparador, onChange: setFilterReparador, placeholder: "REPARADOR", items: REPARADORES },
        ].map(({ value, onChange, placeholder, items }) => (
          <Select key={placeholder} value={value} onValueChange={onChange}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder={placeholder} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>TODOS</SelectItem>
              {items.map((it) => <SelectItem key={it} value={it}>{it}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
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

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["DESPERFECTO", "LOCAL", "ESTADO", "GRAVEDAD", "APUNTA DESPERFECTO", "REPARADOR", "FECHA", "COMENTARIOS", ""].map((h) => (
                <th key={h || "acc"} className="text-left px-3 py-3 text-xs font-bold text-muted-foreground tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => { setEditItem(item); setModalOpen(true); }}>
                <td className="px-3 py-2.5 max-w-[250px]"><span className="font-medium text-foreground line-clamp-2">{item.desperfecto}</span></td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Select value={item.local} onValueChange={(v) => updateField(item.id, "local", v)}>
                    <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCALES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Select value={item.estado} onValueChange={(v) => updateField(item.id, "estado", v)}>
                    <SelectTrigger className="h-8 text-xs w-[130px] border-0 p-0"><StatusBadge value={item.estado} /></SelectTrigger>
                    <SelectContent>{ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Select value={item.gravedad} onValueChange={(v) => updateField(item.id, "gravedad", v)}>
                    <SelectTrigger className="h-8 text-xs w-[120px] border-0 p-0"><GravedadBadge value={item.gravedad} /></SelectTrigger>
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
                <td className="px-3 py-2.5 max-w-[200px]"><span className="text-xs text-muted-foreground line-clamp-2">{item.comentarios}</span></td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary" onClick={() => setDetalleItem(item)}>
                    <Info className="h-3.5 w-3.5" /> MÁS INFO
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No se encontraron incidencias.</td></tr>
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
