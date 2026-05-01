"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Download, Sparkles, Paperclip, MoreVertical, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransaccionContable, TipoTransaccion } from "@/features/contabilidad/data/contabilidad";
import { listTransacciones } from "@/features/contabilidad/actions/contabilidad-actions";
import { FiltrosAvanzados, type FiltroActivo, type CampoFiltro } from "@/features/logistica/components/FiltrosAvanzados";
import { toast } from "sonner";

const TABS = [{ id: "TODAS", label: "Todas" }, { id: "COBRO", label: "Cobros" }, { id: "PAGO", label: "Pagos" }];

type CampoTransaccion = "tipo" | "banco" | "conciliada" | "importe" | "fecha";

function mapDbToTransaccion(row: Record<string, unknown>): TransaccionContable {
  return {
    id: row.id as string,
    concepto: (row.concepto as string) ?? "",
    banco: (row.banco as string) ?? "",
    fecha: (row.fecha as string) ?? "",
    importe: (row.importe as number) ?? 0,
    tipo: ((row.tipo as string) ?? "PAGO") as TipoTransaccion,
    etiquetas: Array.isArray(row.etiquetas) ? (row.etiquetas as { categoria: string; detalle: string; color: string }[]) : [],
    documentos: (row.documentos as number) ?? 0,
    conciliada: (row.conciliada as boolean) ?? false,
  };
}

export function TransaccionesView() {
  const { empresaActual } = useEmpresa();
  const [tab, setTab] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [txs, setTxs] = useState<TransaccionContable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<FiltroActivo<CampoTransaccion>[]>([]);
  const [showConfig, setShowConfig] = useState(false);

  const loadTransacciones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTransacciones();
      if (res.ok) {
        setTxs(res.data.map(mapDbToTransaccion));
      } else {
        toast.error("Error al cargar transacciones");
      }
    } catch {
      toast.error("Error de conexion al cargar transacciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransacciones();
  }, [loadTransacciones]);

  const camposFiltro = useMemo((): CampoFiltro<CampoTransaccion>[] => {
    const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort();
    return [
      { campo: "tipo", label: "Tipo", tipo: "lista", opciones: ["COBRO", "PAGO"] },
      { campo: "banco", label: "Banco", tipo: "lista", opciones: uniq(txs.map(t => t.banco)) },
      { campo: "conciliada", label: "Estado", tipo: "lista", opciones: ["Conciliada", "Sin conciliar"] },
      { campo: "importe", label: "Importe €", tipo: "numero" },
      { campo: "fecha", label: "Fecha", tipo: "fecha" },
    ];
  }, [txs]);

  const filtradas = useMemo(() => txs.filter(t => {
    const matchTab = tab === "TODAS" || t.tipo === tab;
    if (!matchTab) return false;
    for (const f of filtros) {
      if (f.campo === "tipo" && f.valores?.length && !f.valores.includes(t.tipo)) return false;
      if (f.campo === "banco" && f.valores?.length && !f.valores.includes(t.banco)) return false;
      if (f.campo === "conciliada" && f.valores?.length) {
        const lbl = t.conciliada ? "Conciliada" : "Sin conciliar";
        if (!f.valores.includes(lbl)) return false;
      }
      if (f.campo === "importe" && f.numVal !== undefined) {
        if (f.operador === "mayor" && !(t.importe > f.numVal)) return false;
        if (f.operador === "menor" && !(t.importe < f.numVal)) return false;
        if (f.operador === "igual" && !(t.importe === f.numVal)) return false;
      }
      if (f.campo === "fecha") {
        if (f.desde && t.fecha < f.desde) return false;
        if (f.hasta && t.fecha > f.hasta) return false;
      }
    }
    const q = busqueda.toLowerCase();
    return !q || t.concepto.toLowerCase().includes(q) || t.banco.toLowerCase().includes(q);
  }), [txs, tab, busqueda, filtros]);

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
          <Button variant="primary" size="sm">
            <Plus className="h-4 w-4" />Nuevo
          </Button>
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar transacciones de todos tus bancos…" className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <FiltrosAvanzados campos={camposFiltro} filtros={filtros} onChange={setFiltros} />
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Descargar">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs">Desde el inicio</Button>
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" />Etiquetar con IA
          </Button>
          <Button size="icon" variant={showConfig ? "default" : "ghost"} className="h-8 w-8"
            onClick={() => setShowConfig(v => !v)} title="Configuración" aria-label="Configuración">
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {showConfig && (
        <div className="mx-6 mb-3 rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Configuración de transacciones — próximamente.</p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-4">
        <div className="text-[10px] text-muted-foreground mb-2">{filtradas.length} resultados</div>
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 font-medium">Concepto</th>
                <th className="px-3 py-3 font-medium">Etiquetas</th>
                <th className="px-3 py-3 font-medium">Fecha</th>
                <th className="px-3 py-3 font-medium">Documentos</th>
                <th className="px-3 py-3 font-medium text-right">Cantidad</th>
                <th className="px-3 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(t => (
                <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground text-xs font-mono">℞</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold">{t.concepto}</p>
                    <p className="text-[10px] text-muted-foreground">{t.banco}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {t.etiquetas.map((e, i) => (
                        <Badge key={i} className={cn("text-[9px] border", e.color)} variant="outline">
                          {e.categoria}{e.detalle ? ` · ${e.detalle}` : ""}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{t.fecha}</td>
                  <td className="px-3 py-3">
                    {t.documentos > 0 && (
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Paperclip className="h-3 w-3" />
                        <Badge variant="destructive" className="text-[9px] h-4 w-4 p-0 flex items-center justify-center rounded-full">{t.documentos}</Badge>
                      </span>
                    )}
                  </td>
                  <td className={cn("px-3 py-3 text-right font-mono font-semibold", t.importe >= 0 ? "text-emerald-600" : "")}>
                    {t.importe >= 0 ? "" : "↙ "}{t.importe.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                  </td>
                  <td className="px-3 py-3"><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No se encontraron transacciones.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
