"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_OPERACIONES } from "@/features/contabilidad/data/contabilidad";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { operacionesIO } from "@/features/contabilidad/io/operaciones.io";

const TABS = [
  { id: "TODAS", label: "Todas" },
  { id: "ENTRADA", label: "Entradas" },
  { id: "SALIDA", label: "Salidas" },
];

const perioLabel: Record<string, string> = { MENSUAL: "Cada mes", TRIMESTRAL: "Cada trimestre", ANUAL: "Cada año", PUNTUAL: "Puntual", SEMANAL: "Cada semana" };

export function OperacionesView() {
  const { empresaActual } = useEmpresa();
  const [tab, setTab] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [ops] = useState(SAMPLE_OPERACIONES);

  const contactosUsados = useMemo(
    () => [...new Set(ops.map(o => o.contacto).filter(Boolean))].sort(),
    [ops],
  );
  const etiquetasUsadas = useMemo(
    () => [...new Set(ops.flatMap(o => o.etiquetas))].sort(),
    [ops],
  );

  const acceso = (o: typeof ops[number], campo: string): unknown => {
    if (campo === "tipo") return o.tipo;
    if (campo === "periodicidad") return o.periodicidad;
    if (campo === "contacto") return o.contacto;
    if (campo === "etiquetas") return o.etiquetas;
    if (campo === "total") return o.total;
    if (campo === "descripcion") return o.descripcion;
    if (campo === "fechaFin") return o.fechaFin;
    return (o as unknown as Record<string, unknown>)[campo];
  };

  const filtradas = useMemo(() => {
    let lista = ops.filter(o => {
      if (tab !== "TODAS" && o.tipo !== tab) return false;
      const q = busqueda.toLowerCase();
      return !q || o.descripcion.toLowerCase().includes(q) || o.contacto.toLowerCase().includes(q);
    });
    // Filtro especial para etiquetas (array)
    const filtrosEtiqueta = filtros.filter(f => f.campo === "etiquetas");
    const otrosFiltros = filtros.filter(f => f.campo !== "etiquetas");
    lista = aplicarFiltrosToolbar(lista, otrosFiltros, acceso);
    if (filtrosEtiqueta.length > 0) {
      lista = lista.filter(o =>
        filtrosEtiqueta.every(f => f.valores?.some(v => o.etiquetas.includes(v))),
      );
    }
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [ops, tab, busqueda, filtros, orden]);

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
        <SubmoduleToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          placeholderBusqueda="Buscar operaciones…"
          onNuevo={() => { /* nuevo */ }}
          campos={[
            { campo: "tipo", label: "Tipo", tipo: "lista", opciones: ["ENTRADA", "SALIDA"] },
            { campo: "periodicidad", label: "Periodicidad", tipo: "lista", opciones: ["MENSUAL", "TRIMESTRAL", "ANUAL", "SEMANAL", "PUNTUAL"] },
            { campo: "contacto", label: "Contacto", tipo: "lista", opciones: contactosUsados },
            { campo: "etiquetas", label: "Etiquetas", tipo: "lista", opciones: etiquetasUsadas },
            { campo: "total", label: "Total €", tipo: "numero" },
          ]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenOpciones={[
            { campo: "descripcion", label: "Descripción" },
            { campo: "contacto", label: "Contacto" },
            { campo: "total", label: "Total" },
            { campo: "periodicidad", label: "Periodicidad" },
          ]}
          orden={orden}
          onOrdenChange={setOrden}
          columnas={[
            { campo: "descripcion", label: "Descripción" },
            { campo: "periodicidad", label: "Periodicidad" },
            { campo: "fechaFin", label: "Finaliza" },
            { campo: "etiquetas", label: "Etiquetas" },
            { campo: "total", label: "Total" },
          ]}
          columnasVisibles={columnasVisibles}
          onColumnasVisiblesChange={setColumnasVisibles}
          extraDerecha={
            <IOActions config={operacionesIO} onSuccess={() => window.location.reload()} />
          }
        />
      </div>

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
