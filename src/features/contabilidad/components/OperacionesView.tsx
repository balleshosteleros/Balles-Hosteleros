"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MoreVertical, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_OPERACIONES } from "@/features/contabilidad/data/contabilidad";
import { FiltrosAvanzados, type FiltroActivo, type CampoFiltro } from "@/features/logistica/components/FiltrosAvanzados";

const TABS = [
  { id: "TODAS", label: "Todas" },
  { id: "ENTRADA", label: "Entradas" },
  { id: "SALIDA", label: "Salidas" },
];

const perioLabel: Record<string, string> = { MENSUAL: "Cada mes", TRIMESTRAL: "Cada trimestre", ANUAL: "Cada año", PUNTUAL: "Puntual", SEMANAL: "Cada semana" };

type CampoOperacion = "tipo" | "periodicidad" | "contacto" | "etiquetas" | "total";

export function OperacionesView() {
  const { empresaActual } = useEmpresa();
  const [tab, setTab] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltroActivo<CampoOperacion>[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [ops] = useState(SAMPLE_OPERACIONES);

  const camposFiltro = useMemo((): CampoFiltro<CampoOperacion>[] => {
    const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort();
    const allEtiquetas = ops.flatMap(o => o.etiquetas);
    return [
      { campo: "tipo", label: "Tipo", tipo: "lista", opciones: ["ENTRADA", "SALIDA"] },
      { campo: "periodicidad", label: "Periodicidad", tipo: "lista", opciones: ["MENSUAL", "TRIMESTRAL", "ANUAL", "SEMANAL", "PUNTUAL"] },
      { campo: "contacto", label: "Contacto", tipo: "lista", opciones: uniq(ops.map(o => o.contacto)) },
      { campo: "etiquetas", label: "Etiquetas", tipo: "lista", opciones: uniq(allEtiquetas) },
      { campo: "total", label: "Total", tipo: "numero" },
    ];
  }, [ops]);

  const filtradas = useMemo(() => ops.filter(o => {
    const matchTab = tab === "TODAS" || o.tipo === tab;
    if (!matchTab) return false;
    for (const f of filtros) {
      if (f.campo === "tipo" && f.valores?.length && !f.valores.includes(o.tipo)) return false;
      if (f.campo === "periodicidad" && f.valores?.length && !f.valores.includes(o.periodicidad)) return false;
      if (f.campo === "contacto" && f.valores?.length && !f.valores.includes(o.contacto)) return false;
      if (f.campo === "etiquetas" && f.valores?.length && !f.valores.some(v => o.etiquetas.includes(v))) return false;
      if (f.campo === "total" && f.numVal !== undefined) {
        if (f.operador === "mayor" && !(o.total > f.numVal)) return false;
        if (f.operador === "menor" && !(o.total < f.numVal)) return false;
        if (f.operador === "igual" && !(o.total === f.numVal)) return false;
      }
    }
    const q = busqueda.toLowerCase();
    return !q || o.descripcion.toLowerCase().includes(q) || o.contacto.toLowerCase().includes(q);
  }), [ops, tab, busqueda, filtros]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Tabs */}
      <div className="border-b px-6 pt-4 flex items-center gap-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("pb-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3">
        <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg border p-3">
          <Button variant="primary" size="sm" onClick={() => { /* nuevo */ }}>
            <Plus className="h-4 w-4" />Nuevo
          </Button>
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar operaciones…" className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <FiltrosAvanzados campos={camposFiltro} filtros={filtros} onChange={setFiltros} />
          <Button size="icon" variant={showConfig ? "default" : "ghost"} className="h-8 w-8"
            onClick={() => setShowConfig(v => !v)} title="Configuración" aria-label="Configuración">
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {showConfig && (
        <div className="mx-6 mb-3 rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Configuración de operaciones — próximamente.</p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-4">
        <div className="text-[10px] text-muted-foreground mb-2">{filtradas.length} resultados</div>
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-3 py-3 font-medium">Descripción</th>
                <th className="px-3 py-3 font-medium">Periodicidad</th>
                <th className="px-3 py-3 font-medium">Finaliza</th>
                <th className="px-3 py-3 font-medium">Etiquetas</th>
                <th className="px-3 py-3 font-medium text-right">Total</th>
                <th className="px-3 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(o => (
                <tr key={o.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-semibold">{o.descripcion}</p>
                        <p className="text-[10px] text-muted-foreground">{o.contacto || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{perioLabel[o.periodicidad] ?? o.periodicidad}</td>
                  <td className="px-3 py-3 text-muted-foreground">{o.fechaFin || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {o.etiquetas.map(e => <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold">
                    {o.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                  </td>
                  <td className="px-3 py-3 flex gap-1 justify-end">
                    <Button variant="outline" size="sm" className="text-xs h-7">Ver facturas</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No se encontraron operaciones.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
